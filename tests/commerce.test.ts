import {test,expect,vi} from 'vitest';
import {hasAccess,type CommerceStatus} from '../shared/commerce';
import {CommerceService} from '../electron/commerce';
import type {CloudClient} from '../electron/cloud-client';
test('supporter grants themes but no packs or AI credits',()=>{const s:CommerceStatus={mode:'paddle',owned:['supporter-monthly'],prices:{}};expect(hasAccess(s,'amber-hearth')).toBe(true);expect(hasAccess(s,'study')).toBe(false);expect(hasAccess(s,'ai-credits-50')).toBe(false)});
test('checkout opens only through the backend and does not infer ownership',async()=>{const open=vi.fn().mockResolvedValue(undefined);const cloud={checkout:vi.fn().mockResolvedValue('https://pay.example.com/checkout'),commerce:vi.fn().mockResolvedValue({mode:'paddle',owned:[],prices:{}})} as unknown as CloudClient;const service=new CommerceService(cloud,open);expect((await service.purchase('study')).owned).toEqual([]);expect(open).toHaveBeenCalledWith('https://pay.example.com/checkout');await expect(service.require('study')).rejects.toThrow('active purchase')});
test('separately purchased themes survive supporter cancellation',()=>{expect(hasAccess({mode:'paddle',owned:['amber-hearth'],prices:{}},'amber-hearth')).toBe(true);expect(hasAccess({mode:'unavailable',owned:[],prices:{}},'study')).toBe(false)});
