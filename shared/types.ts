export type Page = 'Home'|'Calendar'|'Focus'|'Categories'|'Tasks'|'Events'|'Reminders'|'Settings';
export type SyncState = 'Local only'|'Pending sync'|'Synced'|'Sync error'|'Conflict'|'Disconnected';
export interface Item {
 id:string; kind:'task'|'event'; title:string; date:string; time:string; end:string; timezone:string;
 category:string; priority:'Low'|'Normal'|'High'; notes:string; location:string; done:boolean;
 repeat:'Never'|'Daily'|'Weekdays'|'Weekly'|'Monthly'|'Yearly'|'Custom'; interval:number;
 recurrenceEnd:string; recurrenceCount:number|null; completedDates:string[]; excludedDates:string[];
 exceptions:Record<string,Partial<Item>>; reminders:number[]; reminderEnabled:boolean;
 synced:boolean; calendarId:string; syncState:SyncState; remoteId:string; remoteEtag:string;
 remoteUpdated:string; createdAt:string; updatedAt:string; order:number; deletedAt:string|null;
 /** Phase this task belongs to; empty for none. Events never belong to a phase. */
 phaseId:string; steps:Step[];
 /** Original recurrence date on an expanded occurrence; never a new series ID. */
 occurrenceDate?:string;
}
/** A checklist entry inside a task. On a repeating task, `date` stays empty and
 * completion is tracked per occurrence, like the task's own completedDates. */
export interface Step {id:string; title:string; date:string; time:string; reminders:number[]; reminderEnabled:boolean; done:boolean; completedDates:string[]}
export interface Phase {id:string; title:string; order:number; start:string; end:string; category:string; color:string; createdAt:string; updatedAt:string}
export interface Category {id:string; name:string; icon:string; accent:string}
export interface FocusSession {id:string; date:string; minutes:number; task:string; goal:string; completedAt:number}
export interface FocusState {duration:number; remaining:number; deadline:number|null; running:boolean; task:string; goal:string; sessionId:string; history:FocusSession[]}
export interface Settings {
 start:Page; time:'12'|'24'; week:'Monday'|'Sunday'; timezone:string; startWithWindows:boolean;
 startMinimized:boolean; closeToTray:boolean; reducedMotion:boolean; textScale:number;
 desktop:boolean; inApp:boolean; sound:boolean; defaultReminders:number[];
 googleClientId:string; googleClientSecret:string; calendarId:string; syncMode:'two-way'|'push';
 syncCompleted:boolean; deleteGoogle:boolean; importExisting:boolean;
}
export interface GoogleStatus {configured:boolean; connected:boolean; account:string; calendars:{id:string;summary:string}[]; lastSync:string; error:string; secureStorage:boolean; syncing:boolean}
export interface ReminderRecord {id:string; itemId:string; occurrenceDate:string; offset:number; due:number; deliveredAt:number|null; snoozedUntil:number|null; title:string; enabled:boolean; stepId?:string}
export interface Conflict {id:string; itemId:string; local:Item; remote:Item; reason:string}
export interface AppData {version:number; items:Item[]; phases:Phase[]; categories:Category[]; settings:Settings; focus:FocusState; reminders:ReminderRecord[]; google:GoogleStatus; conflicts:Conflict[]; dataPath:string}
export type Command =
 | {type:'item.save'; item:Item; scope?:'series'|'occurrence'; occurrenceDate?:string}
 | {type:'item.delete'; id:string; scope?:'series'|'occurrence'; occurrenceDate?:string}
 | {type:'item.restore';id:string}
 | {type:'item.complete';id:string;date:string}
 | {type:'item.reorder';ids:string[]}
 | {type:'step.complete';id:string;stepId:string;date:string}
 | {type:'phase.save';phase:Phase;position?:number}
 | {type:'phase.delete';id:string}
 | {type:'categories.save';categories:Category[];moveFrom?:string;moveTo?:string}
 | {type:'settings.save';settings:Settings}
 | {type:'focus.action';action:'start'|'pause'|'resume'|'stop'|'configure';duration?:number;task?:string;goal?:string}
 | {type:'reminder.snooze';id:string}
 | {type:'reminder.dismiss';id:string}
 | {type:'notification.test'}
 | {type:'google.connect'}|{type:'google.disconnect'}|{type:'google.sync'}|{type:'google.createCalendar'}
 | {type:'google.openSetup';destination:import('./google-guide').GoogleSetupDestination}
 | {type:'conflict.resolve';id:string;choice:'local'|'remote'}
 | {type:'data.export'}|{type:'data.import'}|{type:'data.openFolder'};
export interface DesktopAPI {
 getData():Promise<AppData>; command(command:Command):Promise<AppData>;
 window(action:'minimize'|'maximize'|'close'|'quit'):Promise<void>;
 onData(callback:(data:AppData)=>void):()=>void;
 onAlert(callback:(alert:{title:string;body:string;itemId?:string;reminderId?:string})=>void):()=>void;
}
declare global {interface Window {desktop:DesktopAPI}}
