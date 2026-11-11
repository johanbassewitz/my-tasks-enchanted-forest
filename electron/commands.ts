import {aiImportSchema} from '../shared/cloud';
import {studySchema,buildStudySchedule} from '../shared/study';
import {addonsSchema} from '../shared/addons';
import {newItem} from '../shared/defaults';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { Repository,itemSchema,phaseSchema,settingsSchema,categoriesSchema } from './repository';
import {toggleCompletion,toggleStep,focusRemaining,validateItem,validatePhase,isStepDone} from '../shared/domain';
import type {Command,Item} from '../shared/types';

const id=z.string().min(1).max(1000),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>DateTime.fromISO(value).isValid),scope=z.enum(['series','occurrence']).optional();
export const commandSchema=z.discriminatedUnion('type',[
 aiImportSchema.extend({type:z.literal('ai.import')}).strict(),
 z.object({type:z.literal('study.save'),study:studySchema}).strict(),
 z.object({type:z.literal('study.generate')}).strict(),
 z.object({type:z.literal('addons.save'),addons:addonsSchema}).strict(),
 z.object({type:z.literal('item.save'),item:itemSchema,scope,occurrenceDate:date.optional()}).strict(),
 z.object({type:z.literal('item.delete'),id,scope,occurrenceDate:date.optional()}).strict(),
 z.object({type:z.literal('item.restore'),id}).strict(),z.object({type:z.literal('item.complete'),id,date}).strict(),
 z.object({type:z.literal('item.reorder'),ids:z.array(id).max(100000)}).strict(),
 z.object({type:z.literal('step.complete'),id,stepId:id,date}).strict(),
 z.object({type:z.literal('phase.save'),phase:phaseSchema,position:z.number().int().min(0).max(10000).optional()}).strict(),z.object({type:z.literal('phase.delete'),id}).strict(),z.object({type:z.literal('categories.save'),categories:categoriesSchema,moveFrom:id.optional(),moveTo:id.optional()}).strict(),
 z.object({type:z.literal('settings.save'),settings:settingsSchema}).strict(),
 z.object({type:z.literal('focus.action'),action:z.enum(['start','pause','resume','stop','configure']),duration:z.number().min(1).max(1440).optional(),task:z.string().max(1000).optional(),goal:z.string().max(1000).optional()}).strict(),
 z.object({type:z.literal('reminder.snooze'),id}).strict(),z.object({type:z.literal('reminder.dismiss'),id}).strict(),
 ...(['notification.test','data.export','data.import','data.openFolder'] as const).map(type=>z.object({type:z.literal(type)}).strict())
]);

export function applyCommand(repo:Repository,input:unknown):void {
 const c=commandSchema.parse(input) as Command;
  repo.update(d=>{
   if(c.type==='ai.import'){
    const marker='ai-import:'+c.requestId;if(repo.getMeta(marker))return;
    if(d.items.length+c.tasks.length>100000)throw Error('The task limit has been reached.');
    for(const [index,suggestion] of c.tasks.entries()){
     const item={...newItem('task',suggestion.date),id:`ai-${c.requestId}-${index}`,title:suggestion.title,notes:`${suggestion.notes}\nEstimated focus: ${suggestion.minutes} minutes.`.trim(),timezone:d.settings.timezone,category:'Other',order:d.items.length};
     if(!d.items.some(existing=>existing.id===item.id))d.items.push(validateItem(item));
    }
    repo.setMeta(marker,true);
   }

   if(c.type==='addons.save')d.addons=c.addons;
   if(c.type==='study.save')d.study={...c.study,sessions:d.study.sessions};
   if(c.type==='study.generate'){
    const today=DateTime.now().setZone(d.settings.timezone).toISODate()!;
    const slots=buildStudySchedule(d.study,today);
    if(d.items.length+slots.length>100000||d.study.sessions.length+slots.length>50000)throw new Error('This plan is too large. Schedule fewer chapters.');
    for(const slot of slots){
     const task={...newItem('task',slot.date),title:slot.title,category:'Study',timezone:d.settings.timezone,notes:`Study for ${slot.minutes} minutes. Start a Focus session and select this task to track time.`,order:d.items.length};
     d.items.push(task);d.study.sessions.push({...slot,id:randomUUID(),taskId:task.id});
    }
   }

   const find=(itemId:string)=>{const item=d.items.find(i=>i.id===itemId);if(!item)throw new Error('Item no longer exists');return item;};
   const touch=(item:Item)=>{item.updatedAt=new Date().toISOString();};
   if(c.type==='item.save'){
    const old=d.items.find(i=>i.id===c.item.id);const saved=validateItem(c.item);
    if(saved.phaseId&&!d.phases.some(p=>p.id===saved.phaseId))throw new Error('That phase no longer exists. Choose another phase.');
    const studySession=d.study.sessions.find(session=>session.taskId===saved.id);
    if(studySession){
     if(saved.kind!=='task'||saved.repeat!=='Never'||!saved.date)throw new Error('Keep this study session as a dated, one-time task. Choose a date to move it.');
     if(c.scope==='occurrence')throw new Error('Edit the whole study task to move its study allocation.');
     studySession.date=saved.date;
    }

    // Ticking every step in the editor completes a one-time task, like ticking them in the list.
    const allSteps=(item:Item)=>item.steps.length>0&&item.steps.every(step=>isStepDone(item,step,item.date));
    if(saved.repeat==='Never'&&allSteps(saved)&&!(old&&old.repeat==='Never'&&allSteps(old)))saved.done=true;
    if(old){saved.remoteId=old.remoteId;saved.remoteEtag=old.remoteEtag;saved.remoteUpdated=old.remoteUpdated;saved.createdAt=old.createdAt;saved.deletedAt=old.deletedAt;}
    else{saved.remoteId='';saved.remoteEtag='';saved.remoteUpdated='';saved.createdAt=new Date().toISOString();saved.deletedAt=null;}
    if(c.scope==='occurrence'){if(!old||!c.occurrenceDate)throw new Error('Occurrence editing requires a series and date');const patch:Partial<Item>={};const base={...old,date:c.occurrenceDate};for(const key of ['title','date','time','end','timezone','category','priority','notes','location','reminders','reminderEnabled'] as const){if(JSON.stringify(saved[key])!==JSON.stringify(base[key]))(patch as Record<string,unknown>)[key]=saved[key];}if(Object.keys(patch).length)old.exceptions[c.occurrenceDate]=patch;else delete old.exceptions[c.occurrenceDate];old.steps=saved.steps;old.phaseId=saved.phaseId;touch(old);}
    else{delete saved.occurrenceDate;validateItem(saved);if(old)d.items[d.items.indexOf(old)]=saved;else d.items.push(saved);touch(saved);}
   }
   if(c.type==='item.delete'){const item=find(c.id);if(c.scope==='occurrence'){if(!c.occurrenceDate)throw new Error('Select an occurrence date');if(!item.excludedDates.includes(c.occurrenceDate))item.excludedDates.push(c.occurrenceDate);}else item.deletedAt=new Date().toISOString();touch(item);}
   if(c.type==='item.restore'){const item=find(c.id);item.deletedAt=null;touch(item);}
   if(c.type==='item.complete'){const item=find(c.id);const next=toggleCompletion(item,c.date);Object.assign(item,next);touch(item);}
   if(c.type==='step.complete'){const item=find(c.id);Object.assign(item,toggleStep(item,c.stepId,c.date));touch(item);}
   if(c.type==='phase.save'){
    const saved=validatePhase(c.phase),old=d.phases.find(p=>p.id===saved.id),now=new Date().toISOString();
    saved.createdAt=old?.createdAt||now;saved.updatedAt=now;
    const others=d.phases.filter(p=>p.id!==saved.id).sort((a,b)=>a.order-b.order);
    const at=c.position??(old?others.findIndex(p=>p.order>old.order):others.length);
    others.splice(at<0?others.length:Math.min(at,others.length),0,saved);
    others.forEach((p,order)=>p.order=order);d.phases=others;
   }
   // Deleting a phase keeps its tasks; they move to "Tasks without a phase".
   if(c.type==='phase.delete'){if(!d.phases.some(p=>p.id===c.id))throw new Error('Phase no longer exists');d.phases=d.phases.filter(p=>p.id!==c.id).sort((a,b)=>a.order-b.order);d.phases.forEach((p,order)=>p.order=order);for(const item of d.items)if(item.phaseId===c.id)item.phaseId='';}
   if(c.type==='item.reorder'){for(const [order,itemId] of c.ids.entries()){const item=find(itemId);item.order=order;touch(item);}}
   if(c.type==='categories.save'){if(c.moveFrom&&c.moveTo){if(!c.categories.some(cat=>cat.name===c.moveTo))throw new Error('Destination category does not exist');for(const item of d.items)if(item.category===c.moveFrom){item.category=c.moveTo;touch(item);}}d.categories=c.categories;}
   if(c.type==='settings.save'){
    d.settings={...c.settings};
   }
   if(c.type==='focus.action'){
    const f=d.focus,now=Date.now();f.remaining=focusRemaining(f,now);
    if(c.action==='configure'){if(c.duration!==undefined){f.duration=c.duration;f.remaining=c.duration*60;}if(c.task!==undefined)f.task=c.task;if(c.goal!==undefined)f.goal=c.goal;f.running=false;f.deadline=null;}
    if(c.action==='start'||c.action==='resume'){if(c.action==='start'){f.remaining=f.duration*60;f.sessionId=randomUUID();}if(!f.sessionId)f.sessionId=randomUUID();f.running=true;f.deadline=now+f.remaining*1000;}
    if(c.action==='pause'){f.running=false;f.deadline=null;}
    if(c.action==='stop'){f.running=false;f.deadline=null;f.remaining=f.duration*60;f.sessionId='';}
   }
  });
}
