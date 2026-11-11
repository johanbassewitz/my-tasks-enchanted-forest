import { contextBridge,ipcRenderer } from 'electron';
import type { AppData, DesktopAPI, Command } from '../shared/types';
const api:DesktopAPI={
 cloudAccount:()=>ipcRenderer.invoke('cloud:account'),
 requestSignIn:email=>ipcRenderer.invoke('cloud:requestSignIn',email),
 verifySignIn:input=>ipcRenderer.invoke('cloud:verifySignIn',input),
 signOut:()=>ipcRenderer.invoke('cloud:signOut'),
 billingPortal:()=>ipcRenderer.invoke('cloud:portal'),
 purchasesDisabled:value=>ipcRenderer.invoke('cloud:purchasesDisabled',value),
 generateTasks:input=>ipcRenderer.invoke('cloud:generate',input),

 onSound:callback=>{const listener=(_event:Electron.IpcRendererEvent,sound:Parameters<typeof callback>[0])=>callback(sound);ipcRenderer.on('desktop:sound',listener);return()=>ipcRenderer.removeListener('desktop:sound',listener);},
 sponsor:()=>ipcRenderer.invoke('desktop:sponsor'),
 openSponsor:()=>ipcRenderer.invoke('desktop:openSponsor'),
 commerceStatus:()=>ipcRenderer.invoke('desktop:commerce'),
 purchase:key=>ipcRenderer.invoke('desktop:purchase',key),
 feedbackAvailable:()=>ipcRenderer.invoke('desktop:feedbackAvailable'),
 sendFeedback:input=>ipcRenderer.invoke('desktop:feedback',input),
 getData:()=>ipcRenderer.invoke('desktop:getData'),
 command:(command:Command)=>ipcRenderer.invoke('desktop:command',command),
 window:action=>ipcRenderer.invoke('desktop:window',action),
 onData:callback=>{const listener=(_event:Electron.IpcRendererEvent,data:AppData)=>callback(data);ipcRenderer.on('desktop:data',listener);return()=>ipcRenderer.removeListener('desktop:data',listener);},
 onAlert:callback=>{const listener=(_event:Electron.IpcRendererEvent,alert:Parameters<typeof callback>[0])=>callback(alert);ipcRenderer.on('desktop:alert',listener);return()=>ipcRenderer.removeListener('desktop:alert',listener);}
};
contextBridge.exposeInMainWorld('desktop',Object.freeze(api));
