import {createInitialData,newItem,defaultSettings} from './defaults';
import type {Item,AppData} from './types';
/** Converts the supplied HTML prototype's export without trusting simulated
 * connection flags or importing any remote identifiers. Validation still runs
 * on the result before the repository opens a replacement transaction. */
export function normalizeBackup(input:unknown):unknown {
 if(!input||typeof input!=='object')return input;
 const old=input as Record<string,any>;
 if(!Array.isArray(old.items)||!Array.isArray(old.categories)||!old.settings||!('defaultReminder' in old.settings))return input;
 const defaults=createInitialData();const settings={...defaultSettings(),start:old.settings.start||'Home',time:old.settings.time||'12',week:old.settings.week||'Monday',desktop:old.settings.desktop!==false,sound:old.settings.sound===true,defaultReminders:[Number(old.settings.defaultReminder??10)]};
 const items=old.items.map((v:any,index:number):Item=>({...newItem(v.kind==='event'?'event':'task',v.date||''),id:v.id,title:v.title,date:v.date||'',time:v.time||'',end:v.end||'',category:v.category||'Other',done:v.done===true,kind:v.kind==='event'?'event':'task',priority:v.priority||'Normal',repeat:v.repeat||'Never',interval:v.repeat==='Custom'?Number(v.interval||1):1,reminders:v.reminders,reminderEnabled:v.reminderEnabled===true,notes:v.notes||'',location:v.location||'',order:typeof v.order==='number'?v.order:index,completedDates:v.completedDates||[],synced:false,syncState:'Local only'}));
 const history=(old.focus?.history||[]).map((h:any)=>({id:crypto.randomUUID(),date:h.date,minutes:h.minutes,task:'',goal:'Imported focus session',completedAt:new Date(h.date+'T12:00:00').getTime()}));
 return {...defaults,settings,items,categories:old.categories.map((c:any)=>({id:c.id,name:c.name,icon:c.icon,accent:c.accent||'#d7bd78'})),focus:{...defaults.focus,duration:old.focus?.mode||25,remaining:(old.focus?.mode||25)*60,task:old.focus?.task||'',goal:old.focus?.goal||'',history}} satisfies AppData;
}
