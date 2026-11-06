import {afterEach,describe,expect,it,vi} from 'vitest';
import {Repository} from '../electron/repository';
import {applyCommand} from '../electron/commands';
import {defaultStudy} from '../shared/study';

const opened:Repository[]=[];
function setup(){
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
 const repo=new Repository(':memory:');opened.push(repo);
 repo.update(data=>{data.items=[];data.settings.timezone='UTC';data.study={...defaultStudy(),subjects:[{id:'subject',name:'Biology',examDate:'2026-11-10',chapters:[{id:'chapter',title:'Cells',minutes:60,done:false}]}]}});
 applyCommand(repo,{type:'study.generate'});return repo;
}
afterEach(()=>{for(const repo of opened.splice(0))repo.close();vi.useRealTimers()});
describe('study persistence invariants',()=>{
 it('moves allocation capacity with a task and keeps repeated generation idempotent',()=>{
  const repo=setup(),task=repo.getData().items[0];
  applyCommand(repo,{type:'item.save',item:{...task,date:'2026-11-07'}});
  expect(repo.getData().study.sessions[0].date).toBe('2026-11-07');
  const study=repo.getData().study;study.subjects[0].chapters[0].minutes=120;
  applyCommand(repo,{type:'study.save',study});applyCommand(repo,{type:'study.generate'});applyCommand(repo,{type:'study.generate'});
  expect(repo.getData().items.map(item=>item.date).sort()).toEqual(['2026-11-06','2026-11-07']);
  expect(repo.getData().study.sessions).toHaveLength(2);
 });
 it.each([{date:''},{repeat:'Daily'},{kind:'event'}])('rejects an unrepresentable study task edit atomically: %j',patch=>{
  const repo=setup(),before=repo.exportBackup();expect(()=>applyCommand(repo,{type:'item.save',item:{...repo.getData().items[0],...patch}})).toThrow('dated, one-time task');expect(repo.exportBackup()).toBe(before);
 });
 it('rejects missing study task references before replacing data or the safety copy',()=>{
  const repo=setup(),before=repo.exportBackup(),backup=JSON.parse(before);backup.items=[];
  expect(()=>repo.importBackup(JSON.stringify(backup))).toThrow('missing task');expect(repo.exportBackup()).toBe(before);expect(repo.getMeta('backup.beforeImport')).toBeUndefined();
 });
 it('repairs stale allocation dates from linked tasks on import',()=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());backup.items[0].date='2026-11-08';repo.importBackup(JSON.stringify(backup));expect(repo.getData().study.sessions[0].date).toBe('2026-11-08');
 });
 it('preserves history for deleted tasks and removed subjects or chapters',()=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());backup.items[0].deletedAt='2026-11-06T12:00:00Z';backup.study.subjects=[];repo.importBackup(JSON.stringify(backup));expect(repo.getData().study.sessions).toHaveLength(1);expect(repo.getData().items[0].deletedAt).toBeTruthy();
 });
 it('rejects allocations that attribute an existing chapter to another subject',()=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());backup.study.sessions[0].subjectId='wrong';expect(()=>repo.importBackup(JSON.stringify(backup))).toThrow('different subject');
 });
 it.each([{kind:'event'},{repeat:'Daily'},{date:''}])('rejects invalid imported linked task shape: %j',patch=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());Object.assign(backup.items[0],patch);expect(()=>repo.importBackup(JSON.stringify(backup))).toThrow('dated, one-time task');
 });
});
describe('focus backup validation',()=>{
 const session={id:'focus',date:'2026-11-06',minutes:25,task:'',goal:'Reading',completedAt:1793966400000};
 it.each([{minutes:-999},{minutes:0},{minutes:1441},{date:'2026-02-30'},{date:'not-a-date'},{completedAt:-1},{completedAt:8640000000000001},{id:''}])('rejects invalid history without replacing live data: %j',patch=>{
  const repo=setup(),before=repo.exportBackup(),backup=JSON.parse(before);backup.focus.history=[{...session,...patch}];expect(()=>repo.importBackup(JSON.stringify(backup))).toThrow();expect(repo.exportBackup()).toBe(before);
 });
 it('rejects duplicate session IDs that would inflate focus totals',()=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());backup.focus.history=[session,session];expect(()=>repo.importBackup(JSON.stringify(backup))).toThrow('Duplicate focus');
 });
 it('allows valid fractional focus minutes and historical task references',()=>{
  const repo=setup(),backup=JSON.parse(repo.exportBackup());backup.focus.history=[{...session,minutes:1.5,task:'removed-historical-task'}];repo.importBackup(JSON.stringify(backup));expect(repo.getData().focus.history[0].minutes).toBe(1.5);
 });
});
