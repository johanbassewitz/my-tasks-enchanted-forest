import {hasAccess,productKeys,type CommerceStatus,type ProductKey} from '../shared/commerce';
import type {StoreBridge} from './store-bridge';
export interface StoreConfiguration {enabled:boolean;products:Record<ProductKey,string>}
export class CommerceService {
 private snapshot:CommerceStatus={mode:'unavailable',owned:[],prices:{}};
 constructor(private config:StoreConfiguration,private packaged:boolean,private bridge:StoreBridge,private hwnd:()=>string){}
 async status():Promise<CommerceStatus>{
  if(!this.config.enabled)return this.snapshot={mode:'preview',owned:[],prices:{}};
  if(!this.packaged)return this.snapshot={mode:'unavailable',owned:[],prices:{},error:'Purchases require the Microsoft Store edition of Daywhisper.'};
  try{
   const actual=await this.bridge.status(this.hwnd());const owned:ProductKey[]=[];const prices:CommerceStatus['prices']={};
   for(const key of productKeys){
    const id=this.config.products[key];if(!id)continue;
    const product=actual.products.find(p=>p.storeId===id);if(product)prices[key]=product.price;
    // SKU Store IDs use the product ID followed by / and the SKU component.
    // Entitlement must survive offline catalogs, delisting, and trial SKU changes.
    if(actual.license.isActive&&actual.license.activeSkuIds.some(sku=>sku.split('/')[0]===id))owned.push(key);
   }
   return this.snapshot={mode:'store',owned,prices};
  }catch{return this.snapshot={mode:'unavailable',owned:[],prices:{},error:'Could not verify Store access. Core planning and data export remain available. Try Restore purchases when connected.'}}
 }
 async require(key:ProductKey):Promise<void>{const status=await this.status();if(!hasAccess(status,key))throw Error('This feature needs an active purchase. Open Themes & packs to restore access.');}
 async purchase(key:ProductKey):Promise<CommerceStatus>{
  if(!productKeys.includes(key)||!this.config.enabled||!this.packaged||!this.config.products[key])throw Error('Purchases are not available in this build.');
  const result=await this.bridge.purchase(this.config.products[key],this.hwnd());
  if(result.status!=='Succeeded'&&result.status!=='AlreadyPurchased')throw Error(result.status==='NotPurchased'?'Purchase cancelled. Nothing was unlocked.':'The Store could not confirm the purchase. Restore purchases before trying again.');
  return this.status();
 }
}
