import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
import {withUserScope} from '../lib/access-scope.mjs';
import {assertStorageEnvironment,verifyEnvironmentBinding} from '../lib/data-environment.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-isolation-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,VERCEL:'',DATABASE_URL:'',AI_API_KEY:'',DEEPSEEK_API_KEY:''});
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs');
const main=await loadRoute(),chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url)),familia=await loadRoute(new URL('../app/api/familia/[...path]/route.js',import.meta.url));
const a=await auth.createUser({name:'平台及家庭A管理员',email:'owner@isolation.test',password:'Password123'},'admin'),b=await auth.createUser({name:'家庭B管理员',email:'admin-b@isolation.test',password:'Password123'},'admin'),c=await auth.createUser({name:'另一家庭',email:'admin-c@isolation.test',password:'Password123'},'admin');
const cookies={a:`yiban_session=${await auth.createSession(a.id)}`,b:`yiban_session=${await auth.createSession(b.id)}`,c:`yiban_session=${await auth.createSession(c.id)}`};
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint,{as='a',body,key,route=main}={}){return route[method](new Request('http://localhost/api/'+endpoint,{method,headers:{origin:'http://localhost',cookie:cookies[as]||'','Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});}
const familyBefore=await store.snapshot();let familyB,familyC,memoryB,memberB;
test('test storage fails closed on production identity or missing dedicated directory',()=>{
  assert.throws(()=>assertStorageEnvironment({NODE_ENV:'test'}),/独立/);
  assert.throws(()=>assertStorageEnvironment({VERCEL:'1',VERCEL_ENV:'preview',DATABASE_URL:'do-not-connect'}),/非正式/);
  assert.throws(()=>verifyEnvironmentBinding({environment:'production'},'preview',{remote:true}),/拒绝/);
  assert.throws(()=>verifyEnvironmentBinding(null,'preview',{remote:true}),/尚未初始化/);
  assert.equal(assertStorageEnvironment({VERCEL:'1',VERCEL_ENV:'production',DATABASE_URL:'not-used'}),'production');
});
test('new family spaces are empty and independent; original family data is unchanged',async()=>{
  familyB=await(await call('POST','auth/families',{as:'b',body:{name:'家庭B'}})).json();assert.notEqual(familyB.familyId,'family');assert.equal(familyB.role,'admin');
  familyC=await(await call('POST','auth/families',{as:'c',body:{name:'家庭C'}})).json();assert.notEqual(familyC.familyId,familyB.familyId);
  for(const as of ['b','c']){const state=await(await call('GET','state',{as})).json();assert.deepEqual(state.memories,[]);assert.deepEqual(state.members,[]);assert.ok(state.settings.familyName);}
  const current=await(await call('GET','state')).json();assert.deepEqual(current.memories,familyBefore.memories);assert.deepEqual(current.members,familyBefore.members);
  const familySettings=await(await call('PATCH','settings',{as:'b',body:{familyName:'B专属名称'}})).json();assert.equal(familySettings.familyId,familyB.familyId);assert.equal((await(await call('GET','state')).json()).settings.familyName,familyBefore.settings.familyName);
});
test('family-admin roles never grant platform credits; invitation uses trusted family and role',async()=>{
  assert.equal((await call('POST','credits/grant',{as:'b',body:{userId:b.id,amount:100,note:'不能自发'}})).status,403);
  assert.equal((await call('POST','credits/grant',{body:{userId:b.id,amount:10,note:'平台可跨家庭发放'},key:'platform-grant'})).status,201);
  const invite=await(await call('POST','auth/invite',{as:'b',body:{role:'viewer',familyId:'family',platformRole:'owner'}})).json();
  const response=await call('POST','auth/register',{as:'',body:{code:invite.code,name:'B家庭成员',email:'member-b@isolation.test',password:'Password123',familyId:'family',role:'admin',platformRole:'owner'}});assert.equal(response.status,201);const user=(await response.json()).user;
  assert.equal(user.familyId,familyB.familyId);assert.equal(user.role,'viewer');assert.equal(user.platformRole,null);cookies.viewer=`yiban_session=${await auth.createSession(user.id)}`;
  assert.equal((await call('POST','auth/register',{as:'',body:{code:invite.code,name:'抢用',email:'other-b@isolation.test',password:'Password123'}})).status,400);
  assert.equal((await call('POST','auth/invite',{as:'viewer',body:{role:'admin'}})).status,403);
  const accounts=(await(await call('GET','auth/accounts',{as:'b'})).json()).accounts;assert.ok(accounts.some(account=>account.id===user.id));assert.ok(!accounts.some(account=>account.id===a.id));
  assert.equal((await call('PATCH','auth/accounts/'+a.id,{as:'b',body:{name:'越权改名'}})).status,404);
});
test('family data cannot be read, mutated, removed or referenced across families',async()=>{
  const member=await call('POST','members',{as:'b',body:{name:'B的家人',relation:'爸爸',role:'家庭成员',color:'sage'}});assert.equal(member.status,201);memberB=await member.json();
  const created=await call('POST','memories',{as:'b',body:{title:'只有B家能看',story:'家庭B的私有家庭资料',people:['B的家人'],year:'2025',status:'confirmed',familyId:'family'}});assert.equal(created.status,201);memoryB=await created.json();assert.equal(memoryB.familyId,familyB.familyId);
  assert.ok(!(await(await call('GET','state')).json()).memories.some(memory=>memory.id===memoryB.id));
  for(const method of ['PATCH','DELETE'])assert.equal((await call(method,'memories/'+memoryB.id,{body:method==='PATCH'?{title:'不该改动'}:undefined})).status,404);
  assert.equal((await call('POST','comments',{body:{memoryId:memoryB.id,text:'不该出现'}})).status,400);
  assert.equal((await call('POST','stage/milestones',{body:{memberId:memberB.id,key:'first-smile',done:true}})).status,404);
  const chatMemories=await(await call('GET','memories',{as:'b',route:chat})).json();assert.ok(chatMemories.memories.some(memory=>memory.id===memoryB.id));assert.ok(!chatMemories.memories.some(memory=>memory.id==='demo-child'));
  const stored=await store.get('memories',memoryB.id);assert.equal(stored.title,'只有B家能看');
});
test('private media remains private even within the same family and cannot be laundered into a memory',async()=>{
  await withUserScope({...b,...familyB},async()=>{const saved=await store.saveMedia('private-b.wav',Buffer.from('private-audio'),'audio/wav');await store.put('uploads',{id:'private-b.wav',userId:b.id,shared:false,...saved});});
  assert.equal((await call('GET','media/private-b.wav')).status,404);assert.equal((await call('GET','media/private-b.wav',{as:'viewer'})).status,404);
  assert.equal((await call('POST','memories',{body:{title:'不能引用其他家庭声音',story:'测试',audio:'/api/media/private-b.wav'}})).status,404);
  const same=await call('GET','media/private-b.wav',{as:'b'});assert.equal(same.status,200);assert.equal(same.headers.get('Cache-Control'),'private, no-store');assert.match(same.headers.get('Vary'),/Cookie/);assert.equal(await same.text(),'private-audio');
  assert.equal((await call('PATCH','memories/'+memoryB.id,{as:'viewer',body:{audio:'/api/media/private-b.wav'}})).status,403);
  await withUserScope({...b,...familyB},()=>store.put('uploads',{id:'shared-b.wav',userId:b.id,shared:true}));
  assert.equal((await call('GET','media/shared-b.wav')).status,404);
});
test('private companion scopes ignore family-admin access and retain original IDs on family switch',async()=>{
  const thread=await(await call('POST','threads',{as:'b',route:chat,body:{}})).json();
  assert.equal((await call('GET','threads/'+thread.id,{as:'viewer',route:chat})).status,404);assert.equal((await call('GET','threads/'+thread.id,{route:chat})).status,404);
  const profile=await(await call('POST','profiles',{as:'b',route:familia,body:{name:'B的伙伴',role:'friend',age:25,qualities:['friendly']},key:'profile-b'})).json();
  assert.equal((await call('PATCH','profiles/'+profile.id,{as:'viewer',route:familia,body:{name:'不能改'}})).status,404);
  const switched=await call('POST','auth/family-switch',{as:'b',body:{familyId:'family'}});assert.equal(switched.status,200);
  assert.equal((await call('GET','threads/'+thread.id,{as:'b',route:chat})).status,200);
  assert.equal((await call('POST','auth/family-switch',{body:{familyId:familyC.familyId}})).status,404);
  await call('POST','auth/family-switch',{as:'b',body:{familyId:familyB.familyId}});
});
test('storage scopes reject guessed IDs, forged ownership and cross-owner transaction writes',async()=>{
  await assert.rejects(withUserScope({...c,...familyC},()=>store.put('memories',{id:memoryB.id,title:'override'})),/无权/);
  assert.equal(await withUserScope({...c,...familyC},()=>store.get('members',memberB.id)),null);
  const id='private-scope-test';await store.put('chat_messages',{id,userId:b.id,threadId:'test',text:'private',createdAt:'2026-01-01'});
  assert.equal(await withUserScope(a,()=>store.get('chat_messages',id)),null);
  await assert.rejects(withUserScope(a,()=>store.put('chat_messages',{id,userId:a.id,text:'stolen'})),/无权/);
  await assert.rejects(withUserScope(a,()=>store.put('unclassified_new_collection',{id:'new'})),/无权/);
  const transaction=await import('../lib/document-transaction.mjs'),previous=await store.get('chat_messages',id);await assert.rejects(withUserScope(a,()=>transaction.commitDocuments([{collection:'chat_messages',id,value:previous}],[{collection:'chat_messages',id,value:{id,userId:a.id}}])),/无权/);
});
test('removing a family member preserves their other family and private account data',async()=>{
  const own=await call('POST','memories',{as:'c',body:{title:'C家庭保留资料',story:'不能被B管理员删除',status:'confirmed'}});assert.equal(own.status,201);const memory=await own.json();
  const invite=await(await call('POST','auth/invite',{as:'b',body:{role:'viewer'}})).json();
  const joined=await call('POST','auth/family-join',{as:'c',body:{code:invite.code}});assert.equal(joined.status,200);assert.equal((await joined.json()).role,'viewer');
  assert.equal((await call('DELETE','auth/accounts/'+c.id,{as:'b'})).status,200);
  const restored=await(await call('GET','state',{as:'c'})).json();assert.equal(restored.account.familyId,familyC.familyId);assert.equal(restored.account.role,'admin');assert.ok(restored.memories.some(item=>item.id===memory.id));
  assert.equal((await call('POST','auth/family-switch',{as:'c',body:{familyId:familyB.familyId}})).status,404);
});
test('unknown roles, concurrent invitation reuse and duplicate email registration fail safely',async()=>{
  assert.equal(auth.accountRole({role:'unknown'},'viewer'),false);
  const invite=await(await call('POST','auth/invite',{as:'b',body:{role:'viewer'}})).json();
  const attempts=await Promise.all([1,2].map(index=>call('POST','auth/register',{as:'',body:{code:invite.code,name:'并发注册'+index,email:'concurrent-'+index+'@isolation.test',password:'Password123'}})));
  assert.equal(attempts.filter(result=>result.status===201).length,1);
  const duplicate=await Promise.allSettled([1,2].map(index=>auth.createUser({name:'邮箱唯一'+index,email:'same-address@isolation.test',password:'Password123'},'viewer')));assert.equal(duplicate.filter(item=>item.status==='fulfilled').length,1);
});
test('maintenance freezes writes before handlers run and production setup requires its secret',async()=>{
  process.env.YIBAN_MAINTENANCE_MODE='1';
  try{const response=await call('POST','credits/grant',{body:{userId:a.id,amount:1,note:'blocked'}});assert.equal(response.status,503);assert.equal((await response.json()).maintenance,true);assert.equal((await(await call('GET','auth/status')).json()).maintenance,true);}finally{delete process.env.YIBAN_MAINTENANCE_MODE;}
  process.env.VERCEL='1';try{assert.equal((await call('POST','auth/setup',{as:'',body:{name:'不能抢占',email:'bootstrap@isolation.test',password:'Password123'}})).status,403);}finally{process.env.VERCEL='';}
});
