import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-platform-registration-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory});
for(const key of ['DATABASE_URL','VERCEL','YIBAN_WELCOME_CREDITS'])delete process.env[key];
const main=await loadRoute(),platform=await loadRoute(new URL('../app/api/platform/[[...path]]/route.js',import.meta.url));
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs'),credits=await import('../lib/credits.mjs');
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
const password='Password123!';const cookies={};let root,b,c;
async function call(method,endpoint,{as='root',body,origin='http://localhost',route=main}={}){
  const response=await route[method](new Request('http://localhost/api/'+endpoint,{method,headers:{origin,'Content-Type':'application/json',cookie:cookies[as]||''},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/').filter((x,i)=>route!==platform||i>0)})});
  return response;
}
async function register(name,email,extra={}){const r=await call('POST','auth/register',{as:'',body:{name,email,password,...extra}});assert.equal(r.status,201);cookies[email]=r.headers.get('set-cookie').split(';')[0];return (await r.json()).user;}
test('empty invitation atomically creates a new family and only a family-admin role, with 100 welcome credits',async()=>{
  const r=await call('POST','auth/setup',{as:'',body:{name:'平台拥有者',email:'owner@platform.test',password}});assert.equal(r.status,201);root=(await r.json()).user;cookies.root=r.headers.get('set-cookie').split(';')[0];
  b=await register('家庭B','b@platform.test',{code:' ',role:'owner',platformRole:'owner',familyId:'family'});cookies.b=cookies['b@platform.test'];
  c=await register('家庭C','c@platform.test');cookies.c=cookies['c@platform.test'];
  assert.equal(b.role,'admin');assert.equal(b.platformRole,null);assert.notEqual(b.familyId,root.familyId);assert.notEqual(b.familyId,c.familyId);
  const memberships=(await store.all('family_memberships')).filter(m=>m.userId===b.id);assert.equal(memberships.length,1);assert.equal(memberships[0].familyId,b.familyId);
  const state=await(await call('GET','state',{as:'b'})).json();assert.deepEqual(state.memories,[]);assert.deepEqual(state.members,[]);assert.equal(state.settings.familyName,'家庭B的家庭');
  assert.equal((await credits.balance(b.id)).balance,100);assert.equal((await store.get('system','platform_owner')).userId,root.id);
});
test('a supplied invitation joins exactly that family; invalid invitations never create another family',async()=>{
  const code=(await(await call('POST','auth/invite',{as:'b',body:{role:'viewer'}})).json()).code;
  const joined=await register('B成员','join@platform.test',{code,role:'admin',platformRole:'owner'});assert.equal(joined.familyId,b.familyId);assert.equal(joined.role,'viewer');assert.equal(joined.platformRole,null);
  const count=(await store.all('families')).length;
  assert.equal((await call('POST','auth/register',{as:'',body:{name:'无效',email:'bad@platform.test',password,code:'BADCODE'}})).status,400);
  assert.equal((await store.all('families')).length,count);
  assert.equal((await call('GET','platform',{as:'b',route:platform})).status,403);
  assert.equal((await call('GET','platform',{as:'',route:platform})).status,401);
  assert.equal((await call('POST','credits/grant',{as:'b',body:{userId:b.id,amount:100,note:'越权'}})).status,403);
  assert.equal((await call('PATCH','auth/accounts/'+c.id,{as:'b',body:{name:'越权'}})).status,404);
});
test('platform owner manages another family within one session without joining it or changing their identity',async()=>{
  const extraRoot=`yiban_session=${await auth.createSession(root.id)}`;cookies.otherRoot=extraRoot;
  const member=await(await call('POST','members',{as:'b',body:{name:'B家人物'}})).json();
  assert.ok(!(await(await call('GET','state')).json()).members.some(m=>m.id===member.id));
  assert.equal((await call('POST','platform/family-context',{route:platform,as:'c',body:{familyId:b.familyId}})).status,403);
  assert.equal((await call('POST','platform/family-context',{route:platform,body:{familyId:b.familyId}})).status,200);
  const state=await(await call('GET','state')).json();assert.equal(state.account.id,root.id);assert.equal(state.account.platformRole,'owner');assert.equal(state.account.familyId,b.familyId);assert.ok(state.members.some(m=>m.id===member.id));
  assert.equal((await call('PATCH','members/'+member.id,{body:{name:'平台修改'}})).status,200);
  assert.equal((await(await call('GET','state',{as:'b'})).json()).members.find(m=>m.id===member.id).name,'平台修改');
  assert.equal((await(await call('GET','state',{as:'otherRoot'})).json()).account.familyId,root.familyId);
  assert.equal((await store.all('family_memberships')).filter(m=>m.userId===root.id&&m.familyId===b.familyId).length,0);
  await call('POST','platform/family-context',{route:platform,body:{familyId:null}});assert.equal((await(await call('GET','state')).json()).account.familyId,root.familyId);
});
test('owner can inspect business records and wallets, but credentials and internal collections are never exposed',async()=>{
  await store.put('chat_messages',{id:'private-b-message',threadId:'private-thread',userId:b.id,role:'user',text:'B的个人聊天',createdAt:new Date().toISOString()});
  const response=await call('GET','platform',{route:platform});const overview=await response.json();assert.ok(overview.accounts.some(a=>a.id===b.id));assert.ok(overview.families.some(f=>f.id===c.familyId));assert.doesNotMatch(JSON.stringify(overview),/passwordHash|"salt"/);
  const data=await(await call('GET','platform/data?collection=chat_messages&userId='+b.id,{route:platform})).json();assert.equal(data.items.length,1);assert.equal(data.items[0].text,'B的个人聊天');
  for(const collection of ['users','sessions','system','invites','notification_subscriptions','__proto__'])assert.equal((await call('GET','platform/data?collection='+collection,{route:platform})).status,400);
  assert.equal((await call('GET','platform/data?collection=chat_messages',{route:platform,as:'b'})).status,403);
  const wallet=await(await call('GET','platform/accounts/'+b.id+'/credits',{route:platform})).json();assert.equal(wallet.balance,100);
});
test('owner may disable and restore family accounts, cannot disable themselves or grant platform roles',async()=>{
  assert.equal((await call('PATCH','platform/accounts/'+b.id,{route:platform,body:{disabled:true}})).status,200);
  assert.equal((await call('GET','state',{as:'b'})).status,401);
  assert.equal((await call('PATCH','platform/accounts/'+b.id,{route:platform,body:{disabled:false}})).status,200);
  assert.equal((await call('GET','state',{as:'b'})).status,200);
  assert.equal((await call('PATCH','platform/accounts/'+root.id,{route:platform,body:{disabled:true}})).status,403);
  assert.equal((await call('PATCH','platform/accounts/'+b.id,{route:platform,body:{platformRole:'owner'}})).status,400);
  assert.equal((await call('POST','platform/family-context',{route:platform,origin:'https://evil.invalid',body:{familyId:b.familyId}})).status,403);
  assert.equal((await store.get('system','platform_owner')).userId,root.id);
});

test('same-email concurrent registration creates one family, and family admins cannot rename the platform owner',async()=>{
  const before=(await store.all('families')).length;
  const responses=await Promise.all([1,2].map(()=>call('POST','auth/register',{as:'',body:{name:'并发',email:'duplicate@platform.test',password}})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,400]);assert.equal((await store.all('families')).length,before+1);
  const code=(await(await call('POST','auth/invite',{body:{role:'admin'}})).json()).code;
  const sibling=await register('同家庭管理员','sibling@platform.test',{code});cookies.sibling=cookies['sibling@platform.test'];
  assert.equal(sibling.platformRole,null);
  assert.equal((await call('PATCH','auth/accounts/'+root.id,{as:'sibling',body:{name:'不能改平台管理员'}})).status,403);
  assert.equal((await call('GET','platform',{as:'sibling',route:platform})).status,403);
});
