import { contextBridge,ipcRenderer } from 'electron';
import type { AppData, DesktopAPI, Command } from '../shared/types';
const api:DesktopAPI={
 getData:()=>ipcRenderer.invoke('desktop:getData'),
 command:(command:Command)=>ipcRenderer.invoke('desktop:command',command),
 window:action=>ipcRenderer.invoke('desktop:window',action),
 onData:callback=>{const listener=(_event:Electron.IpcRendererEvent,data:AppData)=>callback(data);ipcRenderer.on('desktop:data',listener);return()=>ipcRenderer.removeListener('desktop:data',listener);},
 onAlert:callback=>{const listener=(_event:Electron.IpcRendererEvent,alert:Parameters<typeof callback>[0])=>callback(alert);ipcRenderer.on('desktop:alert',listener);return()=>ipcRenderer.removeListener('desktop:alert',listener);}
};
contextBridge.exposeInMainWorld('desktop',Object.freeze(api));
