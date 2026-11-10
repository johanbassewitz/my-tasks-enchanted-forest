import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
test('music plays across navigation and reminder preferences persist',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'daywhisper-audio-'));
 const launch=()=>electron.launch({args:[resolve('.')],env:{...process.env,MY_TASKS_DATA_DIR:profile}});
 let app=await launch();
 try{
 let page=await app.firstWindow();
 await page.getByRole('button',{name:'Ambient music',exact:true}).click();
 await page.getByLabel('Add music files').setInputFiles(resolve('public/audio/moonbell.wav'));
 await page.getByRole('button',{name:'Play music',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause music',exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.currentTime)).toBeGreaterThan(0);
 await page.keyboard.press('Escape');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.paused)).toBe(false);
 await page.getByLabel('Reminder tone',{exact:true}).selectOption('woodland');
 await page.getByRole('button',{name:'Preview sound',exact:true}).click();
 await page.getByRole('button',{name:'Ambient music',exact:true}).click();
 await page.getByRole('button',{name:'Stop music',exact:true}).click();
 await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.paused)).toBe(true);
 await page.keyboard.press('Escape');
 await app.close();app=await launch();page=await app.firstWindow();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByLabel('Reminder tone',{exact:true})).toHaveValue('woodland');
 await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.paused)).toBe(true);
 }finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy()}).catch(()=>{});await app.close().catch(()=>{});await rm(profile,{recursive:true,force:true})}
});
