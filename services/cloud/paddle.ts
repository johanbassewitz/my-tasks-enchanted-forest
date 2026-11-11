import {z} from 'zod';
import {productKeys,type CommerceStatus,type ProductKey} from '../../shared/commerce';
import {type Account,type Env,ApiError,base64url,encoder,equal,hmac,invalid,parse,rateLimit,readBody,sql,unavailable,upstream} from './core';

type Mode='sandbox'|'live';
const isId=(value:unknown,prefix:string):value is string=>typeof value==='string' && new RegExp('^'+prefix+'_[a-z0-9]{26}$').test(value);
const keySchema=z.enum(productKeys);
const checkoutSchema=z.object({key:keySchema}).strict();
const subscription=(key:ProductKey)=>key==='supporter-monthly' || key==='supporter-yearly';
function secureUrl(value:unknown) {
  if (typeof value!=='string' || value.length>2048) return null;
  try {
    const url=new URL(value);
    return url.protocol==='https:' && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function config(env:Env):{mode:Mode;origin:string;prices:Partial<Record<ProductKey,string>>}|null {
  const mode=env.PADDLE_MODE;
  if ((mode!=='sandbox' && mode!=='live') || !env.PADDLE_API_KEY || !env.PADDLE_WEBHOOK_SECRET) return null;
  const origin=secureUrl(env.PADDLE_CHECKOUT_ORIGIN);
  if (!origin || env.PADDLE_CHECKOUT_ORIGIN!==origin.origin) return null;
  try {
    const input:unknown=JSON.parse(env.PADDLE_PRICES ?? '{}');
    const result=z.partialRecord(keySchema,z.string().regex(/^pri_[a-z0-9]{26}$/)).safeParse(input);
    if (!result.success || new Set(Object.values(result.data)).size!==Object.keys(result.data).length) return null;
    return {mode,origin:origin.origin,prices:result.data};
  } catch { return null; }
}
function getConfig(env:Env) {
  const result=config(env);
  if (!result) throw unavailable();
  return result;
}
type PaddleResponse<T>={data:T;meta?:{pagination?:{has_more:boolean;next:string}}};
class PaddleApiError extends Error { constructor(readonly status:number){super('Paddle API request failed');} }
async function paddle<T>(env:Env, mode:Mode, path:string, body?:unknown, method=body===undefined ? 'GET' : 'POST') {
  const host=mode==='sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
  const response=await upstream(host+path,{
    method,
    headers:{Authorization:`Bearer ${env.PADDLE_API_KEY}`,'Content-Type':'application/json'},
    body:body===undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) { await response.body?.cancel(); throw new PaddleApiError(response.status); }
  try {
    const parsed=parse(await readBody(response,512_000)) as PaddleResponse<T>;
    if (parsed && parsed.data!==undefined) return parsed;
  } catch { /* Invalid provider response. */ }
  throw unavailable();
}
type Customer={id:string;email:string;status:string};
async function lookupCustomer(env:Env,account:Account,mode:Mode) {
  return sql(env,'SELECT customer FROM paddle_customers WHERE account_id=? AND mode=?',account.id,mode).first<{customer:string}>();
}
async function ensureCustomer(env:Env,account:Account,mode:Mode) {
  const mapped=await lookupCustomer(env,account,mode);
  if (mapped) return mapped.customer;
  let customer:Customer;
  try {
    customer=(await paddle<Customer>(env,mode,'/customers',{email:account.email})).data;
  } catch (error) {
    if (!(error instanceof PaddleApiError) || error.status!==409) throw error;
    const {data}=await paddle<Customer[]>(env,mode,'/customers?email='+encodeURIComponent(account.email));
    if (!Array.isArray(data) || data.length!==1) throw unavailable();
    customer=data[0];
  }
  if (!isId(customer?.id,'ctm') || customer.email?.toLowerCase()!==account.email || customer.status!=='active') throw unavailable();
  const saved=await sql(env,`INSERT INTO paddle_customers(account_id,mode,customer) VALUES(?,?,?)
    ON CONFLICT(account_id,mode) DO NOTHING RETURNING customer`,account.id,mode,customer.id).first();
  if (!saved && (await lookupCustomer(env,account,mode))?.customer!==customer.id) throw unavailable();
  return customer.id;
}

type Transaction={
  id:string;status:string;customer_id:string;subscription_id:string|null;origin:string;collection_mode:string;
  items?:Array<{price?:{id:string;billing_cycle?:{interval:string;frequency:number}|null};quantity:number}>;
  billing_period?:{starts_at:string;ends_at:string}|null;
  billed_at?:string;
  details?:{totals?:{grand_total?:string}};
  checkout?:{url?:string};
};
function itemsMatch(txn:Transaction,key:ProductKey,price:string) {
  const item=txn.items?.[0];
  const cycle=item?.price?.billing_cycle;
  return txn.collection_mode==='automatic' && txn.items?.length===1 && item?.quantity===1 && item.price?.id===price
    && (subscription(key) ? cycle?.frequency===1 && cycle.interval===(key==='supporter-monthly' ? 'month' : 'year') : cycle===null);
}
type PaddleConfig=NonNullable<ReturnType<typeof config>>;
const activeSupporter=new ApiError(409,'A supporter subscription already exists. Manage it in the billing portal.');
const pendingSupporter=new ApiError(409,'A supporter checkout is already in progress. Finish it or try again shortly.');
const supporterCheckoutMs=30*60_000;

function checkoutLink(txn:Transaction,cfg:PaddleConfig) {
  const url=secureUrl(txn?.checkout?.url);
  if (!url || url.origin!==cfg.origin || url.searchParams.get('_ptxn')!==txn.id || !isId(txn.id,'txn')) throw unavailable();
  return url.href;
}
async function createCheckout(env:Env,account:Account,cfg:PaddleConfig,key:ProductKey,price:string) {
  const customer=await ensureCustomer(env,account,cfg.mode);
  const {data}=await paddle<Transaction>(env,cfg.mode,'/transactions',{
    items:[{price_id:price,quantity:1}],customer_id:customer,collection_mode:'automatic',
  });
  const url=checkoutLink(data,cfg);
  if (data.customer_id!==customer || !itemsMatch(data,key,price)) throw unavailable();
  await sql(env,'INSERT INTO paddle_transactions(id,account_id,product,price,customer,mode) VALUES(?,?,?,?,?,?)',
    data.id,account.id,key,price,customer,cfg.mode).run();
  return {id:data.id,url};
}
async function checkSupporterGrant(env:Env,account:Account,mode:Mode,now:number) {
  const grant=await sql(env,`SELECT 1 FROM paddle_transactions WHERE account_id=? AND mode=?
    AND product IN ('supporter-monthly','supporter-yearly') AND granted=1 AND expires>? LIMIT 1`,account.id,mode,now).first();
  if (grant) throw activeSupporter;
}
type SupporterSubscription={id:string;customer_id:string;status:string;previously_billed_at:string|null;canceled_at:string|null};
async function checkKnownSubscriptions(env:Env,account:Account,mode:Mode,now:number) {
  const {results}=await sql(env,`SELECT id,customer,product FROM paddle_subscriptions
    WHERE account_id=? AND mode=? AND ended_verified=0 ORDER BY id DESC LIMIT 21`,account.id,mode).all<{id:string;customer:string;product:ProductKey}>();
  if (!results.length) return;
  if (results.length>20) throw activeSupporter;
  const ids=results.map(row=>row.id).join(',');
  const {data}=await paddle<SupporterSubscription[]>(env,mode,'/subscriptions?id='+encodeURIComponent(ids)+'&per_page=20');
  if (!Array.isArray(data) || data.length!==results.length) throw unavailable();
  for (const known of results) {
    const current=data.find(sub=>sub.id===known.id);
    if (current?.customer_id!==known.customer) throw unavailable();
    checkCanceledPeriod(current,known.product,now);
    await sql(env,'UPDATE paddle_subscriptions SET ended_verified=1 WHERE id=?',known.id).run();
  }
}
function checkCanceledPeriod(current:SupporterSubscription,product:ProductKey,now:number) {
  if (current.status!=='canceled') throw activeSupporter;
  const lastBill=Date.parse(current.previously_billed_at ?? '');
  const canceled=Date.parse(current.canceled_at ?? '');
  const maxPeriod=(product==='supporter-monthly' ? 32 : 367)*86_400_000;
  // Paddle clears the current period after cancellation. Keep a conservative
  // bound for any final paid transaction whose webhook has yet to settle.
  if (!Number.isFinite(canceled) || canceled>now || !Number.isFinite(lastBill) || now-lastBill<maxPeriod) throw activeSupporter;
}
async function checkPreviousCheckout(env:Env,account:Account,cfg:PaddleConfig,id:string,until:number,key:ProductKey,now:number) {
  const bound=await transactionBinding(env,id);
  if (!bound || bound.account_id!==account.id || bound.mode!==cfg.mode || !subscription(bound.product)) throw unavailable();
  const {data:txn}=await paddle<Transaction>(env,cfg.mode,'/transactions/'+id);
  if (txn?.id!==id || txn.customer_id!==bound.customer) throw unavailable();
  if (txn.status==='canceled') return;
  if (txn.status==='draft' || txn.status==='ready') {
    if (until>now) {
      if (bound.product!==key) throw new ApiError(409,'Finish the existing supporter checkout or wait for it to expire before changing plans.');
      if (!itemsMatch(txn,bound.product,bound.price)) throw pendingSupporter;
      return checkoutLink(txn,cfg);
    }
    try {
      const {data:canceled}=await paddle<Transaction>(env,cfg.mode,'/transactions/'+id,{status:'canceled'},'PATCH');
      if (canceled?.id!==id || canceled.status!=='canceled') throw pendingSupporter;
    } catch (error) {
      if (error instanceof PaddleApiError && [400,409].includes(error.status)) throw pendingSupporter;
      throw error;
    }
    return;
  }
  if (txn.status!=='completed' || !isId(txn.subscription_id,'sub')) throw pendingSupporter;
  const {data:current}=await paddle<SupporterSubscription>(env,cfg.mode,'/subscriptions/'+txn.subscription_id);
  if (current?.id!==txn.subscription_id || current.customer_id!==bound.customer) throw unavailable();
  checkCanceledPeriod(current,bound.product,now);
}
async function supporterCheckout(env:Env,account:Account,cfg:PaddleConfig,key:ProductKey,price:string,now:number) {
  await checkSupporterGrant(env,account,cfg.mode,now);
  const lease=crypto.randomUUID();
  const lock=await sql(env,`INSERT INTO supporter_checkouts(account_id,mode,lease_id,lease_until) VALUES(?,?,?,?)
    ON CONFLICT(account_id,mode) DO UPDATE SET lease_id=excluded.lease_id,lease_until=excluded.lease_until
    WHERE supporter_checkouts.lease_until<=? RETURNING transaction_id,pending_until`,
  account.id,cfg.mode,lease,now+90_000,now).first<{transaction_id:string|null;pending_until:number}>();
  if (!lock) throw pendingSupporter;
  try {
    if (lock.transaction_id) {
      const url=await checkPreviousCheckout(env,account,cfg,lock.transaction_id,lock.pending_until,key,now);
      if (url) return {url};
    }
    await checkKnownSubscriptions(env,account,cfg.mode,now);
    await checkSupporterGrant(env,account,cfg.mode,now);
    const created=await createCheckout(env,account,cfg,key,price);
    const saved=await sql(env,`UPDATE supporter_checkouts SET transaction_id=?,pending_until=?
      WHERE account_id=? AND mode=? AND lease_id=? AND lease_until>?`,
    created.id,Date.now()+supporterCheckoutMs,account.id,cfg.mode,lease,Date.now()).run();
    if (!saved.meta.changes) throw pendingSupporter;
    return {url:created.url};
  } finally {
    await sql(env,'UPDATE supporter_checkouts SET lease_until=0 WHERE account_id=? AND mode=? AND lease_id=?',
      account.id,cfg.mode,lease).run();
  }
}
export async function checkout(req:Request,env:Env,account:Account,now:number) {
  const cfg=getConfig(env);
  const input=checkoutSchema.safeParse(parse(await readBody(req,2048)));
  if (!input.success) throw invalid();
  const {key}=input.data;
  const price=cfg.prices[key];
  if (!price) throw new ApiError(404,'This product is unavailable.');
  await rateLimit(env,'checkout',account.id,Math.floor(now/3_600_000)*60,6);
  if (subscription(key)) return supporterCheckout(env,account,cfg,key,price,now);
  if (key!=='ai-credits-50') {
    const owned=await sql(env,`SELECT 1 FROM paddle_transactions
      WHERE account_id=? AND mode=? AND product=? AND granted=1 LIMIT 1`,account.id,cfg.mode,key).first();
    if (owned) throw new ApiError(409,'This account already owns this add-on.');
  }
  const {url}=await createCheckout(env,account,cfg,key,price);
  return {url};
}
export async function portal(env:Env,account:Account,now:number) {
  const {mode}=getConfig(env);
  const mapped=await lookupCustomer(env,account,mode);
  if (!mapped) throw new ApiError(404,'There is no billing account yet.');
  await rateLimit(env,'portal',account.id,Math.floor(now/3_600_000)*60,12);
  const {data:customer}=await paddle<Customer>(env,mode,'/customers/'+mapped.customer);
  if (customer?.id!==mapped.customer || customer.email?.toLowerCase()!==account.email || customer.status!=='active') throw unavailable();
  const {data}=await paddle<{customer_id:string;urls?:{general?:{overview?:string}}}>(env,mode,'/customers/'+mapped.customer+'/portal-sessions',{});
  const url=secureUrl(data?.urls?.general?.overview);
  const expected=mode==='sandbox' ? 'https://sandbox-customer-portal.paddle.com' : 'https://customer-portal.paddle.com';
  if (!url || url.origin!==expected || data.customer_id!==mapped.customer) throw unavailable();
  return {url:url.href};
}
export async function commerce(env:Env,account:Account|null,now:number):Promise<CommerceStatus> {
  const cfg=config(env);
  if (!cfg) return {mode:'unavailable',owned:[],prices:{},available:[],error:'Online purchases are unavailable.'};
  const available=productKeys.filter(key=>cfg.prices[key]);
  if (!account) return {mode:'paddle',owned:[],prices:{},available};
  const grants=await sql(env,`SELECT product, MAX(expires) AS expires FROM paddle_transactions WHERE account_id=?
    AND mode=? AND granted=1 AND product<>'ai-credits-50' AND (expires IS NULL OR (starts<=? AND expires>?)) GROUP BY product`,
  account.id,cfg.mode,now,now).all<{product:ProductKey;expires:number|null}>();
  const owned=productKeys.filter(key=>grants.results.some(grant=>grant.product===key));
  const result:CommerceStatus={mode:'paddle',owned,prices:{},available};
  if (env.LICENSE_PRIVATE_KEY) {
    const expirations=grants.results.flatMap(grant=>grant.expires===null ? [] : [grant.expires]);
    const expiresAt=Math.min(now+7*86_400_000,...expirations);
    const payload=JSON.stringify({accountId:account.id,email:account.email,owned,expiresAt});
    const bytes=Uint8Array.from(atob(env.LICENSE_PRIVATE_KEY),char=>char.charCodeAt(0));
    const privateKey=await crypto.subtle.importKey('pkcs8',bytes,{name:'Ed25519'},false,['sign']);
    const signature=await crypto.subtle.sign('Ed25519',privateKey,encoder.encode(payload));
    result.license={payload,signature:base64url(new Uint8Array(signature))};
  }
  return result;
}

type Binding={account_id:string;product:ProductKey;price:string;customer:string;mode:Mode};
type TransactionBinding=Binding & {revision:number;subscription:string|null};
const webhookSchema=z.object({event_id:z.string(),event_type:z.string(),data:z.object({id:z.string().optional(),transaction_id:z.string().optional()})});
async function refunded(env:Env,mode:Mode,id:string) {
  const query=new URLSearchParams({transaction_id:id,per_page:'50'});
  for (let page=0;page<5;page++) {
    const {data,meta}=await paddle<Array<{transaction_id:string;action:string;status:string}>>(env,mode,'/adjustments?'+query);
    if (!Array.isArray(data) || typeof meta?.pagination?.has_more!=='boolean') throw unavailable();
    if (data.some(adj=>adj.transaction_id!==id || typeof adj.action!=='string' || typeof adj.status!=='string')) throw unavailable();
    if (data.some(adj=>adj.status==='approved' && ['refund','chargeback','credit'].includes(adj.action))) return true;
    if (!meta.pagination.has_more) return false;
    const after=secureUrl(meta.pagination.next)?.searchParams.get('after');
    if (!isId(after,'adj') || after===query.get('after')) throw unavailable();
    query.set('after',after);
  }
  throw unavailable();
}
async function transactionBinding(env:Env,id:string) {
  return sql(env,'SELECT * FROM paddle_transactions WHERE id=?',id).first<TransactionBinding>();
}
async function reconcile(env:Env,mode:Mode,id:string) {
  let binding=await transactionBinding(env,id);
  if (binding && binding.mode!==mode) return;
  const {data:txn}=await paddle<Transaction>(env,mode,'/transactions/'+id);
  if (txn?.id!==id || typeof txn.status!=='string') throw unavailable();
  const sub=isId(txn.subscription_id,'sub') ? txn.subscription_id : null;
  if (!binding) {
    if (txn.status!=='completed' || !sub || txn.origin!=='subscription_recurring') return;
    const previous=await sql(env,'SELECT * FROM paddle_subscriptions WHERE id=? AND mode=?',sub,mode).first<Binding>();
    if (!previous) {
      // Retry a renewal that arrives while its originating checkout is still being processed.
      const candidate=await sql(env,`SELECT 1 FROM paddle_transactions WHERE mode=? AND customer=?
        AND product IN ('supporter-monthly','supporter-yearly') LIMIT 1`,mode,txn.customer_id).first();
      if (candidate) throw unavailable();
      return;
    }
    if (previous.customer!==txn.customer_id || !itemsMatch(txn,previous.product,previous.price)) return;
    const inserted=await sql(env,`INSERT INTO paddle_transactions(id,account_id,product,price,customer,subscription,mode)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING revision`,id,previous.account_id,previous.product,
    previous.price,previous.customer,sub,mode).first<{revision:number}>();
    if (!inserted) throw unavailable();
    binding={...previous,subscription:sub,revision:inserted.revision};
  }
  const recurring=subscription(binding.product);
  const amount=txn.details?.totals?.grand_total;
  const paid=txn.status==='completed' && binding.customer===txn.customer_id && itemsMatch(txn,binding.product,binding.price)
    && typeof amount==='string' && /^\d{1,30}$/.test(amount) && BigInt(amount)>0n;
  let period=txn.billing_period;
  if (paid && recurring && sub && !period && txn.origin==='api') {
    // Paddle may omit billing_period on an initial checkout. Use the initial
    // subscription period only if its start agrees with this transaction.
    const {data}=await paddle<{id:string;customer_id:string;current_billing_period?:Transaction['billing_period']}>(
      env,mode,'/subscriptions/'+sub);
    const periodStart=Date.parse(data?.current_billing_period?.starts_at ?? '');
    const billedAt=Date.parse(txn.billed_at ?? '');
    if (data?.id===sub && data.customer_id===binding.customer && Math.abs(periodStart-billedAt)<86_400_000) {
      period=data.current_billing_period;
    }
  }
  const starts=recurring ? Date.parse(period?.starts_at ?? '') : null;
  const expires=recurring ? Date.parse(period?.ends_at ?? '') : null;
  const validPeriod=starts!==null && expires!==null && Number.isFinite(starts) && Number.isFinite(expires) && expires>starts
    && expires-starts <= (binding.product==='supporter-monthly' ? 32 : 367)*86_400_000;
  const eligible=paid
    && (recurring ? sub!==null && (!binding.subscription || binding.subscription===sub) && validPeriod : txn.subscription_id===null);
  if (eligible && sub) {
    const row=await sql(env,`INSERT INTO paddle_subscriptions(id,account_id,product,price,customer,mode)
      VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET id=excluded.id WHERE
      account_id=excluded.account_id AND product=excluded.product AND price=excluded.price
      AND customer=excluded.customer AND mode=excluded.mode RETURNING id`,sub,binding.account_id,binding.product,
    binding.price,binding.customer,mode).first();
    if (!row) throw unavailable();
  }
  const grant=eligible && !(await refunded(env,mode,id));
  const updated=await sql(env,`UPDATE paddle_transactions SET granted=?,subscription=COALESCE(subscription,?),starts=?,expires=?,revision=revision+1
    WHERE id=? AND revision=?`,grant ? 1 : 0,eligible ? sub : null,grant ? starts : null,grant ? expires : null,id,binding.revision).run();
  if (!updated.meta.changes) throw unavailable();
}
export interface Background {waitUntil(work:Promise<unknown>):void}
async function processEvent(env:Env,mode:Mode,eventId:string) {
  const now=Date.now();
  const job=await sql(env,`UPDATE paddle_events SET attempt=attempt+1,next_attempt=?
    WHERE id=? AND mode=? AND done=0 AND next_attempt<=? RETURNING transaction_id,attempt`,
    now+90_000,eventId,mode,now).first<{transaction_id:string;attempt:number}>();
  if (!job) return;
  try {
    await reconcile(env,mode,job.transaction_id);
    await sql(env,'UPDATE paddle_events SET done=1 WHERE id=? AND mode=? AND attempt=?',eventId,mode,job.attempt).run();
  } catch {
    const backoff=Math.min(3_600_000,15_000 * 2**Math.min(job.attempt,8));
    await sql(env,'UPDATE paddle_events SET next_attempt=? WHERE id=? AND mode=? AND attempt=?',
      Date.now()+backoff,eventId,mode,job.attempt).run();
    console.warn('Paddle reconciliation retry scheduled.');
  }
}
export async function retryWebhooks(env:Env,now:number) {
  const cfg=config(env);
  if (!cfg) return;
  const due=await sql(env,`SELECT id FROM paddle_events WHERE mode=? AND done=0 AND next_attempt<=?
    ORDER BY next_attempt LIMIT 3`,cfg.mode,now).all<{id:string}>();
  await Promise.all(due.results.map(event=>processEvent(env,cfg.mode,event.id)));
}
export async function webhook(req:Request,env:Env,now:number,ctx?:Background) {
  const {mode}=getConfig(env);
  const fields=(req.headers.get('Paddle-Signature') ?? '').split(';');
  const timestamps=fields.filter(field=>/^ts=\d{10}$/.test(field));
  const signature=fields.filter(field=>/^h1=[a-f0-9]{64}$/.test(field));
  const timestamp=timestamps[0]?.slice(3);
  if (!timestamp || timestamps.length!==1 || !signature.length || signature.length>5
    || Math.abs(now/1000-Number(timestamp))>5) throw new ApiError(401,'Invalid webhook signature.');
  const raw=await readBody(req,256_000);
  const expected=await hmac(env.PADDLE_WEBHOOK_SECRET!,timestamp+':'+raw);
  if (!signature.some(value=>equal(value.slice(3),expected))) throw new ApiError(401,'Invalid webhook signature.');
  const event=webhookSchema.safeParse(parse(raw));
  if (!event.success) throw invalid();
  const {event_id,event_type,data}=event.data;
  if (!isId(event_id,'evt')) throw invalid();
  const id=event_type.startsWith('transaction.') ? data.id : event_type.startsWith('adjustment.') ? data.transaction_id : null;
  if (isId(id,'txn')) {
    await sql(env,`INSERT OR IGNORE INTO paddle_events(id,mode,transaction_id,received,next_attempt)
      VALUES(?,?,?,?,?)`,event_id,mode,id,now,now).run();
    const work=processEvent(env,mode,event_id);
    if (ctx) ctx.waitUntil(work);
    else await work;
  }
  return {received:true};
}
