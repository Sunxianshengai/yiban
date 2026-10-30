import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadRoute} from './route-harness.mjs';
import {withUserScope} from '../lib/access-scope.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-omni-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_ENV:'test',YIBAN_DATA_DIR:directory,VERCEL:'',DATABASE_URL:'',OMNI_CALL_MOCK:'1',QWEN_OMNI_API_KEY:'',QWEN_VOICE_API_KEY:''});
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs'),omni=await import('../lib/omni-calls.mjs');
const route=await loadRoute(new URL('../app/api/omni-calls/[[...path]]/route.js',import.meta.url));
const a=await auth.createUser({name:'A',email:'a@omni.test',password:'Password123'},'admin'),b=await auth.createUser({name:'B',email:'b@omni.test',password:'Password123'},'viewer');
const cookies={a:'yiban_session='+await auth.createSession(a.id),b:'yiban_session='+await auth.createSession(b.id)};
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
const body=()=>({profileId:'default',voiceId:'Tina',style:'natural',vad:'semantic_vad',silence:700,requestId:randomUUID(),sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'});
async function call(method,endpoint='',value,{user='a',origin='http://localhost',cookie=true}={}){return route[method](new Request('http://localhost/api/omni-calls'+(endpoint?'/'+endpoint:''),{method,headers:{cookie:cookie?cookies[user]:'',origin,'Content-Type':'application/json'},...(value?{body:JSON.stringify(value)}:{})}),{params:Promise.resolve({path:endpoint?endpoint.split('/'):[]})});}
test('call API requires a signed-in owner and same-origin writes; profile and voice remain private',async()=>{
 assert.equal((await call('GET','',null,{cookie:false})).status,401);
 assert.equal((await call('POST','offer',body(),{origin:'https://evil.test'})).status,403);
 const config=await(await call('GET')).json();assert.equal(config.available,true);assert.equal(config.points,0);assert.equal(config.model,omni.OMNI_MODEL);
 await withUserScope(b,()=>store.put('companion_profiles',{id:'private-b',name:'B的伙伴'}));
 assert.equal((await call('POST','offer',{...body(),profileId:'private-b'})).status,404);
 assert.equal((await call('POST','offer',{...body(),voiceId:'mock-omni-'+b.id})).status,403);
 await assert.rejects(withUserScope(a,()=>omni.callConfig(b,'default')),/无权/);
});
test('an active call is exclusive, cannot be repeated or ended by another user, and releases on hangup',async()=>{
 const input=body(),first=await call('POST','offer',input);assert.equal(first.status,201);const connected=await first.json();
 assert.equal(connected.session.turn_detection.interrupt_response,true);assert.equal(connected.session.voice,'Tina');
 assert.equal((await call('POST','offer',input)).status,409);assert.equal((await call('POST','offer',body())).status,409);
 assert.equal((await call('POST',connected.id+'/end',{}, {user:'b'})).status,404);
 assert.equal((await call('POST',connected.id+'/heartbeat',{})).status,200);assert.equal((await call('POST',connected.id+'/end',{})).status,200);
 const next=await(await call('POST','offer',body())).json();assert.notEqual(next.id,connected.id);assert.equal((await call('POST',connected.id+'/end',{})).status,404);await call('POST',next.id+'/end',{});
 const saved=await withUserScope(a,()=>store.get('omni_calls',a.id));assert.equal(saved.status,'ended');assert.equal(saved.sdp,undefined);assert.equal(saved.answer,undefined);
 assert.equal(await withUserScope(b,()=>store.get('omni_calls',a.id)),null);
});
test('voice registry is owner and model bound; production remains disabled even with preview or mock flags',()=>{
 const registry=JSON.stringify([{ownerId:a.id,id:'owner-voice',model:omni.OMNI_MODEL,name:'私有声音'},{ownerId:b.id,id:'other-voice',model:omni.OMNI_MODEL},{ownerId:a.id,id:'tts-only',model:'qwen-audio-3.1-tts-plus'}]);
 assert.deepEqual(omni.voicesFor(a,{OMNI_CALL_VOICES_JSON:registry}).map(v=>v.id),['Tina','owner-voice']);
 assert.equal(omni.omniRuntime({VERCEL:'1',VERCEL_ENV:'production',OMNI_CALL_PREVIEW_ENABLED:'1',OMNI_CALL_MOCK:'1'}).enabled,false);
 assert.equal(omni.omniRuntime({VERCEL:'1',VERCEL_ENV:'preview',OMNI_CALL_MOCK:'1'}).mock,false);
 assert.throws(()=>omni.callSession({style:'unknown'},'Tina'),/语气/);assert.throws(()=>omni.callSession({vad:'manual'},'Tina'),/接话/);assert.throws(()=>omni.callSession({silence:2000},'Tina'),/停顿/);
});
test('real SDP proxy uses server credentials only and upstream failures release the call slot',async()=>{
 Object.assign(process.env,{OMNI_CALL_MOCK:'',OMNI_CALL_PREVIEW_ENABLED:'1',QWEN_OMNI_API_KEY:'test-server-key-not-real'});
 let requests=0;globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,'https://maas.qianwenaiapi.com/api/v1/webrtc/realtime?model='+omni.OMNI_MODEL);assert.equal(options.headers.Authorization,'Bearer test-server-key-not-real');assert.equal(options.headers['Content-Type'],'application/sdp');return requests===1?new Response('denied',{status:403}):new Response(body().sdp);};
 try{assert.equal((await call('POST','offer',body())).status,502);const success=await call('POST','offer',body());assert.equal(success.status,201);const result=await success.json();assert.ok(result.answer.startsWith('v=0'));assert.ok(!JSON.stringify(result).includes('test-server-key'));await call('POST',result.id+'/end',{});assert.equal(requests,2);}
 finally{globalThis.fetch=originalFetch;process.env.OMNI_CALL_MOCK='1';}
});
