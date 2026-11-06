import {describe,it,expect,vi} from 'vitest';
import {FeedbackService} from '../electron/feedback';
import worker from '../services/feedback/worker';
const payload={message:'Please add a weekly review.',replyTo:''};
describe('feedback delivery',()=>{
 it('does not send when unconfigured or validation fails',async()=>{
  const send=vi.fn();const service=new FeedbackService('',send);
  await expect(service.send(payload)).rejects.toThrow('not available');expect(send).not.toHaveBeenCalled();
  await expect(new FeedbackService('https://feedback.example.com',send).send({...payload,message:' '})).rejects.toThrow();expect(send).not.toHaveBeenCalled();
 });
 it('sends only the entered fields and requires an accepted response',async()=>{
  const send=vi.fn().mockResolvedValue(new Response(JSON.stringify({accepted:true}),{status:202}));
  await new FeedbackService('https://feedback.example.com',send).send(payload);
  expect(JSON.parse(send.mock.calls[0][1].body)).toEqual(payload);
  send.mockResolvedValue(new Response('{}',{status:500}));await expect(new FeedbackService('https://feedback.example.com',send).send(payload)).rejects.toThrow();
 });
 it('sets recipient and app subject server-side and rejects recipient overrides',async()=>{
  const send=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"id":"email-id"}'));
  const env={RESEND_API_KEY:'test-only',FEEDBACK_FROM:'Feedback <feedback@example.com>',FEEDBACK_TO:'owner@example.com',RATE_LIMITER:{limit:async()=>({success:true})}};
  try{
   const request=(data:unknown)=>new Request('https://feedback.example.com',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(data)});
   expect((await worker.fetch(request({...payload,to:'other@example.com'}),env)).status).toBe(400);expect(send).not.toHaveBeenCalled();
   expect((await worker.fetch(request(payload),env)).status).toBe(202);
   expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({to:['owner@example.com'],subject:'Daywhisper',text:payload.message});
   const denied={...env,RATE_LIMITER:{limit:async()=>({success:false})}};
   expect((await worker.fetch(request(payload),denied)).status).toBe(429);expect(send).toHaveBeenCalledTimes(1);
  }finally{send.mockRestore()}
 });
});
