import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Repository} from '../electron/repository';
import {commandSchema,applyCommand} from '../electron/commands';

describe('local-only upgrade',()=>{
 it('rejects removed network commands',()=>{
  for(const type of ['google.connect','google.disconnect','google.sync','google.createCalendar','google.openSetup','conflict.resolve'])
   expect(commandSchema.safeParse({type}).success).toBe(false);
 });
 it('preserves planning data while removing credentials and remote associations on upgrade',()=>{
  const dir=mkdtempSync(join(tmpdir(),'local-only-')),file=join(dir,'data.sqlite');
  let repo=new Repository(file);const original=repo.getData();repo.close();
  const db=new DatabaseSync(file);const legacy=structuredClone(original);
  legacy.items[0].synced=true;legacy.items[0].remoteId='remote';legacy.settings.googleClientId='client';legacy.google.connected=true;
  db.prepare('UPDATE state SET json=? WHERE id=1').run(JSON.stringify(legacy));
  db.exec("UPDATE schema_version SET version=3; INSERT INTO metadata VALUES('google.tokens.encrypted','\"token\"'); INSERT INTO metadata VALUES('googleClientSecret','\"secret\"'); INSERT INTO outbox(itemId,action) VALUES('old','upsert');");db.close();
  repo=new Repository(file);
  expect(repo.getData().items).toEqual(original.items);
  expect(repo.getData().settings.googleClientId).toBe('');expect(repo.getData().google.connected).toBe(false);
  expect(repo.getMeta('google.tokens.encrypted')).toBeUndefined();expect(repo.getMeta('googleClientSecret')).toBeUndefined();expect(repo.listOutbox()).toEqual([]);
  repo.close();rmSync(dir,{recursive:true});
 });
 it('cannot reactivate sync through old backups or item saves',()=>{
  const repo=new Repository(':memory:');const backup=JSON.parse(repo.exportBackup());backup.settings.googleClientId='old';backup.google.connected=true;backup.items[0].synced=true;
  repo.importBackup(JSON.stringify(backup));expect(repo.getData().settings.googleClientId).toBe('');
  applyCommand(repo,{type:'item.save',item:{...repo.getData().items[0],synced:true,remoteId:'old'}});
  expect(repo.getData().items[0].synced).toBe(false);expect(repo.listOutbox()).toEqual([]);repo.close();
 });
});
