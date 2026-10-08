import { DateTime } from 'luxon';
import { occurrenceItems, scheduledAt, isDone, advanceFocus } from '../shared/domain';
import { Repository } from './repository';
export interface Alert {title:string;body:string;itemId?:string;reminderId?:string}
export class ReminderScheduler {
 constructor(private repository:Repository,private deliver:(alert:Alert)=>void){}
 tick(now=Date.now()):void{
  const pending:Alert[]=[];this.repository.update(data=>{
   const existing=new Map(data.reminders.map(r=>[r.id,r]));const active=new Set<string>();
   const maxDays=Math.ceil(Math.max(0,...data.items.flatMap(i=>[...i.reminders,...Object.values(i.exceptions).flatMap(p=>p.reminders??[])]))/1440)+1;
   for(const zone of new Set(data.items.map(i=>i.timezone))){
    const local=DateTime.fromMillis(now,{zone});
    const dates=new Set(Array.from({length:Math.max(31,maxDays)+8},(_,index)=>local.plus({days:index-7}).toISODate()!));
    for(const item of data.items)if(item.repeat==='Never'&&item.date&&item.timezone===zone&&item.date>=local.plus({days:-7}).toISODate()!)dates.add(item.date);
    for(const date of dates){
     for(const item of occurrenceItems(data.items.filter(i=>i.timezone===zone&&!i.deletedAt),date)){
      if(!item.reminderEnabled||isDone(item,date))continue;
      for(const offset of item.reminders){const due=scheduledAt(item,date)-offset*60000;if(due<now-7*86400000)continue;const id=`${item.id}:${item.occurrenceDate||date}:${offset}`;const old=existing.get(id);active.add(id);existing.set(id,{id,itemId:item.id,occurrenceDate:item.occurrenceDate||date,offset,due,deliveredAt:old&&old.due===due?old.deliveredAt:null,snoozedUntil:old?.snoozedUntil??null,title:item.title,enabled:true});}
     }
    }
   }
   for(const r of existing.values()){
    const item=data.items.find(i=>i.id===r.itemId);if(!item||item.deletedAt||!active.has(r.id)){r.enabled=false;r.snoozedUntil=null;continue;}if(!r.enabled)continue;const due=r.snoozedUntil??r.due;
    if(due<=now&&(r.deliveredAt===null||r.snoozedUntil!==null)){r.deliveredAt=now;r.snoozedUntil=null;pending.push({title:r.title,body:'Your scheduled reminder is due.',itemId:r.itemId,reminderId:r.id});}
   }
   data.reminders=[...existing.values()].filter(r=>r.due>now-30*86400000||r.snoozedUntil!==null);
   const result=advanceFocus(data.focus,now);data.focus=result.focus;if(result.completed)pending.push({title:'Focus session complete',body:'Time to pause and take a breath.'});
  });
  if(pending.length>1)this.deliver({title:'While you were away',body:`${pending.length} reminders or focus sessions are ready. Open My Tasks to review them.`});else if(pending[0])this.deliver(pending[0]);
 }
 snooze(id:string,now=Date.now()):void{this.repository.update(d=>{const r=d.reminders.find(r=>r.id===id);if(r){r.snoozedUntil=now+10*60000;r.enabled=true;}});}
 dismiss(id:string):void{this.repository.update(d=>{const r=d.reminders.find(r=>r.id===id);if(r){r.deliveredAt=Date.now();r.snoozedUntil=null;}});}
}




