export interface Statement {
  bind(...args: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{meta:{changes:number}}>;
  all<T>(): Promise<{results:T[]}>;
}

export interface Env {
  DB: {prepare(sql:string):Statement};
  RESEND_API_KEY?: string;
  AUTH_SECRET?: string;
  EMAIL_FROM?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  MAX_DAILY_AI_REQUESTS?: string;
  MONTHLY_FREE_LIMIT?: string;
  PADDLE_API_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  PADDLE_MODE?: string;
  PADDLE_PRICES?: string;
  PADDLE_CHECKOUT_ORIGIN?: string;
  LICENSE_PRIVATE_KEY?: string;
}

export type Account = {id:string;email:string};
export class ApiError extends Error {
  constructor(readonly status:number, message:string) { super(message); }
}

export const encoder = new TextEncoder();
export const unavailable = () => new ApiError(503, 'This online service is unavailable.');
export const invalid = () => new ApiError(400, 'Invalid request.');
export function sql(env:Env, query:string, ...args:unknown[]) { return env.DB.prepare(query).bind(...args); }
export function json(data:unknown, status=200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function readBody(message:Request|Response, limit:number) {
  const length = Number(message.headers.get('content-length'));
  if (length > limit) throw invalid();
  const reader = message.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  let size=0;
  let raw='';
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) return raw+decoder.decode();
      size+=value.byteLength;
      if (size > limit) throw invalid();
      raw+=decoder.decode(value,{stream:true});
    }
  } catch {
    void reader.cancel().catch(()=>{});
    throw invalid();
  }
}
export function parse(raw:string):unknown {
  try { return JSON.parse(raw); } catch { throw invalid(); }
}
export const base64url = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const hex = (bytes:ArrayBuffer) => Array.from(new Uint8Array(bytes), byte=>byte.toString(16).padStart(2,'0')).join('');
export async function hash(value:string) { return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value))); }
export async function hmac(secret:string,value:string) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
export function equal(a:string,b:string) {
  if (a.length!==b.length) return false;
  let result=0;
  for (let i=0;i<a.length;i++) result|=a.charCodeAt(i)^b.charCodeAt(i);
  return result===0;
}
export function numberSetting(value:string|undefined, fallback:number, max:number) {
  if (value===undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value)>max) return 0;
  return Number(value);
}
export async function upstream(url:string, init:RequestInit, timeout=10_000) {
  return fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(timeout)});
}
export async function rateLimit(env:Env, scope:string, subject:string, bucket:number, limit:number) {
  const row=await sql(env,`
    INSERT INTO rate_limits(scope,subject,bucket,count) VALUES(?,?,?,1)
    ON CONFLICT(scope,subject,bucket) DO UPDATE SET count=count+1 WHERE count < ?
    RETURNING count`,scope,subject,bucket,limit).first();
  if (!row) throw new ApiError(429,'Too many requests. Try again later.');
}
