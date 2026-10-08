import type {AppData,Item,Settings} from './types';
import {iso,shift} from './domain';
const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
export function defaultSettings():Settings {
 return {start:'Home',time:'12',week:'Monday',timezone:zone(),startWithWindows:false,startMinimized:false,closeToTray:true,reducedMotion:false,textScale:100,desktop:true,inApp:true,sound:false,defaultReminders:[10],googleClientId:'',googleClientSecret:'',calendarId:'',syncMode:'two-way',syncCompleted:false,deleteGoogle:true,importExisting:false};
}
export function newItem(kind:'task'|'event'='task',date:string=iso()):Item {
 const now=new Date().toISOString();
 return {id:crypto.randomUUID(),kind,title:'',date,time:'',end:'',timezone:zone(),category:'Personal',priority:'Normal',notes:'',location:'',done:false,repeat:'Never',interval:1,recurrenceEnd:'',recurrenceCount:null,completedDates:[],excludedDates:[],exceptions:{},reminders:[10],reminderEnabled:false,synced:false,calendarId:'',syncState:'Local only',remoteId:'',remoteEtag:'',remoteUpdated:'',createdAt:now,updatedAt:now,order:0,deletedAt:null};
}
export function createInitialData():AppData {
 const today=iso();const weekday=(day:number)=>{const delta=(day-new Date(today+'T12:00:00').getDay()+7)%7;return shift(today,delta||7)};
 const tasks:[string,string,string,boolean][]=[['Lesson plan','09:00','Study',true],['Gym','11:00','Gym',false],['Edit video','14:00','Work',true],['Read a chapter','18:00','Study',false],['Skincare','20:00','Routine',false],['Bedtime','22:00','Routine',false]];
 const items=tasks.map(([title,time,category,done],order)=>({...newItem('task',today),title,time,category,done,order,reminders:order===1?[30]:order===4?[10]:[],reminderEnabled:order===1||order===4}));
 const events=[{title:'Dentist Appointment',date:shift(today,1),time:'15:00',end:'16:00',category:'Health',location:'Dental clinic'},{title:'University Lecture',date:weekday(4),time:'10:00',end:'12:00',category:'Study',location:'University campus'},{title:'Dinner',date:weekday(5),time:'20:00',end:'21:00',category:'Personal',location:''}];
 events.forEach((event,i)=>items.push({...newItem('event',event.date),...event,order:6+i,reminders:[30],reminderEnabled:true}));
 const names=[['Personal','leaf'],['Study','book-open'],['Work','laptop'],['Gym','dumbbell'],['Health','heart-pulse'],['Routine','moon'],['Appointments','calendar-check'],['Social','users'],['Shopping','shopping-bag'],['Other','sparkles']];
 return {version:1,items,categories:names.map(([name,icon],i)=>({id:'cat'+i,name,icon,accent:['#8bdd62','#d7bd78','#82b4cf','#d7a178','#db9eb0'][i%5]})),settings:defaultSettings(),focus:{duration:25,remaining:1500,deadline:null,running:false,task:'',goal:'One small step forward',sessionId:crypto.randomUUID(),history:[]},reminders:[],google:{configured:false,connected:false,account:'',calendars:[],lastSync:'',error:'',secureStorage:false,syncing:false},conflicts:[],dataPath:''};
}
