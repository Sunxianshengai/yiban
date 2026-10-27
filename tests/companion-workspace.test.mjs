import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-companion-im-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,AI_API_URL:'https://model.invalid/chat/completions',AI_API_KEY:'mock',AI_MODEL:'mock'});delete process.env.DATABASE_URL;delete process.env.VERCEL;
const auth=await import('../lib/auth.mjs'),store=await import('../lib/store.mjs'),credits=await import('../lib/credits.mjs'),memory=await import('../lib/personal-memory.mjs');
const user=await auth.createUser({name:'小雨',email:'im@test.invalid',password:'Password123'},'admin'),other=await auth.createUser({name:'另一人',email:'other-im@test.invalid',password:'Password123'},'viewer');
const cookies={owner:`yiban_session=${await auth.createSession(user.id)}`,other:`yiban_session=${await auth.createSession(other.id)}`};
const chat=await loadRoute(new URL('../app/api/chat/[...path]/route.js',import.meta.url)),familia=await loadRoute(new URL('../app/api/familia/[...path]/route.js',import.meta.url));const originalFetch=globalThis.fetch;
after(async()=>{globalThis.fetch=originalFetch;(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
async function call(api,method,endpoint,{body,key,as='owner'}={}){return (api==='chat'?chat:familia)[method](new Request(`http://localhost/api/${api}/${endpoint}`,{method,headers:{'Content-Type':'application/json',origin:'http://localhost',cookie:cookies[as],...(key?{'Idempotency-Key':key,'X-Credit-Limit':'1'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});}
const newThread=async()=> (await call('chat','POST','threads',{body:{options:{memoryMode:'off'}}})).json();
const jsonModel=value=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]});
const stream=value=>new Response(`data: ${JSON.stringify({choices:[{delta:{content:value},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
async function send(thread,body,key){const response=await call('chat','POST',`threads/${thread.id}/generate`,{body,key});assert.equal(response.status,200);await response.text();return(await call('chat','GET',`threads/${thread.id}`)).json();}
await credits.grant({userId:user.id,actorId:user.id,amount:30,note:'隔离测试',requestKey:'im-fund'});

test('real multi-bubble and sticker replies persist, cool down, replay and bill once per turn',async()=>{
  let normalCalls=0,systems=[];globalThis.fetch=async(_url,req)=>{const body=JSON.parse(req.body);if(!body.stream)return jsonModel({memories:[],ids:[]});normalCalls++;systems.push(body.messages[0].content);return stream('先听你说。\n---\n不急着复盘。\n---\n[[sticker:greeting]]');};
  const thread=await newThread();const first=await send(thread,{texts:['面试结束了。','先别分析，我想歇会儿。']},'im-first');
  assert.equal(first.messages[0].parts.length,2);assert.equal(first.messages[1].parts.length,3);assert.equal(first.messages[1].parts[2].stickerId,'greeting');assert.doesNotMatch(first.messages[1].text,/sticker|---/);assert.match(systems[0],/小满/);assert.match(systems[0],/尊重用户的节奏/);assert.match(systems[0],/不假定|不编造/);
  await(await call('chat','POST',`threads/${thread.id}/generate`,{body:{texts:['面试结束了。','先别分析，我想歇会儿。']},key:'im-first'})).text();assert.equal(normalCalls,1);
  const second=await send(thread,{text:'嗯，歇一会儿。'},'im-second');assert.equal(second.messages.at(-1).parts.some(part=>part.type==='sticker'),false);assert.deepEqual(await credits.balance(user.id),{balance:28,held:0});
  assert.equal((await call('chat','POST',`threads/${thread.id}/generate`,{body:{stickerId:'https://bad.invalid/x'},key:'bad-sticker'})).status,400);
  assert.equal((await call('chat','POST',`threads/${thread.id}/generate`,{body:{stickerId:'quiet',texts:['夹带内容']},key:'bad-combination'})).status,400);
});

test('message reactions and favorites remain private, and suggestions keep old versions',async()=>{
  let system='';globalThis.fetch=async(_url,req)=>{const body=JSON.parse(req.body);if(!body.stream)return jsonModel({memories:[],ids:[]});system=body.messages.at(-1).content;return stream('换个简短说法。');};
  const thread=await newThread(),first=await send(thread,{text:'今天想安静聊聊'},'im-message');const message=first.messages[1];
  assert.equal((await call('chat','POST',`threads/${thread.id}/interact`,{body:{messageId:message.id,reaction:'❤️',favorite:true}})).status,200);
  assert.equal((await call('chat','POST',`threads/${thread.id}/interact`,{as:'other',body:{messageId:message.id,favorite:false}})).status,404);
  const next=await send(thread,{action:'suggest',messageId:message.id,suggestion:'只回应一句，不用给建议'},'im-suggest');assert.equal(next.allMessages.length,3);assert.match(system,/只回应一句/);assert.equal(next.allMessages.find(m=>m.id===message.id).favorite,true);assert.equal(next.allMessages.find(m=>m.id===message.id).reaction,'❤️');
});

test('default companion personality is per account and editing it preserves the null memory scope',async()=>{
  const first=(await(await call('familia','GET','profiles')).json()).defaultProfile;assert.equal(first.name,'小满');
  const updated=await call('familia','PATCH','profiles/default',{body:{name:'沉稳的小满',qualities:['principled'],speakingStyle:'短句、少追问',expectedUpdatedAt:first.updatedAt}});assert.equal(updated.status,200);
  assert.equal((await(await call('familia','GET','profiles',{as:'other'})).json()).defaultProfile.name,'小满');
  assert.equal((await call('familia','PATCH','profiles/default',{body:{name:'旧页面',expectedUpdatedAt:first.updatedAt}})).status,409);
  let prompt='';globalThis.fetch=async(_url,req)=>{const body=JSON.parse(req.body);if(!body.stream)return jsonModel({memories:[],ids:[]});prompt=body.messages[0].content;return stream('可以，慢慢聊。');};await send(await newThread(),{text:'你好'},'updated-default');assert.match(prompt,/沉稳的小满/);assert.match(prompt,/短句、少追问/);
  assert.equal((await memory.listPersonalMemories(user,null)).mode,'auto');
});

test('semantic retrieval is scoped and expired plans are excluded even when the model selects them',async()=>{
  const saved=await memory.createPersonalMemory(user,null,{text:'我习惯傍晚沿河跑步。',category:'preference'},'semantic-example');
  const state=await memory.listPersonalMemories(user,null);const raw=(await store.all('personal_memory_scopes')).find(item=>item.userId===user.id&&item.profileId===null);await store.put('personal_memory_scopes',{...raw,items:[...raw.items,{id:'expired-plan',text:'明天去面试',category:'event',kind:'plan',createdAt:'2020-01-01T00:00:00Z',updatedAt:'2020-01-01T00:00:00Z',expiresAt:'2020-01-02T00:00:00Z'}]});
  globalThis.fetch=async()=>jsonModel({ids:[saved.id,'expired-plan','other-account-id']});
  const result=await memory.retrievePersonalContext(user,null,'下班后的运动安排');assert.deepEqual(result.items.map(item=>item.id),[saved.id]);assert.equal(result.snapshot.revision,state.revision);
});

test('automatic memory replaces outdated auto facts with evidence, refuses protected or foreign replacement, and keeps no obsolete body',async()=>{
  const thread=await newThread();
  async function capture(id,text,extract){await store.put('chat_messages',{id,userId:user.id,threadId:thread.id,role:'user',status:'completed',text,createdAt:new Date().toISOString()});globalThis.fetch=async()=>jsonModel({memories:[extract]});const snapshot=await memory.automaticMemorySnapshot(user,null);return memory.saveAutomaticMemories(user,null,{threadId:thread.id,messageId:id},text,snapshot);}
  const first=await capture('plan-source','我明天要去面试。',{quote:'我明天要去面试。',category:'event',kind:'plan',topic:'面试'});assert.equal(first.status,'saved');
  const next=await capture('done-source','面试已经结束了，比预想顺利。',{quote:'面试已经结束了，比预想顺利。',category:'event',kind:'event',topic:'面试',replaces:first.ids});assert.equal(next.status,'saved');
  const state=await memory.listPersonalMemories(user,null);assert.ok(!state.items.some(item=>first.ids.includes(item.id)));assert.ok(state.items.some(item=>next.ids.includes(item.id)));
  const raw=(await store.all('personal_memory_scopes')).find(item=>item.userId===user.id&&item.profileId===null);assert.equal(raw.items.find(item=>item.id===first.ids[0]).text,undefined);
  const protectedItem=state.items.find(item=>item.origin==='manual');const refused=await capture('forged-source','我改变计划了。',{quote:'我改变计划了。',category:'event',replaces:[protectedItem.id]});assert.equal(refused.status,'skipped');
  const foreign=await capture('foreign-source','我改变安排了。',{quote:'我改变安排了。',category:'event',replaces:['another-private-id']});assert.equal(foreign.status,'skipped');
});

test('deferred memory runs after a completed response, without blocking or billing an extra reply',async()=>{
  const {prepareGeneration,generationResponse}=await import('../lib/chat-generation.mjs');const thread=await newThread();let tasks=[];
  globalThis.fetch=async(_url,req)=>{const body=JSON.parse(req.body);if(body.stream)return stream('收到。');if(body.messages[0].content.includes('相关性选择器'))return jsonModel({ids:[]});return jsonModel({memories:[{quote:'我最近在学木工。',category:'event'}]});};
  const before=await credits.balance(user.id),prepared=await prepareGeneration(user,thread.id,{text:'我最近在学木工。'},'background-example',1);const response=generationResponse(user,prepared,undefined,{schedule:task=>tasks.push(task)});await response.text();
  assert.equal(tasks.length,1);assert.equal((await memory.listPersonalMemories(user,null)).items.some(item=>item.text==='我最近在学木工。'),false);await tasks[0]();assert.equal((await memory.listPersonalMemories(user,null)).items.some(item=>item.text==='我最近在学木工。'),true);assert.equal((await credits.balance(user.id)).balance,before.balance-1);
});
