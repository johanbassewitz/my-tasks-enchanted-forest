import {z} from 'zod';
const id=z.string().min(1).max(200);
const title=z.string().trim().min(1,'Add a title or name').max(200);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value},'Choose a valid date');
export const addonPacks=['creator','freelancer','habits','journal'] as const;
export type AddonPack=typeof addonPacks[number];
export const addonsSchema=z.object({
 creator:z.array(z.object({id,title,stage:z.enum(['idea','draft','production','published']),targetDate:z.union([date,z.literal('')]),notes:z.string().max(20000)})).max(2000).default([]),
 clients:z.array(z.object({id,name:title})).max(1000).default([]),
 projects:z.array(z.object({id,clientId:id,title,minutes:z.number().int().min(0).max(10000000),rate:z.number().finite().min(0).max(1000000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,'Use at most two decimal places for the hourly rate'),paymentStatus:z.enum(['unbilled','awaiting','paid'])})).max(5000).default([]),
 habits:z.array(z.object({id,title,period:z.enum(['daily','weekly']),target:z.number().int().min(1).max(100000),entries:z.array(z.object({date,count:z.number().int().min(1).max(100000)})).max(20000)})).max(200).default([]),
 journal:z.array(z.object({id,date,mood:z.enum(['great','good','okay','low','difficult']),prompt:z.string().max(500),body:z.string().max(100000)})).max(20000).default([]),
}).superRefine((value,ctx)=>{
 for(const key of ['creator','clients','projects','habits','journal'] as const){if(new Set(value[key].map(item=>item.id)).size!==value[key].length)ctx.addIssue({code:'custom',path:[key],message:'Record IDs must be unique'})}
 const clients=new Set(value.clients.map(c=>c.id));if(value.projects.some(p=>!clients.has(p.clientId)))ctx.addIssue({code:'custom',path:['projects'],message:'Each project needs an existing client'});
 for(const habit of value.habits)if(new Set(habit.entries.map(e=>e.date)).size!==habit.entries.length)ctx.addIssue({code:'custom',path:['habits'],message:'Habit history can have only one count per date'});
});
export type AddonsState=z.infer<typeof addonsSchema>;
export type Habit=AddonsState['habits'][number];
export const defaultAddons=():AddonsState=>({creator:[],clients:[],projects:[],habits:[],journal:[]});
/** Round once to the nearest hundredth of the user's chosen currency unit. */
export function projectEstimate(project:Pick<AddonsState['projects'][number],'minutes'|'rate'>):number{return Math.round(project.minutes*Math.round(project.rate*100)/60)/100}
const shift=(day:string,days:number)=>new Date(new Date(`${day}T00:00:00Z`).valueOf()+days*86400000).toISOString().slice(0,10);
export function weekStart(day:string):string{date.parse(day);const weekday=new Date(`${day}T00:00:00Z`).getUTCDay();return shift(day,-((weekday+6)%7))}
export function habitProgress(habit:Habit,day:string):number{date.parse(day);const start=habit.period==='weekly'?weekStart(day):day;const end=habit.period==='weekly'?shift(start,6):day;return habit.entries.filter(e=>e.date>=start&&e.date<=end&&e.date<=day).reduce((total,e)=>total+e.count,0)}
/** A live streak includes consecutive completed periods, ending this period or the previous one. */
export function habitStreak(habit:Habit,today:string):number{
 date.parse(today);const periodDays=habit.period==='weekly'?7:1;const current=habit.period==='weekly'?weekStart(today):today;
 const totals=new Map<string,number>();for(const entry of habit.entries){if(entry.date>today)continue;const key=habit.period==='weekly'?weekStart(entry.date):entry.date;totals.set(key,(totals.get(key)||0)+entry.count)}
 let cursor=(totals.get(current)||0)>=habit.target?current:shift(current,-periodDays);let count=0;
 while((totals.get(cursor)||0)>=habit.target){count++;cursor=shift(cursor,-periodDays)}return count;
}
export function recordHabit(habit:Habit,day:string,delta:number):Habit{
 date.parse(day);if(!Number.isInteger(delta))throw new Error('Habit counts must be whole numbers');
 const count=Math.max(0,(habit.entries.find(e=>e.date===day)?.count||0)+delta);if(count>100000)throw new Error('Daily habit count limit reached');
 return {...habit,entries:[...habit.entries.filter(e=>e.date!==day),...(count?[{date:day,count}]:[])].sort((a,b)=>a.date.localeCompare(b.date))};
}
