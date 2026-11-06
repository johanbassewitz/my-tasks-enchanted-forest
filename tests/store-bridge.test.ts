import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { StoreBridge } from '../electron/store-bridge';
vi.mock('node:child_process',()=>({execFile:vi.fn()}));
const invoke=vi.mocked(execFile);
const executable='/application/native/Daywhisper.Store.exe';
function output(value:unknown,error:Error|null=null){invoke.mockImplementationOnce((...args:any[])=>{args.at(-1)(error,JSON.stringify(value),'');return {} as any;});}
beforeEach(()=>vi.clearAllMocks());
describe('Store process boundary',()=>{
 it('uses the fixed helper with no shell, bounded time and owner HWND',async()=>{
  const value={ok:true,action:'status',products:[{storeId:'9ABC123',title:'Theme',price:'$1.00',owned:false}],license:{isActive:true,isTrial:false,activeSkuIds:[]}};
  output(value);expect(await new StoreBridge(executable).status('1234')).toEqual(value);
  expect(invoke).toHaveBeenCalledWith(executable,['status','--hwnd','1234'],expect.objectContaining({shell:false,timeout:30000,windowsHide:true,maxBuffer:1048576}),expect.any(Function));
 });
 it('rejects invalid actions and arguments before spawning',async()=>{
  const bridge=new StoreBridge(executable);
  await expect(bridge.purchase('bad;command','1234')).rejects.toThrow();
  await expect(bridge.status('0')).rejects.toThrow();
  await expect(bridge.startup('arbitrary' as any)).rejects.toThrow();
  expect(invoke).not.toHaveBeenCalled();expect(()=>new StoreBridge('relative.exe')).toThrow();
 });
 it('preserves canceled and failed purchase outcomes without granting ownership',async()=>{
  const bridge=new StoreBridge(executable);
  for(const status of ['NotPurchased','NetworkError','ServerError']){
   output({ok:true,action:'purchase',storeId:'9ABC123',status,extendedError:null});
   expect((await bridge.purchase('9ABC123','1234')).status).toBe(status);
  }
 });
 it('rejects malformed, mismatched and failed helper responses',async()=>{
  const bridge=new StoreBridge(executable);
  output({ok:true,action:'status',products:[],license:{isActive:true}});await expect(bridge.status('1234')).rejects.toThrow();
  output({ok:true,action:'startup',state:'Enabled'});await expect(bridge.status('1234')).rejects.toThrow();
  output({ok:false,error:{code:'0x80070005',message:'Store unavailable'}},new Error('exit 1'));await expect(bridge.status('1234')).rejects.toThrow('Store unavailable');
  output({},new Error('timeout'));await expect(bridge.status('1234')).rejects.toThrow();
 });
 it('returns policy-controlled startup state without claiming enabled',async()=>{
  output({ok:true,action:'startup',state:'DisabledByUser'});
  expect(await new StoreBridge(executable).startup('enable')).toEqual({ok:true,action:'startup',state:'DisabledByUser'});
 });
});
