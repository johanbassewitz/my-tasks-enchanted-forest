import {feedbackSchema} from '../shared/feedback';
export class FeedbackService {
 constructor(private endpoint:string,private request:typeof fetch=fetch){}
 get available():boolean {try{return new URL(this.endpoint).protocol==='https:'}catch{return false}}
 async send(input:unknown):Promise<void>{
  const data=feedbackSchema.parse(input);
  if(!this.available)throw Error('Feedback delivery is not available yet. Your message has not been sent.');
  try{
   const response=await this.request(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok||!(await response.json() as {accepted?:boolean}).accepted)throw Error('Not accepted');
  }catch{throw Error('Could not confirm delivery. Your message is still here; please try again later.');}
 }
}
