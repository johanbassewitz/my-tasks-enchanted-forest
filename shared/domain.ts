import {DateTime,IANAZone} from 'luxon';
import type {Item,FocusState} from './types';

export function iso(date:Date=new Date()):string {
 if(!Number.isFinite(date.getTime())) throw new Error('Invalid date');
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const validDate=(s:string)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&DateTime.fromISO(s,{zone:'UTC'}).isValid;
export function shift(date:string,days:number):string {
 if(!validDate(date)||!Number.isInteger(days)) throw new Error('Enter a valid date and whole number of days');
 return DateTime.fromISO(date,{zone:'UTC'}).plus({days}).toISODate()!;
}
const validTime=(s:string)=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const minute=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));

export function validateItem(item:Item):Item {
 if(!item||typeof item!=='object') throw new Error('An item is required');
 if(typeof item.id!=='string'||!item.id||item.id.length>200) throw new Error('Item ID is required');
 if(!['task','event'].includes(item.kind)) throw new Error('Choose task or event');
 if(typeof item.title!=='string'||!item.title.trim()) throw new Error('A title is required');
 if(item.title.length>500) throw new Error('Title must be 500 characters or fewer');
 if(item.date!==''&&!validDate(item.date)) throw new Error('Enter a valid date (YYYY-MM-DD)');
 if(!item.date&&(item.kind==='event'||item.repeat!=='Never'||item.synced||item.time)) throw new Error('Choose a date for an event, a timed task, recurrence, or Google Calendar synchronization');
 if(item.time!==''&&!validTime(item.time)) throw new Error('Enter a valid start time (HH:mm)');
 if(item.end!==''&&!validTime(item.end)) throw new Error('Enter a valid end time (HH:mm)');
 if(item.end&&(!item.time||minute(item.end)<=minute(item.time))) throw new Error('End time must follow start time on the same day');
 if(typeof item.timezone!=='string'||!IANAZone.isValidZone(item.timezone)) throw new Error('Choose a valid IANA timezone');
 if(!['Low','Normal','High'].includes(item.priority)) throw new Error('Choose a valid priority');
 if(!['Never','Daily','Weekdays','Weekly','Monthly','Yearly','Custom'].includes(item.repeat)) throw new Error('Choose a valid repeat schedule');
 if(!Number.isInteger(item.interval)||item.interval<1||item.interval>999) throw new Error('Repeat interval must be a whole number from 1 to 999');
 if(item.recurrenceEnd&&(!validDate(item.recurrenceEnd)||item.recurrenceEnd<item.date)) throw new Error('Repeat end must be on or after the first date');
 if(item.recurrenceCount!==null&&(!Number.isInteger(item.recurrenceCount)||item.recurrenceCount<1||item.recurrenceCount>100000)) throw new Error('Repeat count must be between 1 and 100000');
 if(!Array.isArray(item.reminders)||item.reminders.length>5||item.reminders.some(x=>!Number.isInteger(x)||x<0||x>40320)) throw new Error('Use up to 5 reminders, from 0 to 40320 minutes before');
 for(const key of ['completedDates','excludedDates'] as const) if(!Array.isArray(item[key])||item[key].some(d=>!validDate(d))) throw new Error('Occurrence dates must be valid YYYY-MM-DD dates');
 for(const key of ['notes','location','category','calendarId','remoteId','remoteEtag','remoteUpdated','createdAt','updatedAt'] as const) if(typeof item[key]!=='string') throw new Error(`${key} must be text`);
 if(item.notes.length>100000||item.location.length>2000||item.category.length>200) throw new Error('Item text is too long');
 if(typeof item.done!=='boolean'||typeof item.synced!=='boolean'||typeof item.reminderEnabled!=='boolean'||!Number.isFinite(item.order)) throw new Error('Item status is invalid');
 if(!['Local only','Pending sync','Synced','Sync error','Conflict','Disconnected'].includes(item.syncState)) throw new Error('Sync state is invalid');
 if(item.deletedAt!==null&&(typeof item.deletedAt!=='string'||!Number.isFinite(Date.parse(item.deletedAt)))) throw new Error('Trash date is invalid');
 if(!item.exceptions||typeof item.exceptions!=='object'||Array.isArray(item.exceptions)) throw new Error('Occurrence exceptions must be an object');
 const exceptions:Item['exceptions']={};
 for(const [date,patch] of Object.entries(item.exceptions)) {
  if(!validDate(date)||!patch||typeof patch!=='object'||Array.isArray(patch)||Object.prototype.hasOwnProperty.call(patch,'exceptions')) throw new Error('Occurrence exception is invalid');
  if(patch.id!==undefined&&patch.id!==item.id)throw new Error('Occurrence ID must match its series');
  const clean=validateItem({...item,...patch,id:item.id,exceptions:{}});
  exceptions[date]={...patch,...(patch.title!==undefined?{title:clean.title}:{})};
 }
 return {...item,title:item.title.trim(),reminders:[...new Set(item.reminders)].sort((a,b)=>a-b),completedDates:[...new Set(item.completedDates)],excludedDates:[...new Set(item.excludedDates)],exceptions};
}

// Recurrence arithmetic operates on floating calendar dates. UTC is used only
// to count calendar days; delivery uses the item's IANA wall-clock timezone.
function occurs(item:Item,date:string):boolean {
 if(date<item.date||item.excludedDates.includes(date)) return false;
 if(item.repeat==='Never') return item.date===date;
 if(item.recurrenceEnd&&date>item.recurrenceEnd)return false;
 const start=DateTime.fromISO(item.date,{zone:'UTC'}),target=DateTime.fromISO(date,{zone:'UTC'});
 const days=Math.round((target.toMillis()-start.toMillis())/86400000),interval=item.interval||1;
 let index=0;
 if(item.repeat==='Daily'||item.repeat==='Custom') {if(days%interval)return false;index=days/interval+1}
 else if(item.repeat==='Weekly') {if(days%(interval*7))return false;index=days/(interval*7)+1}
 else if(item.repeat==='Weekdays') {
  if(target.weekday>5)return false;
  const weeks=Math.round((days+start.weekday-target.weekday)/7);
  if(weeks%interval)return false;
  const first=5-Math.min(start.weekday-1,5);
  index=weeks===0?target.weekday-start.weekday+1:first+(weeks/interval-1)*5+target.weekday;
 }
 else if(item.repeat==='Monthly') {
  const months=(target.year-start.year)*12+target.month-start.month;
  if(target.day!==start.day||months%interval)return false;
  // Invalid dates are omitted rather than clamped to the month's final day.
  for(let offset=0;offset<=months;offset+=interval) {
   const month=start.startOf('month').plus({months:offset});
   if(start.day<=month.daysInMonth)index++;
  }
 }
 else if(item.repeat==='Yearly') {
  const years=target.year-start.year;
  if(target.month!==start.month||target.day!==start.day||years%interval)return false;
  for(let offset=0;offset<=years;offset+=interval) if(DateTime.fromObject({year:start.year+offset,month:start.month,day:start.day},{zone:'UTC'}).isValid)index++;
 }
 return index>0&&(!item.recurrenceCount||index<=item.recurrenceCount);
}
function originalDate(item:Item,date:string):string {
 return item.occurrenceDate??date;
}
export function isDone(item:Item,date:string):boolean {
 return item.repeat==='Never'?item.done:item.completedDates.includes(originalDate(item,date));
}
export function toggleCompletion(item:Item,date:string):Item {
 const key=originalDate(item,date);
 return {...item,...(item.repeat==='Never'?{done:!item.done}:{completedDates:isDone(item,date)?item.completedDates.filter(d=>d!==key):[...item.completedDates,key]}),updatedAt:new Date().toISOString()};
}
export function occurrenceItems(items:Item[],date:string):Item[] {
 if(!validDate(date)) throw new Error('Enter a valid occurrence date');
 const result:Item[]=[];
 for(const item of items) {
  if(item.deletedAt) continue;
  const keys=new Set([date,...Object.entries(item.exceptions).filter(([,p])=>p.date===date).map(([d])=>d)]);
  for(const key of keys) {
   if(!occurs(item,key)) continue;
   const patch=item.exceptions[key]??{};
   if(patch.deletedAt||(patch.date??key)!==date) continue;
   const instance={...item,...patch,date,occurrenceDate:key,done:item.repeat==='Never'?item.done:item.completedDates.includes(key)};
   result.push(instance);
  }
 }
 return result.sort((a,b)=>a.order-b.order||a.time.localeCompare(b.time));
}

export function scheduledAt(item:Item,date:string):number {
 if(!validDate(date)||!IANAZone.isValidZone(item.timezone)||item.time&&!validTime(item.time)) throw new Error('Cannot schedule an invalid date, time or timezone');
 const local=DateTime.fromISO(`${date}T${item.time||'09:00'}`,{zone:item.timezone});
 // Luxon advances a gap by its duration. Select earliest overlap explicitly.
 return Math.min(...local.getPossibleOffsets().map((d:{toMillis:()=>number})=>d.toMillis()));
}
function countThrough(item:Item,end:string):number {
 const start=DateTime.fromISO(item.date,{zone:'UTC'}),target=DateTime.fromISO(end,{zone:'UTC'}),interval=item.interval||1;
 const days=Math.round((target.toMillis()-start.toMillis())/86400000);
 if(days<0)return 0;
 if(item.repeat==='Daily'||item.repeat==='Custom')return Math.floor(days/interval)+1;
 if(item.repeat==='Weekly')return Math.floor(days/(7*interval))+1;
 if(item.repeat==='Weekdays') {
  const weeks=Math.floor((days+start.weekday-1)/7),cycles=Math.floor(weeks/interval),first=5-Math.min(start.weekday-1,5);
  if(weeks===0)return Math.max(0,Math.min(target.weekday,5)-start.weekday+1);
  if(cycles===0)return first;
  return first+(cycles-1)*5+(weeks%interval===0?Math.min(target.weekday,5):5);
 }
 let count=0;
 if(item.repeat==='Monthly') {
  const months=(target.year-start.year)*12+target.month-start.month;
  for(let offset=0;offset<=months;offset+=interval) {
   const month=start.startOf('month').plus({months:offset});
   if(start.day<=month.daysInMonth&&(offset<months||start.day<=target.day))count++;
  }
 } else if(item.repeat==='Yearly') {
  const years=target.year-start.year;
  for(let offset=0;offset<=years;offset+=interval) {
   const at=DateTime.fromObject({year:start.year+offset,month:start.month,day:start.day},{zone:'UTC'});
   if(at.isValid&&at.toMillis()<=target.toMillis())count++;
  }
 }
 return count;
}
export function toRRule(item:Item):string[] {
 if(item.repeat==='Never') return [];
 const freq=item.repeat==='Weekly'||item.repeat==='Weekdays'?'WEEKLY':item.repeat==='Monthly'?'MONTHLY':item.repeat==='Yearly'?'YEARLY':'DAILY';
 let rule=`RRULE:FREQ=${freq};INTERVAL=${item.interval||1}`;
 if(item.repeat==='Weekdays') rule+=';BYDAY=MO,TU,WE,TH,FR';
 if(item.recurrenceCount) rule+=`;COUNT=${item.recurrenceEnd?Math.min(item.recurrenceCount,countThrough(item,item.recurrenceEnd)):item.recurrenceCount}`;
 if(item.recurrenceEnd&&!item.recurrenceCount) rule+=`;UNTIL=${item.time?DateTime.fromISO(item.recurrenceEnd,{zone:item.timezone}).endOf('day').toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'"):item.recurrenceEnd.replaceAll('-','')}`;
 const out=[rule];
 if(item.excludedDates.length) out.push(item.time?`EXDATE;TZID=${item.timezone}:${item.excludedDates.map(d=>d.replaceAll('-','')+'T'+item.time.replace(':','')+'00').join(',')}`:`EXDATE;VALUE=DATE:${item.excludedDates.map(d=>d.replaceAll('-','')).join(',')}`);
 return out;
}

export function parseQuick(text:string,baseDate:string=iso()):Partial<Item> {
 let title=text.trim(); const result:Partial<Item>={date:baseDate};
 const take=(pattern:RegExp,fn:(m:RegExpMatchArray)=>void)=>{const m=title.match(pattern);if(m){fn(m);title=title.replace(m[0],' ').replace(/\s+/g,' ').trim()}};
 take(/\bremind(?:\s+me)?\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\s*(?:before)?\b/i,m=>{result.reminders=[Number(m[1])*(m[2].toLowerCase().startsWith('h')?60:m[2].toLowerCase().startsWith('d')?1440:1)];result.reminderEnabled=true});
 take(/\b(today|tomorrow)\b/i,m=>{result.date=m[1].toLowerCase()==='tomorrow'?shift(baseDate,1):baseDate});
 take(/\b\d{4}-\d{2}-\d{2}\b/,m=>{if(validDate(m[0])) result.date=m[0]});
 take(/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,m=>{const target=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(m[1].toLowerCase())+1;const delta=(target-DateTime.fromISO(baseDate).weekday+7)%7;result.date=shift(baseDate,delta||7)});
 take(/\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i,m=>{const h=Number(m[1]);if(h>=1&&h<=12)result.time=String(h%12+(m[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')+':'+(m[2]||'00')});
 if(!result.time) take(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/,m=>{result.time=m[1].padStart(2,'0')+':'+m[2]});
 take(/(?:^|\s)!(high|normal|low)\b/i,m=>{result.priority=(m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()) as Item['priority']});
 take(/\b(?:every\s+)?(daily|weekdays|weekly|monthly|yearly)\b/i,m=>{result.repeat=(m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()) as Item['repeat'];result.interval=1});
 take(/(?:^|\s)#([\w-]+)/,m=>{result.category=m[1]});
 return {...result,title};
}

export function calendarLanes(items:Item[]):{id:string;lane:number;lanes:number}[] {
 const timed=items.filter(x=>validTime(x.time)).map(x=>({id:x.id,start:minute(x.time),end:x.end&&validTime(x.end)?minute(x.end):Math.min(minute(x.time)+60,1440)})).sort((a,b)=>a.start-b.start||b.end-a.end||a.id.localeCompare(b.id));
 const output:{id:string;lane:number;lanes:number}[]=[];
 let group:typeof output=[],ends:number[]=[],boundary=-1;
 const flush=()=>{for(const entry of group)entry.lanes=ends.length;output.push(...group);group=[];ends=[]};
 for(const block of timed) {
  if(group.length&&block.start>=boundary){flush();boundary=-1}
  let lane=ends.findIndex(end=>end<=block.start);if(lane<0)lane=ends.length;
  ends[lane]=block.end;boundary=Math.max(boundary,block.end);group.push({id:block.id,lane,lanes:1});
 }
 flush();return output;
}
export function focusRemaining(focus:FocusState,now:number=Date.now()):number {
 return focus.running&&focus.deadline!==null?Math.max(0,Math.ceil((focus.deadline-now)/1000)):Math.max(0,focus.remaining);
}
export function advanceFocus(focus:FocusState,now:number=Date.now()):{focus:FocusState;completed:boolean} {
 const remaining=focusRemaining(focus,now);
 if(!focus.running||remaining>0)return {focus:{...focus,remaining},completed:false};
 const at=focus.deadline??now;
 const session={id:focus.sessionId,date:iso(new Date(at)),minutes:focus.duration,task:focus.task,goal:focus.goal,completedAt:at};
 return {focus:{...focus,running:false,deadline:null,remaining:0,history:focus.history.some(x=>x.id===session.id)?[...focus.history]:[...focus.history,session]},completed:true};
}
