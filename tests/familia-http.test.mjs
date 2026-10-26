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
test('profile conversations retain history, use private persona settings and keep real memory billing rules',async()=>{
  const profile=await(await call('POST','profiles',{body:{...profileInput,name:'阿爸'},key:'owner-chat-profile'})).json();
  const chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url));
  async function chatCall(method,endpoint,{as='owner',body,key}={}){return chat[method](new Request(`http://localhost/api/chat/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin:'http://localhost',cookie:cookies[as],...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('/')})});}
  assert.equal((await chatCall('POST','threads',{as:'viewer',body:{options:{profileId:profile.id}}})).status,404);
  const thread=await(await chatCall('POST','threads',{body:{options:{profileId:profile.id}}})).json();assert.equal(thread.options.profileId,profile.id);
  const credits=await import('../lib/credits.mjs');await credits.grant({userId:owner.id,actorId:owner.id,amount:5,note:'隔离聊天测试',requestKey:'profile-fund'});
  globalThis.fetch=async(_url,request)=>{const messages=JSON.parse(request.body).messages;assert.match(messages[0].content,/阿爸/);assert.match(messages[0].content,/有耐心/);assert.match(messages[0].content,/不是.*真实家人/);return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'愿意听你说。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  const request={body:{text:'今天想和你聊聊'},key:'profile-turn'};const response=await chatCall('POST',`threads/${thread.id}/generate`,request);assert.equal(response.status,200);await response.text();
  // Consume the idempotent replay after the original real stream has finished.
  const first=await chatCall('POST',`threads/${thread.id}/generate`,request);await first.text();
  const stored=await(await chatCall('GET',`threads/${thread.id}`)).json();assert.equal(stored.messages[1].text,'愿意听你说。');assert.equal(stored.thread.options.profileId,profile.id);assert.deepEqual(await credits.balance(owner.id),{balance:4,held:0});
  assert.equal((await chatCall('PATCH',`threads/${thread.id}`,{body:{options:{profileId:null}}})).status,409);
});
