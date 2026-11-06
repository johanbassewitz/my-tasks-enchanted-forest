import { execFile } from 'node:child_process';
import { isAbsolute, win32 } from 'node:path';
import { z } from 'zod';
const text=z.string().max(10000);
const storeId=z.string().regex(/^[A-Za-z0-9]{6,32}$/);
const hwnd=z.string().regex(/^[1-9][0-9]{0,19}$/).refine(v=>BigInt(v)<=0x7fffffffffffffffn,'Invalid window handle');
const startupAction=z.enum(['status','enable','disable']);
const statusSchema=z.object({ok:z.literal(true),action:z.literal('status'),products:z.array(z.object({storeId:text,title:text,price:text,owned:z.boolean()}).strict()).max(10000),license:z.object({isActive:z.boolean(),isTrial:z.boolean(),activeSkuIds:z.array(text).max(10000)}).strict()}).strict();
const purchaseSchema=z.object({ok:z.literal(true),action:z.literal('purchase'),storeId:text,status:z.enum(['Succeeded','AlreadyPurchased','NotPurchased','NetworkError','ServerError']),extendedError:text.nullable()}).strict();
const startupSchema=z.object({ok:z.literal(true),action:z.literal('startup'),state:z.enum(['Disabled','DisabledByUser','Enabled','DisabledByPolicy','EnabledByPolicy'])}).strict();
const errorSchema=z.object({ok:z.literal(false),error:z.object({code:text,message:text})});
export type StoreStatus=z.infer<typeof statusSchema>;
export type StorePurchase=z.infer<typeof purchaseSchema>;
export type StoreStartup=z.infer<typeof startupSchema>;
/** Main-process only. The executable path comes from the packaged resources, never IPC input. */
export class StoreBridge {
 constructor(private readonly executable:string){
  if(!(isAbsolute(executable)||win32.isAbsolute(executable))||!/[\\/]Daywhisper\.Store\.exe$/.test(executable))throw new Error('A fixed absolute Store helper path is required');
 }
 async status(windowHandle:string):Promise<StoreStatus>{return statusSchema.parse(await this.run(['status','--hwnd',hwnd.parse(windowHandle)],30000));}
 async purchase(productId:string,windowHandle:string):Promise<StorePurchase>{
  const id=storeId.parse(productId);
  const result=purchaseSchema.parse(await this.run(['purchase','--hwnd',hwnd.parse(windowHandle),'--store-id',id],180000));
  if(result.storeId!==id)throw new Error('Store returned a different product');
  return result;
 }
 async startup(action:'status'|'enable'|'disable'):Promise<StoreStartup>{return startupSchema.parse(await this.run(['startup','--action',startupAction.parse(action)],30000));}
 private run(args:string[],timeout:number):Promise<unknown>{
  return new Promise((resolve,reject)=>{
   execFile(this.executable,args,{encoding:'utf8',windowsHide:true,shell:false,timeout,maxBuffer:1024*1024},(error,stdout)=>{
    let value:unknown;
    try{value=JSON.parse(stdout);}catch{reject(new Error(error?'Store helper did not complete. Check Store status before retrying a purchase.':'Store helper returned invalid data'));return;}
    const failure=errorSchema.safeParse(value);
    if(failure.success){reject(new Error(`${failure.data.error.message} (${failure.data.error.code})`));return;}
    if(error){reject(new Error('Store helper did not complete. Check Store status before retrying a purchase.'));return;}
    resolve(value);
   });
  });
 }
}
