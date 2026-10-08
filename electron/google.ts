import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {DateTime} from 'luxon';
import type {AppData, Item, GoogleStatus} from '../shared/types';
import {toRRule} from '../shared/domain';

export interface GoogleRepository {
 getData():AppData; update(fn:(data:AppData)=>void):AppData;
 getMeta<T>(key:string):T|undefined; setMeta(key:string,value:unknown):void;
 enqueue(itemId:string,action?:'upsert'|'delete'):void;
 listOutbox():{id:number;itemId:string;action:'upsert'|'delete';attempts:number;error:string}[];
 removeOutbox(id:number):void; failOutbox(id:number,error:string):void;
}
export interface GoogleAdapters {
 safeStorage:{isEncryptionAvailable():boolean;encryptString(value:string):Buffer;decryptString(value:Buffer):string};
 openExternal(url:string):Promise<unknown>; getClientSecret?:()=>string;
 fetch?:typeof fetch; now?:()=>number; onChange?:()=>void; oauthTimeoutMs?:number;
}
type Tokens={access_token:string;refresh_token?:string;expiresAt:number};
type Event={id?:string;etag?:string;updated?:string;status?:string;summary?:string;description?:string;location?:string;start?:{date?:string;dateTime?:string;timeZone?:string};end?:{date?:string;dateTime?:string;timeZone?:string};recurrence?:string[];recurringEventId?:string;extendedProperties?:{private?:Record<string,string>};reminders?:{useDefault:boolean;overrides?:{method:string;minutes:number}[]}};
class GoogleHTTPError extends Error {constructor(public status:number,public retryAfter:number,message:string){super(message)}}
const api='https://www.googleapis.com/calendar/v3';
const key='google.tokens.encrypted';
const scopes=['openid','email','https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.calendars'];
const eventId=(id:string)=>'mt'+createHash('sha256').update(id).digest('hex');
const comparable=(e:Event)=>{
 const when=(value:Event['start'])=>value?.date?{date:value.date}:value?.dateTime?{dateTime:DateTime.fromISO(value.dateTime).toUTC().toISO(),...(e.recurrence?.length?{timeZone:value.timeZone||'UTC'}:{})}:null;
 return JSON.stringify({summary:e.summary||'',description:e.description||'',location:e.location||'',start:when(e.start),end:when(e.end),recurrence:[...(e.recurrence||[])].sort(),reminders:{useDefault:e.reminders?.useDefault||false,overrides:[...(e.reminders?.overrides||[])].map(r=>`${r.method}:${r.minutes}`).sort()}});
};
export function itemToGoogle(item:Item):Event {
 if(!item.date) throw new Error('Choose a date before syncing this task.');
 if(Object.keys(item.exceptions).length) throw new Error('Google sync of edited recurring occurrences is not supported. Keep this series local or remove its occurrence edits.');
 const start=DateTime.fromISO(`${item.date}T${item.time||'00:00'}`,{zone:item.timezone});
 if(!start.isValid) throw new Error('Invalid event date or time zone.');
 const end=item.end?DateTime.fromISO(`${item.date}T${item.end}`,{zone:item.timezone}):start.plus({hours:1});
 const recurrence:string[]=toRRule(item);
 return {summary:item.title,description:item.notes,location:item.location,start:item.time?{dateTime:start.toISO()!,timeZone:item.timezone}:{date:item.date},end:item.time?{dateTime:(end<=start?end.plus({days:1}):end).toISO()!,timeZone:item.timezone}:{date:start.plus({days:1}).toISODate()!},recurrence,extendedProperties:{private:{myTasksId:item.id,myTasksKind:item.kind}},reminders:{useDefault:false,overrides:item.reminderEnabled?item.reminders.slice(0,5).map(minutes=>({method:'popup',minutes})):[]}};
}
function remoteItem(event:Event,calendarId:string,base?:Item):Item {
 if(event.status==='cancelled'&&base)return {...base,deletedAt:new Date().toISOString(),syncState:'Synced',remoteEtag:event.etag||'',remoteUpdated:event.updated||base.remoteUpdated};
 const rawDate=event.start?.date||event.start?.dateTime?.slice(0,10)||'';
 const zone=event.start?.timeZone||base?.timezone||'UTC';
 const dateTime=event.start?.dateTime?DateTime.fromISO(event.start.dateTime,{zone}):null;
 const date=event.start?.date||dateTime?.toISODate()||rawDate;
 const rr=event.recurrence?.find(r=>r.startsWith('RRULE:'))||'';
 const freq=/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(rr)?.[1];
 const repeat=rr.includes('BYDAY=MO,TU,WE,TH,FR')?'Weekdays':({DAILY:'Daily',WEEKLY:'Weekly',MONTHLY:'Monthly',YEARLY:'Yearly'} as const)[freq as 'DAILY']||'Never';
 const now=new Date().toISOString();
 return {...base,id:base?.id||randomUUID(),kind:base?.kind||(event.extendedProperties?.private?.myTasksKind==='task'?'task':'event'),title:event.summary||'(Untitled)',date,time:dateTime?.toFormat('HH:mm')||'',end:event.end?.dateTime?DateTime.fromISO(event.end.dateTime,{zone}).toFormat('HH:mm'):'',timezone:zone,category:base?.category||'Other',priority:base?.priority||'Normal',notes:event.description||'',location:event.location||'',done:base?.done||false,repeat,interval:Number(/INTERVAL=(\d+)/.exec(rr)?.[1]||1),recurrenceEnd:/UNTIL=([^;]+)/.exec(rr)?.[1]?DateTime.fromISO(/UNTIL=([^;]+)/.exec(rr)![1],{zone}).toISODate()||'':'',recurrenceCount:Number(/COUNT=(\d+)/.exec(rr)?.[1])||null,completedDates:base?.completedDates||[],excludedDates:(event.recurrence||[]).filter(r=>r.startsWith('EXDATE')).flatMap(r=>(r.split(':')[1]||'').split(',').map(d=>`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`)),exceptions:base?.exceptions||{},reminders:event.reminders?.overrides?.map(r=>r.minutes)||[],reminderEnabled:!!event.reminders?.overrides?.length,synced:true,calendarId,syncState:'Synced',remoteId:event.id||'',remoteEtag:event.etag||'',remoteUpdated:event.updated||'',createdAt:base?.createdAt||now,updatedAt:now,order:base?.order||0,deletedAt:event.status==='cancelled'?now:null};
}
export class GoogleService {
 private fetcher:typeof fetch; private now:()=>number; private busy=false; private connecting=false;
 constructor(private repo:GoogleRepository,private adapters:GoogleAdapters){this.fetcher=adapters.fetch||fetch;this.now=adapters.now||Date.now;this.status({secureStorage:adapters.safeStorage.isEncryptionAvailable(),connected:adapters.safeStorage.isEncryptionAvailable()&&!!repo.getMeta(key),syncing:false});}
 private status(patch:Partial<GoogleStatus>){this.repo.update(d=>{Object.assign(d.google,patch);d.google.configured=!!d.settings.googleClientId});this.adapters.onChange?.();}
 private tokens():Tokens {const encrypted=this.repo.getMeta<string>(key);if(!encrypted)throw new Error('Connect Google Calendar first.');if(!this.adapters.safeStorage.isEncryptionAvailable())throw new Error('Windows secure credential storage is unavailable.');return JSON.parse(this.adapters.safeStorage.decryptString(Buffer.from(encrypted,'base64')));}
 private storeTokens(t:Tokens){if(!this.adapters.safeStorage.isEncryptionAvailable())throw new Error('Windows secure credential storage is unavailable; tokens were not saved.');this.repo.setMeta(key,this.adapters.safeStorage.encryptString(JSON.stringify(t)).toString('base64'));}
 private secret(){return this.adapters.getClientSecret?.()||this.repo.getData().settings.googleClientSecret||'';}
 private async tokenRequest(values:Record<string,string>){const settings=this.repo.getData().settings;const response=await this.fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({...values,client_id:settings.googleClientId,...(this.secret()?{client_secret:this.secret()}:{})})});if(!response.ok)throw new Error(`Google authorization failed (${response.status}). Reconnect your account.`);return await response.json() as Tokens&{expires_in:number};}
 private async request<T>(url:string,init:RequestInit={},retried=false):Promise<T>{let tokens=this.tokens();if(tokens.expiresAt<=this.now()+60000){if(!tokens.refresh_token)throw new Error('Authorization expired. Reconnect Google.');const refreshed=await this.tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token});tokens={...tokens,...refreshed,expiresAt:this.now()+refreshed.expires_in*1000};this.storeTokens(tokens);}const response=await this.fetcher(url,{...init,headers:{Authorization:`Bearer ${tokens.access_token}`,'Content-Type':'application/json',...init.headers}});if(response.status===401&&!retried){this.storeTokens({...tokens,expiresAt:0});return this.request(url,init,true);}if(!response.ok){const retry=response.headers.get('Retry-After');const seconds=retry?Number(retry):0;const delay=Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(retry||'')-this.now());throw new GoogleHTTPError(response.status,delay,`Google Calendar request failed (${response.status}).`);}return response.status===204?undefined as T:await response.json() as T;}
 async connect(){if(this.connecting)throw new Error('Google sign-in is already open.');if(!this.adapters.safeStorage.isEncryptionAvailable())throw new Error('Windows secure credential storage is unavailable. Sign-in is disabled.');if(!this.repo.getData().settings.googleClientId)throw new Error('Enter your Google Desktop OAuth client ID first.');this.connecting=true;
  try {const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');const server=createServer();await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const address=server.address();if(!address||typeof address==='string')throw new Error('Cannot open OAuth callback.');const redirect=`http://127.0.0.1:${address.port}`;
   let timer:ReturnType<typeof setTimeout>;const codePromise=new Promise<string>((resolve,reject)=>{timer=setTimeout(()=>{server.close();reject(new Error('Google sign-in timed out. Try again.'));},this.adapters.oauthTimeoutMs||180000);server.on('request',(req,res)=>{const url=new URL(req.url||'/',redirect);if(req.method!=='GET'||url.pathname!=='/'||url.searchParams.get('state')!==state){res.writeHead(400);res.end('Invalid sign-in callback');return;}const code=url.searchParams.get('code');clearTimeout(timer);server.close();res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('You can close this tab and return to My Tasks.');if(code)resolve(code);else reject(new Error('Google sign-in was cancelled.'));});});void codePromise.catch(()=>{});
   const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');auth.search=new URLSearchParams({client_id:this.repo.getData().settings.googleClientId,redirect_uri:redirect,response_type:'code',scope:scopes.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'offline',prompt:'consent'}).toString();let code:string;try{await this.adapters.openExternal(auth.toString());code=await codePromise;}catch(error){clearTimeout(timer!);server.close();throw error;}const t=await this.tokenRequest({grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier});this.storeTokens({...t,expiresAt:this.now()+t.expires_in*1000});const account=await this.request<{email:string}>('https://openidconnect.googleapis.com/v1/userinfo');this.status({connected:true,account:account.email,error:''});await this.listCalendars();
  }catch(e){this.status({error:(e as Error).message});throw e;}finally{this.connecting=false;}
 }
 async disconnect(){let revokeError='';try{const t=this.tokens();const response=await this.fetcher('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t.refresh_token||t.access_token})});if(!response.ok)revokeError='Disconnected locally. Google revocation failed; remove access in your Google account.';}catch{revokeError='Disconnected locally. Remove access in your Google account if needed.';}this.repo.setMeta(key,null);this.repo.update(d=>{d.items.forEach(i=>{if(i.synced)i.syncState='Disconnected'});});this.status({connected:false,account:'',calendars:[],error:revokeError});}
 async listCalendars(){const calendars:{id:string;summary:string}[]=[];let page='';do{const data=await this.request<{items:{id:string;summary:string;accessRole:string}[];nextPageToken?:string}>(`${api}/users/me/calendarList?minAccessRole=writer${page?`&pageToken=${encodeURIComponent(page)}`:''}`);calendars.push(...data.items.filter(c=>['writer','owner'].includes(c.accessRole)).map(({id,summary})=>({id,summary})));page=data.nextPageToken||'';}while(page);this.status({calendars});if(!this.repo.getData().settings.calendarId&&calendars.length)this.repo.update(d=>{d.settings.calendarId=calendars[0].id;});}
 async createCalendar(){const calendar=await this.request<{id:string;summary:string}>(`${api}/calendars`,{method:'POST',body:JSON.stringify({summary:'My Tasks',timeZone:this.repo.getData().settings.timezone})});this.repo.update(d=>{d.settings.calendarId=calendar.id;});await this.listCalendars();}
 private conflict(local:Item,remote:Item,reason:string){this.repo.update(d=>{d.conflicts=d.conflicts.filter(c=>c.itemId!==local.id);d.conflicts.push({id:randomUUID(),itemId:local.id,local:{...local},remote,reason});const i=d.items.find(x=>x.id===local.id);if(i)i.syncState='Conflict';});}
 async resolveConflict(id:string,choice:'local'|'remote'){
  const conflict=this.repo.getData().conflicts.find(c=>c.id===id);if(!conflict)throw new Error('Conflict no longer exists.');
  this.repo.update(d=>{const index=d.items.findIndex(i=>i.id===conflict.itemId);if(index>=0)d.items[index]=choice==='remote'?conflict.remote:{...conflict.local,remoteId:conflict.remote.deletedAt?'':conflict.remote.remoteId,remoteEtag:conflict.remote.deletedAt?'':conflict.remote.remoteEtag,syncState:'Pending sync'};d.conflicts=d.conflicts.filter(c=>c.id!==id);});
  this.repo.setMeta(`google.baseline.${conflict.itemId}`,comparable(itemToGoogle(conflict.remote)));
  for(const entry of this.repo.listOutbox().filter(e=>e.itemId===conflict.itemId))this.repo.removeOutbox(entry.id);
  if(choice==='local'){if(conflict.remote.deletedAt)this.repo.setMeta(`google.generation.${conflict.itemId}`,(this.repo.getMeta<number>(`google.generation.${conflict.itemId}`)||0)+1);this.repo.enqueue(conflict.itemId,conflict.local.deletedAt||!conflict.local.synced?'delete':'upsert');}
  this.adapters.onChange?.();
 }
 async sync(){
  if(this.busy)return;this.busy=true;this.status({syncing:true,error:''});
  try{
   this.tokens();await this.listCalendars();
   for(const entry of this.repo.listOutbox()){
    const item=this.repo.getData().items.find(i=>i.id===entry.itemId);
    if(!item){this.repo.removeOutbox(entry.id);continue;}
    if((this.repo.getMeta<number>(`google.retry.${entry.id}`)||0)>this.now()&&this.repo.getMeta<string>(`google.retryVersion.${entry.id}`)===item.updatedAt){this.status({error:'Some changes are waiting for their next retry.'});continue;}
    if(item.syncState==='Conflict')continue;
    try{
     await this.push(item,entry.action);
     if(this.repo.getData().items.find(i=>i.id===item.id)?.updatedAt===item.updatedAt)this.repo.removeOutbox(entry.id);
    }catch(e){
     const error=e as GoogleHTTPError;this.repo.failOutbox(entry.id,error.message);
     const delay=Math.min(3600000,1000*2**Math.min(entry.attempts,12));
     this.repo.setMeta(`google.retry.${entry.id}`,this.now()+Math.max(delay,error.retryAfter||0));
     this.repo.setMeta(`google.retryVersion.${entry.id}`,item.updatedAt);
     this.repo.update(d=>{const i=d.items.find(x=>x.id===item.id);if(i&&i.syncState!=='Conflict')i.syncState='Sync error';});
     this.status({error:error.message});
    }
   }
   if(this.repo.getData().settings.syncMode==='two-way'){
    const data=this.repo.getData();const calendars=new Set([data.settings.calendarId,...data.items.filter(i=>i.synced).map(i=>i.calendarId)].filter(Boolean));
    for(const calendar of calendars)await this.pull(calendar);
   }
   if(!this.repo.getData().google.error)this.status({lastSync:new Date(this.now()).toISOString()});
  }catch(e){this.status({error:(e as Error).message});throw e;}finally{this.busy=false;this.status({syncing:false});}
 }
 private async push(item:Item,action:'upsert'|'delete'){const settings=this.repo.getData().settings;const calendar=item.calendarId||settings.calendarId;if(!calendar)throw new Error('Choose a writable Google calendar.');const oldCalendar=this.repo.getMeta<string>(`google.calendar.${item.id}`);if(item.remoteId&&oldCalendar&&oldCalendar!==calendar)throw new Error('Unlink this event before changing its Google calendar.');const url=`${api}/calendars/${encodeURIComponent(calendar)}/events`;const generation=this.repo.getMeta<number>(`google.generation.${item.id}`)||0;const id=item.remoteId||eventId(generation?`${item.id}:${generation}`:item.id);const deleting=action==='delete'||!!item.deletedAt||(item.done&&!settings.syncCompleted);
 if(deleting){
  if(item.remoteId&&settings.deleteGoogle){try{await this.request(`${url}/${encodeURIComponent(id)}`,{method:'DELETE',headers:item.remoteEtag?{'If-Match':item.remoteEtag}:{}});}catch(e){
   if((e as GoogleHTTPError).status===412){const remote=await this.request<Event>(`${url}/${encodeURIComponent(id)}`);this.conflict(item,remoteItem(remote,calendar,item),'Google changed before this deletion.');return;}
   if((e as GoogleHTTPError).status!==404&&(e as GoogleHTTPError).status!==410)throw e;
  }}
  if(item.remoteId){this.repo.setMeta(`google.unlinked.${calendar}.${id}`,true);if(settings.deleteGoogle)this.repo.setMeta(`google.generation.${item.id}`,generation+1);}
  this.repo.update(d=>{const i=d.items.find(x=>x.id===item.id);if(i){i.synced=item.done&&!item.deletedAt&&action!=='delete';i.syncState='Local only';i.remoteId='';i.remoteEtag='';}});return;
 }
 const body=itemToGoogle(item);let event:Event;
 try{event=await this.request<Event>(item.remoteId?`${url}/${encodeURIComponent(id)}`:url,{method:item.remoteId?'PUT':'POST',headers:item.remoteEtag?{'If-Match':item.remoteEtag}:{},body:JSON.stringify({...body,id})});}
 catch(e){const status=(e as GoogleHTTPError).status;
  if(status===409&&!item.remoteId){const existing=await this.request<Event>(`${url}/${id}`);if(existing.extendedProperties?.private?.myTasksId!==item.id)throw new Error('Remote event ID collision.');if(comparable(existing)===comparable(body))event=existing;else{this.conflict(item,remoteItem(existing,calendar,item),'A previous upload exists with different content.');return;}}
  else if(status===412){const remote=await this.request<Event>(`${url}/${encodeURIComponent(id)}`);this.conflict(item,remoteItem(remote,calendar,item),'Both the local item and Google event changed.');return;}
  else if(item.remoteId&&[404,410].includes(status)){this.conflict(item,remoteItem({id:item.remoteId,status:'cancelled'},calendar,item),'The linked event was deleted in Google Calendar.');return;}
  else throw e;
 }
 this.repo.setMeta(`google.baseline.${item.id}`,comparable(event));this.repo.setMeta(`google.calendar.${item.id}`,calendar);this.repo.setMeta(`google.unlinked.${calendar}.${id}`,false);this.repo.update(d=>{const i=d.items.find(x=>x.id===item.id);if(i){i.remoteId=event.id||id;i.remoteEtag=event.etag||'';i.remoteUpdated=event.updated||'';i.calendarId=calendar;i.syncState=i.updatedAt===item.updatedAt?'Synced':'Pending sync';i.synced=true;}});
 }
 private async pull(calendar:string,recovered=false){const tokenKey=`google.syncToken.${calendar}`;const syncToken=this.repo.getMeta<string>(tokenKey);let page='';let next='';const events:Event[]=[];try{do{const params=new URLSearchParams({showDeleted:'true',maxResults:'2500'});if(syncToken)params.set('syncToken',syncToken);if(page)params.set('pageToken',page);const data=await this.request<{items:Event[];nextPageToken?:string;nextSyncToken?:string}>(`${api}/calendars/${encodeURIComponent(calendar)}/events?${params}`);events.push(...data.items);page=data.nextPageToken||'';next=data.nextSyncToken||next;}while(page);}catch(e){if((e as GoogleHTTPError).status===410&&!recovered){this.repo.setMeta(tokenKey,null);await this.pull(calendar,true);return;}throw e;}
 if(!syncToken){
  const missing=this.repo.getData().items.filter(i=>i.calendarId===calendar&&i.remoteId&&!events.some(e=>e.id===i.remoteId));
  for(const item of missing){try{events.push(await this.request<Event>(`${api}/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(item.remoteId)}`));}catch(e){if([404,410].includes((e as GoogleHTTPError).status))events.push({id:item.remoteId,status:'cancelled',etag:'deleted'});else throw e;}}
 }
 for(const event of events){
  if(event.recurringEventId){this.status({error:'Google occurrence exceptions are not imported. Edit this recurring series in Google Calendar.'});continue;}
  const data=this.repo.getData();const local=data.items.find(i=>i.calendarId===calendar&&i.remoteId===event.id);
  if(event.start?.date&&event.end?.date&&DateTime.fromISO(event.start.date).plus({days:1}).toISODate()!==event.end.date || event.start?.dateTime&&event.end?.dateTime&&DateTime.fromISO(event.start.dateTime,{zone:event.start.timeZone||'UTC'}).toISODate()!==DateTime.fromISO(event.end.dateTime,{zone:event.start.timeZone||'UTC'}).toISODate()){
   this.status({error:'A multi-day Google event cannot be represented locally and was left unchanged.'});continue;
  }
  const rule=(event.recurrence||[]).find(r=>r.startsWith('RRULE:'))||'';
  if(rule&&(!/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/.test(rule)||/BY(SETPOS|MONTHDAY|MONTH|HOUR|MINUTE|SECOND|YEARDAY|WEEKNO)=/.test(rule)||(/BYDAY=/.test(rule)&&!rule.includes('BYDAY=MO,TU,WE,TH,FR')))){
   this.status({error:'A Google event uses unsupported advanced recurrence and was left unchanged.'});continue;
  }
  if(!local){if(data.settings.importExisting&&calendar===data.settings.calendarId&&event.status!=='cancelled'&&!this.repo.getMeta(`google.unlinked.${calendar}.${event.id}`)){const imported=remoteItem(event,calendar);this.repo.update(d=>{d.items.push(imported)});this.repo.setMeta(`google.baseline.${imported.id}`,comparable(event));this.repo.setMeta(`google.calendar.${imported.id}`,calendar);}continue;}
  if(local.syncState==='Conflict'||event.etag===local.remoteEtag)continue;
  const pending=this.repo.listOutbox().some(e=>e.itemId===local.id);const baseline=this.repo.getMeta<string>(`google.baseline.${local.id}`);
  if(pending&&(!baseline||comparable(event)!==baseline)){this.conflict(local,remoteItem(event,calendar,local),'Google changed while a local edit was waiting to sync.');continue;}
  if(pending)continue;const remote=remoteItem(event,calendar,local);this.repo.update(d=>{const index=d.items.findIndex(i=>i.id===local.id);d.items[index]=remote;});this.repo.setMeta(`google.baseline.${local.id}`,comparable(event));
 }if(next)this.repo.setMeta(tokenKey,next);
 }
}
