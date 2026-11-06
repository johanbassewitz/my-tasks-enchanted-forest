import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Repository } from './repository';

interface BackupOptions {
 intervalMs?:number;
 retention?:number;
 onError?:(error:unknown)=>void;
}
const automaticPattern=/^automatic-(\d{16})-[0-9a-f-]+\.json$/;
/** Plain JSON recovery copies independent of the live SQLite database.
 * Automatic copies roll; pre-restore copies are protected from that rotation.
 */
export class RollingBackups {
 private nextAttempt=0;
 private initialized=false;
 private readonly intervalMs:number;
 private readonly retention:number;
 constructor(private repository:Repository,private directory:string,private options:BackupOptions={}){
  this.intervalMs=options.intervalMs??6*60*60*1000;
  this.retention=options.retention??14;
  if(!Number.isFinite(this.intervalMs)||this.intervalMs<=0)throw new Error('Backup interval must be positive');
  if(!Number.isInteger(this.retention)||this.retention<1)throw new Error('Backup retention must be a positive integer');
 }
 private automaticFiles():string[]{return existsSync(this.directory)?readdirSync(this.directory).filter(name=>automaticPattern.test(name)).sort():[];}
 /** Safe to call from the scheduler. Failure preserves existing copies and retries in five minutes. */
 tick(now=Date.now()):void{
  if(now<this.nextAttempt)return;
  try{
   if(!this.initialized){
    const files=this.automaticFiles();
    const last=files.length?Number(automaticPattern.exec(files[files.length-1])![1]):0;
    this.initialized=true;
    if(last>0&&last<=now&&now-last<this.intervalMs){this.nextAttempt=last+this.intervalMs;return;}
   }
   this.write('automatic',now);
   // Only prune after a complete, flushed replacement is visible.
   const files=this.automaticFiles();
   for(const file of files.slice(0,Math.max(0,files.length-this.retention)))unlinkSync(join(this.directory,file));
   this.nextAttempt=now+this.intervalMs;
  }catch(error){this.nextAttempt=now+5*60*1000;this.options.onError?.(error);}
 }
 createBeforeRestore(now=Date.now()):string{return this.write('before-restore',now);}
 /** A failed safety copy must prevent replacing the live database. */
 restore(raw:string,now=Date.now()):void{this.createBeforeRestore(now);this.repository.importBackup(raw);}
 private write(kind:'automatic'|'before-restore',now:number):string{
  const raw=this.repository.exportBackup();
  mkdirSync(this.directory,{recursive:true});
  const destination=join(this.directory,`${kind}-${Math.trunc(now).toString().padStart(16,'0')}-${randomUUID()}.json`);
  const temporary=destination+'.tmp';let fd:number|undefined;
  try{
   fd=openSync(temporary,'wx',0o600);writeFileSync(fd,raw,'utf8');fsyncSync(fd);closeSync(fd);fd=undefined;
   renameSync(temporary,destination);
   return destination;
  }finally{
   if(fd!==undefined)closeSync(fd);
   if(existsSync(temporary))unlinkSync(temporary);
  }
 }
}
