import { describe,it,expect } from 'vitest';
import { Repository } from '../electron/repository';
import { ReminderScheduler } from '../electron/scheduler';
import { newItem } from '../shared/defaults';

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




