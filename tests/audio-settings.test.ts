import {test,expect} from 'vitest';
import {settingsSchema,Repository} from '../electron/repository';
import {defaultSettings} from '../shared/defaults';
test('legacy backups acquire gentle audio defaults without enabling sound',()=>{const old={...defaultSettings()} as Record<string,unknown>;delete old.reminderTone;delete old.soundVolume;const settings=settingsSchema.parse(old);expect(settings).toMatchObject({reminderTone:'moonbell',soundVolume:0.35,sound:false});});
test('audio preferences reject unsafe asset paths and volumes',()=>{expect(settingsSchema.safeParse({...defaultSettings(),reminderTone:'../../other',soundVolume:2}).success).toBe(false)});
test('audio choices survive backup restore',()=>{const repo=new Repository(':memory:');try{const backup=JSON.parse(repo.exportBackup());backup.settings.reminderTone='woodland';backup.settings.soundVolume=0.2;repo.importBackup(JSON.stringify(backup));expect(repo.getData().settings).toMatchObject({reminderTone:'woodland',soundVolume:0.2});}finally{repo.close()}});
