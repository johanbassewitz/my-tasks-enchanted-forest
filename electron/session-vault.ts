import {safeStorage} from 'electron';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import type {SessionState,SessionVault} from './cloud-client';
/** OS-protected session separate from the planner database and its backups. */
export class ProtectedSessionVault implements SessionVault {
 private memory:SessionState|undefined;
 constructor(private file:string){}
 private secure(){return safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text')}
 read():SessionState{if(this.memory)return this.memory;try{if(this.secure()&&existsSync(this.file))this.memory=JSON.parse(safeStorage.decryptString(readFileSync(this.file)))}catch{/* Corrupted or another user's credentials: sign in again. */}return this.memory??={};}
 write(state:SessionState){this.memory=state;if(!this.secure())return;writeFileSync(this.file+'.tmp',safeStorage.encryptString(JSON.stringify(state)),{mode:0o600});renameSync(this.file+'.tmp',this.file)}
}
