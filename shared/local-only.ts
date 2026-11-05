import type {AppData,Item} from './types';

// Retain inert legacy fields so existing version-1 backups remain readable.
export function clearRemoteLinks(item:Partial<Item>):void {
 item.synced=false;item.syncState='Local only';item.calendarId='';
 item.remoteId='';item.remoteEtag='';item.remoteUpdated='';
}
export function makeLocalOnly(data:AppData):void {
 for(const item of data.items){clearRemoteLinks(item);for(const patch of Object.values(item.exceptions??{})){
  // Exception patches only override fields actually present in the patch.
  for(const key of ['synced','syncState','calendarId','remoteId','remoteEtag','remoteUpdated'] as const)delete patch[key];
 }}
 Object.assign(data.settings,{googleClientId:'',googleClientSecret:'',calendarId:'',syncMode:'two-way',syncCompleted:false,deleteGoogle:true,importExisting:false});
 data.google={configured:false,connected:false,account:'',calendars:[],lastSync:'',error:'',secureStorage:false,syncing:false};
 data.conflicts=[];
}
