import {z} from 'zod';

const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(`${value}T00:00:00Z`);return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value},'Choose a valid date');
const id=z.string().min(1).max(200);
export const studySchema=z.object({
 subjects:z.array(z.object({id,name:z.string().trim().min(1,'A subject needs a name').max(120),examDate:dateSchema,chapters:z.array(z.object({id,title:z.string().trim().min(1,'A chapter needs a title').max(200),minutes:z.number().int().min(1).max(100000),done:z.boolean()})).max(500)})).max(100),
 dailyMinutes:z.number().int().min(1).max(1440),
 availableWeekdays:z.array(z.number().int().min(0).max(6)).min(1,'Choose at least one study day').default([0,1,2,3,4,5,6]),
 sessions:z.array(z.object({id,subjectId:id,chapterId:id,date:dateSchema,minutes:z.number().int().min(1).max(1440),taskId:id})).max(50000).default([]),
}).superRefine((study,ctx)=>{
 const ids=[...study.subjects.map(s=>s.id),...study.subjects.flatMap(s=>s.chapters.map(c=>c.id))];
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Subject and chapter IDs must be unique'});
 if(new Set(study.sessions.map(s=>s.id)).size!==study.sessions.length||new Set(study.sessions.map(s=>s.taskId)).size!==study.sessions.length)ctx.addIssue({code:'custom',message:'Study session and task IDs must be unique'});
});
export type StudyState=z.infer<typeof studySchema>;
export type StudySubject=StudyState['subjects'][number];
export type StudySession=StudyState['sessions'][number];
export interface StudySlot {subjectId:string;chapterId:string;date:string;minutes:number;title:string}
export const defaultStudy=():StudyState=>({subjects:[],dailyMinutes:60,availableWeekdays:[0,1,2,3,4,5,6],sessions:[]});
const nextDay=(day:string)=>new Date(new Date(`${day}T00:00:00Z`).valueOf()+86400000).toISOString().slice(0,10);
/** Pure, atomic planning: callers must persist the complete returned plan in one transaction.
 * Previous allocations remain reserved, including past sessions, so regeneration is idempotent.
 */
export function buildStudySchedule(input:StudyState,today:string):StudySlot[]{
 const study=studySchema.parse(input);dateSchema.parse(today);
 const used=new Map<string,number>();const allocated=new Map<string,number>();
 for(const session of study.sessions){used.set(session.date,(used.get(session.date)||0)+session.minutes);allocated.set(session.chapterId,(allocated.get(session.chapterId)||0)+session.minutes)}
 const slots:StudySlot[]=[];
 for(const subject of study.subjects.slice().sort((a,b)=>a.examDate.localeCompare(b.examDate)||a.id.localeCompare(b.id))){
  const chapters=subject.chapters.filter(c=>!c.done).map(c=>({...c,remaining:Math.max(0,c.minutes-(allocated.get(c.id)||0))}));
  const required=chapters.reduce((sum,c)=>sum+c.remaining,0);if(!required)continue;
  if(subject.examDate<=today)throw new Error(`${subject.name}: choose an exam date after today before scheduling ${required} minutes.`);
  const days:string[]=[];let capacity=0;
  for(let day=today;day<subject.examDate;day=nextDay(day)){
   if(study.availableWeekdays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())){days.push(day);capacity+=Math.max(0,study.dailyMinutes-(used.get(day)||0))}
   if(days.length>3660)throw new Error('Choose an exam date within ten years.');
  }
  if(required>capacity)throw new Error(`${subject.name} needs ${required} more minutes, but only ${capacity} fit before the exam. Add study days, increase daily minutes, or reduce chapter estimates.`);
  let index=0;
  for(const chapter of chapters){let remaining=chapter.remaining;while(remaining>0){const day=days[index];const free=Math.max(0,study.dailyMinutes-(used.get(day)||0));if(!free){index++;continue}const minutes=Math.min(remaining,free);slots.push({subjectId:subject.id,chapterId:chapter.id,date:day,minutes,title:`${subject.name}: ${chapter.title}`});used.set(day,(used.get(day)||0)+minutes);remaining-=minutes}}
 }
 return slots;
}
export function subjectFocusMinutes(study:StudyState,subjectId:string,history:readonly {task:string;minutes:number}[]):number{
 const ids=new Set(study.sessions.filter(s=>s.subjectId===subjectId).map(s=>s.taskId));return history.reduce((sum,session)=>sum+(ids.has(session.task)?session.minutes:0),0);
}
