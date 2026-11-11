import {createPublicKey,verify} from 'node:crypto';
import {z} from 'zod';
import {aiInputSchema,aiResultSchema,cloudAccountSchema,emailSchema,verifyCodeSchema,sessionResponseSchema,type CloudAccount} from '../shared/cloud';
import {productKeys,type ProductKey,type CommerceStatus} from '../shared/commerce';
export interface CloudConfig {enabled:boolean;preview:boolean;apiBase:string;checkoutOrigins:string[];licensePublicKey:string}
export interface SessionState {token?:string;license?:{payload:string;signature:string};purchasesDisabled?:boolean}
export interface SessionVault {read():SessionState;write(state:SessionState):void}
const licenseSchema=z.object({payload:z.string().max(10000),signature:z.string().max(1000)});
const commerceSchema=z.object({mode:z.enum(['paddle','unavailable']),owned:z.array(z.enum(productKeys)).max(20),prices:z.record(z.string(),z.string().max(100)),available:z.array(z.enum(productKeys)).max(20).optional(),license:licenseSchema.optional(),error:z.string().max(500).optional()});
const emptyAccount=(configured:boolean):CloudAccount=>({configured,email:null,freeRemaining:0,paidRemaining:0,freeLimit:0,resetAt:'',aiAvailable:false});
class ServiceError extends Error {constructor(message:string,readonly status:number){super(message)}}
export function validateExternalUrl(value:string,origins:string[]):string {
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!origins.includes(url.origin))throw Error('Untrusted checkout address. Nothing was opened.');return url.href;
}
export class CloudClient {
 private sessionGeneration=0;
 constructor(private config:CloudConfig,private vault:SessionVault,private request:typeof fetch=fetch){}
 get configured(){try{const u=new URL(this.config.apiBase);return this.config.enabled&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash}catch{return false}}
 private async call(path:string,body?:unknown,authenticated=true):Promise<unknown>{
  if(!this.configured)throw Error('Online services are not configured in this preview.');
  const token=['/auth/request','/auth/verify'].includes(path)?undefined:this.vault.read().token;if(authenticated&&!token)throw new ServiceError('Sign in to use purchases or AI.',401);
  const response=await this.request(this.config.apiBase.replace(/\/$/,'')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(path==='/ai/generate'?60000:20000),redirect:'error'});
  // Bound response bytes before parsing even if the service is misconfigured.
  const reader=response.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();throw Error('Service response was too large.')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode();
  let data:any;try{data=JSON.parse(raw)}catch{throw Error('The online service returned an invalid response.');}
  if(!response.ok){if(response.status===401&&token===this.vault.read().token)this.vault.write({purchasesDisabled:this.vault.read().purchasesDisabled});throw new ServiceError(typeof data?.error==='string'?data.error.slice(0,300):'The request could not be completed. Please try again.',response.status)}
  return data;
 }
 async requestCode(email:unknown){await this.call('/auth/request',{email:emailSchema.parse(email)},false)}
 async verifyCode(input:unknown){const generation=++this.sessionGeneration;const response=sessionResponseSchema.parse(await this.call('/auth/verify',verifyCodeSchema.parse(input),false));if(generation!==this.sessionGeneration){void this.request(this.config.apiBase.replace(/\/$/,'')+'/auth/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${response.token}`},body:'{}',signal:AbortSignal.timeout(10000),redirect:'error'}).catch(()=>{});throw Error('Sign-in was canceled. Please sign in again if needed.')}this.vault.write({token:response.token,purchasesDisabled:this.vault.read().purchasesDisabled});return this.account()}
 async logout(){this.sessionGeneration++;const revoke=this.call('/auth/logout',{}).catch(()=>{});this.vault.write({purchasesDisabled:this.vault.read().purchasesDisabled});void revoke;return emptyAccount(this.configured)}
 async account():Promise<CloudAccount>{const token=this.vault.read().token;if(!this.configured||!token)return emptyAccount(this.configured);const account=cloudAccountSchema.parse(await this.call('/account'));return token===this.vault.read().token?account:emptyAccount(this.configured)}
 get purchasesDisabled(){return this.vault.read().purchasesDisabled===true}
 setPurchasesDisabled(value:boolean){this.vault.write({...this.vault.read(),purchasesDisabled:value});}
 private offline():ProductKey[]{
  try{const state=this.vault.read();if(!state.token||!state.license||!this.config.licensePublicKey)return [];const {payload,signature}=licenseSchema.parse(state.license);const key=createPublicKey({key:Buffer.from(this.config.licensePublicKey,'base64'),format:'der',type:'spki'});if(!verify(null,Buffer.from(payload),key,Buffer.from(signature,'base64url')))return [];const grant=z.object({accountId:z.string(),email:emailSchema,owned:z.array(z.enum(productKeys)),expiresAt:z.number()}).parse(JSON.parse(payload));if(grant.expiresAt<=Date.now()||grant.expiresAt>Date.now()+7*86400000)return [];return grant.owned}catch{return []}
 }
 async commerce():Promise<CommerceStatus>{
  if(!this.configured)return {mode:this.config.preview?'preview':'unavailable',owned:[],prices:{},available:[],error:this.config.preview?undefined:'Online purchases are not configured.'};
  const originalToken=this.vault.read().token;
  try{const status=commerceSchema.parse(await this.call('/commerce',undefined,false));const state=this.vault.read();if(state.token!==originalToken)return {mode:'unavailable',owned:[],prices:{},available:[]};if(state.token)this.vault.write({...state,license:status.license});return status;}
  catch(e){const owned=e instanceof ServiceError&&e.status<500?[]:this.offline();return {mode:'unavailable',owned,prices:{},available:[],error:owned.length?'Offline: using recently verified purchases. Reconnect to refresh.':'Could not verify purchases. Core planning and exports remain available.'}}
 }
 async checkout(key:ProductKey){if(this.purchasesDisabled)throw Error('Purchases are disabled on this device. Enable them in Account.');const result=z.object({url:z.string().max(3000)}).parse(await this.call('/checkout',{key:z.enum(productKeys).parse(key)}));return validateExternalUrl(result.url,this.config.checkoutOrigins)}
 async portal(){const result=z.object({url:z.string().max(3000)}).parse(await this.call('/portal',{}));return validateExternalUrl(result.url,['https://customer-portal.paddle.com','https://sandbox-customer-portal.paddle.com'])}
 async generate(input:unknown){if(!this.configured)throw Error('Online services are not configured in this preview.');const request=aiInputSchema.parse(input);const result=aiResultSchema.parse(await this.call('/ai/generate',request));if(result.requestId!==request.requestId)throw Error('The AI response did not match this request. Retry to recover your result.');return result}
}
