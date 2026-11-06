import sponsorConfig from '../config/sponsor.json';
import {activeSponsor} from '../shared/sponsor';
import {isSupporter} from '../shared/commerce';
import {StoreBridge} from './store-bridge';
import {CommerceService} from './commerce';
import storeConfig from '../config/store.json';
import {productKeys} from '../shared/commerce';
import { app, BrowserWindow, ipcMain, Menu, Tray, Notification, powerMonitor, shell, dialog, screen } from 'electron';
import { FeedbackService } from './feedback';
import packageInfo from '../package.json';
import { join } from 'node:path';
import { readFile,writeFile } from 'node:fs/promises';
import {RollingBackups} from './backups';
import { mkdirSync,existsSync } from 'node:fs';
import { z } from 'zod';
import { DateTime } from 'luxon';
import {applyCommand,commandSchema} from './commands';
import { Repository,itemSchema,settingsSchema,categoriesSchema } from './repository';
import { ReminderScheduler,Alert } from './scheduler';
import { toggleCompletion, focusRemaining, validateItem } from '../shared/domain';
import type { AppData,Command,Item } from '../shared/types';

// Also supports isolated profiles for automated desktop verification.
app.setName('Daywhisper');
app.setPath('userData',join(app.getPath('appData'),'My Tasks'));
if(process.env.MY_TASKS_DATA_DIR){mkdirSync(process.env.MY_TASKS_DATA_DIR,{recursive:true});app.setPath('userData',process.env.MY_TASKS_DATA_DIR);}

const storeBridge=new StoreBridge(join(process.resourcesPath,'store','Daywhisper.Store.exe'));
const commerce=new CommerceService(storeConfig,!!process.windowsStore,storeBridge,()=>{if(!win)throw Error('Window unavailable');const buffer=win.getNativeWindowHandle();return (buffer.length===8?buffer.readBigUInt64LE():BigInt(buffer.readUInt32LE())).toString()});
async function configureStartup(settings:AppData['settings']){
 if(process.windowsStore){const result=await storeBridge.startup(settings.startWithWindows?'enable':'disable');if(settings.startWithWindows!==['Enabled','EnabledByPolicy'].includes(result.state))throw Error(settings.startWithWindows?'Windows has disabled startup. Enable Daywhisper in Windows Settings → Apps → Startup.':'Windows policy keeps Daywhisper startup enabled. Contact your administrator to change this setting.');}
 else app.setLoginItemSettings({openAtLogin:settings.startWithWindows,args:settings.startMinimized?['--minimized']:[]});
}
const feedback=new FeedbackService(packageInfo.feedbackEndpoint);
let win:BrowserWindow|null=null,tray:Tray|null=null,repo:Repository,scheduler:ReminderScheduler,backups:RollingBackups,quitting=false,timer:NodeJS.Timeout|undefined;
function show(){if(!win)return;if(win.isMinimized())win.restore();win.show();win.focus();}
function view():AppData{const data=repo.getData();data.dataPath=app.getPath('userData');data.settings.googleClientSecret='';return data;}
function broadcast(){if(win&&!win.isDestroyed())win.webContents.send('desktop:data',view());}
function alert(message:Alert){const settings=repo.getData().settings;if(settings.inApp)win?.webContents.send('desktop:alert',message);if(settings.desktop&&Notification.isSupported()){const note=new Notification({title:message.title,body:message.body,silent:!settings.sound,icon:join(app.getAppPath(),'build/icon.png')});note.on('click',()=>{show();win?.webContents.send('desktop:alert',message);});note.show();}}
function trusted(event:Electron.IpcMainInvokeEvent){if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('Untrusted IPC sender');}
async function command(input:unknown):Promise<AppData>{
 const c=commandSchema.parse(input) as Command;
 if(c.type==='study.save'||c.type==='study.generate')await commerce.require('study');
 if(c.type==='addons.save'){const old=repo.getData().addons;for(const key of ['creator','habits','journal'] as const)if(JSON.stringify(old[key])!==JSON.stringify(c.addons[key]))await commerce.require(key);if(JSON.stringify(old.clients)!==JSON.stringify(c.addons.clients)||JSON.stringify(old.projects)!==JSON.stringify(c.addons.projects))await commerce.require('freelancer');}
 if(c.type==='settings.save'){if(c.settings.theme!=='enchanted-forest'&&c.settings.theme!==repo.getData().settings.theme)await commerce.require(c.settings.theme);if(c.settings.startWithWindows!==repo.getData().settings.startWithWindows||c.settings.startMinimized!==repo.getData().settings.startMinimized)await configureStartup(c.settings);}
 if(c.type==='data.openFolder')await shell.openPath(app.getPath('userData'));
 else if(c.type==='data.export'){const selected=await dialog.showSaveDialog(win!,{title:'Export Daywhisper backup',defaultPath:'daywhisper-backup.json',filters:[{name:'JSON backup',extensions:['json']}]});if(selected.filePath)await writeFile(selected.filePath,repo.exportBackup(),'utf8');}
 else if(c.type==='data.import'){const selected=await dialog.showOpenDialog(win!,{title:'Restore Daywhisper backup',properties:['openFile'],filters:[{name:'JSON backup',extensions:['json']}]});if(selected.filePaths[0]){const raw=await readFile(selected.filePaths[0],'utf8');backups.restore(raw);const settings=repo.getData().settings;try{await configureStartup(settings)}catch{repo.update(d=>{d.settings.startWithWindows=false});alert({title:'Startup setting needs attention',body:'Your backup was restored. Enable startup again in Settings.'})}}}
 else if(c.type==='notification.test')alert({title:'A little nudge from Daywhisper',body:'Your desktop reminders are ready.'});
 else if(c.type==='reminder.snooze')scheduler.snooze(c.id);
 else if(c.type==='reminder.dismiss')scheduler.dismiss(c.id);
 else{
  applyCommand(repo,c);

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
 tray=new Tray(join(app.getAppPath(),'build/icon.png'));tray.setToolTip('Daywhisper');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Daywhisper',click:show},{label:'Quit',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',show);
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',show);app.on('before-quit',()=>{quitting=true;});app.on('window-all-closed',()=>{if(!repo?.getData().settings.closeToTray)app.quit();});app.on('will-quit',()=>{if(timer)clearInterval(timer);tray?.destroy();repo?.close();});
 void app.whenReady().then(()=>{
  if(!process.windowsStore)app.setAppUserModelId('com.mytasks.forest');mkdirSync(app.getPath('userData'),{recursive:true});const databasePath=join(app.getPath('userData'),'my-tasks.sqlite');const fresh=!existsSync(databasePath);repo=new Repository(databasePath);if(fresh)repo.update(data=>{data.items=[];});
  backups=new RollingBackups(repo,join(app.getPath('userData'),'backups'),{onError:()=>alert({title:'Backup needs attention',body:'Could not save an automatic backup. Check free disk space and folder permissions.'})});
  scheduler=new ReminderScheduler(repo,alert);createWindow();
  ipcMain.handle('desktop:sponsor',async event=>{trusted(event);const sponsor=activeSponsor(sponsorConfig);if(!sponsor||isSupporter(await commerce.status()))return null;return {name:sponsor.name,message:sponsor.message};});
  ipcMain.handle('desktop:openSponsor',async event=>{trusted(event);const sponsor=activeSponsor(sponsorConfig);if(sponsor)await shell.openExternal(sponsor.url);});
  ipcMain.handle('desktop:commerce',event=>{trusted(event);return commerce.status()});
  ipcMain.handle('desktop:purchase',(event,key)=>{trusted(event);return commerce.purchase(z.enum(productKeys).parse(key))});
  ipcMain.handle('desktop:feedbackAvailable',event=>{trusted(event);return feedback.available;});
  ipcMain.handle('desktop:feedback',(event,input)=>{trusted(event);return feedback.send(input);});
  ipcMain.handle('desktop:getData',event=>{trusted(event);return view();});ipcMain.handle('desktop:command',(event,input)=>{trusted(event);return command(input);});
  ipcMain.handle('desktop:window',(event,action)=>{trusted(event);const kind=z.enum(['minimize','maximize','close','quit']).parse(action);if(kind==='minimize')win?.minimize();if(kind==='maximize'){if(win?.isMaximized())win.unmaximize();else win?.maximize();}if(kind==='close')win?.close();if(kind==='quit'){quitting=true;app.quit();}});
  const tick=()=>{try{scheduler.tick();backups.tick();broadcast();}catch(error){console.error('Background scheduler failed',error);}};const frequentTick=()=>{try{scheduler.tick();backups.tick();broadcast();}catch(error){console.error(error)}};timer=setInterval(frequentTick,1000);powerMonitor.on('resume',tick);tick();
 }).catch(error=>{dialog.showErrorBox('Daywhisper could not start',`${(error as Error).message}\nYour existing data has not been reset. Check the data folder permissions and free disk space.`);app.exit(1);});
}





