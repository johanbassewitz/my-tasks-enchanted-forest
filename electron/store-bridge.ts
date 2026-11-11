import {execFile} from 'node:child_process';
import {isAbsolute,win32} from 'node:path';
import {z} from 'zod';
const startupSchema=z.object({ok:z.literal(true),action:z.literal('startup'),state:z.enum(['Disabled','DisabledByUser','Enabled','DisabledByPolicy','EnabledByPolicy'])}).strict();
/** Package-only Windows startup. This helper has no payment or licensing APIs. */
export class StoreBridge {
 constructor(private executable:string){if(!(isAbsolute(executable)||win32.isAbsolute(executable))||!/[\\/]Daywhisper\.Store\.exe$/.test(executable))throw Error('A fixed absolute startup helper path is required')}
 async startup(action:'status'|'enable'|'disable'){
  const validated=z.enum(['status','enable','disable']).parse(action);
  return new Promise<z.infer<typeof startupSchema>>((resolve,reject)=>{execFile(this.executable,['startup','--action',validated],{encoding:'utf8',windowsHide:true,shell:false,timeout:30000,maxBuffer:65536},(error,stdout)=>{try{if(error)throw Error('Windows startup helper failed');resolve(startupSchema.parse(JSON.parse(stdout)))}catch{reject(Error('Windows could not update the startup preference.'))}})});
 }
}
