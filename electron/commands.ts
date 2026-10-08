import { z } from 'zod';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { Repository,itemSchema,settingsSchema,categoriesSchema } from './repository';
import {toggleCompletion,focusRemaining,validateItem} from '../shared/domain';
import type {Command,Item} from '../shared/types';
import {googleSetupDestinations} from '../shared/google-guide';

const id=z.string().min(1).max(1000),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>DateTime.fromISO(value).isValid),scope=z.enum(['series','occurrence']).optional();
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('item.save'),item:itemSchema,scope,occurrenceDate:date.optional()}).strict(),
 z.object({type:z.literal('item.delete'),id,scope,occurrenceDate:date.optional()}).strict(),
 z.object({type:z.literal('item.restore'),id}).strict(),z.object({type:z.literal('item.complete'),id,date}).strict(),
 z.object({type:z.literal('item.reorder'),ids:z.array(id).max(100000)}).strict(),z.object({type:z.literal('categories.save'),categories:categoriesSchema,moveFrom:id.optional(),moveTo:id.optional()}).strict(),
 z.object({type:z.literal('settings.save'),settings:settingsSchema}).strict(),
 z.object({type:z.literal('focus.action'),action:z.enum(['start','pause','resume','stop','configure']),duration:z.number().min(1).max(1440).optional(),task:z.string().max(1000).optional(),goal:z.string().max(1000).optional()}).strict(),
 z.object({type:z.literal('reminder.snooze'),id}).strict(),z.object({type:z.literal('reminder.dismiss'),id}).strict(),
 z.object({type:z.literal('conflict.resolve'),id,choice:z.enum(['local','remote'])}).strict(),
 z.object({type:z.literal('google.openSetup'),destination:z.enum(googleSetupDestinations)}).strict(),
 ...(['notification.test','google.connect','google.disconnect','google.sync','google.createCalendar','data.export','data.import','data.openFolder'] as const).map(type=>z.object({type:z.literal(type)}).strict())
]);

export function applyCommand(repo:Repository,input:unknown):void {
 const c=commandSchema.parse(input) as Command;
  const changes:string[]=[];
  repo.update(d=>{
   const find=(itemId:string)=>{const item=d.items.find(i=>i.id===itemId);if(!item)throw new Error('Item no longer exists');return item;};
   const touch=(item:Item)=>{item.updatedAt=new Date().toISOString();if(item.synced)item.syncState='Pending sync';changes.push(item.id);};
   if(c.type==='item.save'){
    const old=d.items.find(i=>i.id===c.item.id);const saved=validateItem(c.item);
    if(old){saved.remoteId=old.remoteId;saved.remoteEtag=old.remoteEtag;saved.remoteUpdated=old.remoteUpdated;saved.createdAt=old.createdAt;saved.deletedAt=old.deletedAt;}
    else{saved.remoteId='';saved.remoteEtag='';saved.remoteUpdated='';saved.createdAt=new Date().toISOString();saved.deletedAt=null;}
    if(c.scope==='occurrence'){if(old?.synced)throw new Error('Edit the entire Google-linked series here, or edit this occurrence in Google Calendar. Individual edited occurrences are supported for local series.');if(!old||!c.occurrenceDate)throw new Error('Occurrence editing requires a series and date');const patch:Partial<Item>={};const base={...old,date:c.occurrenceDate};for(const key of ['title','date','time','end','timezone','category','priority','notes','location','reminders','reminderEnabled'] as const){if(JSON.stringify(saved[key])!==JSON.stringify(base[key]))(patch as Record<string,unknown>)[key]=saved[key];}if(Object.keys(patch).length)old.exceptions[c.occurrenceDate]=patch;else delete old.exceptions[c.occurrenceDate];touch(old);}
    else{delete saved.occurrenceDate;if(old?.synced&&!saved.synced&&old.remoteId)repo.enqueue(old.id,'delete');validateItem(saved);if(old)d.items[d.items.indexOf(old)]=saved;else d.items.push(saved);touch(saved);}
   }
   if(c.type==='item.delete'){const item=find(c.id);if(c.scope==='occurrence'){if(!c.occurrenceDate)throw new Error('Select an occurrence date');if(!item.excludedDates.includes(c.occurrenceDate))item.excludedDates.push(c.occurrenceDate);}else item.deletedAt=new Date().toISOString();touch(item);}
   if(c.type==='item.restore'){const item=find(c.id);item.deletedAt=null;touch(item);}
   if(c.type==='item.complete'){const item=find(c.id);const next=toggleCompletion(item,c.date);Object.assign(item,next);touch(item);}
   if(c.type==='item.reorder'){for(const [order,itemId] of c.ids.entries()){const item=find(itemId);item.order=order;touch(item);}}
   if(c.type==='categories.save'){if(c.moveFrom&&c.moveTo){if(!c.categories.some(cat=>cat.name===c.moveTo))throw new Error('Destination category does not exist');for(const item of d.items)if(item.category===c.moveFrom){item.category=c.moveTo;touch(item);}}d.categories=c.categories;}
   if(c.type==='settings.save'){
    if((c.settings.importExisting&&!d.settings.importExisting)||c.settings.calendarId!==d.settings.calendarId)repo.setMeta("google.syncToken."+c.settings.calendarId,undefined);
    const changed=c.settings.calendarId!==d.settings.calendarId||c.settings.syncCompleted!==d.settings.syncCompleted;
    d.settings={...c.settings,googleClientSecret:''};d.google.configured=!!d.settings.googleClientId;if(changed)for(const item of d.items)if(item.synced){touch(item);}
   }
   if(c.type==='focus.action'){
    const f=d.focus,now=Date.now();f.remaining=focusRemaining(f,now);
    if(c.action==='configure'){if(c.duration!==undefined){f.duration=c.duration;f.remaining=c.duration*60;}if(c.task!==undefined)f.task=c.task;if(c.goal!==undefined)f.goal=c.goal;f.running=false;f.deadline=null;}
    if(c.action==='start'||c.action==='resume'){if(c.action==='start'){f.remaining=f.duration*60;f.sessionId=randomUUID();}if(!f.sessionId)f.sessionId=randomUUID();f.running=true;f.deadline=now+f.remaining*1000;}
    if(c.action==='pause'){f.running=false;f.deadline=null;}
    if(c.action==='stop'){f.running=false;f.deadline=null;f.remaining=f.duration*60;f.sessionId='';}
   }
   for(const itemId of changes){const item=d.items.find(i=>i.id===itemId)!;if(item.synced)repo.enqueue(item.id,item.deletedAt?'delete':'upsert');}
  });
}
