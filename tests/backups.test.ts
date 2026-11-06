import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../electron/repository';
import { RollingBackups } from '../electron/backups';

vi.mock('node:fs',{spy:true});
const cleanup:(()=>void)[]=[];
afterEach(()=>{for(const fn of cleanup.splice(0))fn();});
function setup(){const root=mkdtempSync(join(tmpdir(),'daywhisper-backups-'));const repo=new Repository(':memory:');cleanup.push(()=>{repo.close();rmSync(root,{recursive:true,force:true});});return {root,repo};}
describe('rolling backups',()=>{
 it('writes readable atomic snapshots on schedule, rotates only automatic files and resumes schedule after restart',()=>{
  const {root,repo}=setup(),directory=join(root,'backups');const service=new RollingBackups(repo,directory,{intervalMs:1000,retention:2});
  const protectedFile=service.createBeforeRestore(1000);service.tick(1000);service.tick(1500);
  expect(readdirSync(directory)).toHaveLength(2);
  service.tick(2000);service.tick(3000);
  const files=readdirSync(directory);expect(files).toHaveLength(3);expect(readFileSync(protectedFile,'utf8')).toContain('Lesson plan');
  for(const file of files)expect(JSON.parse(readFileSync(join(directory,file),'utf8')).version).toBe(1);
  new RollingBackups(repo,directory,{intervalMs:1000,retention:2}).tick(3500);expect(readdirSync(directory)).toEqual(files);
 });
 it('preserves the pre-restore state outside SQLite and aborts restore when that safety copy cannot be written',()=>{
  const {root,repo}=setup(),directory=join(root,'backups');const raw=JSON.parse(repo.exportBackup());raw.items[0].title='Restored';
  const service=new RollingBackups(repo,directory);service.restore(JSON.stringify(raw),1000);
  expect(repo.getData().items[0].title).toBe('Restored');expect(readFileSync(join(directory,readdirSync(directory)[0]),'utf8')).toContain('Lesson plan');
  const blocked=join(root,'blocked');writeFileSync(blocked,'file');raw.items[0].title='Unsafe';
  expect(()=>new RollingBackups(repo,blocked).restore(JSON.stringify(raw))).toThrow();expect(repo.getData().items[0].title).toBe('Restored');
 });
 it('reports automatic failures without losing live data and retries after backoff',()=>{
  const {root,repo}=setup(),directory=join(root,'blocked');writeFileSync(directory,'file');const errors:unknown[]=[];
  const service=new RollingBackups(repo,directory,{onError:error=>errors.push(error)});
  expect(()=>service.tick(1000)).not.toThrow();service.tick(2000);expect(errors).toHaveLength(1);expect(repo.getData().items[0].title).toBe('Lesson plan');
  rmSync(directory);service.tick(301000);expect(readdirSync(directory)).toHaveLength(1);
 });
 it('keeps existing recovery files and cleans temporary output if atomic rename fails',()=>{
  const {root,repo}=setup(),directory=join(root,'backups'),errors:unknown[]=[];
  const service=new RollingBackups(repo,directory,{intervalMs:1000,retention:1,onError:error=>errors.push(error)});
  service.tick(1000);const originalFiles=readdirSync(directory),original=readFileSync(join(directory,originalFiles[0]),'utf8');
  repo.update(d=>{d.items[0].title='New edit';});
  const rename=vi.spyOn(fs,'renameSync').mockImplementationOnce(()=>{throw new Error('Disk unavailable');});
  try{service.tick(2000);}finally{rename.mockRestore();}
  expect(errors).toHaveLength(1);expect(readdirSync(directory)).toEqual(originalFiles);
  expect(readFileSync(join(directory,originalFiles[0]),'utf8')).toBe(original);
  expect(repo.getData().items[0].title).toBe('New edit');
 });
 it('invalid imports leave live data unchanged and retain the recovery snapshot',()=>{
  const {root,repo}=setup(),directory=join(root,'backups');const before=repo.exportBackup();
  expect(()=>new RollingBackups(repo,directory).restore('{"version":1}',1000)).toThrow();
  expect(repo.exportBackup()).toBe(before);expect(readdirSync(directory)).toHaveLength(1);
 });
});
