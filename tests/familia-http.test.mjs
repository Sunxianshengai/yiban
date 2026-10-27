import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-familia-http-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'test-only',AI_MODEL:'mock'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const route=await loadRoute(new URL('../app/api/familia/[...path]/route.js',import.meta.url));
const auth=await import('../lib/auth.mjs');
const owner=await auth.createUser({name:'小雨',email:'owner@familia.test',password:'Password123'},'admin');
const viewer=await auth.createUser({name:'爸爸',email:'viewer@familia.test',password:'Password123'},'viewer');
const cookies={owner:`yiban_session=${await auth.createSession(owner.id)}`,viewer:`yiban_session=${await auth.createSession(viewer.id)}`};
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await(await import('../lib/store.mjs')).creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint,{as='owner',body,key,origin='http://localhost'}={}){
  return route[method](new Request(`http://localhost/api/familia/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin,...(as?{cookie:cookies[as]}:{}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});
}
const profileInput={role:'father',name:'爸爸',age:36,relation:'distant',description:'希望能多聊聊日常',rating:3,qualities:['patient']};
test('AI companion setup is private, validated and idempotent, including for a viewer',async()=>{
  assert.equal((await call('GET','profiles',{as:''})).status,401);
  assert.equal((await call('POST','profiles',{body:profileInput,key:'origin-check',origin:'https://other.test'})).status,403);
  const created=await call('POST','profiles',{as:'viewer',body:{...profileInput,userId:owner.id},key:'create-viewer'});assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'private, no-store');const profile=await created.json();assert.equal(profile.userId,viewer.id);
  const replay=await(await call('POST','profiles',{as:'viewer',body:{...profileInput,userId:owner.id},key:'create-viewer'})).json();assert.equal(replay.id,profile.id);
  assert.equal((await(await call('GET','profiles',{as:'viewer'})).json()).profiles.length,1);assert.equal((await(await call('GET','profiles')).json()).profiles.length,0);
  assert.equal((await call('PATCH',`profiles/${profile.id}`,{body:{name:'越权'}})).status,404);
  assert.equal((await call('POST','profiles',{body:{...profileInput,age:7},key:'invalid'})).status,400);
  assert.equal((await call('POST','profiles',{body:{...profileInput,avatar:'data:image/svg+xml;base64,PHN2Zz4='},key:'unsafe-avatar'})).status,400);
  assert.equal((await call('POST','profiles',{body:{...profileInput,avatar:'data:image/png;base64,aGVsbG8='},key:'fake-avatar'})).status,400);
  assert.equal((await call('POST','profiles',{as:'viewer',body:{...profileInput,name:'更改内容'},key:'create-viewer'})).status,409);
});
test('mood check-ins persist one personal self-report per day with an honest seven-day series',async()=>{
  const empty=await(await call('GET','moods')).json();assert.equal(empty.series.length,7);assert.equal(empty.series.filter(d=>d.value!==null).length,0);
  assert.equal((await call('POST','moods',{body:{value:0}})).status,400);
  const low=await(await call('POST','moods',{body:{value:1,note:'今天有点累'}})).json();assert.equal(low.entry.value,1);
  const changed=await(await call('POST','moods',{body:{value:5,note:'和家人聊过，感觉好一些'}})).json();assert.equal(changed.entry.id,low.entry.id);
  const series=await(await call('GET','moods')).json();assert.equal(series.series.filter(d=>d.value!==null).length,1);assert.equal(series.today.value,5);
  const other=await(await call('GET','moods',{as:'viewer'})).json();assert.equal(other.today,null);assert.equal(other.series.filter(d=>d.value!==null).length,0);
});
test('advanced persona expressions persist privately, reject invalid values, clear explicitly and detect stale edits',async()=>{
  const expressions={speakingStyle:'短句，一次只问一个问题。',responseExample:'听起来今天挺累的，想先聊聊吗？',avoidedExpressions:'不用你应该，不替我做决定。'};
  const created=await call('POST','profiles',{body:{...profileInput,...expressions},key:'advanced-persona'});assert.equal(created.status,201);const profile=await created.json();
  for(const [field,text] of Object.entries(expressions))assert.equal(profile[field],text);
  assert.equal((await call('PATCH',`profiles/${profile.id}`,{as:'viewer',body:{speakingStyle:'越权修改'}})).status,404);
  for(const body of [{speakingStyle:[]},{responseExample:'字'.repeat(1201)},{avoidedExpressions:{text:'错误类型'}}])assert.equal((await call('PATCH',`profiles/${profile.id}`,{body})).status,400);
  const changed=await call('PATCH',`profiles/${profile.id}`,{body:{expectedUpdatedAt:profile.updatedAt,speakingStyle:''}});assert.equal(changed.status,200);const next=await changed.json();assert.equal(next.speakingStyle,'');assert.equal(next.responseExample,expressions.responseExample);
  assert.equal((await call('PATCH',`profiles/${profile.id}`,{body:{expectedUpdatedAt:'2000-01-01T00:00:00.000Z',name:'旧页面'}})).status,409);
  assert.equal((await(await call('GET','profiles')).json()).profiles.find(item=>item.id===profile.id).name,profile.name);
});
test('profile conversations retain history, use private persona settings and keep real memory billing rules',async()=>{
  const profile=await(await call('POST','profiles',{body:{...profileInput,name:'阿爸'},key:'owner-chat-profile'})).json();
  const chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url));
  async function chatCall(method,endpoint,{as='owner',body,key}={}){return chat[method](new Request(`http://localhost/api/chat/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin:'http://localhost',cookie:cookies[as],...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('/')})});}
  assert.equal((await chatCall('POST','threads',{as:'viewer',body:{options:{profileId:profile.id}}})).status,404);
  const thread=await(await chatCall('POST','threads',{body:{options:{profileId:profile.id}}})).json();assert.equal(thread.options.profileId,profile.id);
  const credits=await import('../lib/credits.mjs');await credits.grant({userId:owner.id,actorId:owner.id,amount:5,note:'隔离聊天测试',requestKey:'profile-fund'});
  let modelCalls=0;
  globalThis.fetch=async(_url,request)=>{if(!JSON.parse(request.body).stream)return Response.json({choices:[{message:{content:'{"memories":[],"ids":[]}'}}]});modelCalls++;const messages=JSON.parse(request.body).messages;assert.match(messages[0].content,/阿爸/);assert.match(messages[0].content,/有耐心/);assert.match(messages[0].content,/不是.*真实家人/);assert.match(messages[0].content,/我们不太亲近/);assert.match(messages[0].content,/关系感受.*一般/);assert.match(messages[0].content,/不逼迫和解/);return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'愿意听你说。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  const request={body:{text:'今天想和你聊聊'},key:'profile-turn'};const response=await chatCall('POST',`threads/${thread.id}/generate`,request);assert.equal(response.status,200);await response.text();
  // Consume the idempotent replay after the original real stream has finished.
  const first=await chatCall('POST',`threads/${thread.id}/generate`,request);await first.text();
  const stored=await(await chatCall('GET',`threads/${thread.id}`)).json();assert.equal(stored.messages[1].text,'愿意听你说。');assert.equal(stored.thread.options.profileId,profile.id);assert.deepEqual(await credits.balance(owner.id),{balance:4,held:0});
  assert.equal((await chatCall('PATCH',`threads/${thread.id}`,{body:{options:{profileId:null}}})).status,409);
  assert.equal(modelCalls,1);
  const changed=await call('PATCH',`profiles/${profile.id}`,{body:{name:'温和的阿爸',relation:'passed',rating:1,qualities:['patient','strict'],speakingStyle:'先听，再回应。',responseExample:'我愿意慢慢听。',avoidedExpressions:'不使用你应该。'}});assert.equal(changed.status,200);
  assert.deepEqual(await credits.balance(owner.id),{balance:4,held:0},'editing persona is free');
  globalThis.fetch=async(_url,request)=>{if(!JSON.parse(request.body).stream)return Response.json({choices:[{message:{content:'{"memories":[],"ids":[]}'}}]});modelCalls++;const messages=JSON.parse(request.body).messages;assert.match(messages[0].content,/温和的阿爸/);assert.match(messages[0].content,/已经离开了/);assert.match(messages[0].content,/很疏远/);assert.match(messages[0].content,/不冒充逝者/);assert.match(messages[0].content,/先听，再回应/);assert.match(messages[0].content,/我愿意慢慢听/);assert.match(messages[0].content,/不使用你应该/);assert.match(messages[0].content,/不是真实聊天或家庭事实/);assert.match(messages[0].content,/不训斥、贬低或威胁/);assert.equal(messages.find(m=>m.role==='assistant').content,'愿意听你说。');return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'你可以慢慢说。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  const next=await chatCall('POST',`threads/${thread.id}/generate`,{body:{text:'再聊一会儿'},key:'updated-profile-turn'});assert.equal(next.status,200);await next.text();
  const updated=await(await chatCall('GET',`threads/${thread.id}`)).json();assert.equal(updated.messages[1].text,'愿意听你说。');assert.equal(updated.messages.at(-1).text,'你可以慢慢说。');assert.equal(modelCalls,2);assert.deepEqual(await credits.balance(owner.id),{balance:3,held:0});
});
