import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';

const directory=mkdtempSync(path.join(tmpdir(),'yiban-welcome-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory});
for(const key of ['DATABASE_URL','VERCEL','YIBAN_WELCOME_CREDITS'])delete process.env[key];
const route=await loadRoute();
const auth=await import('../lib/auth.mjs'),credits=await import('../lib/credits.mjs'),store=await import('../lib/store.mjs');
const {ensureWelcomeCredits}=await import('../lib/welcome-credits.mjs');
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function post(endpoint,body,cookie=''){
  return route.POST(new Request('http://localhost/api/'+endpoint,{method:'POST',headers:{origin:'http://localhost','Content-Type':'application/json',cookie},body:JSON.stringify(body)}),{params:Promise.resolve({path:endpoint.split('/')})});
}
const cookie=response=>response.headers.get('set-cookie').split(';')[0];
const password='Password123!';let ownerCookie,member;

test('setup and invited registration credit exactly 100 with a system welcome ledger',async()=>{
  const setup=await post('auth/setup',{name:'管理',email:'owner@welcome.test',password});assert.equal(setup.status,201);ownerCookie=cookie(setup);
  const owner=(await setup.json()).user;assert.equal((await credits.balance(owner.id)).balance,100);
  const invite=await post('auth/invite',{role:'viewer'},ownerCookie);assert.equal(invite.status,200);
  const response=await post('auth/register',{name:'新成员',email:'new@welcome.test',password,code:(await invite.json()).code,amount:999999,welcomeCreditVersion:999});
  assert.equal(response.status,201);member=(await response.json()).user;
  const wallet=await credits.account(member.id);assert.equal(wallet.balance,100);assert.equal(wallet.total,1);
  assert.equal(wallet.entries[0].feature,'welcome_grant');assert.equal(wallet.entries[0].amount,100);assert.match(wallet.entries[0].note,/新用户/);
});

test('repeated and concurrent logins cannot claim again or credit a body-supplied account',async()=>{
  const responses=await Promise.all(Array.from({length:8},()=>post('auth/login',{email:'new@welcome.test',password,userId:'forged-account',amount:9999})));
  assert.ok(responses.every(r=>r.status===200));
  await Promise.all(Array.from({length:12},()=>ensureWelcomeCredits(member.id)));
  assert.equal((await credits.account(member.id)).balance,100);assert.equal((await credits.account(member.id)).total,1);
  assert.equal((await credits.balance('forged-account')).balance,0);
  const failure=await post('auth/login',{email:'new@welcome.test',password:'wrong'});assert.equal(failure.status,400);
  assert.equal((await credits.account(member.id)).total,1);
});

test('existing unmarked accounts do not receive a retroactive promotion',async()=>{
  const old=await auth.createUser({name:'原账号',email:'old@welcome.test',password});
  const raw=await store.get('users',old.id);delete raw.welcomeCreditVersion;await store.put('users',raw);
  assert.equal((await post('auth/login',{email:'old@welcome.test',password})).status,200);
  assert.equal((await credits.balance(old.id)).balance,0);
});

test('an interrupted or disabled promotion can retry later without losing eligibility or double funding',async()=>{
  const waiting=await auth.createUser({name:'重试账号',email:'retry@welcome.test',password});
  process.env.YIBAN_WELCOME_CREDITS='0';await ensureWelcomeCredits(waiting.id);assert.equal((await credits.balance(waiting.id)).balance,0);
  delete process.env.YIBAN_WELCOME_CREDITS;await Promise.all([ensureWelcomeCredits(waiting.id),ensureWelcomeCredits(waiting.id)]);
  assert.equal((await credits.account(waiting.id)).balance,100);assert.equal((await credits.account(waiting.id)).total,1);
});
