import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { IANAZone } from 'luxon';
import type { AppData, Item, Settings } from '../shared/types';
import { validateItem } from '../shared/domain';
import { createInitialData } from '../shared/defaults';
import { normalizeBackup } from '../shared/backup';
import { migrate } from './migrations';

const date=z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/);const short=z.string().max(1000);const strings=z.array(short).max(10000);
export const settingsSchema=z.object({start:z.enum(['Home','Calendar','Focus','Categories','Tasks','Events','Reminders','Settings']),time:z.enum(['12','24']),week:z.enum(['Monday','Sunday']),timezone:short.refine(zone=>IANAZone.isValidZone(zone)),startWithWindows:z.boolean(),startMinimized:z.boolean(),closeToTray:z.boolean(),reducedMotion:z.boolean(),textScale:z.number().min(75).max(200),desktop:z.boolean(),inApp:z.boolean(),sound:z.boolean(),defaultReminders:z.array(z.number().int().min(0).max(40320)).max(5),googleClientId:short,googleClientSecret:short,calendarId:short,syncMode:z.enum(['two-way','push']),syncCompleted:z.boolean(),deleteGoogle:z.boolean(),importExisting:z.boolean()}).strict();
const itemShape={occurrenceDate:date.optional(),id:short.min(1),kind:z.enum(['task','event']),title:short.min(1),date,time:z.string().regex(/^(|\d{2}:\d{2})$/),end:z.string().max(40),timezone:short,category:short,priority:z.enum(['Low','Normal','High']),notes:z.string().max(100000),location:short,done:z.boolean(),repeat:z.enum(['Never','Daily','Weekdays','Weekly','Monthly','Yearly','Custom']),interval:z.number().int().min(1).max(1000),recurrenceEnd:z.string().max(10),recurrenceCount:z.number().int().min(1).max(100000).nullable(),completedDates:strings,excludedDates:strings,exceptions:z.record(z.string(),z.record(z.string(),z.unknown())),reminders:z.array(z.number().int().min(0).max(40320)).max(5),reminderEnabled:z.boolean(),synced:z.boolean(),calendarId:short,syncState:z.enum(['Local only','Pending sync','Synced','Sync error','Conflict','Disconnected']),remoteId:short,remoteEtag:short,remoteUpdated:short,createdAt:short,updatedAt:short,order:z.number().finite(),deletedAt:short.nullable()};
export const itemSchema=z.object(itemShape).strict().superRefine((item,ctx)=>{try{validateItem(item as Item);}catch(error){ctx.addIssue({code:'custom',message:String(error)});}});
export const categoriesSchema=z.array(z.object({id:short.min(1),name:short.min(1),icon:short,accent:short}).strict()).max(1000).refine(a=>new Set(a.map(c=>c.id)).size===a.length,'Duplicate categories');
export interface OutboxEntry {id:number;itemId:string;action:'upsert'|'delete';attempts:number;error:string}
export class Repository {
 private db:DatabaseSync;
 constructor(path:string){
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
  try{this.transaction(()=>{migrate(this.db);if(!this.db.prepare('SELECT id FROM state').get())this.db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(createInitialData()));})();}catch(error){this.db.close();throw error;}
 }
 private transaction<T>(fn:()=>T):()=>T{return()=>{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}};}
 getData():AppData{return JSON.parse((this.db.prepare('SELECT json FROM state WHERE id=1').get() as {json:string}).json);}
 update(mutator:(data:AppData)=>void):AppData{return this.transaction(()=>{const data=this.getData();mutator(data);data.settings.googleClientSecret='';this.db.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(data));return data;})();}
 getMeta<T=unknown>(key:string):T|undefined{const row=this.db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as {value:string}|undefined;return row?JSON.parse(row.value):undefined;}
 setMeta(key:string,value:unknown):void{if(value===undefined)this.db.prepare('DELETE FROM metadata WHERE key=?').run(key);else this.db.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
 enqueue(itemId:string,action:'upsert'|'delete'='upsert'):void{this.db.prepare('INSERT INTO outbox(itemId,action) VALUES(?,?) ON CONFLICT(itemId) DO UPDATE SET action=excluded.action').run(itemId,action);}
 listOutbox():OutboxEntry[]{return this.db.prepare('SELECT * FROM outbox ORDER BY id').all() as unknown as OutboxEntry[];}
 removeOutbox(id:number):void{this.db.prepare('DELETE FROM outbox WHERE id=?').run(id);}
 failOutbox(id:number,error:string):void{this.db.prepare('UPDATE outbox SET attempts=attempts+1,error=? WHERE id=?').run(error.slice(0,2000),id);}
 exportBackup():string{const data=this.getData();data.settings.googleClientSecret='';data.google={...data.google,connected:false,account:'',calendars:[],syncing:false};data.dataPath='';return JSON.stringify(data,null,2);}
 importBackup(raw:string):void{
  if(raw.length>50_000_000)throw new Error('Backup is too large');const input=normalizeBackup(JSON.parse(raw));
  const schema=z.object({version:z.literal(1),items:z.array(itemSchema).max(100000),categories:categoriesSchema,settings:settingsSchema,focus:z.object({duration:z.number().min(1).max(1440),remaining:z.number().min(0),deadline:z.number().nullable(),running:z.boolean(),task:short,goal:short,sessionId:short,history:z.array(z.object({id:short,date:short,minutes:z.number(),task:short,goal:short,completedAt:z.number()})).max(100000)}),reminders:z.array(z.unknown()),google:z.unknown(),conflicts:z.array(z.unknown()),dataPath:z.string()});
  const parsed=schema.parse(input);if(new Set(parsed.items.map(i=>i.id)).size!==parsed.items.length)throw new Error('Duplicate item identifiers');
  this.transaction(()=>{this.setMeta('backup.beforeImport',this.exportBackup());const old=this.getData();const next={...old,...parsed,reminders:[],conflicts:[],google:old.google,dataPath:old.dataPath} as AppData;next.settings.googleClientSecret='';next.focus.running=false;next.focus.deadline=null;for(const item of next.items){item.remoteId='';item.remoteEtag='';item.remoteUpdated='';item.synced=false;item.syncState='Local only';}this.db.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(next));this.db.exec('DELETE FROM outbox');})();
 }
 close():void{this.db.close();}
}





