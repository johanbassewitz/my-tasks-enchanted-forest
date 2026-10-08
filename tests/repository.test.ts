import { describe,it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../electron/repository';
import {DatabaseSync} from 'node:sqlite';

describe('durable repository',()=>{
 it('upgrades a prior database without reseeding and refuses a future schema',()=>{const dir=mkdtempSync(join(tmpdir(),'mytasks-migration-')),file=join(dir,'data.sqlite');let r=new Repository(file);r.update(d=>{d.items[0].title='Retained'});r.close();let db=new DatabaseSync(file);db.exec('UPDATE schema_version SET version=1');db.close();r=new Repository(file);expect(r.getData().items[0].title).toBe('Retained');r.close();db=new DatabaseSync(file);expect(db.prepare('SELECT version FROM schema_version').get()?.version).toBe(2);db.exec('UPDATE schema_version SET version=999');db.close();expect(()=>new Repository(file)).toThrow('newer version');rmSync(dir,{recursive:true,force:true})});
 it('imports the supplied prototype data without trusting simulated Google statuses',()=>{const r=new Repository(':memory:');r.importBackup(JSON.stringify({version:1,settings:{start:'Home',time:'12',week:'Monday',defaultReminder:30,connected:true},categories:[{id:'other',name:'Other',icon:'leaf'}],items:[{id:'legacy',title:'Old task',date:'',time:'',end:'',kind:'task',category:'Other',repeat:'Never',reminders:[30],synced:true,done:false}],focus:{mode:25}}));expect(r.getData().items[0]).toMatchObject({id:'legacy',title:'Old task',date:'',synced:false,syncState:'Local only'});r.close()});
 it('restores validated backup atomically with a recoverable copy and fresh remote links',()=>{
  const repo=new Repository(':memory:');const backup=JSON.parse(repo.exportBackup());backup.settings.time='24';backup.items[0].synced=true;backup.items[0].remoteId='old-remote';repo.importBackup(JSON.stringify(backup));expect(repo.getData().settings.time).toBe('24');expect(repo.getData().items[0].remoteId).toBe('');expect(repo.getMeta<string>('backup.beforeImport')).toContain('Lesson plan');repo.close();
 });
 it('commits edits across restart and rolls back a failing edit',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mytasks-')); const file=join(dir,'data.sqlite');
  let repo=new Repository(file); repo.update(d=>{d.settings.time='24'});
  expect(()=>repo.update(d=>{d.settings.time='12';throw new Error('cancel')})).toThrow('cancel');
  repo.close(); repo=new Repository(file); expect(repo.getData().settings.time).toBe('24'); repo.close();rmSync(dir,{recursive:true});
 });
 it('keeps a durable deduplicated retry queue without losing retry metadata',()=>{
  const repo=new Repository(':memory:'); repo.enqueue('abc');repo.enqueue('abc');
  expect(repo.listOutbox()).toHaveLength(1);const row=repo.listOutbox()[0];repo.failOutbox(row.id,'offline');
  expect(repo.listOutbox()[0].attempts).toBe(1);repo.enqueue('abc','delete');expect(repo.listOutbox()[0].action).toBe('delete');repo.close();
 });
 it('does not export secrets and rejects invalid backup before replacing live data',()=>{
  const repo=new Repository(':memory:');repo.setMeta('token','encrypted');repo.update(d=>{d.settings.googleClientSecret='secret'});
  expect(repo.exportBackup()).not.toContain('secret');expect(repo.exportBackup()).not.toContain('encrypted');
  expect(()=>repo.importBackup('{"version":1}')).toThrow();expect(repo.getData().settings.start).toBe('Home');repo.close();
 });
});

