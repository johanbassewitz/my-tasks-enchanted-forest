import {hasAccess,type ProductKey,type CommerceStatus} from '../shared/commerce';
import type {CloudClient} from './cloud-client';
/** Paddle is the sole billing provider, in both direct and Microsoft Store packages. */
export class CommerceService {
 constructor(private cloud:CloudClient,private openExternal:(url:string)=>Promise<void>){}
 status():Promise<CommerceStatus>{return this.cloud.commerce()}
 async require(key:ProductKey){if(!hasAccess(await this.status(),key))throw Error('This feature needs an active purchase. Sign in and restore purchases in Themes & packs.')}
 async purchase(key:ProductKey){const url=await this.cloud.checkout(key);await this.openExternal(url);return this.status()}
}
