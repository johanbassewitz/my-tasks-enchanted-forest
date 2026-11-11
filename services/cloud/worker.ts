import {accountFor,logout,requestCode,verifyCode} from './auth';
import {accountStatus,generate} from './ai';
import {checkout,commerce,portal,webhook,retryWebhooks,type Background} from './paddle';
import {type Env,ApiError,json,sql} from './core';

async function route(req:Request,env:Env,now:number,ctx?:Background) {
  const path=new URL(req.url).pathname;
  const endpoint=req.method+' '+path;
  switch (endpoint) {
    case 'POST /auth/request': return requestCode(req,env,now);
    case 'POST /auth/verify': return verifyCode(req,env,now);
    case 'POST /auth/logout': return logout(req,env);
    case 'POST /webhooks/paddle': return webhook(req,env,now,ctx);
    case 'GET /commerce': return commerce(env,await accountFor(req,env,now,true),now);
    case 'GET /account':
    case 'POST /ai/generate':
    case 'POST /checkout':
    case 'POST /portal': {
      const account=await accountFor(req,env,now);
      if (!account) throw new ApiError(401,'Sign in to continue.');
      if (endpoint==='GET /account') return accountStatus(env,account,now);
      if (endpoint==='POST /ai/generate') return generate(req,env,account,now);
      if (endpoint==='POST /checkout') return checkout(req,env,account,now);
      return portal(env,account,now);
    }
    default: throw new ApiError(404,'Endpoint not found.');
  }
}
export default {
  async fetch(req:Request,env:Env,ctx?:Background) {
    try {
      return json(await route(req,env,Date.now(),ctx));
    } catch (error) {
      return error instanceof ApiError ? json({error:error.message},error.status)
        : json({error:'This online service is unavailable.'},503);
    }
  },
  async scheduled(_event:unknown,env:Env) {
    const now=Date.now();
    await retryWebhooks(env,now);
    if (Math.floor(now/60_000)%10!==7) return;
    await sql(env,'DELETE FROM rate_limits WHERE bucket<?',Math.floor(now/60_000)-120).run();
    await sql(env,'DELETE FROM codes WHERE expires<=?',now).run();
    await sql(env,'DELETE FROM sessions WHERE expires<=?',now).run();
    await sql(env,'DELETE FROM paddle_events WHERE done=1 AND received<=?',now-90*86_400_000).run();
    await sql(env,'DELETE FROM ai_daily WHERE day<?',new Date(now-7*86_400_000).toISOString().slice(0,10)).run();
    await sql(env,'UPDATE ai_requests SET result=NULL WHERE result IS NOT NULL AND result_until<=?',now).run();
    // Retain successful request IDs as replay tombstones. Failed or abandoned requests never spent an allowance.
    await sql(env,"DELETE FROM ai_requests WHERE state<>'completed' AND reserved_until<=? AND created<=?",now,now-7*86_400_000).run();
  },
};
