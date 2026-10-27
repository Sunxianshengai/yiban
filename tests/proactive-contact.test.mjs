import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-proactive-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'test',AI_MODEL:'mock',PROACTIVE_CRON_SECRET:'unit-cron-secret'});delete process.env.DATABASE_URL;delete process.env.VERCEL;
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs'),p=await import('../lib/proactive-contact.mjs'),push=await import('../lib/proactive-push.mjs'),credits=await import('../lib/credits.mjs');
const route=await loadRoute(new URL('../app/api/proactive/[...path]/route.js',import.meta.url));
const time=Date.parse('2026-10-27T08:00:00Z'),hour=3600000;
let serial=0;
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function fixture(){
 const n=++serial,user=await auth.createUser({name:'测试',email:`proactive-${n}@test.invalid`,password:'Password123'},'admin'),threadId=`thread-${n}`,userId=`human-${n}`,assistantId=`assistant-${n}`;
 await store.put('chat_threads',{id:threadId,userId:user.id,options:{profileId:null,mode:'daily',memoryMode:'off'},headId:assistantId,activeJobId:null,createdAt:new Date(time-25*hour).toISOString(),updatedAt:new Date(time-3*hour).toISOString()});
 const messages=[{id:`earlier-${n}`,role:'user',text:'最近在准备面试',parentId:null,createdAt:new Date(time-25*hour).toISOString()},{id:`earlier-ai-${n}`,role:'assistant',text:'一起慢慢准备',parentId:`earlier-${n}`,createdAt:new Date(time-25*hour+1000).toISOString()},{id:userId,role:'user',text:'明天下午要去面试。',parentId:`earlier-ai-${n}`,createdAt:new Date(time-3*hour).toISOString()},{id:assistantId,role:'assistant',text:'今晚好好休息。',parentId:userId,createdAt:new Date(time-3*hour+1000).toISOString()}];
 for(const m of messages)await store.put('chat_messages',{...m,userId:user.id,threadId,status:'completed'});
 const callback={id:`callback-${n}`,userId:user.id,personaId:null,threadId,sourceMessageId:userId,status:'open',quote:'明天下午要去面试。',hook:'面试',kind:'promise',dueAt:new Date(time-hour).toISOString(),expiresAt:new Date(time+24*hour).toISOString(),createdAt:new Date(time-3*hour).toISOString()};await store.put('chat_callbacks',callback);
 let settings=await p.readSettings(user);assert.equal(settings.enabled,false);settings=await p.updateSettings(user,null,{enabled:true,expectedRevision:0},time-2*hour);
 return {user,settings,threadId,callback,userId};
}
const model=async()=>JSON.stringify({send:true,text:'准备得怎么样了？\n---\n想聊的时候和我说说。'});
test('offline outreach is private, atomic, persisted, unpaid and idempotent under overlapping workers',async()=>{
 const f=await fixture();const before=await credits.balance(f.user.id);const results=await Promise.all([p.runForSetting(f.settings,{time,model}),p.runForSetting(f.settings,{time,model})]);assert.equal(results.filter(r=>r.status==='completed').length,1);
 const messages=(await store.all('chat_messages')).filter(m=>m.userId===f.user.id&&m.proactive);assert.equal(messages.length,1);assert.equal(messages[0].parts.length,2);assert.equal(messages[0].free,true);assert.deepEqual(await credits.balance(f.user.id),before);assert.equal((await p.runForSetting(f.settings,{time:time+hour,model})).status,'skipped');
 const reason=await p.reasonFor(f.user,messages[0].id);assert.equal(reason.quote,f.callback.quote);await store.remove('chat_messages',f.userId);assert.equal((await p.reasonFor(f.user,messages[0].id)).available,false);
});
test('quiet hours across midnight, cadence, per-account cap and unanswered backoff are enforced',async()=>{
 const f=await fixture();assert.equal(p.isQuiet(f.settings,Date.parse('2026-10-27T15:00:00Z')),true);assert.equal(p.isQuiet(f.settings,Date.parse('2026-10-27T23:30:00Z')),true);assert.equal(p.isQuiet(f.settings,time),false);
 let state=await p.accountState(f.user);await store.put('proactive_state',{...state,sent:[{profileId:null,at:time-hour}]});assert.equal((await p.runForSetting(f.settings,{time,model})).status,'skipped');
 state=await p.accountState(f.user);await store.put('proactive_state',{...state,sent:[{profileId:null,at:time-25*hour},{profileId:null,at:time-49*hour}]});assert.equal((await p.runForSetting(f.settings,{time,model})).status,'skipped');
 await p.activity(f.user,{profileId:null,replied:true},time-2*hour);assert.equal((await p.runForSetting(f.settings,{time,model})).status,'completed');
 const paused=await p.updateSettings(f.user,null,{expectedRevision:f.settings.revision,pause:true},time);assert.ok(paused.pausedUntil>time);assert.equal(p.isQuiet(paused,paused.pausedUntil),false);
});
test('typing, changed settings, deleted evidence and new human input invalidate in-flight generation',async()=>{
 for(const change of ['activity','disabled','source']){const f=await fixture();const result=await p.runForSetting(f.settings,{time,model:async()=>{if(change==='activity')await p.activity(f.user,{profileId:null,typing:true},time);if(change==='disabled')await p.updateSettings(f.user,null,{enabled:false,expectedRevision:f.settings.revision},time);if(change==='source')await store.remove('chat_messages',f.userId);return model();}});assert.equal(result.status,'retry');assert.equal((await store.all('chat_messages')).filter(m=>m.userId===f.user.id&&m.proactive).length,0);}
});
test('foreign partner callbacks and fabricated source quotes never become outreach',async()=>{
 const f=await fixture();await store.put('chat_callbacks',{...f.callback,personaId:'other-profile'});assert.equal((await p.runForSetting(f.settings,{time,model})).status,'skipped');await store.put('chat_callbacks',{...f.callback,quote:'用户没说过的安排'});assert.equal((await p.runForSetting(f.settings,{time,model})).status,'skipped');
});
test('scheduler authorization, settings revisions and reason access use real HTTP boundaries',async()=>{
 const f=await fixture(),token=await auth.createSession(f.user.id);const call=(method,endpoint,body,extra={})=>route[method](new Request('http://localhost/api/proactive/'+endpoint,{method,headers:{origin:'http://localhost',cookie:'yiban_session='+token,...extra},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({path:endpoint.split('/')} )});
 assert.equal((await call('POST','run',{})).status,401);assert.equal((await call('GET','settings')).status,200);assert.equal((await call('PATCH','settings',{expectedRevision:0,enabled:false})).status,409);assert.equal((await call('GET','reason/not-mine')).status,404);assert.equal((await call('POST','activity',{profileId:'not-owned'})).status,404);
});
test('push rejects arbitrary network endpoints and logout revokes this session only',async()=>{
 const f=await fixture(),token=await auth.createSession(f.user.id),request=new Request('http://localhost',{headers:{cookie:'yiban_session='+token}});const valid={subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}}};
 for(const endpoint of ['http://127.0.0.1','https://evil.invalid','https://fcm.googleapis.com.evil.invalid','https://fcm.googleapis.com:8443/test'])assert.throws(()=>push.validateSubscription({...valid,subscription:{...valid.subscription,endpoint}}));
 process.env.WEB_PUSH_PUBLIC_KEY='test';process.env.WEB_PUSH_PRIVATE_KEY='test';await push.subscribe(f.user,request,valid);assert.equal((await push.deviceState(f.user,request)).enabled,true);await auth.revokeSession(request);assert.equal((await push.deviceState(f.user,request)).enabled,false);
});
