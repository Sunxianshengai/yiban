import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CALLBACK_KINDS,extractCallbacks,listCallbacks,callbackForPrompt,consumeCallback,knockState,setEnabled,callbackPrompt,resolveCallbacksByText} from '../lib/chat-callbacks.mjs';

const user={id:'user-1'};
const other={id:'user-2'};
process.env.YIBAN_DATA_DIR=process.env.YIBAN_DATA_DIR||'.data-test-callbacks';
process.env.YIBAN_DATA_DIR=process.env.YIBAN_DATA_DIR+'-'+process.pid;

test('话头只在到期后出现，用过即关闭，不会第二次提起',async()=>{
  const created=await extractCallbacks(user,{personaId:'p1',threadId:'t1',text:'我明天要去医院做体检，有点紧张',messageId:'m1'});
  assert.ok(created.ids.length>=1,'至少抽到一条线索');
  // 刚创建时未到期，不该被提起。
  assert.equal(await callbackForPrompt(user,'p1',{threadId:'t2'}),null);
  const listed=await listCallbacks(user);
  assert.equal(listed.enabled,true);
  assert.ok(listed.items.length>=1);
  const item=listed.items[0];
  // 手动把到期时间提前，模拟过了一天。
  const {get,put}=await import('../lib/store.mjs');
  const stored=await get('chat_callbacks',item.id);
  await put('chat_callbacks',{...stored,dueAt:new Date(Date.now()-1000).toISOString()});
  const due=await callbackForPrompt(user,'p1',{threadId:'t2'});
  assert.ok(due&&due.id===item.id);
  assert.match(callbackPrompt(due),/原话/,'提示词必须带用户原话');
  await consumeCallback(user,due.id,{threadId:'t2'});
  assert.equal(await callbackForPrompt(user,'p1',{threadId:'t3'}),null,'提过就关闭');
});

test('敏感信息与一次性请求不进入话头',async()=>{
  const a=await extractCallbacks(user,{text:'我的银行卡密码是123456，帮我记一下'});
  assert.equal(a.ids.length,0);
  const b=await extractCallbacks(user,{text:'帮我写一段关于明天面试的小说'});
  assert.equal(b.ids.length,0);
});

test('别人的话头读不到也提不起',async()=>{
  await extractCallbacks(other,{text:'我下周要搬家了，东西还没收拾'});
  assert.equal(await callbackForPrompt(user,'p1'),null);
  const mine=await listCallbacks(user);
  assert.ok(mine.items.every(item=>!String(item.hook).includes('搬家')));
});

test('关闭主动开口后既不提取也不提起',async()=>{
  await setEnabled(user,false);
  const created=await extractCallbacks(user,{text:'我明天要去考试，很紧张'});
  assert.equal(created.ids.length,0);
  assert.equal(await callbackForPrompt(user,'p1'),null);
  assert.equal((await knockState(user)).knock,null);
  await setEnabled(user,true);
});

test('沉默重启：隔一天先问起旧话头，隔三天只寒暄',async()=>{
  const gap=(hours)=>Date.now()+hours*3600000;
  const fresh={id:'user-3'};
  const {put}=await import('../lib/store.mjs');
  const at=(hours)=>new Date(Date.now()-hours*3600000).toISOString();
  await put('chat_messages',{id:'m-a',userId:fresh.id,role:'user',text:'在吗',createdAt:at(30)});
  const day=await knockState(fresh,{now:gap(0)});
  assert.ok(day.knock,'隔 30 小时应有开口');
  assert.equal(day.knock.reason,'silence');

  await put('chat_messages',{id:'m-b',userId:fresh.id,role:'user',text:'在吗',createdAt:at(100)});
  const week=await knockState(fresh,{now:gap(0)});
  assert.ok(week.knock.reason==='silence');
  assert.match(week.knock.text,/最近忙什么|过得怎么样/);
});

test('kind 表驱动到期与寿命，不写死散落常量',()=>{
  for(const [key,value] of Object.entries(CALLBACK_KINDS)){
    assert.ok(value.dueHours>0&&value.lifeHours>value.dueHours,`${key} 的到期必须早于失效`);
  }
});

test('resolveCallbacksByText closes threads the user says are finished',async()=>{
  const user={id:'resolve-user'};
  const created=await extractCallbacks(user,{text:'明天要去体检，有点紧张',personaId:null,threadId:'t1',messageId:'m1'});
  assert.equal(created.status,'created');
  const before=await resolveCallbacksByText(user,'体检完啦，一切正常',{threadId:'t1'});
  assert.equal(before.resolved,1);
  assert.ok(before.hooks.includes('去体检'));
  const again=await resolveCallbacksByText(user,'体检完啦',{threadId:'t1'});
  assert.equal(again.resolved,0,'已关的话头不会重复关');
  const unrelated=await resolveCallbacksByText(user,'项目黄了，难受',{threadId:'t1'});
  assert.equal(unrelated.resolved,0,'话头关键词没出现就不误伤');
});
