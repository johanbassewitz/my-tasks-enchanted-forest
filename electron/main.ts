import { app, BrowserWindow, ipcMain, Menu, Tray, Notification, powerMonitor, safeStorage, shell, dialog, screen } from 'electron';
import { join } from 'node:path';
import { readFile,writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { z } from 'zod';
import { DateTime } from 'luxon';
import {applyCommand,commandSchema} from './commands';
import { Repository,itemSchema,settingsSchema,categoriesSchema } from './repository';
import { ReminderScheduler,Alert } from './scheduler';
import { GoogleService } from './google';
import {connectGoogleWithSetup} from './google-setup';
import {googleSetupLinks} from '../shared/google-guide';
import { toggleCompletion, focusRemaining, validateItem } from '../shared/domain';
import type { AppData,Command,Item } from '../shared/types';

// Also supports isolated profiles for automated desktop verification.
app.setName('My Tasks');
app.setPath('userData',join(app.getPath('appData'),'My Tasks'));
if(process.env.MY_TASKS_DATA_DIR){mkdirSync(process.env.MY_TASKS_DATA_DIR,{recursive:true});app.setPath('userData',process.env.MY_TASKS_DATA_DIR);}

let win:BrowserWindow|null=null,tray:Tray|null=null,repo:Repository,scheduler:ReminderScheduler,google:GoogleService,quitting=false,timer:NodeJS.Timeout|undefined;
function show(){if(!win)return;if(win.isMinimized())win.restore();win.show();win.focus();}
function view():AppData{const data=repo.getData();data.dataPath=app.getPath('userData');data.google.secureStorage=safeStorage.isEncryptionAvailable();data.settings.googleClientSecret='';return data;}
function broadcast(){if(win&&!win.isDestroyed())win.webContents.send('desktop:data',view());}
function alert(message:Alert){const settings=repo.getData().settings;if(settings.inApp)win?.webContents.send('desktop:alert',message);if(settings.desktop&&Notification.isSupported()){const note=new Notification({title:message.title,body:message.body,silent:!settings.sound,icon:join(app.getAppPath(),'build/icon.png')});note.on('click',()=>{show();win?.webContents.send('desktop:alert',message);});note.show();}}
function enqueue(item:Item){const settings=repo.getData().settings;if(item.synced){repo.enqueue(item.id,item.deletedAt?'delete':'upsert');}}
function trusted(event:Electron.IpcMainInvokeEvent){if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('Untrusted IPC sender');}
async function command(input:unknown):Promise<AppData>{
 const c=commandSchema.parse(input) as Command;
 if(c.type.startsWith('google.')){if(c.type==='google.openSetup')await shell.openExternal(googleSetupLinks[c.destination]);if(c.type==='google.connect')await connectGoogleWithSetup({
  configured:!!repo.getData().settings.googleClientId,
  secureStorage:safeStorage.isEncryptionAvailable(),
  pickClientFile:async()=>{
   const selected=await dialog.showOpenDialog(win!,{title:'One-time Google setup — select your Desktop client JSON',buttonLabel:'Continue to Google sign-in',properties:['openFile'],filters:[{name:'Google Desktop client configuration',extensions:['json']}]});
   if(selected.canceled||!selected.filePaths[0])return null;
   const raw=await readFile(selected.filePaths[0],'utf8');
   return raw;
  },
  saveClient:async client=>{
   const encrypted=client.clientSecret?safeStorage.encryptString(client.clientSecret).toString('base64'):undefined;
   // Keep the client secret out of the renderer and normal settings snapshot.
   repo.update(data=>{repo.setMeta('googleClientSecret',encrypted);data.settings.googleClientId=client.clientId;data.settings.googleClientSecret='';data.google.configured=true;});
   broadcast();
  },
  connect:()=>google.connect()
 });if(c.type==='google.disconnect')await google.disconnect();if(c.type==='google.sync')await google.sync();if(c.type==='google.createCalendar')await google.createCalendar();}
 else if(c.type==='conflict.resolve')await google.resolveConflict(c.id,c.choice);
 else if(c.type==='data.openFolder')await shell.openPath(app.getPath('userData'));
 else if(c.type==='data.export'){const selected=await dialog.showSaveDialog(win!,{title:'Export My Tasks backup',defaultPath:'my-tasks-backup.json',filters:[{name:'JSON backup',extensions:['json']}]});if(selected.filePath)await writeFile(selected.filePath,repo.exportBackup(),'utf8');}
 else if(c.type==='data.import'){const selected=await dialog.showOpenDialog(win!,{title:'Restore My Tasks backup',properties:['openFile'],filters:[{name:'JSON backup',extensions:['json']}]});if(selected.filePaths[0]){const before=repo.exportBackup();const raw=await readFile(selected.filePaths[0],'utf8');repo.importBackup(raw);const settings=repo.getData().settings;app.setLoginItemSettings({openAtLogin:settings.startWithWindows,args:settings.startMinimized?['--minimized']:[]});await writeFile(join(app.getPath('userData'),`before-import-${Date.now()}.json`),before,'utf8');}}
 else if(c.type==='notification.test')alert({title:'A little nudge from My Tasks',body:'Your desktop reminders are ready.'});
 else if(c.type==='reminder.snooze')scheduler.snooze(c.id);
 else if(c.type==='reminder.dismiss')scheduler.dismiss(c.id);
 else{
  if(c.type==='settings.save'){
    if(c.settings.googleClientId!==repo.getData().settings.googleClientId&&!c.settings.googleClientSecret)repo.setMeta('googleClientSecret',undefined);
    if(c.settings.googleClientSecret){if(!safeStorage.isEncryptionAvailable())throw new Error('Windows secure storage is unavailable');repo.setMeta('googleClientSecret',safeStorage.encryptString(c.settings.googleClientSecret).toString('base64'));}
  }
  applyCommand(repo,c);
  if(c.type==='settings.save')app.setLoginItemSettings({openAtLogin:c.settings.startWithWindows,args:c.settings.startMinimized?['--minimized']:[]});
 }
 scheduler.tick();broadcast();return view();
}
function createWindow(){const saved=repo.getMeta<Electron.Rectangle>('window.bounds');const area=screen.getPrimaryDisplay().workArea;const bounds=saved&&screen.getAllDisplays().some(d=>saved.x<d.workArea.x+d.workArea.width&&saved.x+saved.width>d.workArea.x&&saved.y<d.workArea.y+d.workArea.height&&saved.y+saved.height>d.workArea.y)?saved:{width:Math.min(1440,area.width),height:Math.min(950,area.height)};
 win=new BrowserWindow({...bounds,minWidth:800,minHeight:600,frame:false,show:false,backgroundColor:'#102015',icon:join(app.getAppPath(),'build/icon.png'),webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 win.on('resize',()=>{if(win&&!win.isMaximized())repo.setMeta('window.bounds',win.getBounds());});win.on('move',()=>{if(win&&!win.isMaximized())repo.setMeta('window.bounds',win.getBounds());});
 win.on('close',event=>{if(!quitting&&repo.getData().settings.closeToTray){event.preventDefault();win?.hide();}});win.on('closed',()=>{win=null;});
 win.once('ready-to-show',()=>{if(!repo.getData().settings.startMinimized&&!process.argv.includes('--minimized'))show();});
 void win.loadFile(join(app.getAppPath(),'dist/index.html'));
 tray=new Tray(join(app.getAppPath(),'build/icon.png'));tray.setToolTip('My Tasks');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open My Tasks',click:show},{label:'Quit',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',show);
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',show);app.on('before-quit',()=>{quitting=true;});app.on('window-all-closed',()=>{if(!repo?.getData().settings.closeToTray)app.quit();});app.on('will-quit',()=>{if(timer)clearInterval(timer);tray?.destroy();repo?.close();});
 void app.whenReady().then(()=>{
  app.setAppUserModelId('com.mytasks.forest');mkdirSync(app.getPath('userData'),{recursive:true});repo=new Repository(join(app.getPath('userData'),'my-tasks.sqlite'));
  google=new GoogleService(repo,{safeStorage,openExternal:url=>shell.openExternal(url),getClientSecret:()=>{const secret=repo.getMeta<string>('googleClientSecret');return secret&&safeStorage.isEncryptionAvailable()?safeStorage.decryptString(Buffer.from(secret,'base64')):'';},onChange:broadcast});
  scheduler=new ReminderScheduler(repo,alert);createWindow();
  ipcMain.handle('desktop:getData',event=>{trusted(event);return view();});ipcMain.handle('desktop:command',(event,input)=>{trusted(event);return command(input);});
  ipcMain.handle('desktop:window',(event,action)=>{trusted(event);const kind=z.enum(['minimize','maximize','close','quit']).parse(action);if(kind==='minimize')win?.minimize();if(kind==='maximize'){if(win?.isMaximized())win.unmaximize();else win?.maximize();}if(kind==='close')win?.close();if(kind==='quit'){quitting=true;app.quit();}});
  const tick=()=>{try{scheduler.tick();broadcast();if(repo.getData().google.connected)void google.sync().catch(()=>broadcast());}catch(error){console.error('Background scheduler failed',error);}};let lastSync=0;const frequentTick=()=>{try{scheduler.tick();broadcast();if(Date.now()-lastSync>=30000){lastSync=Date.now();if(repo.getData().google.connected)void google.sync().catch(()=>broadcast());}}catch(error){console.error(error)}};timer=setInterval(frequentTick,1000);powerMonitor.on('resume',tick);tick();
 }).catch(error=>{dialog.showErrorBox('My Tasks could not start',`${(error as Error).message}\nYour existing data has not been reset. Check the data folder permissions and free disk space.`);app.exit(1);});
}





