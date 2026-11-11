import {z} from 'zod';
import {emailSchema, verifyCodeSchema} from '../../shared/cloud';
import {type Account,type Env,ApiError,hash,hmac,invalid,parse,randomToken,rateLimit,readBody,sql,unavailable,upstream} from './core';

const sessionMs=30*86_400_000;
const requestSchema=z.object({email:emailSchema}).strict();

export function authConfigured(env:Env) {
  return Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length>=32 && env.RESEND_API_KEY && env.EMAIL_FROM);
}
function authSecret(env:Env) {
  if (!authConfigured(env)) throw unavailable();
  return env.AUTH_SECRET!;
}
function generateCode() {
  const buffer=new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while(buffer[0]>=4_294_000_000);
  return String(buffer[0]%1_000_000).padStart(6,'0');
}
export async function requestCode(req:Request,env:Env,now:number) {
  const secret=authSecret(env);
  const input=requestSchema.safeParse(parse(await readBody(req,4096)));
  if (!input.success) throw invalid();
  const {email}=input.data;
  const ip=await hmac(secret,'ip:'+ (req.headers.get('CF-Connecting-IP') ?? 'unknown'));
  const emailKey=await hmac(secret,'email:'+email);
  const hour=Math.floor(now/3_600_000)*60;
  await rateLimit(env,'request_ip',ip,hour,15);
  await rateLimit(env,'request_global','all',hour,150);
  await rateLimit(env,'request_email',emailKey,hour,3);
  await rateLimit(env,'request_cooldown',emailKey,Math.floor(now/60_000),1);
  const code=generateCode();
  const digest=await hmac(secret,'code:'+email+':'+code);
  await sql(env,`INSERT INTO codes(email,digest,expires,attempts) VALUES(?,?,?,0)
    ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,expires=excluded.expires,attempts=0`,email,digest,now+600_000).run();
  let sent=false;
  try {
    const response=await upstream('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'Your Daywhisper sign-in code',
        text:`Your Daywhisper sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`}),
    });
    sent=response.ok;
    await response.body?.cancel();
  } finally {
    if (!sent) await sql(env,'DELETE FROM codes WHERE email=? AND digest=?',email,digest).run();
  }
  if (!sent) throw unavailable();
  return {accepted:true};
}
export async function verifyCode(req:Request,env:Env,now:number) {
  const secret=authSecret(env);
  const input=verifyCodeSchema.safeParse(parse(await readBody(req,4096)));
  if (!input.success) throw invalid();
  const {email,code}=input.data;
  const ip=await hmac(secret,'ip:'+ (req.headers.get('CF-Connecting-IP') ?? 'unknown'));
  const hour=Math.floor(now/3_600_000)*60;
  await rateLimit(env,'verify_ip',ip,hour,45);
  await rateLimit(env,'verify_email',await hmac(secret,'email:'+email),hour,15);
  const digest=await hmac(secret,'code:'+email+':'+code);
  const used=await sql(env,`DELETE FROM codes WHERE email=? AND expires>? AND attempts<5 AND digest=? RETURNING email`,
    email,now,digest).first();
  if (!used) {
    await sql(env,`UPDATE codes SET attempts=attempts+1 WHERE email=? AND expires>? AND attempts<5`,email,now).run();
    throw new ApiError(401,'The code is invalid or expired.');
  }
  const account=await sql(env,`INSERT INTO accounts(id,email) VALUES(?,?)
    ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id`,crypto.randomUUID(),email).first<{id:string}>();
  if (!account) throw unavailable();
  const token=randomToken();
  await sql(env,'INSERT INTO sessions(digest,account_id,expires) VALUES(?,?,?)',await hash(token),account.id,now+sessionMs).run();
  return {token};
}
function bearer(req:Request) { return /^Bearer ([a-zA-Z0-9_-]{43})$/.exec(req.headers.get('Authorization') ?? '')?.[1]; }
export async function accountFor(req:Request,env:Env,now:number,optional=false):Promise<Account|null> {
  if (optional && !req.headers.has('Authorization')) return null;
  const token=bearer(req);
  const account=token ? await sql(env,`SELECT accounts.* FROM sessions JOIN accounts ON accounts.id=sessions.account_id
    WHERE digest=? AND expires>?`,await hash(token),now).first<Account>() : null;
  if (!account) throw new ApiError(401,'Sign in to continue.');
  return account;
}
export async function logout(req:Request,env:Env) {
  const token=bearer(req);
  if (token) await sql(env,'DELETE FROM sessions WHERE digest=?',await hash(token)).run();
  return {signedOut:true};
}
