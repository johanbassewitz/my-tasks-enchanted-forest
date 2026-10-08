import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
test('native desktop navigation, task persistence and keyboard search',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'my-tasks-e2e-'));
 const launch=()=>electron.launch({args:[resolve('.')],env:{...process.env,MY_TASKS_DATA_DIR:profile}});
 let app=await launch();
 try{
  let page=await app.firstWindow();
  await expect(page.getByRole('heading',{name:'Good Morning'}).or(page.getByRole('heading',{name:'Good Afternoon'})).or(page.getByRole('heading',{name:'Good Evening'}))).toBeVisible();
  for(const name of ['Calendar','Focus','Categories','Tasks','Events','Reminders','Settings','Home']){
   await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('main')).toBeVisible();
  }
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Persistent desktop task');
  await page.getByRole('button',{name:'Add Task',exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit Persistent desktop task',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:'Complete Persistent desktop task',exact:true}).check();
  await app.evaluate(({app})=>app.quit());
  app=await launch();page=await app.firstWindow();
  await expect(page.getByRole('checkbox',{name:'Uncomplete Persistent desktop task',exact:true})).toBeChecked();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('textbox',{name:'Quick add task'})).toBeVisible();
 }finally{await app.close();await rm(profile,{recursive:true,force:true});}
});
