import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-workspace-http-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const route=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url));
const auth=await import('../lib/auth.mjs');
const one=await auth.createUser({name:'小雨',email:'one@workspace.test',password:'Password123'},'admin');
const two=await auth.createUser({name:'爸爸',email:'two@workspace.test',password:'Password123'},'viewer');
const cookies={one:`yiban_session=${await auth.createSession(one.id)}`,two:`yiban_session=${await auth.createSession(two.id)}`};
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await (await import('../lib/store.mjs')).creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(method,endpoint,{as='one',body,key,signal}={}){
  return route[method](new Request(`http://localhost/api/chat/${endpoint}`,{method,signal,headers:{'Content-Type':'application/json',origin:'http://localhost',...(as?{cookie:cookies[as]}:{}),...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});
}

test('chat history belongs to one account; rename, search, archive and delete preserve privacy',async()=>{
  assert.equal((await call('GET','threads',{as:''})).status,401);
  const response=await call('POST','threads',{body:{title:'那年夏天'}});assert.equal(response.status,201);const thread=await response.json();
  assert.equal((await (await call('GET','threads')).json()).threads.length,1);
  assert.equal((await (await call('GET','threads',{as:'two'})).json()).threads.length,0);
  assert.equal((await call('GET',`threads/${thread.id}`,{as:'two'})).status,404);
  assert.equal((await call('PATCH',`threads/${thread.id}`,{as:'two',body:{title:'越权'}})).status,404);
  await call('PATCH',`threads/${thread.id}`,{body:{title:'爸爸的老照片',archived:true}});
  assert.equal((await (await call('GET','threads')).json()).threads.length,0);
  assert.equal((await (await call('GET','threads?archived=true&q=老照片')).json()).threads[0].title,'爸爸的老照片');
  assert.equal((await call('DELETE',`threads/${thread.id}`)).status,200);
  assert.equal((await call('GET',`threads/${thread.id}`)).status,404);
});

test('real streamed chunks are persisted as a complete answer and idempotent replay never bills twice',async()=>{
  const credits=await import('../lib/credits.mjs');
  await credits.grant({userId:one.id,actorId:one.id,amount:20,note:'隔离测试',requestKey:'chat-test-funding'});
  let calls=0;
  globalThis.fetch=async(_url,request)=>{
    calls++;assert.equal(JSON.parse(request.body).stream,true);
    const data=['data: '+JSON.stringify({choices:[{delta:{content:'我在听。'},finish_reason:null}]})+'\n\n','data: '+JSON.stringify({choices:[{delta:{content:'慢慢说。'},finish_reason:'stop'}]})+'\n\n','data: [DONE]\n\n'].join('');
    const bytes=new TextEncoder().encode(data);
    return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
  };
  const thread=await (await call('POST','threads',{body:{}})).json();
  const request={body:{text:'今天有点累'},key:'stream-success'};
  const response=await call('POST',`threads/${thread.id}/generate`,request);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const events=await response.text();assert.match(events,/event: delta/);assert.match(events,/event: done/);
  const stored=await (await call('GET',`threads/${thread.id}`)).json();
  assert.equal(stored.messages.length,2);assert.equal(stored.messages[1].text,'我在听。慢慢说。');assert.equal(stored.messages[1].status,'completed');
  assert.match(await (await call('POST',`threads/${thread.id}/generate`,request)).text(),/event: done/);
  assert.equal(calls,1);assert.deepEqual(await credits.balance(one.id),{balance:19,held:0});
});

test('stopping a running answer preserves its partial text, refunds once and releases its conversation',async()=>{
  const credits=await import('../lib/credits.mjs');
  globalThis.fetch=async(_url,request)=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta:{content:'这是还没讲完的一段'}}]})}\n\n`));request.signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});
  const thread=await (await call('POST','threads',{body:{}})).json();
  const response=await call('POST',`threads/${thread.id}/generate`,{body:{text:'慢慢讲'},key:'stoppable'});
  const {readSSE}=await import('../lib/sse.mjs');const frames=readSSE(response.body);const first=await frames.next();const jobId=JSON.parse(first.value.data).jobId;
  while((await frames.next()).value?.event!=='delta'){}
  assert.equal((await call('GET',`jobs/${jobId}`,{as:'two'})).status,404);
  await call('POST',`jobs/${jobId}/cancel`,{body:{}});
  for await(const frame of frames)if(frame.event==='done')assert.equal(JSON.parse(frame.data).status,'stopped');
  const stored=await (await call('GET',`threads/${thread.id}`)).json();
  assert.equal(stored.messages[1].text,'这是还没讲完的一段');assert.equal(stored.messages[1].status,'stopped');assert.equal(stored.thread.activeJobId,null);
  await call('POST',`jobs/${jobId}/cancel`,{body:{}});assert.deepEqual(await credits.balance(one.id),{balance:19,held:0});
});

test('legacy conversation history is imported once without exposing another account or resurrecting deleted chats',async()=>{
  const store=await import('../lib/store.mjs');
  await store.put('companion_threads',{id:'legacy-mine',userId:one.id,messages:[{role:'user',text:'以前的对话',at:'2026-01-01T00:00:00.000Z'},{role:'companion',text:'当时留下的回答',at:'2026-01-01T00:00:01.000Z'}],createdAt:'2026-01-01T00:00:00.000Z'});
  await store.put('companion_threads',{id:'legacy-other',userId:two.id,messages:[{role:'user',text:'另一个人的私人对话'}],createdAt:'2026-01-01T00:00:00.000Z'});
  const listed=await (await call('GET','threads')).json();const imported=listed.threads.find(t=>t.id==='legacy-legacy-mine');assert.ok(imported);
  const history=await (await call('GET',`threads/${imported.id}`)).json();assert.equal(history.messages[1].text,'当时留下的回答');
  assert.equal(listed.threads.some(t=>t.id==='legacy-legacy-other'),false);
  await call('DELETE',`threads/${imported.id}`);assert.equal((await (await call('GET','threads')).json()).threads.some(t=>t.id===imported.id),false);
  assert.equal(await store.get('companion_threads','legacy-mine'),null);
});

function successModel(capture){globalThis.fetch=async(_url,request)=>{const body=JSON.parse(request.body);capture?.(body);const text=`回复：${body.messages.at(-1).content}`;return new Response(`data: ${JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});};}
async function send(thread,body,key){const response=await call('POST',`threads/${thread.id}/generate`,{body,key});assert.equal(response.status,200);await response.text();return (await call('GET',`threads/${thread.id}`)).json();}
test('edit and regeneration preserve branches, feedback and billing; selecting a version restores its history',async()=>{
  successModel();const credits=await import('../lib/credits.mjs');const before=await credits.balance(one.id);
  const thread=await (await call('POST','threads',{body:{}})).json();
  const first=await send(thread,{text:'旧的问题'},'branch-first');
  const second=await send(thread,{action:'regenerate',messageId:first.messages[1].id},'branch-regenerate');
  assert.equal(second.allMessages.length,3);assert.notEqual(second.messages[1].id,first.messages[1].id);assert.equal(second.messages[0].id,first.messages[0].id);
  const edited=await send(thread,{action:'edit',messageId:first.messages[0].id,text:'新的问题'},'branch-edit');
  assert.equal(edited.allMessages.length,5);assert.equal(edited.messages[0].text,'新的问题');
  const restored=await (await call('POST',`threads/${thread.id}/select`,{body:{messageId:first.messages[1].id}})).json();assert.equal(restored.messages[0].text,'旧的问题');assert.equal(restored.messages[1].id,first.messages[1].id);
  assert.equal((await call('POST',`threads/${thread.id}/feedback`,{body:{messageId:first.messages[1].id,feedback:'up'}})).status,200);
  const other=await call('POST',`threads/${thread.id}/feedback`,{as:'two',body:{messageId:first.messages[1].id,feedback:'down'}});assert.equal(other.status,404);
  assert.deepEqual(await credits.balance(one.id),{balance:before.balance-3,held:0});
});
test('truncated streams preserve partial replies and refund, insufficient balance never calls the model',async()=>{
  const credits=await import('../lib/credits.mjs');const before=await credits.balance(one.id);let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(`data: ${JSON.stringify({choices:[{delta:{content:'未完成的回答'}}]})}\n\n`,{headers:{'Content-Type':'text/event-stream'}});};
  const thread=await (await call('POST','threads',{body:{}})).json();const result=await send(thread,{text:'中断测试'},'truncated');
  assert.equal(result.messages[1].status,'failed');assert.equal(result.messages[1].text,'未完成的回答');assert.deepEqual(await credits.balance(one.id),before);
  const unfunded=await (await call('POST','threads',{as:'two',body:{}})).json();const response=await call('POST',`threads/${unfunded.id}/generate`,{as:'two',body:{text:'没有积分'},key:'unfunded'});
  assert.equal(response.status,402);assert.equal(calls,1);assert.equal((await (await call('GET',`threads/${unfunded.id}`,{as:'two'})).json()).thread.activeJobId,null);
});
test('memory choices only expose confirmed memories and off mode excludes family facts from prompts',async()=>{
  const store=await import('../lib/store.mjs');await store.put('memories',{id:'confirmed-chat',title:'已确认的往事',story:'只有确认后才可引用的细节',status:'confirmed'});await store.put('memories',{id:'draft-chat',title:'未确认的往事',story:'不可引用的猜测',status:'draft'});
  const list=await (await call('GET','memories',{as:'two'})).json();assert.ok(list.memories.some(m=>m.id==='confirmed-chat'));assert.ok(!list.memories.some(m=>m.id==='draft-chat'));
  const thread=await (await call('POST','threads',{body:{options:{memoryMode:'selected',memoryIds:['confirmed-chat','draft-chat']}}})).json();let prompt;
  successModel(body=>prompt=body.messages[0].content);const result=await send(thread,{text:'说说那件事'},'memory-selected');assert.match(prompt,/只有确认后/);assert.doesNotMatch(prompt,/不可引用的猜测/);assert.deepEqual(result.messages[1].sources.map(s=>s.id),['confirmed-chat']);
  await call('PATCH',`threads/${thread.id}`,{body:{options:{memoryMode:'off'}}});const off=await send(thread,{text:'继续'},'memory-off');assert.equal(off.messages.at(-1).sources.length,0);assert.doesNotMatch(prompt,/只有确认后/);
});
test('stale orphan locks are repaired, and stalled reservations are refunded through the wallet',async()=>{
  const store=await import('../lib/store.mjs');const credits=await import('../lib/credits.mjs');const before=await credits.balance(one.id);
  const thread=await (await call('POST','threads',{body:{}})).json();const stamp=new Date(Date.now()-240000).toISOString();
  await store.put('chat_threads',{...thread,activeJobId:'missing-job',updatedAt:stamp});
  const recovered=await (await call('GET',`threads/${thread.id}`)).json();assert.equal(recovered.thread.activeJobId,null);
  const reserved=await credits.reserve({userId:one.id,feature:'companion',amount:1,requestKey:'stale-public',requestHash:'stale',metadata:{async:true,kind:'chat',pollKey:'stale-job',threadId:thread.id}});
  await store.put('chat_jobs',{id:'stale-job',userId:one.id,threadId:thread.id,operationId:reserved.operation.id,status:'running',text:'片段',updatedAt:stamp,messageId:'stale-message'});
  await store.put('chat_messages',{id:'stale-message',userId:one.id,threadId:thread.id,role:'assistant',status:'generating',text:'片段',createdAt:stamp});await store.put('chat_threads',{...recovered.thread,activeJobId:'stale-job',headId:'stale-message'});
  await credits.account(one.id);assert.deepEqual(await credits.balance(one.id),before);assert.equal((await (await call('GET','jobs/stale-job')).json()).status,'failed');
  const result=await (await call('GET',`threads/${thread.id}`)).json();assert.equal(result.thread.activeJobId,null);assert.equal(result.messages[0].status,'failed');
});

test('parallel sends cannot double-spend; pending replay returns the existing job and rejects a changed payload',async()=>{
  const credits=await import('../lib/credits.mjs');const before=await credits.balance(one.id);let modelCalls=0;
  globalThis.fetch=async(_url,request)=>{modelCalls++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta:{content:'片段'}}]})}\n\n`));request.signal.addEventListener('abort',()=>c.error(new Error('cancelled')),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});};
  const thread=await (await call('POST','threads',{body:{}})).json();const body={text:'只发送一遍'};
  const first=await call('POST',`threads/${thread.id}/generate`,{body,key:'parallel-one'});
  const replay=await call('POST',`threads/${thread.id}/generate`,{body,key:'parallel-one'});assert.match(await replay.text(),/event: pending/);
  assert.equal((await call('POST',`threads/${thread.id}/generate`,{body:{text:'另一条'},key:'parallel-two'})).status,409);
  assert.equal((await call('POST',`threads/${thread.id}/generate`,{body:{text:'篡改'},key:'parallel-one'})).status,409);
  assert.equal((await call('DELETE',`threads/${thread.id}`)).status,409);const current=await (await call('GET',`threads/${thread.id}`)).json();assert.equal(modelCalls,1);assert.equal(current.messages.length,2);
  await call('POST',`jobs/${current.job.id}/cancel`,{body:{}});await first.text();assert.deepEqual(await credits.balance(one.id),before);
});

test('complete saved history survives a bounded model context instead of being trimmed to sixty messages',async()=>{
  const store=await import('../lib/store.mjs');const thread=await (await call('POST','threads',{body:{}})).json();let parentId=null;
  for(let i=0;i<72;i++){const message={id:`long-${i}`,userId:one.id,threadId:thread.id,parentId,role:i%2?'assistant':'user',text:`第${i}条：`+'回忆内容'.repeat(220),status:'completed',createdAt:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()};await store.put('chat_messages',message);parentId=message.id;}
  await store.put('chat_threads',{...thread,headId:parentId});let context;
  successModel(body=>context=body.messages);const result=await send(thread,{text:'接着聊聊'},'long-history');
  assert.equal(result.messages.length,74);assert.equal(result.messages[0].id,'long-0');assert.ok(context.length<74);assert.ok(context.slice(1).reduce((count,m)=>count+m.content.length,0)<=24000);assert.equal(context.at(-1).content,'接着聊聊');
});
test('a disconnected streaming reader also refunds and leaves a recoverable partial reply',async()=>{
  const credits=await import('../lib/credits.mjs');const before=await credits.balance(one.id);
  globalThis.fetch=async(_url,request)=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta:{content:'连接断开前的内容'}}]})}\n\n`));request.signal.addEventListener('abort',()=>c.error(new Error('aborted')),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});
  const thread=await (await call('POST','threads',{body:{}})).json();const response=await call('POST',`threads/${thread.id}/generate`,{body:{text:'意外断线'},key:'reader-disconnect'});const reader=response.body.getReader();await reader.read();await reader.read();await reader.cancel();
  const result=await (await call('GET',`threads/${thread.id}`)).json();assert.equal(result.thread.activeJobId,null);assert.equal(result.messages[1].status,'stopped');assert.equal(result.messages[1].text,'连接断开前的内容');assert.deepEqual(await credits.balance(one.id),before);
});
