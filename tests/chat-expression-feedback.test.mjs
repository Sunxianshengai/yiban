import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-expressions-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock'});delete process.env.DATABASE_URL;delete process.env.VERCEL;
const auth=await import('../lib/auth.mjs'),store=await import('../lib/store.mjs'),credits=await import('../lib/credits.mjs'),profiles=await import('../lib/familia-store.mjs');
const user=await auth.createUser({name:'表达测试',email:'expression@test.invalid',password:'Password123'},'admin'),other=await auth.createUser({name:'别人',email:'expression-other@test.invalid',password:'Password123'},'viewer');
const cookie=`yiban_session=${await auth.createSession(user.id)}`,foreignCookie=`yiban_session=${await auth.createSession(other.id)}`;
const route=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url)),originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint,body,{foreign=false,key,origin='http://localhost'}={}){return route[method](new Request(`http://localhost/api/chat/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin,cookie:foreign?foreignCookie:cookie,...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({path:endpoint.split('/')})});}
await credits.grant({userId:user.id,actorId:user.id,amount:30,note:'隔离测试',requestKey:'expression-fund'});
let requests=[],replies=['你说，我听着。'];
globalThis.fetch=async(url,request)=>{const body=JSON.parse(request.body);if(!body.stream)return Response.json({choices:[{message:{content:'{"memories":[],"ids":[]}'}}]});requests.push(body);return new Response(`data: ${JSON.stringify({choices:[{delta:{content:replies.shift()||'按你喜欢的方式聊。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
const familyBefore=await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name)));
let thread,message;
test('three styles persist separately and edits preserve prior fields and user isolation',async()=>{
 for(const styleId of ['banter','gentle','bright']){const p=await profiles.createProfile(user,{name:styleId,role:'friend',age:26,qualities:[],styleId},'style-'+styleId);assert.equal(p.styleId,styleId);const next=await profiles.updateProfile(user,p.id,{description:'留住自定义',verbalTics:'low'});assert.equal(next.styleId,styleId);assert.equal(next.verbalTics,'low');await assert.rejects(()=>profiles.ownedProfile(other,p.id));}
 await profiles.updateDefaultProfile(user,{styleId:'banter'});
});
test('message feedback persists private literal preference for free, is idempotent and checks source and origin',async()=>{
 thread=await(await call('POST','threads',{options:{memoryMode:'off'}})).json();
 await(await call('POST',`threads/${thread.id}/generate`,{text:'我今天只是想吐槽'}, {key:'first'})).text();
 message=(await(await call('GET',`threads/${thread.id}`)).json()).messages.at(-1);
 const before=await credits.balance(user.id),endpoint=`threads/${thread.id}/avoid-expression`,body={messageId:message.id,phrase:'你说，我听着'};
 assert.equal((await call('POST',endpoint,body,{foreign:true})).status,404);
 assert.equal((await call('POST',endpoint,body,{origin:'https://attacker.invalid'})).status,403);
 assert.equal((await call('POST',endpoint,{...body,phrase:'没有出现的短语'})).status,400);
 assert.equal((await call('POST',endpoint,body)).status,200);assert.equal((await call('POST',endpoint,body)).status,200);
 assert.deepEqual((await profiles.defaultProfile(user)).blockedExpressions,['你说，我听着']);assert.deepEqual((await profiles.defaultProfile(other)).blockedExpressions,undefined);assert.deepEqual(await credits.balance(user.id),before);
});
test('next reply gets role examples and recent context, repairs banned words without leaking or double charging',async()=>{
 replies=['你说，我听着。','那个同事可真会抢功劳。'];const before=(await credits.balance(user.id)).balance,count=requests.length;
 const response=await call('POST',`threads/${thread.id}/generate`,{text:'同事又抢我功劳'}, {key:'repair'});const sse=await response.text();assert.doesNotMatch(sse,/你说，我听着/);assert.match(sse,/那个同事/);assert.equal(requests.length,count+2);assert.match(requests[count].messages[0].content,/俏皮损友/);assert.match(requests[count].messages[0].content,/原创的虚构多轮/);assert.equal((await credits.balance(user.id)).balance,before-1);
});
test('unrepairable ban refunds, leaves no banned message text, and releases thread for next turn',async()=>{
 replies=['你说，我听着','你说，我听着'];const before=(await credits.balance(user.id)).balance;
 const sse=await(await call('POST',`threads/${thread.id}/generate`,{text:'今天太忙了'}, {key:'repair-fail'})).text();assert.match(sse,/积分已退回/);
 const view=await(await call('GET',`threads/${thread.id}`)).json();assert.equal(view.thread.activeJobId,null);assert.equal(view.messages.at(-1).status,'failed');assert.equal(view.messages.at(-1).text,'');assert.equal((await credits.balance(user.id)).balance,before);
});
test('new private settings and feedback never change family memory records',async()=>{assert.deepEqual(await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name))),familyBefore);});
