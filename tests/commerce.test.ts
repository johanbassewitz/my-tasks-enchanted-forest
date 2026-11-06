import {describe,it,expect} from 'vitest';
import {hasAccess,type CommerceStatus} from '../shared/commerce';
describe('feature access',()=>{
 it('does not grant packs from theme subscriptions',()=>{const s:CommerceStatus={mode:'store',prices:{},owned:['supporter-monthly']};expect(hasAccess(s,'amber-hearth')).toBe(true);expect(hasAccess(s,'study')).toBe(false)});
 it('preserves individual themes after subscription expires',()=>{const s:CommerceStatus={mode:'store',prices:{},owned:['amber-hearth']};expect(hasAccess(s,'amber-hearth')).toBe(true);expect(hasAccess(s,'midnight-observatory')).toBe(false)});
 it('never unlocks unavailable commerce without an existing verified grant',()=>{expect(hasAccess({mode:'unavailable',prices:{},owned:[]},'study')).toBe(false)});
});

import {vi} from 'vitest';
import {CommerceService,type StoreConfiguration} from '../electron/commerce';
import {productKeys} from '../shared/commerce';
import type {StoreBridge} from '../electron/store-bridge';
const config:StoreConfiguration={enabled:true,products:Object.fromEntries(productKeys.map(key=>[key,key==='study'?'9STUDY123456':key==='supporter-monthly'?'9SUPPORT1234':''])) as StoreConfiguration['products']};
function service(activeSkuIds:string[],products:unknown[]=[],isActive=true){
 const bridge={status:vi.fn().mockResolvedValue({ok:true,action:'status',products,license:{isActive,isTrial:false,activeSkuIds}}),purchase:vi.fn()} as unknown as StoreBridge;
 return {commerce:new CommerceService(config,true,bridge,()=> '1234'),bridge};
}
describe('verified Store licenses',()=>{
 it('preserves purchased access without a sellable catalog entry or online price',async()=>{
  const {commerce}=service(['9STUDY123456/0010']);
  expect(await commerce.status()).toMatchObject({mode:'store',owned:['study'],prices:{}});
  await expect(commerce.require('study')).resolves.toBeUndefined();
 });
 it('does not infer access from catalog ownership or similarly prefixed product IDs',async()=>{
  const {commerce}=service(['9STUDY123456OTHER/0010'],[{storeId:'9STUDY123456',title:'Study',price:'$1',owned:true}]);
  expect(await commerce.status()).toMatchObject({owned:[],prices:{study:'$1'}});
 });
 it('revokes expired subscription access while retaining a separate permanent license',async()=>{
  const {commerce,bridge}=service(['9STUDY123456/0010','9SUPPORT1234/0010']);
  expect(hasAccess(await commerce.status(),'amber-hearth')).toBe(true);
  vi.mocked(bridge.status).mockResolvedValue({ok:true,action:'status',products:[],license:{isActive:true,isTrial:false,activeSkuIds:['9STUDY123456/0010']}});
  const next=await commerce.status();expect(hasAccess(next,'amber-hearth')).toBe(false);expect(hasAccess(next,'study')).toBe(true);
 });
 it('does not grant access when the app license is inactive or verification fails',async()=>{
  const {commerce,bridge}=service(['9STUDY123456/0010'],[],false);
  expect((await commerce.status()).owned).toEqual([]);
  vi.mocked(bridge.status).mockRejectedValue(new Error('Store unavailable'));
  await expect(commerce.require('study')).rejects.toThrow('active purchase');
 });
});

import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const realRequire=createRequire(import.meta.url);
describe('Store artifact labeling',()=>{
 const build=(enabled:boolean,products:Record<string,string>)=>{
  const result={exports:{} as any};
  runInNewContext(readFileSync(new URL('../electron-builder.store.cjs',import.meta.url),'utf8'),{module:result,__dirname:fileURLToPath(new URL('..',import.meta.url)),require:(name:string)=>name==='./config/store.json'?{enabled,identityName:'Real.Identity',publisher:'CN=RealPublisher',publisherDisplayName:'Real Publisher',products}:realRequire(name)});
  return result.exports.appx.artifactName as string;
 };
 it('labels identity-configured builds as preview while commerce is disabled or products missing',()=>{
  expect(build(false,{study:'9STUDY123456'})).toContain('PREVIEW-');
  expect(build(true,{study:''})).toContain('PREVIEW-');
  expect(build(true,{study:'9STUDY123456'})).not.toContain('PREVIEW-');
 });
});
