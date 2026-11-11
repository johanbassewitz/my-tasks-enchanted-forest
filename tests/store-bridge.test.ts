import {test,expect,vi} from 'vitest';
const invoke=vi.hoisted(()=>vi.fn());vi.mock('node:child_process',()=>({execFile:invoke}));
import {StoreBridge} from '../electron/store-bridge';
const path='C:\\Daywhisper\\Daywhisper.Store.exe';
test('Windows helper permits startup only, with fixed executable and validated arguments',async()=>{const bridge=new StoreBridge(path);await expect(bridge.startup('purchase' as any)).rejects.toThrow();expect(invoke).not.toHaveBeenCalled();expect(()=>new StoreBridge('relative.exe')).toThrow();expect('purchase' in bridge).toBe(false);expect('status' in bridge).toBe(false)});
test('startup honors disabled-by-user state',async()=>{invoke.mockImplementation((_p,_args,_opts,cb)=>cb(null,JSON.stringify({ok:true,action:'startup',state:'DisabledByUser'})));expect(await new StoreBridge(path).startup('enable')).toMatchObject({state:'DisabledByUser'})});
test('startup rejects malformed helper output',async()=>{invoke.mockImplementation((_p,_args,_opts,cb)=>cb(null,JSON.stringify({ok:true,state:'Enabled'})));await expect(new StoreBridge(path).startup('status')).rejects.toThrow()});
