import {it,expect} from 'vitest';
import {activeSponsor} from '../shared/sponsor';
it('only displays active explicitly configured HTTPS sponsorships',()=>{const s={enabled:true,name:'Study tools',message:'A sponsored placement',url:'https://example.com',expires:'2030-01-01'};expect(activeSponsor(s,0)?.name).toBe(s.name);expect(activeSponsor({...s,enabled:false},0)).toBeNull();expect(activeSponsor({...s,url:'javascript:alert(1)'},0)).toBeNull();expect(activeSponsor(s,Date.UTC(2031,0,1))).toBeNull()});
