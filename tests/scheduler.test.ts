import { describe,it,expect } from 'vitest';
import { Repository } from '../electron/repository';
import { ReminderScheduler } from '../electron/scheduler';
import { newItem } from '../shared/defaults';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('durable reminder delivery',()=>{
 it('exposes actual future alert dates beyond tomorrow',()=>{const repo=new Repository(':memory:');const now=Date.UTC(2026,9,8,12);repo.update(d=>{d.items=[{...newItem('task','2026-11-20'),id:'later',title:'Later',time:'12:00',timezone:'UTC',reminders:[0],reminderEnabled:true}]});const s=new ReminderScheduler(repo,()=>{});s.tick(now);expect(repo.getData().reminders[0].due).toBe(Date.UTC(2026,10,20,12));repo.close()});
 it('cancels a snoozed reminder when its reminder configuration is disabled',()=>{const repo=new Repository(':memory:');const now=Date.UTC(2026,9,8,12);repo.update(d=>{d.items=[{...newItem('task','2026-10-08'),id:'t',title:'Tea',time:'12:00',timezone:'UTC',reminders:[0],reminderEnabled:true}]});const alerts:any[]=[];const s=new ReminderScheduler(repo,a=>alerts.push(a));s.tick(now);s.snooze(repo.getData().reminders[0].id,now);repo.update(d=>{d.items[0].reminderEnabled=false});s.tick(now+600000);expect(alerts).toHaveLength(1);repo.close()});
 it('delivers once after restart and delivers snooze again at its deadline',()=>{
  const repo=new Repository(':memory:');const now=Date.UTC(2026,9,8,12);
  repo.update(d=>{d.items=[{...newItem('task','2026-10-08'),id:'task',title:'Tea',time:'12:00',timezone:'UTC',reminders:[0],reminderEnabled:true}]});
  const alerts:any[]=[];let scheduler=new ReminderScheduler(repo,a=>alerts.push(a));scheduler.tick(now);
  expect(alerts).toHaveLength(1);scheduler=new ReminderScheduler(repo,a=>alerts.push(a));scheduler.tick(now+1000);expect(alerts).toHaveLength(1);
  scheduler.snooze(repo.getData().reminders[0].id,now+1000);scheduler.tick(now+301000);expect(alerts).toHaveLength(1);scheduler.tick(now+601000);expect(alerts).toHaveLength(2);repo.close();
 });
 it('summarizes multiple missed reminders and suppresses completed tasks',()=>{
  const repo=new Repository(':memory:');const now=Date.UTC(2026,9,8,12);
  repo.update(d=>{d.items=[0,1,2].map(n=>({...newItem('task','2026-10-08'),id:'t'+n,title:'Task '+n,time:'10:00',timezone:'UTC',reminders:[0],reminderEnabled:true,done:n===2}))});
  const alerts:any[]=[];new ReminderScheduler(repo,a=>alerts.push(a)).tick(now);expect(alerts).toHaveLength(1);expect(alerts[0].body).toContain('2');repo.close();
 });
});





it('does not write SQLite on idle ticks or active countdown, and completes once after restart',()=>{
 const repo=new Repository(':memory:');
 // total_changes observes real SQL writes on the repository connection.
 const db=(repo as unknown as {db:import('node:sqlite').DatabaseSync}).db;
 const changes=()=>db.prepare('SELECT total_changes() AS n').get()!.n;
 const now=Date.UTC(2026,9,8,12),alerts:unknown[]=[];
 repo.update(d=>{d.items=[];d.reminders=[];d.focus={...d.focus,running:true,remaining:60,deadline:now+60000,sessionId:'durable-session'};});
 let scheduler=new ReminderScheduler(repo,a=>alerts.push(a));scheduler.tick(now);
 const before=changes();for(let i=1;i<60;i++)scheduler.tick(now+i*1000);
 expect(changes()).toBe(before);expect(repo.getData().focus.deadline).toBe(now+60000);
 scheduler=new ReminderScheduler(repo,a=>alerts.push(a));scheduler.tick(now+3600000);scheduler.tick(now+3601000);
 expect(alerts).toHaveLength(1);expect(repo.getData().focus.history.filter(h=>h.id==='durable-session')).toHaveLength(1);
 const idle=changes();scheduler.tick(now+3602000);expect(changes()).toBe(idle);repo.close();
});

it('recovers a running focus deadline from disk after sleep and a process restart',()=>{
 const directory=mkdtempSync(join(tmpdir(),'daywhisper-focus-')),file=join(directory,'data.sqlite');
 const now=Date.UTC(2026,9,8,12);let repo=new Repository(file);const alerts:unknown[]=[];
 try{
  repo.update(d=>{d.items=[];d.reminders=[];d.focus={...d.focus,running:true,remaining:60,deadline:now+60000,sessionId:'restart-session'};});
  new ReminderScheduler(repo,a=>alerts.push(a)).tick(now+30000);repo.close();repo=new Repository(file);
  new ReminderScheduler(repo,a=>alerts.push(a)).tick(now+86400000);
  expect(repo.getData().focus).toMatchObject({running:false,remaining:0,deadline:null});
  expect(repo.getData().focus.history.at(-1)).toMatchObject({id:'restart-session',completedAt:now+60000});
  repo.close();repo=new Repository(file);new ReminderScheduler(repo,a=>alerts.push(a)).tick(now+86401000);
  expect(alerts).toHaveLength(1);
 }finally{repo.close();rmSync(directory,{recursive:true,force:true});}
});
