import {feedbackSchema,appDisplayName} from '../../shared/feedback';
interface Env {
 RESEND_API_KEY:string;FEEDBACK_FROM:string;FEEDBACK_TO:string;
 RATE_LIMITER:{limit(input:{key:string}):Promise<{success:boolean}>};
}
const reply=(status:number,accepted=false)=>Response.json({accepted},{status,headers:{'Cache-Control':'no-store'}});
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  if(request.method!=='POST')return reply(405);
  if(!env.RESEND_API_KEY||!env.FEEDBACK_FROM||!env.FEEDBACK_TO||!env.RATE_LIMITER)return reply(503);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415);
  try{
   const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply(400);
   if(!(await env.RATE_LIMITER.limit({key:ip})).success)return reply(429);
   // Bound streamed bytes, including requests without Content-Length.
   const reader=request.body?.getReader();if(!reader)return reply(400);
   let bytes=0;const chunks:Uint8Array[]=[];
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>24000){await reader.cancel();return reply(413)}chunks.push(value)}
   const raw=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length}
   let input:unknown;try{input=JSON.parse(new TextDecoder().decode(raw))}catch{return reply(400)}
   const parsed=feedbackSchema.safeParse(input);if(!parsed.success)return reply(400);
   const {message,replyTo}=parsed.data;
   const result=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:env.FEEDBACK_FROM,to:[env.FEEDBACK_TO],subject:appDisplayName,text:message,...(replyTo?{reply_to:replyTo}:{})}),
    signal:AbortSignal.timeout(10000),redirect:'error'
   });
   if(!result.ok)return reply(502);
   const sent=await result.json() as {id?:string};return sent.id?reply(202,true):reply(502);
  }catch{return reply(503)}
 }
};
