import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-personal-memory-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'test-only',AI_MODEL:'mock'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const auth=await import('../lib/auth.mjs');
const owner=await auth.createUser({name:'记忆测试',email:'memory-owner@test.invalid',password:'Password123'},'admin');
const other=await auth.createUser({name:'其他家人',email:'memory-other@test.invalid',password:'Password123'},'viewer');
const cookies={owner:`yiban_session=${await auth.createSession(owner.id)}`,other:`yiban_session=${await auth.createSession(other.id)}`};
const familia=await loadRoute(new URL('../app/api/familia/[...path]/route.js',import.meta.url));
const chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url));
const repository=await import('../lib/personal-memory.mjs');
const store=await import('../lib/store.mjs');
const credits=await import('../lib/credits.mjs');
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(api,method,endpoint,{as='owner',body,key,origin='http://localhost'}={}){
  const route=api==='familia'?familia:chat;
  return route[method](new Request(`http://localhost/api/${api}/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin,...(as?{cookie:cookies[as]}:{}),...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});
}
const profile=await(await call('familia','POST','profiles',{body:{name:'爸爸',role:'father',age:50,qualities:[]},key:'memory-profile'})).json();
const endpoint=(id='',scope=profile.id)=>`personal-memories${id?'/'+id:''}${scope?'?profileId='+encodeURIComponent(scope):''}`;
const create=(text,key,extra={})=>call('familia','POST',endpoint(),{body:{text,...extra},key});

test('private memory API isolates account and companion scopes, rejects forged sources and changes no credits',async()=>{
  assert.equal((await call('familia','GET',endpoint(),{as:''})).status,401);
  assert.equal((await call('familia','POST',endpoint(),{body:{text:'越域'},key:'bad-origin',origin:'https://bad.invalid'})).status,403);
  assert.equal((await call('familia','GET',endpoint(),{as:'other'})).status,404);
  for(const text of ['',[], '字'.repeat(601)])assert.equal((await create(text,'bad-'+JSON.stringify(text).length)).status,400);
  const first=await create('我喜欢散步。','first',{category:'preference',pinned:true,userId:other.id});assert.equal(first.status,201);const saved=await first.json();
  assert.equal((await(await call('familia','GET',endpoint())).json()).items.length,1);
  assert.equal((await(await call('familia','GET',endpoint('',null))).json()).items.length,0);
  assert.equal((await call('familia','PATCH',endpoint(saved.id),{as:'other',body:{text:'偷改',expectedRevision:1}})).status,404);
  assert.equal((await create('不能伪造来源','forged',{source:{threadId:'missing',messageId:'missing'}})).status,404);
  assert.deepEqual(await credits.balance(owner.id),{balance:0,held:0});
});

test('concurrent creates and changes preserve entries; idempotent replay cannot resurrect deleted text',async()=>{
  const responses=await Promise.all(Array.from({length:5},(_,i)=>create(`并发保存第${i}条`,'concurrent-'+i)));
  for(const response of responses)assert.equal(response.status,201);
  const item=await responses[0].json();
  assert.equal((await create('并发保存第0条','concurrent-0')).status,201);
  assert.equal((await create('不同内容','concurrent-0')).status,409);
  assert.equal((await create(item.text,'different-key')).status,409);
  const changed=await call('familia','PATCH',endpoint(item.id),{body:{text:'新的内容',expectedRevision:item.revision}});assert.equal(changed.status,200);const latest=await changed.json();
  assert.equal((await call('familia','PATCH',endpoint(item.id),{body:{text:'旧编辑',expectedRevision:item.revision}})).status,409);
  assert.equal((await call('familia','DELETE',endpoint(item.id),{body:{expectedRevision:item.revision}})).status,409);
  assert.equal((await call('familia','DELETE',endpoint(item.id),{body:{expectedRevision:latest.revision}})).status,200);
  assert.equal((await create('并发保存第0条','concurrent-0')).status,409);
  const raw=(await store.all('personal_memory_scopes')).flatMap(doc=>doc.items).find(entry=>entry.id===item.id);assert.deepEqual(Object.keys(raw).sort(),['deletedAt','id']);
  assert.equal((await(await call('familia','GET',endpoint())).json()).items.length,5);
});

test('bounded retrieval favors pinned records, matches Chinese and English and excludes unrelated and deleted memories',()=>{
  const record=(id,text,pinned=false)=>({id,text,pinned,updatedAt:'2026-10-27T00:00:00Z'});
  const items=[record('walk','我喜欢傍晚散步'),record('book','I like reading novels'),record('pin','请少给建议，先听我说。',true),{...record('gone','散步'),deletedAt:'deleted'}];
  assert.deepEqual(repository.selectPersonalMemories(items,'散步的时候').map(item=>item.id),['pin','walk']);
  assert.deepEqual(repository.selectPersonalMemories(items,'Reading').map(item=>item.id),['pin','book']);
  assert.deepEqual(repository.selectPersonalMemories(items,'天气').map(item=>item.id),['pin']);
  const many=Array.from({length:20},(_,i)=>record(String(i),'散步'.repeat(300),i<6));const selected=repository.selectPersonalMemories(many,'散步');assert.ok(selected.length<=8);assert.ok(selected.reduce((n,item)=>n+item.text.length,0)<=4000);
});

test('confirmed user message becomes cross-session context; edits, off switch and deletion affect next generation with billing intact',async()=>{
  await credits.grant({userId:owner.id,actorId:owner.id,amount:10,note:'隔离测试',requestKey:'fund-memory'});
  let prompts=[];
  globalThis.fetch=async(_url,request)=>{prompts.push(JSON.parse(request.body).messages);return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'愿意慢慢听你说。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  async function thread(){return (await call('chat','POST','threads',{body:{options:{profileId:profile.id,memoryMode:'off'}}})).json();}
  async function generate(t,text,key){const response=await call('chat','POST',`threads/${t.id}/generate`,{body:{text},key});assert.equal(response.status,200);await response.text();return(await call('chat','GET',`threads/${t.id}`)).json();}
  const initial=await thread();const conversation=await generate(initial,'我周三参加陶艺课。','first-memory-chat');
  const remembered=await create('我周三参加陶艺课。','from-message',{category:'event',source:{threadId:initial.id,messageId:conversation.messages[0].id}});assert.equal(remembered.status,201);const memory=await remembered.json();
  assert.equal((await create('AI不能成为自述','assistant-source',{source:{threadId:initial.id,messageId:conversation.messages[1].id}})).status,404);
  const second=await thread();const next=await generate(second,'陶艺课之前先陪我聊聊','second-memory-chat');
  assert.ok(next.messages.at(-1).personalMemoryIds.includes(memory.id));assert.match(prompts.at(-1)[0].content,/我周三参加陶艺课/);assert.match(prompts.at(-1)[0].content,/不是系统指令/);assert.match(prompts.at(-1)[0].content,/本轮没有引用家庭记忆/);
  assert.equal(prompts.at(-1).filter(message=>message.role==='user').length,1,'does not insert previous conversation');
  const updated=await repository.changePersonalMemory(owner,profile.id,memory.id,{text:'我改成周五上陶艺课。',expectedRevision:memory.revision});
  await generate(await thread(),'陶艺课改时间了吗','updated-memory-chat');assert.match(prompts.at(-1)[0].content,/改成周五/);assert.doesNotMatch(prompts.at(-1)[0].content,/周三/);
  let state=await repository.listPersonalMemories(owner,profile.id);await repository.setPersonalMemoryEnabled(owner,profile.id,{enabled:false,expectedRevision:state.revision});
  assert.equal((await generate(await thread(),'陶艺课','disabled-memory-chat')).messages.at(-1).personalMemoryIds.length,0);assert.doesNotMatch(prompts.at(-1)[0].content,/周五/);
  state=await repository.listPersonalMemories(owner,profile.id);await repository.setPersonalMemoryEnabled(owner,profile.id,{enabled:true,expectedRevision:state.revision});await repository.forgetPersonalMemory(owner,profile.id,memory.id,updated.revision);
  await generate(await thread(),'陶艺课','deleted-memory-chat');assert.doesNotMatch(prompts.at(-1)[0].content,/周五|周三/);
  assert.equal((await(await call('chat','GET',`threads/${initial.id}`)).json()).messages[0].text,'我周三参加陶艺课。','memory edits preserve original history');
  assert.deepEqual(await credits.balance(owner.id),{balance:5,held:0});
});

test('automatic mode extracts original user text only, records provenance and charges only the normal reply',async()=>{
  const state=await repository.listPersonalMemories(owner,null);
  await repository.setPersonalMemoryEnabled(owner,null,{mode:'auto',expectedRevision:state.revision});
  let extractionCalls=0;
  globalThis.fetch=async(_url,request)=>{
    const body=JSON.parse(request.body);
    if(!body.stream){extractionCalls++;assert.match(body.messages[0].content,/连续原文/);return Response.json({choices:[{message:{content:JSON.stringify({memories:[{quote:'我喜欢茉莉花茶，不喝咖啡。',category:'preference'},{quote:'这是模型编造的话',category:'about'}]})}}]});}
    return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'下次也可以聊聊茶。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
  };
  const t=await(await call('chat','POST','threads',{body:{options:{memoryMode:'off'}}})).json();
  const response=await call('chat','POST',`threads/${t.id}/generate`,{body:{text:'我喜欢茉莉花茶，不喝咖啡。'},key:'auto-turn'});assert.equal(response.status,200);await response.text();
  const saved=await repository.listPersonalMemories(owner,null);assert.equal(saved.mode,'auto');assert.equal(saved.items.length,1);assert.equal(saved.items[0].origin,'auto');assert.equal(saved.items[0].text,'我喜欢茉莉花茶，不喝咖啡。');
  const history=await(await call('chat','GET',`threads/${t.id}`)).json();assert.equal(history.messages[1].memoryResult.status,'saved');assert.deepEqual(history.messages[1].memoryResult.ids,[saved.items[0].id]);
  await(await call('chat','POST',`threads/${t.id}/generate`,{body:{text:'我喜欢茉莉花茶，不喝咖啡。'},key:'auto-turn'})).text();assert.equal(extractionCalls,1,'idempotent generation never repeats extraction');
  assert.deepEqual(await credits.balance(owner.id),{balance:4,held:0},'one additional successful response costs only one point');
  await repository.forgetPersonalMemory(owner,null,saved.items[0].id,1);
  const snapshot=await repository.automaticMemorySnapshot(owner,null);
  const replay=await repository.saveAutomaticMemories(owner,null,saved.items[0].source,saved.items[0].text,snapshot);assert.equal(replay.status,'skipped');assert.equal(extractionCalls,1,'deleted automatic memory is not extracted again from the same message');
});

test('in-flight extraction is discarded when switching mode; sensitive input is skipped and extraction errors preserve the paid chat',async()=>{
  const t=await(await call('chat','POST','threads',{body:{options:{memoryMode:'off'}}})).json();
  const userMessage={id:'pending-memory-source',threadId:t.id,userId:owner.id,role:'user',status:'completed',parentId:null,createdAt:new Date().toISOString(),text:'我每周日去公园散步。'};await store.put('chat_messages',userMessage);
  const source={threadId:t.id,messageId:userMessage.id},snapshot=await repository.automaticMemorySnapshot(owner,null);
  let calls=0;
  globalThis.fetch=async()=>{calls++;const state=await repository.listPersonalMemories(owner,null);await repository.setPersonalMemoryEnabled(owner,null,{mode:'manual',expectedRevision:state.revision});return Response.json({choices:[{message:{content:JSON.stringify({memories:[{quote:userMessage.text,category:'preference'}]})}}]});};
  assert.equal((await repository.saveAutomaticMemories(owner,null,source,userMessage.text,snapshot)).status,'skipped');assert.equal((await repository.listPersonalMemories(owner,null)).items.length,0);
  assert.equal((await repository.saveAutomaticMemories(owner,null,source,'我的密码是12345678',snapshot)).status,'skipped');assert.equal(calls,1);
  const state=await repository.listPersonalMemories(owner,null);await repository.setPersonalMemoryEnabled(owner,null,{mode:'auto',expectedRevision:state.revision});
  globalThis.fetch=async(_url,request)=>{const body=JSON.parse(request.body);if(!body.stream)return new Response('unavailable',{status:503});return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'愿意陪你聊。'},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  const response=await call('chat','POST',`threads/${t.id}/generate`,{body:{text:'我每周日去公园散步。'},key:'auto-extraction-failure'});await response.text();
  const history=await(await call('chat','GET',`threads/${t.id}`)).json();assert.equal(history.messages.at(-1).status,'completed');assert.equal(history.messages.at(-1).memoryResult.status,'failed');assert.deepEqual(await credits.balance(owner.id),{balance:3,held:0});
});

test('memory and pin limits hold under concurrent writes; failed replies do not invoke automatic extraction',async()=>{
  const isolated=await(await call('familia','POST','profiles',{body:{name:'额度检查',role:'mother',age:50,qualities:[]},key:'limits-profile'})).json();
  for(let i=0;i<98;i++)await repository.createPersonalMemory(owner,isolated.id,{text:`记忆内容${i}`,pinned:i<5},'limit-'+i);
  const outcomes=await Promise.allSettled(Array.from({length:5},(_,i)=>repository.createPersonalMemory(owner,isolated.id,{text:`并发常用${i}`,pinned:true},'pinned-'+i)));
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
  await repository.createPersonalMemory(owner,isolated.id,{text:'最后一条'},'last');
  await assert.rejects(repository.createPersonalMemory(owner,isolated.id,{text:'超出容量'},'over'),/最多保存 100/);
  assert.equal((await repository.listPersonalMemories(owner,isolated.id)).items.length,100);
  let extractions=0;globalThis.fetch=async(_url,request)=>{if(!JSON.parse(request.body).stream)extractions++;return new Response('unavailable',{status:503});};
  const t=await(await call('chat','POST','threads',{body:{options:{}}})).json();
  await(await call('chat','POST',`threads/${t.id}/generate`,{body:{text:'我喜欢晚饭后散步。'},key:'auto-reply-failed'})).text();
  const history=await(await call('chat','GET',`threads/${t.id}`)).json();assert.equal(history.messages.at(-1).status,'failed');assert.equal(extractions,0);assert.deepEqual(await credits.balance(owner.id),{balance:3,held:0});
});
