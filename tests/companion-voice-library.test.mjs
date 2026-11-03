import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
import {encodePcmWav} from '../lib/chat-audio-client.mjs';
import {inspectVoiceWav,repairVoiceWav} from '../lib/voice-audio.mjs';
import {voiceReplyIntent,normalizeVoiceMode} from '../lib/ai-voices.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-companion-voice-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,QWEN_VOICE_API_KEY:'isolated-mock',QWEN_VOICE_BASE_URL:'http://127.0.0.1:3988/api/v1',YIBAN_VOICE_MOCK:'1',AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs'),library=await import('../lib/companion-voice-library.mjs'),profiles=await import('../lib/familia-store.mjs');
const user=await auth.createUser({name:'用户',email:'voice@local.test',password:'Password123'},'viewer'),other=await auth.createUser({name:'另一位',email:'other-voice@local.test',password:'Password123'},'admin');
const cookie=`yiban_session=${await auth.createSession(user.id)}`,otherCookie=`yiban_session=${await auth.createSession(other.id)}`;
const route=await loadRoute(new URL('../app/api/companion-voices/[[...path]]/route.js',import.meta.url)),familia=await loadRoute(new URL('../app/api/familia/[...path]/route.js',import.meta.url));
const realFetch=globalThis.fetch;let calls=[],createTimeout=false,ttsFailure=false,ttsExternal=false;
const wav=Buffer.from(encodePcmWav(Float32Array.from({length:24000*4},(_,i)=>Math.sin(i/20)*.1),24000));
globalThis.fetch=async(url,options={})=>{
  const raw=String(url);calls.push({url:raw,options});
  if(raw.includes('model.invalid')){const body=JSON.parse(options.body);if(!body.stream)return Response.json({choices:[{message:{content:'{"memories":[]}'}}]});return new Response('data: '+JSON.stringify({choices:[{delta:{content:'回来啦。'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});}
  if(raw.endsWith('/customization')){const body=JSON.parse(options.body);assert.equal(body.model,'voice-enrollment');const input=body.input;
    if(input.action==='create_voice'){assert.match(input.audio,/^data:audio\/wav;base64,/);assert.equal(input.target_model,'qwen-audio-3.1-tts-plus');if(createTimeout)throw Error('timeout after dispatch');return Response.json({output:{voice_id:input.target_model+'-'+input.prefix+'-mock'}});}
    if(input.action==='list_voice')return Response.json({output:{voice_list:[{voice_id:'qwen-audio-3.1-tts-plus-'+input.prefix+'-recovered'}]}});
    return Response.json({output:{status:'OK'}});
  }
  if(raw.endsWith('/SpeechSynthesizer')){if(ttsFailure)return new Response('',{status:503});const body=JSON.parse(options.body);assert.equal(body.model,'qwen-audio-3.1-tts-plus');return Response.json({output:{audio:{url:ttsExternal?'https://untrusted.test/record.wav':'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/result.wav'}}});}
  if(raw==='https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/result.wav'){assert.equal(options.headers?.Authorization,undefined);const streaming=Buffer.from(wav);streaming.writeUInt32LE(0x7fffffff,4);streaming.writeUInt32LE(0x7fffffff,40);return new Response(streaming,{headers:{'Content-Type':'audio/wav'}});}
  throw Error('unexpected external request');
};
after(async()=>{globalThis.fetch=realFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint='',{body,key,as='owner',origin='http://localhost'}={}){return route[method](new Request('http://localhost/api/companion-voices/'+endpoint,{method,headers:{origin,...(as?{cookie:as==='owner'?cookie:otherCookie}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint?endpoint.split('/'):[]})});}
const familyBefore=await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name)));
let source,voice;
test('enrollment validates real WAV bytes and rejects incomplete/short audio',()=>{assert.equal(inspectVoiceWav(wav).duration,4);assert.throws(()=>inspectVoiceWav(wav.subarray(0,50)));assert.throws(()=>inspectVoiceWav(Buffer.from(encodePcmWav(new Float32Array(16000)))));const fixed=repairVoiceWav(wav);assert.equal(fixed.readUInt32LE(4),fixed.length-8);});
test('both reply modes obey explicit text override and preserve legacy migration',()=>{assert.equal(normalizeVoiceMode('auto'),'text');assert.equal(voiceReplyIntent({mode:'voice',voice:'voice',text:'刚下班',recent:[{audio:{}}]}),true);assert.equal(voiceReplyIntent({mode:'voice',voice:'voice',text:'打字就好'}),false);assert.equal(voiceReplyIntent({mode:'text',voice:'voice',text:'晚安'}),false);assert.equal(voiceReplyIntent({mode:'text',voice:'voice',text:'说给我听'}),true);});
test('authenticated private material upload works for viewer, rejects invalid media and origin',async()=>{
  assert.equal((await call('GET','',{as:''})).status,401);assert.equal((await call('POST','',{origin:'https://foreign.test',body:{}})).status,403);
  const form=new FormData();form.append('file',new File([wav],'voice.wav',{type:'audio/wav'}));const response=await call('POST','material',{body:form});assert.equal(response.status,200);source=(await response.json()).url;const saved=await store.get('uploads',source.split('/').at(-1));assert.equal(saved.userId,user.id);assert.equal(saved.shared,false);
  const bad=new FormData();bad.append('file',new File(['bad'],'voice.wav'));assert.equal((await call('POST','material',{body:bad})).status,400);
});
test('creation checks consent, ownership, idempotency and hides provider IDs',async()=>{
  const body={name:'专属声音01',audioUrl:source,consent:true};const before=calls.length;
  assert.equal((await call('POST','',{body:{...body,consent:false},key:'no-consent'})).status,400);
  assert.equal((await call('POST','',{body,key:'foreign-media',as:'other'})).status,404);assert.equal(calls.length,before);
  const response=await call('POST','',{body,key:'one-voice'});assert.equal(response.status,201);voice=await response.json();assert.equal(voice.status,'pending');assert.equal(voice.providerVoiceId,undefined);
  const count=calls.length;assert.equal((await(await call('POST','',{body,key:'one-voice'})).json()).id,voice.id);assert.equal(calls.length,count);
  assert.equal((await call('POST','',{body:{...body,name:'different'},key:'one-voice'})).status,409);
  assert.equal((await call('POST',voice.id+'/status',{as:'other'})).status,404);
  assert.equal((await(await call('GET','',{as:'other'})).json()).voices.length,0);
  assert.equal((await(await call('POST',voice.id+'/status')).json()).status,'ready');
});
test('custom choices are owned, model bound, cached, private and protect active voices',async()=>{
  await assert.rejects(profiles.updateDefaultProfile(other,{voice:voice.id}),/无权/);
  let saved=await profiles.updateDefaultProfile(user,{voice:voice.id,voiceMode:'voice'});assert.equal(saved.voiceMode,'voice');
  assert.equal((await call('DELETE',voice.id)).status,409);
  const before=calls.length,response=await call('POST',voice.id+'/preview',{body:{index:0}});assert.equal(response.status,200);const result=await response.json();assert.equal(result.audio.synthetic,true);
  const bytes=await store.readMediaBuffer(result.audio.url.split('/').at(-1));assert.equal(inspectVoiceWav(bytes.data).duration,4);assert.equal(calls.length,before+2);
  await call('POST',voice.id+'/preview',{body:{index:0}});assert.equal(calls.length,before+2);assert.equal((await call('POST',voice.id+'/preview',{as:'other',body:{index:0}})).status,404);
  assert.equal((await call('POST',voice.id+'/preview',{body:{index:5}})).status,400);
  await profiles.updateDefaultProfile(user,{voice:null,voiceMode:'text',expectedUpdatedAt:saved.updatedAt});assert.equal((await call('DELETE',voice.id)).status,200);
  await assert.rejects(profiles.updateDefaultProfile(user,{voice:voice.id}),/不存在/);
  assert.ok((await store.readMediaBuffer(result.audio.url.split('/').at(-1))).data.length);
});
test('creation timeout recovers by prefix without resending audio; failed preview retries are bounded',async()=>{
  createTimeout=true;const body={name:'超时音色',audioUrl:source,consent:true};const result=await(await call('POST','',{body,key:'timeout-voice'})).json();assert.equal(result.status,'uncertain');const createCount=calls.filter(item=>String(item.options.body).includes('create_voice')).length;
  createTimeout=false;const recovered=await(await call('POST',result.id+'/status')).json();assert.equal(recovered.status,'ready');assert.equal(calls.filter(item=>String(item.options.body).includes('create_voice')).length,createCount);
  ttsFailure=true;for(let i=0;i<3;i++)assert.equal((await call('POST',result.id+'/preview',{body:{index:1}})).status,400);assert.equal((await call('POST',result.id+'/preview',{body:{index:1}})).status,429);ttsFailure=false;
  ttsExternal=true;const before=calls.length;assert.equal((await call('POST',result.id+'/preview',{body:{index:2}})).status,400);assert.equal(calls.length,before+1);ttsExternal=false;
  voice=recovered;
});
test('actual chat generation uses custom audio in voice mode, defaults to text in text mode and preserves failed speech',async()=>{
  const credits=await import('../lib/credits.mjs');await credits.grant({userId:user.id,actorId:other.id,amount:10,note:'test',requestKey:'voice-test-fund'});
  const chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url));
  async function chatCall(method,endpoint,body,key){return chat[method](new Request('http://localhost/api/chat/'+endpoint,{method,headers:{cookie,origin:'http://localhost','Content-Type':'application/json',...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{params:Promise.resolve({path:endpoint.split('/')})});}
  await profiles.updateDefaultProfile(user,{voice:voice.id,voiceMode:'voice'});
  const thread=await(await chatCall('POST','threads',{options:{memoryMode:'off'}})).json();
  async function send(text,key){const result=await chatCall('POST','threads/'+thread.id+'/generate',{text},key);assert.equal(result.status,200);await result.text();return (await(await chatCall('GET','threads/'+thread.id)).json()).messages.filter(message=>message.role==='assistant').at(-1);}
  let message=await send('刚忙完','voice-chat');assert.equal(message.voiceStatus,'ready');assert.equal(message.audio.synthetic,true);
  await profiles.updateDefaultProfile(user,{voiceMode:'text'});let count=calls.filter(item=>item.url.endsWith('/SpeechSynthesizer')).length;
  message=await send('晚安','text-chat');assert.equal(message.audio,undefined);assert.equal(calls.filter(item=>item.url.endsWith('/SpeechSynthesizer')).length,count);
  message=await send('说给我听','explicit-chat');assert.equal(message.voiceStatus,'ready');
  ttsFailure=true;await profiles.updateDefaultProfile(user,{voiceMode:'voice'});message=await send('好呀','failed-speech');assert.equal(message.voiceStatus,'failed');assert.equal(message.status,'completed');assert.ok(message.text);ttsFailure=false;
  assert.deepEqual(await Promise.all(['memories','members','anniversaries','settings'].map(name=>store.all(name))),familyBefore);
});
test('configured existing voices are scoped, verified and do not upload or create again',async()=>{
  process.env.QWEN_COMPANION_VOICES_JSON=JSON.stringify([{userId:other.id,name:'已有声音',voiceId:'qwen-audio-3.1-tts-plus-existing-local',model:'qwen-audio-3.1-tts-plus'}]);
  const count=calls.filter(item=>String(item.options.body).includes('create_voice')).length;
  const listed=await(await call('GET','',{as:'other'})).json();assert.equal(listed.voices.length,1);const registered=listed.voices[0];assert.equal(registered.status,'pending');assert.equal(registered.providerVoiceId,undefined);
  await assert.rejects(profiles.updateDefaultProfile(other,{voice:registered.id}),/尚未就绪/);
  assert.equal((await(await call('POST',registered.id+'/status',{as:'other'})).json()).status,'ready');
  await profiles.updateDefaultProfile(other,{voice:registered.id,voiceMode:'voice'});assert.equal(calls.filter(item=>String(item.options.body).includes('create_voice')).length,count);
  assert.ok(!(await(await call('GET')).json()).voices.some(item=>item.id===registered.id));delete process.env.QWEN_COMPANION_VOICES_JSON;
});
test('concurrent enrollment cannot duplicate a provider call and daily budget is enforced',async()=>{
  const body={name:'并发音色',audioUrl:source,consent:true},before=calls.filter(item=>String(item.options.body).includes('create_voice')).length;
  const results=await Promise.all([call('POST','',{body,key:'concurrent'}),call('POST','',{body,key:'concurrent'})]);
  assert.ok(results.every(result=>[201,409].includes(result.status)));assert.equal(calls.filter(item=>String(item.options.body).includes('create_voice')).length,before+1);
  const replay=await(await call('POST','',{body,key:'concurrent'})).json();assert.match(replay.id,/^custom-/);assert.equal(calls.filter(item=>String(item.options.body).includes('create_voice')).length,before+1);
  for(const key of ['fourth','fifth'])assert.equal((await call('POST','',{body,key})).status,201);
  const count=calls.length;assert.equal((await call('POST','',{body,key:'sixth'})).status,429);assert.equal(calls.length,count);
});
