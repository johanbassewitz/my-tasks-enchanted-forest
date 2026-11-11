import {readFileSync} from 'node:fs';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import worker from '../services/cloud/worker';
import {type Env,type Statement,encoder,hmac} from '../services/cloud/core';

const base='https://cloud.example.com';
const id=(prefix:string,char:string)=>prefix+'_'+char.repeat(26);
const customer=id('ctm','a');
const price=id('pri','a');
const txn=id('txn','a');
const email='account@example.com';
const secret='webhook-signature-test';
const sku='ai-credits-50';
const migrations=['0001_cloud.sql','0002_supporter_checkout.sql'].map(name=>
  readFileSync(new URL('../services/cloud/migrations/'+name,import.meta.url),'utf8'));
let db:DatabaseSync;
let env:Env;
let fetchMock:ReturnType<typeof vi.fn<typeof fetch>>;
let signInCode:string;

function statement(query:string,args:unknown[]=[]):Statement {
  const input=args as SQLInputValue[];
  return {
    bind:(...values)=>statement(query,values),
    first:async<T>()=>(db.prepare(query).get(...input) as T|undefined) ?? null,
    all:async<T>()=>({results:db.prepare(query).all(...input) as T[]}),
    run:async()=>({meta:{changes:Number(db.prepare(query).run(...input).changes)}}),
  };
}
function request(path:string,body?:unknown,token?:string,method?:string) {
  return worker.fetch(new Request(base+path,{
    method:method ?? (body===undefined ? 'GET' : 'POST'),
    headers:{'CF-Connecting-IP':'192.0.2.1',...(token ? {Authorization:'Bearer '+token} : {})},
    body:body===undefined ? undefined : JSON.stringify(body),
  }),env);
}
async function signIn() {
  expect((await request('/auth/request',{email})).status).toBe(200);
  const response=await request('/auth/verify',{email,code:signInCode});
  expect(response.status).toBe(200);
  return (await response.json() as {token:string}).token;
}
async function webhook(event:string,eventType:string,data:unknown,signature=true,ctx?:{waitUntil(work:Promise<unknown>):void}) {
  const body=JSON.stringify({event_id:id('evt',event),event_type:eventType,data});
  const ts=Math.floor(Date.now()/1000);
  const digest=signature ? await hmac(secret,ts+':'+body) : '0'.repeat(64);
  return worker.fetch(new Request(base+'/webhooks/paddle',{method:'POST',body,headers:{'Paddle-Signature':'ts='+ts+';h1='+digest}}),env,ctx);
}
const aiInput=(requestId=crypto.randomUUID())=>({requestId,prompt:'Plan two study sessions',today:'2026-11-10',timezone:'Europe/London',consent:true});
const model=(date='')=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[{title:'Study',notes:'',date,minutes:25}]})}}]});
const provider=(data:unknown)=>Response.json({data});
const transaction=(status='completed', overrides:Record<string,unknown>={})=>({
  id:txn,customer_id:customer,status,subscription_id:null,collection_mode:'automatic',origin:'api',
  items:[{price:{id:price,billing_cycle:null},quantity:1}],details:{totals:{grand_total:'100'}},
  checkout:{url:'https://checkout.example.com/pay?_ptxn='+txn},...overrides,
});
function billingMock({current,adjustments}:{current:()=>unknown;adjustments:()=>unknown[]}) {
  fetchMock.mockImplementation(async (url,init)=>{
    const path=new URL(String(url)).pathname;
    if (path==='/emails') return resend(url,init);
    if (path==='/customers') return provider({id:customer,email,status:'active'});
    if (path==='/transactions') return provider(transaction('draft'));
    if (path.startsWith('/transactions/')) return provider(current());
    if (path==='/adjustments') return Response.json({data:adjustments(),meta:{pagination:{has_more:false}}});
    if (path==='/api/v1/chat/completions') return model();
    throw Error('Unexpected mocked provider request: '+path);
  });
}
async function resend(_url:RequestInfo|URL,init?:RequestInit) {
  signInCode=String(JSON.parse(String(init?.body)).text).match(/\b\d{6}\b/)?.[0] ?? '';
  return provider({id:'test-email'});
}
beforeEach(()=>{
  db=new DatabaseSync(':memory:');
  migrations.forEach(migration=>db.exec(migration));
  env={DB:{prepare:statement},AUTH_SECRET:'test secret with more than 32 chars',EMAIL_FROM:'sign-in@example.com',RESEND_API_KEY:'mock',
    OPENROUTER_API_KEY:'mock',OPENROUTER_MODEL:'fixture/test',MAX_DAILY_AI_REQUESTS:'20',
    PADDLE_MODE:'sandbox',PADDLE_API_KEY:'mock',PADDLE_WEBHOOK_SECRET:secret,PADDLE_PRICES:JSON.stringify({[sku]:price}),
    PADDLE_CHECKOUT_ORIGIN:'https://checkout.example.com'};
  fetchMock=vi.fn<typeof fetch>(resend);
  vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>{ vi.unstubAllGlobals(); db.close(); });

describe('cloud Worker',()=>{
  it('fails closed without configuration and does not make provider calls',async()=>{
    const token=await signIn();
    fetchMock.mockClear();
    env.RESEND_API_KEY=undefined;
    env.PADDLE_API_KEY=undefined;
    env.MAX_DAILY_AI_REQUESTS='0';
    expect((await request('/auth/request',{email})).status).toBe(503);
    expect(await (await request('/commerce')).json()).toMatchObject({mode:'unavailable',owned:[]});
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({aiAvailable:false});
    expect((await request('/ai/generate',aiInput(),token)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throttles email, consumes an OTP once, stores only digests, and revokes sessions',async()=>{
    expect((await request('/auth/request',{email})).status).toBe(200);
    expect((await request('/auth/request',{email})).status).toBe(429);
    const row=db.prepare('SELECT digest FROM codes').get();
    expect(row?.digest).toMatch(/^[a-f0-9]{64}$/);
    const valid={email,code:signInCode};
    const results=await Promise.all([request('/auth/verify',valid),request('/auth/verify',valid)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,401]);
    const {token}=await results.find(r=>r.ok)!.json() as {token:string};
    expect(db.prepare('SELECT digest FROM sessions').get()?.digest).not.toBe(token);
    expect((await request('/account',undefined,token)).status).toBe(200);
    expect((await request('/auth/logout',undefined,token,'POST')).status).toBe(200);
    expect((await request('/account',undefined,token)).status).toBe(401);
  });

  it('expires codes and limits incorrect attempts',async()=>{
    await request('/auth/request',{email});
    const wrong=signInCode==='000000' ? '000001' : '000000';
    for(let i=0;i<5;i++) expect((await request('/auth/verify',{email,code:wrong})).status).toBe(401);
    expect((await request('/auth/verify',{email,code:signInCode})).status).toBe(401);
    db.prepare('UPDATE codes SET attempts=0, expires=?').run(Date.now()-1);
    expect((await request('/auth/verify',{email,code:signInCode})).status).toBe(401);
  });

  it('reserves quota concurrently, retries completed IDs, rejects mismatched inputs and honors the UTC month',async()=>{
    env.MONTHLY_FREE_LIMIT='1';
    const token=await signIn();
    let finish!: (r:Response)=>void;
    let started!: ()=>void;
    const providerStarted=new Promise<void>(resolve=>{started=resolve;});
    fetchMock.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;started();}));
    const input=aiInput();
    const original=request('/ai/generate',input,token);
    await providerStarted;
    expect((await request('/ai/generate',input,token)).status).toBe(409);
    expect((await request('/ai/generate',aiInput(),token)).status).toBe(429);
    finish(model());
    const response=await original;
    expect(response.status).toBe(200);
    expect(await (await request('/ai/generate',input,token)).json()).toEqual(await response.json());
    expect((await request('/ai/generate',{...input,prompt:'Different planning input'},token)).status).toBe(409);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({freeRemaining:0,freeLimit:1});
    expect(db.prepare('SELECT used FROM ai_totals').get()?.used).toBe(1);
    const future=Date.now()+35*86_400_000;
    db.prepare('UPDATE sessions SET expires=?').run(future+86_400_000);
    vi.spyOn(Date,'now').mockReturnValue(future);
    try {
      expect(await (await request('/account',undefined,token)).json()).toMatchObject({freeRemaining:1});
    } finally { vi.restoreAllMocks(); }
  });

  it('returns malformed model results without spending allowance but caps upstream attempts globally',async()=>{
    env.MAX_DAILY_AI_REQUESTS='2';
    const token=await signIn();
    const input=aiInput();
    fetchMock.mockResolvedValueOnce(model('2026-02-30')).mockResolvedValueOnce(model());
    expect((await request('/ai/generate',input,token)).status).toBe(503);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({freeRemaining:5});
    expect((await request('/ai/generate',input,token)).status).toBe(200);
    expect((await request('/ai/generate',aiInput(),token)).status).toBe(429);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({freeRemaining:4});
  });

  it('reclaims expired reservations, guards against stale commits, and expires cached results without replaying',async()=>{
    env.MONTHLY_FREE_LIMIT='1';
    const token=await signIn();
    let finish!: (r:Response)=>void;
    let started!: ()=>void;
    const providerStarted=new Promise<void>(resolve=>{started=resolve;});
    fetchMock.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;started();})).mockResolvedValueOnce(model());
    const input=aiInput();
    const original=request('/ai/generate',input,token);
    await providerStarted;
    db.exec('UPDATE ai_requests SET reserved_until=0');
    expect((await request('/ai/generate',input,token)).status).toBe(200);
    finish(model());
    expect((await original).status).toBe(503);
    expect(db.prepare('SELECT used FROM ai_totals').get()?.used).toBe(1);
    db.exec('UPDATE ai_requests SET result_until=0');
    const cleanupTime=Math.floor(Date.now()/600_000)*600_000+420_000;
    vi.spyOn(Date,'now').mockReturnValue(cleanupTime);
    try { await worker.scheduled(null,env); } finally { vi.restoreAllMocks(); }
    expect(db.prepare('SELECT result FROM ai_requests').get()?.result).toBeNull();
    expect((await request('/ai/generate',input,token)).status).toBe(409);
  });

  it('only credits bound authoritative Paddle transactions and revokes refunded credits without duplication',async()=>{
    const token=await signIn();
    expect(await (await request('/commerce')).json()).toMatchObject({mode:'paddle',owned:[],available:[sku]});
    let current=transaction('completed',{customer_id:id('ctm','b')});
    let adjustments:unknown[]=[];
    billingMock({current:()=>current,adjustments:()=>adjustments});
    expect((await request('/checkout',{key:sku},token)).status).toBe(200);
    expect((await webhook('a','transaction.completed',{id:txn},false)).status).toBe(401);
    expect((await webhook('a','transaction.completed',{id:txn})).status).toBe(200);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:0});
    current=transaction();
    expect((await webhook('b','transaction.completed',{id:txn})).status).toBe(200);
    expect((await webhook('b','transaction.completed',{id:txn})).status).toBe(200);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:50});
    env.MONTHLY_FREE_LIMIT='0';
    expect((await request('/ai/generate',aiInput(),token)).status).toBe(200);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:49});
    adjustments=[{transaction_id:txn,action:'refund',status:'approved'}];
    expect((await webhook('c','adjustment.updated',{transaction_id:txn})).status).toBe(200);
    expect((await webhook('d','transaction.completed',{id:txn})).status).toBe(200);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:0});
    adjustments=[];
    expect((await webhook('e','adjustment.updated',{transaction_id:txn})).status).toBe(200);
    expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:49});
  });
  it('bounds signed offline access by the paid period and gives renewals their own refund state',async()=>{
    const token=await signIn();
    const subscription=id('sub','a');
    const renewal=id('txn','b');
    const {privateKey,publicKey}=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
    env.LICENSE_PRIVATE_KEY=Buffer.from(await crypto.subtle.exportKey('pkcs8',privateKey)).toString('base64');
    env.PADDLE_PRICES=JSON.stringify({'supporter-monthly':price});
    const now=Date.now();
    const day=86_400_000;
    const firstPeriod={starts_at:new Date(now-25*day).toISOString(),ends_at:new Date(now+5*day).toISOString()};
    const nextPeriod={starts_at:firstPeriod.ends_at,ends_at:new Date(now+35*day).toISOString()};
    const recurring={subscription_id:subscription,items:[{price:{id:price,billing_cycle:{interval:'month',frequency:1}},quantity:1}]};
    let refundRenewal=false;
    fetchMock.mockImplementation(async input=>{
      const url=new URL(String(input));
      if (url.pathname==='/customers') return provider({id:customer,email,status:'active'});
      if (url.pathname==='/transactions') return provider(transaction('draft',recurring));
      if (url.pathname==='/transactions/'+txn) return provider(transaction('completed',{...recurring,billed_at:firstPeriod.starts_at}));
      if (url.pathname==='/transactions/'+renewal) return provider(transaction('completed',{...recurring,id:renewal,origin:'subscription_recurring',billing_period:nextPeriod}));
      if (url.pathname==='/subscriptions/'+subscription) return provider({id:subscription,customer_id:customer,current_billing_period:firstPeriod});
      if (url.pathname==='/adjustments') {
        const data=refundRenewal && url.searchParams.get('transaction_id')===renewal
          ? [{transaction_id:renewal,action:'refund',status:'approved'}] : [];
        return Response.json({data,meta:{pagination:{has_more:false}}});
      }
      throw Error('Unexpected provider request');
    });
    expect((await request('/checkout',{key:'supporter-monthly'},token)).status).toBe(200);
    expect((await webhook('a','transaction.completed',{id:txn})).status).toBe(200);
    expect((await webhook('b','transaction.completed',{id:renewal})).status).toBe(200);
    const {owned,license}=await (await request('/commerce',undefined,token)).json() as {owned:string[];license:{payload:string;signature:string}};
    expect(owned).toEqual(['supporter-monthly']);
    expect(JSON.parse(license.payload)).toMatchObject({email,owned,expiresAt:now+5*day});
    expect(await crypto.subtle.verify('Ed25519',publicKey,Buffer.from(license.signature,'base64url'),encoder.encode(license.payload))).toBe(true);
    vi.spyOn(Date,'now').mockReturnValue(now+6*day);
    try {
      expect(await (await request('/commerce',undefined,token)).json()).toMatchObject({owned});
      refundRenewal=true;
      await webhook('c','adjustment.updated',{transaction_id:renewal});
      expect(await (await request('/commerce',undefined,token)).json()).toMatchObject({owned:[]});
    } finally { vi.restoreAllMocks(); }
  });

  it('acknowledges after durable enqueue and retries transient Paddle failures',async()=>{
    const token=await signIn();
    let fail=true;
    billingMock({current:()=>{
      if (fail) throw Error('Mock Paddle transport failure');
      return transaction();
    },adjustments:()=>[]});
    expect((await request('/checkout',{key:sku},token)).status).toBe(200);
    let pending:Promise<unknown>|undefined;
    const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      expect((await webhook('a','transaction.completed',{id:txn},true,{waitUntil:work=>{pending=work;}})).status).toBe(200);
      await pending;
      expect(db.prepare('SELECT done,attempt FROM paddle_events').get()).toMatchObject({done:0,attempt:1});
      expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:0});
      fail=false;
      db.exec('UPDATE paddle_events SET next_attempt=0');
      await worker.scheduled(null,env);
      expect(db.prepare('SELECT done,attempt FROM paddle_events').get()).toMatchObject({done:1,attempt:2});
      expect(await (await request('/account',undefined,token)).json()).toMatchObject({paidRemaining:50});
    } finally { log.mockRestore(); }
  });

  it('limits authenticated checkout and portal creation before calling Paddle',async()=>{
    const token=await signIn();
    let checkouts=0;
    let portals=0;
    fetchMock.mockImplementation(async input=>{
      const path=new URL(String(input)).pathname;
      if (path==='/customers' || path==='/customers/'+customer) return provider({id:customer,email,status:'active'});
      if (path==='/transactions') {
        const transactionId=id('txn',String(++checkouts));
        return provider(transaction('draft',{id:transactionId,checkout:{url:'https://checkout.example.com/pay?_ptxn='+transactionId}}));
      }
      if (path==='/customers/'+customer+'/portal-sessions') {
        portals++;
        return provider({customer_id:customer,urls:{general:{overview:'https://sandbox-customer-portal.paddle.com/link'}}});
      }
      throw Error('Unexpected provider request');
    });
    for (let i=0;i<6;i++) expect((await request('/checkout',{key:sku},token)).status).toBe(200);
    expect((await request('/checkout',{key:sku},token)).status).toBe(429);
    expect(checkouts).toBe(6);
    for (let i=0;i<12;i++) expect((await request('/portal',undefined,token,'POST')).status).toBe(200);
    expect((await request('/portal',undefined,token,'POST')).status).toBe(429);
    expect(portals).toBe(12);
  });

  it('serializes supporter checkout, reuses the same link and blocks other plans before and after settlement',async()=>{
    const token=await signIn();
    const annual=id('pri','b');
    const sub=id('sub','a');
    env.PADDLE_PRICES=JSON.stringify({'supporter-monthly':price,'supporter-yearly':annual});
    const now=Date.now();
    const cycle={interval:'month',frequency:1};
    const billing_period={starts_at:new Date(now-1_000).toISOString(),ends_at:new Date(now+30*86_400_000).toISOString()};
    const supporter={items:[{price:{id:price,billing_cycle:cycle},quantity:1}],subscription_id:sub,billing_period};
    let status='draft';
    let subscriptionStatus='active';
    let creations=0;
    let finish!: (r:Response)=>void;
    let started!: ()=>void;
    const providerStarted=new Promise<void>(resolve=>{started=resolve;});
    fetchMock.mockImplementation(async input=>{
      const path=new URL(String(input)).pathname;
      if (path==='/customers') return provider({id:customer,email,status:'active'});
      if (path==='/transactions') {
        creations++;
        return new Promise<Response>(resolve=>{finish=resolve;started();});
      }
      if (path==='/transactions/'+txn) return provider(transaction(status,supporter));
      if (path==='/subscriptions/'+sub) return provider({id:sub,customer_id:customer,status:subscriptionStatus});
      if (path==='/adjustments') return Response.json({data:[],meta:{pagination:{has_more:false}}});
      throw Error('Unexpected provider request');
    });
    const initial=request('/checkout',{key:'supporter-monthly'},token);
    await providerStarted;
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    finish(provider(transaction('draft',supporter)));
    const opened=await initial;
    expect(opened.status).toBe(200);
    expect(await (await request('/checkout',{key:'supporter-monthly'},token)).json()).toEqual(await opened.json());
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    status='completed';
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    await webhook('a','transaction.completed',{id:txn});
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    db.exec('UPDATE paddle_transactions SET expires=0');
    subscriptionStatus='paused';
    db.exec("DELETE FROM rate_limits WHERE scope='checkout'");
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    expect(creations).toBe(1);
  });

  it('recovers from failed supporter creation and confirms cancellation before replacing an expired draft',async()=>{
    const token=await signIn();
    const yearlyPrice=id('pri','b');
    const yearlyTxn=id('txn','b');
    env.PADDLE_PRICES=JSON.stringify({'supporter-monthly':price,'supporter-yearly':yearlyPrice});
    const monthly={items:[{price:{id:price,billing_cycle:{interval:'month',frequency:1}},quantity:1}]};
    const yearly={id:yearlyTxn,items:[{price:{id:yearlyPrice,billing_cycle:{interval:'year',frequency:1}},quantity:1}],
      checkout:{url:'https://checkout.example.com/pay?_ptxn='+yearlyTxn}};
    let createAttempts=0;
    let refuseCancel=true;
    let canceled=false;
    fetchMock.mockImplementation(async (input,init)=>{
      const path=new URL(String(input)).pathname;
      if (path==='/customers') return provider({id:customer,email,status:'active'});
      if (path==='/transactions/'+txn && init?.method==='PATCH') {
        if (refuseCancel) return new Response(null,{status:409});
        canceled=true;
        return provider(transaction('canceled',monthly));
      }
      if (path==='/transactions/'+txn) return provider(transaction('draft',monthly));
      if (path==='/transactions') {
        createAttempts++;
        if (createAttempts===1) return new Response(null,{status:503});
        if (createAttempts===2) return provider(transaction('draft',monthly));
        expect(canceled).toBe(true);
        return provider(transaction('draft',yearly));
      }
      throw Error('Unexpected provider request');
    });
    expect((await request('/checkout',{key:'supporter-monthly'},token)).status).toBe(503);
    expect((await request('/checkout',{key:'supporter-monthly'},token)).status).toBe(200);
    db.exec('UPDATE supporter_checkouts SET pending_until=0');
    expect((await request('/checkout',{key:'supporter-yearly'},token)).status).toBe(409);
    expect(createAttempts).toBe(2);
    refuseCancel=false;
    expect(await (await request('/checkout',{key:'supporter-yearly'},token)).json()).toEqual(yearly.checkout);
    expect(createAttempts).toBe(3);
  });

});
