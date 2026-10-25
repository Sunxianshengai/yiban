import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';

const directory=mkdtempSync(path.join(tmpdir(),'yiban-credit-http-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/v1/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock'});
delete process.env.DATABASE_URL;delete process.env.VERCEL;
const route=await loadRoute();
const auth=await import('../lib/auth.mjs');
const admin=await auth.createUser({name:'管理家长',email:'admin@credits.test',password:'Password123'},'admin');
const viewer=await auth.createUser({name:'家人',email:'member@credits.test',password:'Password123'},'viewer');
const adminCookie=`yiban_session=${await auth.createSession(admin.id)}`;
const viewerCookie=`yiban_session=${await auth.createSession(viewer.id)}`;
const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await (await import('../lib/store.mjs')).creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});

async function call(method,endpoint,{cookie=viewerCookie,body,key,max}={}) {
  return route[method](new Request(`http://localhost/api/${endpoint}`,{method,
    headers:{'Content-Type':'application/json',origin:'http://localhost',...(cookie?{cookie}:{}),...(key?{'Idempotency-Key':key}:{}),...(max===undefined?{}:{'X-Credit-Limit':String(max)})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('/')})});
}

test('只有管理员能发放积分，每人只能读取自己的流水',async()=>{
  assert.equal((await call('GET','credits',{cookie:''})).status,401);
  assert.equal((await call('POST','credits/grant',{body:{userId:viewer.id,amount:50,note:'体验'},key:'forbidden-grant'})).status,403);
  const granted=await call('POST','credits/grant',{cookie:adminCookie,body:{userId:viewer.id,amount:50,note:'首次体验'},key:'admin-grant'});
  assert.equal(granted.status,201);
  const mine=await (await call('GET','credits')).json();
  assert.equal(mine.balance,50);
  assert.equal(mine.entries[0].note,'首次体验');
  const own=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(own.balance,0);
});

test('成功回复扣费一次，重复请求重放结果；失败退回，余额不足不会调用模型',async()=>{
  let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'我听着呢。'}}]});};
  const data={text:'今天很好'};
  const first=await call('POST','companion/turn',{body:data,key:'chat-success'});
  assert.equal(first.status,201);
  assert.equal((await (await call('GET','credits')).json()).balance,49);
  const replay=await call('POST','companion/turn',{body:data,key:'chat-success'});
  assert.deepEqual(await replay.json(),await first.json());
  assert.equal(calls,1);
  assert.equal((await call('POST','companion/turn',{body:{text:'另一个请求'},key:'chat-success'})).status,409);
  globalThis.fetch=async()=>{calls++;throw new Error('模拟模型断网');};
  assert.equal((await call('POST','companion/turn',{body:{text:'再聊一句'},key:'chat-failure'})).status,504);
  const refunded=await (await call('GET','credits')).json();
  assert.equal(refunded.balance,49);
  assert.equal(refunded.held,0);
  assert.equal(refunded.entries.filter(e=>e.kind==='refund').length,1);
  const before=calls;
  assert.equal((await call('POST','companion/turn',{cookie:adminCookie,body:data,key:'empty-admin'})).status,402);
  assert.equal(calls,before);
});

test('视频创建只冻结；查询失败仍保持冻结，明确失败退回；成功保存后只结算一次',async()=>{
  const store=await import('../lib/store.mjs');
  const {narrationKey}=await import('../lib/narrate.mjs');
  process.env.DASHSCOPE_API_KEY='mock-voice';
  await call('POST','credits/grant',{cookie:adminCookie,body:{userId:admin.id,amount:500,note:'视频体验'},key:'video-grant'});
  const member=await store.get('members','member-1');
  await store.put('members',{...member,voiceId:'test-voice'});
  const memory=await store.get('memories','demo-child');
  await store.saveMedia('credit-test.png',Buffer.from('mock-image'),'image/png');
  await store.put('uploads',{id:'credit-test.png',userId:admin.id});
  await store.put('memories',{...memory,cover:'/api/media/credit-test.png'});
  await store.put('narrations',{id:narrationKey(memory.id,member.id,memory.updatedAt),script:'这是测试讲述稿，来自已经确认的家庭记忆。'});
  globalThis.fetch=async()=>Response.json({output:{task_id:'test-video'}});
  const request={memoryId:memory.id,resolution:'480P',duration:5};
  const created=await call('POST','narrate/video',{cookie:adminCookie,body:request,key:'video-fail'});
  assert.equal(created.status,202);
  const task=(await created.json()).taskId;
  let wallet=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(wallet.balance,400);assert.equal(wallet.held,100);
  globalThis.fetch=async()=>{throw new Error('查询临时断网');};
  await call('GET',`narrate-video/${task}`,{cookie:adminCookie});
  assert.equal((await (await call('GET','credits',{cookie:adminCookie})).json()).held,100);
  globalThis.fetch=async()=>Response.json({output:{task_status:'FAILED',message:'生成失败'}});
  await call('GET',`narrate-video/${task}`,{cookie:adminCookie});
  wallet=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(wallet.balance,500);assert.equal(wallet.held,0);
  globalThis.fetch=async()=>Response.json({output:{task_id:'second-video'}});
  assert.equal((await call('POST','narrate/video',{cookie:adminCookie,body:request,key:'video-success'})).status,202);
  globalThis.fetch=async url=>String(url).includes('/tasks/')
    ?Response.json({output:{task_status:'SUCCEEDED',video_url:'https://download.invalid/video'}})
    :new Response(Buffer.from('mock-video'));
  assert.equal((await call('GET',`narrate-video/${task}`,{cookie:adminCookie})).status,200);
  await call('GET',`narrate-video/${task}`,{cookie:adminCookie});
  wallet=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(wallet.balance,400);assert.equal(wallet.held,0);
  const before=wallet.entries.length;
  assert.equal((await call('POST','narrate/video',{cookie:adminCookie,body:request,key:'video-cached'})).status,200);
  assert.equal((await (await call('GET','credits',{cookie:adminCookie})).json()).entries.length,before);
  delete process.env.DASHSCOPE_API_KEY;
});

test('模型空输出不扣费；超过用户确认上限的报价不执行也不冻结',async()=>{
  await call('POST','credits/grant',{cookie:adminCookie,body:{userId:admin.id,amount:100,note:'整理计费测试'},key:'organize-grant'});
  const before=await (await call('GET','credits',{cookie:adminCookie})).json();
  let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:'{"title":"","story":""}'}}]});};
  const empty=await call('POST','organize',{cookie:adminCookie,body:{title:'空输出测试'},key:'empty-organize'});
  assert.equal(empty.status,502);
  assert.equal((await (await call('GET','credits',{cookie:adminCookie})).json()).balance,before.balance);
  const count=calls;
  const changed=await call('POST','organize',{cookie:adminCookie,body:{title:'空输出测试'},key:'old-price',max:1});
  assert.equal(changed.status,409);
  assert.equal(calls,count);
  assert.equal((await (await call('GET','credits',{cookie:adminCookie})).json()).held,0);
});

test('视频明确成功但结果下载失效时退回积分',async()=>{
  process.env.DASHSCOPE_API_KEY='mock';
  const before=(await (await call('GET','credits',{cookie:adminCookie})).json()).balance;
  globalThis.fetch=async()=>Response.json({output:{task_id:'expired-download'}});
  const created=await call('POST','narrate/video',{cookie:adminCookie,body:{memoryId:'demo-child',duration:6},key:'expired-video'});
  assert.equal(created.status,202);
  const {taskId}=await created.json();
  globalThis.fetch=async url=>String(url).includes('/tasks/')
    ?Response.json({output:{task_status:'SUCCEEDED',video_url:'https://download.invalid/expired'}})
    :new Response('expired',{status:404});
  const result=await (await call('GET',`narrate-video/${taskId}`,{cookie:adminCookie})).json();
  assert.equal(result.status,'failed');
  const wallet=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(wallet.balance,before);assert.equal(wallet.held,0);
  delete process.env.DASHSCOPE_API_KEY;
});

test('本地整理免费；角色回复按次收费；声音合成按字数收费且缓存免费',async()=>{
  const env={url:process.env.AI_API_URL,key:process.env.AI_API_KEY,model:process.env.AI_MODEL,deepseek:process.env.DEEPSEEK_API_KEY};
  delete process.env.AI_API_URL;delete process.env.AI_API_KEY;delete process.env.AI_MODEL;delete process.env.DEEPSEEK_API_KEY;
  const before=(await (await call('GET','credits',{cookie:adminCookie})).json()).balance;
  assert.equal((await call('POST','organize',{cookie:adminCookie,body:{title:'家庭回忆',story:'一家人在老家团聚。'},key:'local-free'})).status,200);
  assert.equal((await (await call('GET','credits',{cookie:adminCookie})).json()).balance,before);
  Object.assign(process.env,{AI_API_URL:env.url,AI_API_KEY:env.key,AI_MODEL:env.model});
  if(env.deepseek!==undefined)process.env.DEEPSEEK_API_KEY=env.deepseek;
  globalThis.fetch=async()=>Response.json({choices:[{message:{content:'我听着。'}}]});
  const viewerBefore=(await (await call('GET','credits')).json()).balance;
  assert.equal((await call('POST','role/turn',{body:{roleId:'mother',text:'你好'},key:'role-paid'})).status,201);
  assert.equal((await (await call('GET','credits')).json()).balance,viewerBefore-1);
  process.env.DASHSCOPE_API_KEY='mock';
  let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({output:{audio:{audio:[{data:Buffer.from('test-audio').toString('base64')}]}}});};
  const text='家'.repeat(101);
  const args={body:{memberId:'member-1',text},key:'voice-paid'};
  assert.equal((await call('POST','voice/speak',args)).status,200);
  assert.equal((await (await call('GET','credits')).json()).balance,viewerBefore-5);
  assert.equal((await call('POST','voice/speak',{...args,key:'voice-cached'})).status,200);
  assert.equal((await (await call('GET','credits')).json()).balance,viewerBefore-5);
  assert.equal(calls,1);
  delete process.env.DASHSCOPE_API_KEY;
});

test('并发查询同一视频不能把已交付的成功覆盖成失败',async()=>{
  process.env.DASHSCOPE_API_KEY='mock';
  const before=(await (await call('GET','credits',{cookie:adminCookie})).json()).balance;
  globalThis.fetch=async()=>Response.json({output:{task_id:'concurrent-poll'}});
  const created=await call('POST','narrate/video',{cookie:adminCookie,body:{memoryId:'demo-child',duration:7},key:'concurrent-poll'});
  assert.equal(created.status,202);
  const {taskId}=await created.json();
  let downloads=0,release;
  const firstFinished=new Promise(resolve=>release=resolve);
  globalThis.fetch=async url=>{
    if(String(url).includes('/tasks/'))return Response.json({output:{task_status:'SUCCEEDED',video_url:'https://download.invalid/concurrent'}});
    if(++downloads===1)return new Response(Buffer.from('delivered-video'));
    await firstFinished;return new Response('expired',{status:404});
  };
  const first=call('GET',`narrate-video/${taskId}`,{cookie:adminCookie});
  const second=call('GET',`narrate-video/${taskId}`,{cookie:adminCookie});
  try {assert.equal((await (await first).json()).status,'ready');}
  finally {release();}
  assert.equal((await (await second).json()).status,'ready');
  const wallet=await (await call('GET','credits',{cookie:adminCookie})).json();
  assert.equal(wallet.balance,before-140);assert.equal(wallet.held,0);
  delete process.env.DASHSCOPE_API_KEY;
});
