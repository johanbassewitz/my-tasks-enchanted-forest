import {z} from 'zod';
export const sponsorSchema=z.object({enabled:z.boolean(),name:z.string().max(80),message:z.string().max(160),url:z.string(),expires:z.string()}).strict();
export function activeSponsor(input:unknown,now=Date.now()){
 const parsed=sponsorSchema.safeParse(input);if(!parsed.success)return null;const data=parsed.data;
 if(!data.enabled||!data.name.trim()||!data.message.trim()||!Number.isFinite(Date.parse(data.expires))||Date.parse(data.expires)<=now)return null;
 try{if(new URL(data.url).protocol!=='https:')return null}catch{return null}
 return {name:data.name,message:data.message,url:data.url};
}
