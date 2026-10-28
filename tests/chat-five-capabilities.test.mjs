import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
import {encodePcmWav} from '../lib/chat-audio-client.mjs';
import {voiceReplyIntent} from '../lib/ai-voices.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-five-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock',YIBAN_ASR_KEY:'mock',YIBAN_ASR_URL:'https://asr.invalid',YIBAN_ASR_MODEL:'mock-asr',YIBAN_VISION_KEY:'mock',YIBAN_VISION_URL:'https://vision.invalid',YIBAN_VISION_MODEL:'mock-vision',YIBAN_TTS_KEY:'mock',YIBAN_TTS_URL:'https://tts.invalid'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const auth=await import('../lib/auth.mjs'),store=await import('../lib/store.mjs'),credits=await import('../lib/credits.mjs'),memory=await import('../lib/personal-memory.mjs');
const user=await auth.createUser({name:'小雨',email:'five@test.invalid',password:'Password123'},'admin'),other=await auth.createUser({name:'另一人',email:'other-five@test.invalid',password:'Password123'},'viewer');
const cookies={owner:`yiban_session=${await auth.createSession(user.id)}`,other:`yiban_session=${await auth.createSession(other.id)}`};
const route=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url)),originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint,{body,key,as='owner'}={}){return route[method](new Request(`http://localhost/api/chat/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin:'http://localhost',cookie:cookies[as],...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});}
const newThread=async(as='owner')=>(await call('POST','threads',{as,body:{options:{memoryMode:'off'}}})).json();
const json=value=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]});
let modelRequests=[],failAsr=false,failTts=false,asrCount=0,ttsCount=0;
function model(){globalThis.fetch=async(url,request)=>{
  const body=JSON.parse(request.body);
  if(String(url).includes('asr.invalid')){asrCount++;if(failAsr)return new Response('',{status:503});assert.match(body.messages[0].content[0].input_audio.data,/^data:audio\/wav;base64,/);return Response.json({choices:[{message:{content:'今天去公园，看见了一只橘猫。'}}]});}
  if(String(url).includes('vision.invalid')){assert.match(body.messages[0].content[1].image_url.url,/^data:image\/png;base64,/);return Response.json({choices:[{message:{content:'一只橘猫坐在公园长椅上。'}}]});}
  if(String(url).includes('tts.invalid')){ttsCount++;if(failTts)return new Response('',{status:503});assert.ok(body.input.voice);assert.equal(body.input.format,'mp3');return Response.json({output:{audio:{data:Buffer.from('ID3test-audio').toString('base64')}}});}
  if(!body.stream)return json({memories:[],ids:[]});
  modelRequests.push(body);return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'那只橘猫听起来好可爱。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
};}
model();await credits.grant({userId:user.id,actorId:user.id,amount:60,note:'隔离测试',requestKey:'five-fund'});
const familyBefore=await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name)));
async function send(thread,body,key){const response=await call('POST',`threads/${thread.id}/generate`,{body,key});assert.equal(response.status,200,await(response.status===200?Promise.resolve(''):response.text()));await response.text();return(await call('GET',`threads/${thread.id}`)).json();}
async function upload(name,data,owner=user){const saved=await store.saveMedia(name,data,'application/octet-stream');await store.put('uploads',{id:name,userId:owner.id,...saved});return `/api/media/${name}`;}
const audioURL=await upload('five-voice.wav',Buffer.from(encodePcmWav(new Float32Array(16000))));
const imageURL=await upload('five-cat.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8xoAAAAASUVORK5CYII=','base64'));

test('PCM WAV has a real header and clamped mono samples',()=>{const view=new DataView(encodePcmWav(new Float32Array([-2,0,2])));assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint32(40,true),6);assert.equal(view.getInt16(44,true),-32768);assert.equal(view.getInt16(48,true),32767);});
test('audio is transcribed server-side, persisted, reused by later context, and replay does not call ASR again',async()=>{
  const thread=await newThread(),before=asrCount,body={audio:{url:audioURL,duration:1}};
  const result=await send(thread,body,'voice-understand');assert.equal(result.messages[0].audio.recognition,'ready');assert.match(result.messages[0].audio.transcript,/橘猫/);assert.match(modelRequests.at(-1).messages.at(-1).content,/公园/);
  await send(thread,body,'voice-understand');assert.equal(asrCount,before+1);
  await send(thread,{text:'它是什么颜色的？'},'voice-followup');assert.ok(modelRequests.at(-1).messages.some(m=>String(m.content).includes('语音转写：今天去公园')));
});
test('images are privately inlined for vision and the description remains in follow-up context',async()=>{
  const thread=await newThread(),result=await send(thread,{text:'看看这只猫',images:[{url:imageURL}]},'image-understand');assert.equal(result.messages[0].vision.status,'ready');assert.match(modelRequests.at(-1).messages.at(-1).content,/公园长椅/);
  await send(thread,{text:'它在哪里？'},'image-followup');assert.ok(modelRequests.at(-1).messages.some(m=>m.content.includes('图片描述：一只橘猫')));
});
test('foreign media and arbitrary URLs are rejected before any model call or charge',async()=>{
  const url=await upload('other-voice.wav',Buffer.from('private'),other),thread=await newThread(),before=await credits.balance(user.id),count=modelRequests.length;
  assert.equal((await call('POST',`threads/${thread.id}/generate`,{body:{audio:{url,duration:1}},key:'foreign-media'})).status,404);
  assert.equal((await call('POST',`threads/${thread.id}/generate`,{body:{images:[{url:'http://localhost/private'}]},key:'unsafe-media'})).status,400);
  assert.equal(modelRequests.length,count);assert.deepEqual(await credits.balance(user.id),before);
});
test('ASR failure is visible and retry updates only the original message without charging again',async()=>{
  failAsr=true;const thread=await newThread(),result=await send(thread,{audio:{url:audioURL,duration:1}},'asr-fail');assert.equal(result.messages[0].audio.recognition,'failed');assert.match(modelRequests.at(-1).messages.at(-1).content,/不能假装听懂/);
  failAsr=false;const before=await credits.balance(user.id),count=modelRequests.length;
  const retried=await call('POST',`threads/${thread.id}/media-retry`,{body:{messageId:result.messages[0].id}});assert.equal(retried.status,200);assert.equal((await retried.json()).audio.recognition,'ready');assert.equal(modelRequests.length,count);assert.deepEqual(await credits.balance(user.id),before);
  assert.notEqual((await call('POST',`threads/${thread.id}/media-retry`,{as:'other',body:{messageId:result.messages[0].id}})).status,200);
});
test('natural voice respects preference, explicit opt-out and cooldown',()=>{
  assert.equal(voiceReplyIntent({text:'晚安',voice:'longwan'}),true);assert.equal(voiceReplyIntent({text:'晚安',voice:'longwan',recent:[{audio:{}}]}),false);
  assert.equal(voiceReplyIntent({text:'发语音',voice:'longwan',mode:'off'}),false);assert.equal(voiceReplyIntent({text:'不要发语音',voice:'longwan'}),false);assert.equal(voiceReplyIntent({text:'晚安',voice:'longwan',mode:'manual'}),false);
});
test('voice synthesis failure is recoverable, actual audio is persisted and repeat retry is idempotent',async()=>{
  const {updateDefaultProfile}=await import('../lib/familia-store.mjs');await updateDefaultProfile(user,{voice:'longwan',voiceMode:'auto'});failTts=true;
  const thread=await newThread(),result=await send(thread,{text:'发语音'},'tts-fail');assert.equal(result.messages[1].voiceStatus,'failed');assert.equal(result.messages[1].audio,undefined);failTts=false;
  const before=await credits.balance(user.id),count=ttsCount;
  const retry=async()=>call('POST',`threads/${thread.id}/voice-retry`,{body:{messageId:result.messages[1].id}});
  await updateDefaultProfile(user,{voiceMode:'off'});assert.equal((await retry()).status,400);assert.equal(ttsCount,count);await updateDefaultProfile(user,{voiceMode:'auto'});
  const response=await retry();assert.equal(response.status,200);const ready=await response.json();assert.equal(ready.voiceStatus,'ready');assert.match(ready.audio.url,/^\/api\/media\/companion-/);assert.equal(ready.audio.duration,null);await retry();assert.equal(ttsCount,count+1);assert.deepEqual(await credits.balance(user.id),before);
});
test('chat correction needs confirmation, updates protected memory and cannot cross accounts',async()=>{
  const entry=await memory.createPersonalMemory(user,null,{text:'我喜欢咖啡',category:'preference'},'coffee');
  const thread=await newThread(),result=await send(thread,{text:'你记错了，“我喜欢咖啡”改成“我喜欢红茶”'},'correct-coffee');const message=result.messages[0];assert.equal(message.memoryProposal.kind,'correct');assert.equal((await memory.listPersonalMemories(user)).items.find(m=>m.id===entry.id).text,'我喜欢咖啡');
  const request={body:{messageId:message.id,targetId:entry.id,text:'我喜欢红茶'}};
  assert.notEqual((await call('POST',`threads/${thread.id}/memory-action`,{...request,as:'other'})).status,200);
  assert.equal((await call('POST',`threads/${thread.id}/memory-action`,request)).status,200);assert.equal((await memory.listPersonalMemories(user)).items.find(m=>m.id===entry.id).text,'我喜欢红茶');
  assert.equal((await call('POST',`threads/${thread.id}/memory-action`,request)).status,200);
});
test('stale correction cannot overwrite a newer edit and forget is scoped to one chosen memory',async()=>{
  let entry=await memory.createPersonalMemory(user,null,{text:'我每周去游泳',category:'about'},'swim');const thread=await newThread();
  const first=await send(thread,{text:'你记错了，“我每周去游泳”改成“我每周跑步”'},'swim-correction');entry=await memory.changePersonalMemory(user,null,entry.id,{text:'我每周打球',expectedRevision:entry.revision});
  assert.equal((await call('POST',`threads/${thread.id}/memory-action`,{body:{messageId:first.messages[0].id,targetId:entry.id,text:'我每周跑步'}})).status,409);
  const next=await send(thread,{text:'忘记“我每周打球”'},'forget-ball');const response=await call('POST',`threads/${thread.id}/memory-action`,{body:{messageId:next.messages.at(-2).id,targetId:entry.id}});assert.equal(response.status,200);assert.equal((await memory.listPersonalMemories(user)).items.some(m=>m.id===entry.id),false);assert.ok((await memory.listPersonalMemories(user)).items.some(m=>m.text==='我喜欢红茶'));
});
test('finished-topic confirmation expires a plan and removes only its matching private follow-up',async()=>{
  const plan=await memory.createPersonalMemory(user,null,{text:'我明天要面试',category:'event'},'plan');const current=await store.get('personal_memory_scopes',(await store.all('personal_memory_scopes')).find(s=>s.userId===user.id).id);await store.put('personal_memory_scopes',{...current,items:current.items.map(m=>m.id===plan.id?{...m,kind:'plan',topic:'面试'}:m)});
  const thread=await newThread(),result=await send(thread,{text:'“我明天要面试”这件事结束了'},'finish-plan');const response=await call('POST',`threads/${thread.id}/memory-action`,{body:{messageId:result.messages[0].id,targetId:plan.id}});assert.equal(response.status,200);assert.equal((await memory.listPersonalMemories(user)).items.find(m=>m.id===plan.id).expired,true);
});
test('search and favorites locate visible branches only, and pinning changes history ordering',async()=>{
  const first=await newThread(),result=await send(first,{text:'独特的收藏句子'},'favorite-search');const id=result.messages[0].id;
  await call('POST',`threads/${first.id}/interact`,{body:{messageId:id,favorite:true}});const list=await(await call('GET','messages?favorites=true&q=独特')).json();assert.equal(list.messages[0].id,id);assert.equal(list.messages[0].threadId,first.id);assert.equal((await(await call('GET','messages?favorites=true',{as:'other'})).json()).messages.length,0);
  await newThread();await call('PATCH',`threads/${first.id}`,{body:{pinned:true}});assert.equal((await(await call('GET','threads')).json()).threads[0].id,first.id);
  await call('POST',`threads/${first.id}/delete-message`,{body:{messageId:id}});assert.equal((await(await call('GET','messages?favorites=true&q=独特')).json()).messages.length,0);
});
test('forwarding is atomic and idempotent, preserves media, never triggers a model or billing, and checks destination ownership',async()=>{
  const source=await newThread(),result=await send(source,{text:'转发这张猫照片',images:[{url:imageURL}]},'source-forward'),target=await newThread(),foreign=await newThread('other'),before=await credits.balance(user.id),count=modelRequests.length;
  const request={body:{messageId:result.messages[0].id,targetThreadId:target.id},key:'forward-once'};
  const one=await call('POST',`threads/${source.id}/forward`,request);assert.equal(one.status,200);const message=await one.json();assert.equal(message.images[0].url,imageURL);assert.equal((await call('POST',`threads/${source.id}/forward`,request)).status,200);assert.equal((await(await call('GET',`threads/${target.id}`)).json()).messages.length,1);
  assert.equal((await call('POST',`threads/${source.id}/forward`,{body:{...request.body,targetThreadId:foreign.id},key:'foreign-forward'})).status,404);assert.deepEqual(await credits.balance(user.id),before);assert.equal(modelRequests.length,count);
});
test('explicit completed topic wins over an unrelated previous memory reference',async()=>{
  const plan=await memory.createPersonalMemory(user,null,{text:'下周我要参加画展',category:'event'},'exhibition-plan');const scope=(await store.all('personal_memory_scopes')).find(s=>s.userId===user.id);await store.put('personal_memory_scopes',{...scope,items:scope.items.map(item=>item.id===plan.id?{...item,kind:'plan',topic:'画展'}:item)});
  const thread=await newThread(),first=await send(thread,{text:'说说喝茶的事'},'unrelated-reference');const previous=first.messages[1],tea=(await memory.listPersonalMemories(user)).items.find(item=>item.text==='我喜欢红茶');await store.put('chat_messages',{...previous,personalMemoryIds:[tea.id]});
  const result=await send(thread,{text:'画展已经结束了'},'exhibition-finished');assert.equal(result.messages.at(-2).memoryProposal.status,'applied');assert.equal((await memory.listPersonalMemories(user)).items.find(item=>item.id===plan.id).expired,true);
});
test('companion improvements never write family memories, members, anniversaries or settings',async()=>{assert.deepEqual(await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name))),familyBefore);});
test('long audio transcripts count toward the same history context budget as text',async()=>{
  const thread=await newThread();let parentId=null;
  for(let i=0;i<4;i++){const message={id:`long-transcript-${i}`,userId:user.id,threadId:thread.id,role:'user',text:'',audio:{transcript:'长'.repeat(8000)},parentId,status:'completed',createdAt:new Date(Date.now()+i).toISOString()};await store.put('chat_messages',message);parentId=message.id;}
  await store.put('chat_threads',{...thread,headId:parentId});await send(thread,{text:'继续刚才的事'},'bounded-audio-context');assert.ok(modelRequests.at(-1).messages.filter(m=>m.role!=='system').reduce((count,m)=>count+m.content.length,0)<=24000);
});
test('default and named companions never borrow each other’s private follow-up hooks',async()=>{
  const callbacks=await import('../lib/chat-callbacks.mjs'),time=Date.now();for(const [id,personaId] of [['scope-default',null],['scope-named','another-companion']])await store.put('chat_callbacks',{id,userId:user.id,personaId,status:'open',kind:'interest',hook:id,quote:'本人原话',dueAt:new Date(time-60000).toISOString(),expiresAt:new Date(time+60000).toISOString()});
  assert.equal((await callbacks.callbackForPrompt(user,null)).personaId,null);assert.equal((await callbacks.callbackForPrompt(user,'another-companion')).personaId,'another-companion');
});
