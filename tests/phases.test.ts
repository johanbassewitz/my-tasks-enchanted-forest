import {describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Repository} from '../electron/repository';
import {applyCommand} from '../electron/commands';
import {ReminderScheduler} from '../electron/scheduler';
import {newItem,newPhase,newStep} from '../shared/defaults';
import {validateItem,validatePhase,toggleStep,isDone,isStepDone,stepProgress} from '../shared/domain';
import type {Item} from '../shared/types';

const task=(patch:Partial<Item>={}):Item=>({...newItem('task','2026-10-17'),title:'Buy soil',timezone:'UTC',...patch});
const steps=(...titles:string[])=>titles.map(t=>newStep(t));

describe('steps',()=>{
 it('completes a one-time task when its last step is ticked and reopens it when a step is unticked',()=>{
  let item=task({steps:steps('Measure','Order')});
  item=toggleStep(item,item.steps[0].id,item.date);expect(isDone(item,item.date)).toBe(false);expect(stepProgress(item,item.date)).toEqual({done:1,total:2});
  item=toggleStep(item,item.steps[1].id,item.date);expect(isDone(item,item.date)).toBe(true);
  item=toggleStep(item,item.steps[0].id,item.date);expect(isDone(item,item.date)).toBe(false);
 });
 it('gives each occurrence of a repeating task its own fresh steps',()=>{
  let item=task({repeat:'Daily',steps:steps('Stretch')});
  item=toggleStep(item,item.steps[0].id,'2026-10-18');
  expect(isStepDone(item,item.steps[0],'2026-10-18')).toBe(true);expect(isDone(item,'2026-10-18')).toBe(true);
  expect(isStepDone(item,item.steps[0],'2026-10-19')).toBe(false);expect(isDone(item,'2026-10-19')).toBe(false);
 });
 it('validates step fields',()=>{
  expect(()=>validateItem(task({steps:[{...newStep(''),title:' '}]}))).toThrow('needs a title');
  expect(()=>validateItem(task({repeat:'Weekly',steps:[{...newStep('Dated'),date:'2026-10-20'}]}))).toThrow('repeating task');
  expect(()=>validateItem(task({date:'',steps:[{...newStep('Timed'),time:'10:00'}]}))).toThrow('Choose a date');
  expect(()=>validateItem({...newItem('event','2026-10-17'),title:'Party',steps:steps('Cake')})).toThrow('Only tasks');
  const s=newStep('Dup');expect(()=>validateItem(task({steps:[s,s]}))).toThrow('unique');
  expect(validateItem(task({steps:[{...newStep('  Trim  '),reminders:[30,10,30]}]})).steps[0]).toMatchObject({title:'Trim',reminders:[10,30]});
 });
 it('ticks steps through commands and completes the task when every step is ticked in the editor',()=>{
  const r=new Repository(':memory:');const item=task({steps:steps('A','B')});applyCommand(r,{type:'item.save',item});
  applyCommand(r,{type:'step.complete',id:item.id,stepId:item.steps[0].id,date:item.date});
  expect(r.getData().items.find(i=>i.id===item.id)?.done).toBe(false);
  applyCommand(r,{type:'step.complete',id:item.id,stepId:item.steps[1].id,date:item.date});
  expect(r.getData().items.find(i=>i.id===item.id)?.done).toBe(true);
  const other=task({steps:steps('X').map(s=>({...s,done:true}))});applyCommand(r,{type:'item.save',item:other});
  expect(r.getData().items.find(i=>i.id===other.id)?.done).toBe(true);
  expect(()=>applyCommand(r,{type:'step.complete',id:item.id,stepId:'missing',date:item.date})).toThrow('Step no longer exists');r.close();
 });
 it('keeps step definitions on the series when one occurrence is edited',()=>{
  const r=new Repository(':memory:');const item=task({repeat:'Daily'});applyCommand(r,{type:'item.save',item});
  applyCommand(r,{type:'item.save',item:{...item,date:'2026-10-19',steps:steps('New step')},scope:'occurrence',occurrenceDate:'2026-10-19'});
  const saved=r.getData().items.find(i=>i.id===item.id)!;expect(saved.steps.map(s=>s.title)).toEqual(['New step']);expect(saved.exceptions['2026-10-19']).toBeUndefined();r.close();
 });
 it('schedules step reminders, using the step time and date, and drops them once the step is done',()=>{
  const r=new Repository(':memory:');const now=Date.UTC(2026,9,17,8);
  const item=task({time:'12:00',steps:[{...newStep('Call'),time:'10:00',reminders:[0],reminderEnabled:true},{...newStep('Pick up'),date:'2026-10-19',reminders:[60],reminderEnabled:true}]});
  r.update(d=>{d.items=[item]});const alerts:any[]=[];const s=new ReminderScheduler(r,a=>alerts.push(a));s.tick(now);
  const records=r.getData().reminders;expect(records.map(x=>x.due).sort()).toEqual([Date.UTC(2026,9,17,10),Date.UTC(2026,9,19,8)]);
  expect(records.find(x=>x.stepId===item.steps[0].id)?.title).toBe('Buy soil · Call');
  applyCommand(r,{type:'step.complete',id:item.id,stepId:item.steps[0].id,date:item.date});s.tick(now);
  expect(r.getData().reminders.find(x=>x.stepId===item.steps[0].id)?.enabled).toBe(false);
  s.tick(Date.UTC(2026,9,19,8));expect(alerts.map(a=>a.title)).toEqual(['Buy soil · Pick up']);r.close();
 });
 it('schedules step reminders on each occurrence of a repeating task',()=>{
  const r=new Repository(':memory:');const item=task({repeat:'Daily',time:'07:00',steps:[{...newStep('Water'),reminders:[0],reminderEnabled:true}]});
  r.update(d=>{d.items=[item]});new ReminderScheduler(r,()=>{}).tick(Date.UTC(2026,9,17,6));
  const ids=r.getData().reminders.filter(x=>x.stepId).map(x=>x.occurrenceDate);expect(ids).toContain('2026-10-17');expect(ids).toContain('2026-10-18');r.close();
 });
});

describe('phases',()=>{
 it('validates phase fields',()=>{
  expect(()=>validatePhase({...newPhase(),title:''})).toThrow('name');
  expect(()=>validatePhase({...newPhase(),title:'P',start:'2026-10-20',end:'2026-10-10'})).toThrow('end on or after');
  expect(()=>validatePhase({...newPhase(),title:'P',color:'green'})).toThrow('colour');
 });
 it('adds, orders and deletes phases while keeping their tasks',()=>{
  const r=new Repository(':memory:');const plan={...newPhase(),title:'Plan'},build={...newPhase(),title:'Build'},plant={...newPhase(),title:'Plant'};
  for(const phase of [plan,build,plant])applyCommand(r,{type:'phase.save',phase});
  expect(r.getData().phases.map(p=>[p.title,p.order])).toEqual([['Plan',0],['Build',1],['Plant',2]]);
  applyCommand(r,{type:'phase.save',phase:{...plant,title:'Planting'},position:0});
  expect(r.getData().phases.map(p=>p.title)).toEqual(['Planting','Plan','Build']);
  applyCommand(r,{type:'phase.save',phase:{...build,title:'Build beds'}});
  expect(r.getData().phases.map(p=>p.title)).toEqual(['Planting','Plan','Build beds']);
  const item=task({phaseId:build.id});applyCommand(r,{type:'item.save',item});
  expect(()=>applyCommand(r,{type:'item.save',item:task({phaseId:'gone'})})).toThrow('phase no longer exists');
  applyCommand(r,{type:'phase.delete',id:build.id});
  expect(r.getData().phases.map(p=>[p.title,p.order])).toEqual([['Planting',0],['Plan',1]]);
  expect(r.getData().items.find(i=>i.id===item.id)).toMatchObject({phaseId:'',deletedAt:null});r.close();
 });
 it('round-trips phases through backup and clears links to missing phases',()=>{
  const r=new Repository(':memory:');const phase={...newPhase(),title:'Plan'};applyCommand(r,{type:'phase.save',phase});
  applyCommand(r,{type:'item.save',item:task({phaseId:phase.id,steps:steps('One')})});
  const backup=JSON.parse(r.exportBackup());r.importBackup(JSON.stringify(backup));
  expect(r.getData().phases[0].title).toBe('Plan');expect(r.getData().items.find(i=>i.title==='Buy soil')?.steps[0].title).toBe('One');
  backup.phases=[];r.importBackup(JSON.stringify(backup));expect(r.getData().items.find(i=>i.title==='Buy soil')?.phaseId).toBe('');
  delete backup.phases;for(const i of backup.items){delete i.phaseId;delete i.steps;}r.importBackup(JSON.stringify(backup));
  expect(r.getData().items.every(i=>i.phaseId===''&&Array.isArray(i.steps))).toBe(true);r.close();
 });
 it('upgrades a version 2 database by adding empty phases and steps',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mytasks-v3-')),file=join(dir,'data.sqlite');new Repository(file).close();
  let db=new DatabaseSync(file);const row=db.prepare('SELECT json FROM state WHERE id=1').get() as {json:string};const old=JSON.parse(row.json);
  delete old.phases;for(const i of old.items){delete i.phaseId;delete i.steps;}
  db.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(old));db.exec('UPDATE schema_version SET version=2');db.close();
  const r=new Repository(file);expect(r.getData().phases).toEqual([]);expect(r.getData().items.every(i=>i.phaseId===''&&i.steps.length===0)).toBe(true);r.close();
  db=new DatabaseSync(file);expect(db.prepare('SELECT version FROM schema_version').get()?.version).toBe(3);db.close();rmSync(dir,{recursive:true,force:true});
 });
});
