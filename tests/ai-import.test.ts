import {test,expect} from 'vitest';
import {Repository} from '../electron/repository';
import {applyCommand} from '../electron/commands';
const id='a83d9c93-f797-48c4-8ebe-5dcc8ff5aa00';
test('reviewed AI tasks import atomically and retries do not duplicate them',()=>{const repo=new Repository(':memory:');try{const before=repo.getData().items.length;const c={type:'ai.import',requestId:id,tasks:[{title:'Read chapter',notes:'Start small',date:'2026-12-01',minutes:25}]};applyCommand(repo,c);applyCommand(repo,c);expect(repo.getData().items.length).toBe(before+1);expect(repo.getData().items.at(-1)).toMatchObject({title:'Read chapter',date:'2026-12-01',reminderEnabled:false})}finally{repo.close()}});
test('invalid AI dates reject the entire import',()=>{const repo=new Repository(':memory:');try{const before=repo.exportBackup();expect(()=>applyCommand(repo,{type:'ai.import',requestId:id,tasks:[{title:'Valid',notes:'',date:'',minutes:25},{title:'Invalid',notes:'',date:'2026-02-31',minutes:25}]})).toThrow();expect(repo.exportBackup()).toBe(before)}finally{repo.close()}});
