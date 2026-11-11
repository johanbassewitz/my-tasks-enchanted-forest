import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import cloudConfig from '../config/cloud.json';
import packageInfo from '../package.json';

// This smoke test exercises the distributable preview edition, without Store credentials
// or live feedback delivery. Every persisted change is made through the visible UI.
test('Daywhisper themes, private feedback form and study tasks survive desktop restart',async({},testInfo)=>{
 test.setTimeout(120_000);
 test.skip(cloudConfig.enabled||Boolean(packageInfo.feedbackEndpoint),'This scenario requires the offline preview build.');
 const profile=await mkdtemp(join(tmpdir(),'daywhisper-e2e-'));
 const screenshotDir=resolve('artifacts/screenshots');
 await mkdir(screenshotDir,{recursive:true});
 let app:ElectronApplication|undefined;
 let page:Page;
 const launch=async()=>{
  app=await electron.launch({args:[resolve('.')],env:{...process.env,MY_TASKS_DATA_DIR:profile}});
  page=await app.firstWindow();
  await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1440,1000);window.center()});
  await expect(page.getByRole('heading',{name:/^Good (Morning|Afternoon|Evening)$/})).toBeVisible();
 };
 const navigate=async(name:string)=>{
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');
 };
 const capture=async(name:string)=>{
  await page.locator('main').evaluate(element=>element.scrollTo(0,0));
  const path=join(screenshotDir,`${name}.png`);
  await page.screenshot({path,animations:'disabled'});
  await testInfo.attach(name,{path,contentType:'image/png'});
 };
 try{
  await launch();
  await expect(page!.locator('.brand h1')).toHaveText('Daywhisper');
  await expect(page!.locator('html')).toHaveAttribute('data-theme','enchanted-forest');
  await capture('daywhisper-enchanted-forest');

  await page!.getByRole('button',{name:'Share feedback',exact:true}).click();
  const feedback=page!.getByRole('dialog',{name:'Share feedback'});
  await expect(feedback.getByRole('status')).toHaveText('Feedback sending is not available in this build yet.');
  await expect(feedback.getByLabel('Your feedback',{exact:true})).toBeVisible();
  await expect(feedback.getByLabel('Your email (optional, only if you want a reply)',{exact:true})).toBeVisible();
  await expect(feedback.getByRole('textbox')).toHaveCount(2);
  await expect(feedback.getByRole('textbox',{name:/recipient|subject|^to$/i})).toHaveCount(0);
  await feedback.getByLabel('Your feedback',{exact:true}).fill('A quiet, thoughtful place to plan.');
  await expect(feedback.getByRole('button',{name:'Send feedback',exact:true})).toBeDisabled();
  await feedback.getByRole('button',{name:'Cancel',exact:true}).click();

  await navigate('Shop');
  await expect(page!.getByText('Preview edition: try every theme and pack.',{exact:false})).toBeVisible();
  const purchaseButtons=page!.getByRole('button',{name:'Available in preview',exact:true});
  await expect(purchaseButtons).toHaveCount(9);
  for(const button of await purchaseButtons.all())await expect(button).toBeDisabled();

  await expect(page!.getByRole('button',{name:'Not connected yet',exact:true})).toBeDisabled();
  await navigate('AI');
  await expect(page!.getByRole('button',{name:'Generate task suggestions',exact:true})).toBeDisabled();
  await expect(page!.getByText('AI is not connected in this preview.',{exact:false})).toBeVisible();

  // Closing an isolated preview must not alter the active theme.
  await navigate('Settings');
  await page!.getByRole('button',{name:'Preview Midnight Observatory',exact:true}).click();
  await expect(page!.getByRole('dialog',{name:'Midnight Observatory'})).toBeVisible();
  await expect(page!.locator('html')).toHaveAttribute('data-theme','enchanted-forest');
  await page!.getByRole('button',{name:'Close preview',exact:true}).click();
  await expect(page!.locator('html')).toHaveAttribute('data-theme','enchanted-forest');

  for(const [id,name] of [['midnight-observatory','Midnight Observatory'],['amber-hearth','Amber Hearth']] as const){
   await navigate('Settings');
   await page!.getByRole('button',{name:`Preview ${name}`,exact:true}).click();
   await page!.getByRole('dialog',{name}).getByRole('button',{name:'Use this theme',exact:true}).click();
   await expect(page!.getByRole('dialog')).toHaveCount(0);
   await expect(page!.locator('html')).toHaveAttribute('data-theme',id);
   await navigate('Home');
   await capture(`daywhisper-${id}`);
  }

  await navigate('Study');
  await page!.getByRole('button',{name:'+ Add subject',exact:true}).click();
  await page!.getByRole('textbox',{name:/^Subject name /}).fill('Biology');
  const exam=await page!.evaluate(()=>{const day=new Date();day.setDate(day.getDate()+14);return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`});
  await page!.getByLabel('Exam date for Biology',{exact:true}).fill(exam);
  await page!.getByRole('spinbutton',{name:'Daily study minutes',exact:true}).fill('30');
  await page!.getByRole('button',{name:'+ Add chapter',exact:true}).click();
  await page!.getByRole('textbox',{name:'Chapter title',exact:true}).fill('Cell structure');
  await page!.getByRole('spinbutton',{name:'Estimated minutes for Cell structure',exact:true}).fill('45');
  await expect(page!.getByText('2 new sessions',{exact:true})).toBeVisible();
  await page!.getByRole('button',{name:'Save & generate tasks',exact:true}).click();
  await expect(page!.getByRole('status')).toHaveText('Revision tasks added to your calendar.');
  await expect(page!.getByRole('button',{name:'Save & generate tasks',exact:true})).toBeDisabled();
  await capture('daywhisper-study');
  await navigate('Tasks');
  await expect(page!.getByRole('button',{name:'Edit Biology: Cell structure',exact:true})).toHaveCount(2);
  await page!.getByRole('button',{name:'Edit Biology: Cell structure',exact:true}).first().click();
  await expect(page!.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Biology: Cell structure');

  await app!.close();app=undefined;
  await launch();
  await expect(page!.locator('html')).toHaveAttribute('data-theme','amber-hearth');
  await navigate('Study');
  await expect(page!.getByRole('textbox',{name:/^Subject name /})).toHaveValue('Biology');
  await expect(page!.getByRole('textbox',{name:'Chapter title',exact:true})).toHaveValue('Cell structure');
  await expect(page!.getByRole('spinbutton',{name:'Daily study minutes',exact:true})).toHaveValue('30');
  await expect(page!.getByRole('button',{name:'Save & generate tasks',exact:true})).toBeDisabled();
  await navigate('Tasks');
  await expect(page!.getByRole('button',{name:'Edit Biology: Cell structure',exact:true})).toHaveCount(2);
  await navigate('Settings');
  await expect(page!.locator('.theme-option.is-selected')).toContainText('Amber Hearth');

  // Unsaved Study edits must survive cancellation and reset after explicit discard.
  await navigate('Study');
  await page!.getByRole('textbox',{name:/^Subject name /}).fill('Unsaved biology');
  await page!.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Home',exact:true}).click();
  await expect(page!.getByRole('dialog',{name:'Keep your changes?'})).toBeVisible();
  await page!.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page!.getByRole('textbox',{name:/^Subject name /})).toHaveValue('Unsaved biology');
  await page!.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Home',exact:true}).click();
  await page!.getByRole('dialog').getByRole('button',{name:'Discard edits',exact:true}).click();
  await navigate('Study');
  await expect(page!.getByRole('textbox',{name:/^Subject name /})).toHaveValue('Biology');

  // A pack switch uses the same guard, including reset while staying on Packs.
  await navigate('Packs');
  await expect(page!.getByRole('navigation',{name:'Optional packs'})).toHaveCount(1);
  await page!.getByRole('button',{name:'+ New idea',exact:true}).click();
  await page!.getByRole('textbox',{name:'Content title',exact:true}).fill('Discarded idea');
  await page!.getByRole('navigation',{name:'Optional packs'}).getByRole('button',{name:'Journal',exact:true}).click();
  await expect(page!.getByRole('dialog',{name:'Keep your changes?'})).toBeVisible();
  await page!.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page!.getByRole('textbox',{name:'Content title',exact:true})).toHaveValue('Discarded idea');
  await page!.getByRole('navigation',{name:'Optional packs'}).getByRole('button',{name:'Journal',exact:true}).click();
  await page!.getByRole('dialog').getByRole('button',{name:'Discard edits',exact:true}).click();
  await page!.getByLabel('View the week containing',{exact:true}).fill('');
  await expect(page!.getByRole('alert')).toHaveText('Choose a valid date between years 0001 and 9999.');
  await expect(page!.getByRole('heading',{name:/^Week of /})).toBeVisible();
  await page!.getByRole('button',{name:'+ New entry',exact:true}).click();
  await page!.getByRole('textbox',{name:'Your entry',exact:true}).fill('Keep this reflection safe.');
  await page!.locator('.addons-page').getByLabel('Date',{exact:true}).fill('10000-01-01');
  await expect(page!.getByRole('status')).toHaveText('Choose a valid journal date between years 0001 and 9999.');
  await expect(page!.getByRole('textbox',{name:'Your entry',exact:true})).toHaveValue('Keep this reflection safe.');
  await page!.getByRole('navigation',{name:'Optional packs'}).getByRole('button',{name:'Creator',exact:true}).click();
  await page!.getByRole('dialog').getByRole('button',{name:'Discard edits',exact:true}).click();
  await expect(page!.getByRole('textbox',{name:'Content title',exact:true})).toHaveCount(0);

 }finally{
  // Cleanup must not block on a legitimate unsaved-edits dialog after an assertion fails.
  await app?.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.destroy()}).catch(()=>{});
  await app?.close();
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});
