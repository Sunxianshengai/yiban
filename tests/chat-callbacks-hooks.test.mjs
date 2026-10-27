import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCallbacks,knockState,forgetCallback,listCallbacks,callbackForPrompt} from '../lib/chat-callbacks.mjs';

process.env.YIBAN_DATA_DIR=(process.env.YIBAN_DATA_DIR||'.data-test-callbacks')+'-hooks-'+process.pid;

// 话头会直接印在开场卡上（「你说的「X」，后来怎么样了？」），所以它必须是一句
// 能独立读通的短语，不能是「去医院做体」这种被字数截断的半句。
test('话头不被截成半句：结尾不留虚词，开头不留时间词',async()=>{
  const cases=['我明天要去医院做体检，有点紧张','我下周要搬家了，东西还没收拾','最近在学做蛋糕','我打算下个月开始跑步'];
  for(const text of cases){
    const user={id:'h-'+Math.random().toString(36).slice(2,9)};
    await extractCallbacks(user,{text});
    const hooks=(await listCallbacks(user)).items.map(item=>item.hook);
    assert.ok(hooks.length>=1,`${text} 应该抽出至少一条`);
    for(const hook of hooks){
      assert.ok(hook.length>=2&&hook.length<=8,`「${hook}」长度应在 2–8 字之间`);
      assert.doesNotMatch(hook,/^(?:明天|后天|下周|下个月|今天|最近)/,`「${hook}」不该以时间词开头`);
      assert.doesNotMatch(hook,/[要去在的了着和跟与给把被就还都也又很太回为过]$/,`「${hook}」不该以虚词结尾`);
    }
  }
});

test('同一句话里的重复线索只留一条',async()=>{
  const user={id:'dup-'+Math.random().toString(36).slice(2,9)};
  await extractCallbacks(user,{text:'我打算下个月开始跑步'});
  const hooks=(await listCallbacks(user)).items.map(item=>item.hook);
  assert.equal(hooks.length,new Set(hooks).size,'不能出现两行说同一件事');
});

test('「忘记」一条之后它不会再被提起',async()=>{
  const user={id:'fg-'+Math.random().toString(36).slice(2,9)};
  await extractCallbacks(user,{text:'我明天要去医院做体检，有点紧张'});
  const listed=(await listCallbacks(user)).items;
  assert.ok(listed.length>=1);
  const target=listed[0];
  await forgetCallback(user,target.id);
  const after=(await listCallbacks(user)).items;
  assert.ok(!after.some(item=>item.id===target.id));
  // 剩余条目即使到期也不该是刚忘掉的那条。
  const {get,put}=await import('../lib/store.mjs');
  for(const item of after){
    const stored=await get('chat_callbacks',item.id);
    await put('chat_callbacks',{...stored,dueAt:new Date(Date.now()-1000).toISOString()});
  }
  const next=await callbackForPrompt(user,null,{threadId:'other'});
  assert.ok(!next||next.id!==target.id);
});

test('隔一天回来先问旧话头，隔三天只寒暄',async()=>{
  const user={id:'kn-'+Math.random().toString(36).slice(2,9)};
  const {put,get}=await import('../lib/store.mjs');
  const at=hours=>new Date(Date.now()-hours*3600000).toISOString();
  await extractCallbacks(user,{text:'我明天要去医院做体检，有点紧张',threadId:'t-old'});
  const listed=(await listCallbacks(user)).items;
  for(const item of listed){
    const stored=await get('chat_callbacks',item.id);
    await put('chat_callbacks',{...stored,dueAt:at(2)});
  }
  await put('chat_messages',{id:'k1',userId:user.id,role:'user',text:'在吗',createdAt:at(30)});
  const day=await knockState(user);
  assert.ok(day.knock,'隔一天应主动开口');
  assert.ok(['promise','mood','interest'].includes(day.knock.reason),'应该提起具体话头而不是寒暄');
  assert.match(day.knock.text,/你说的「.+」，后来怎么样了？/);

  // 同一段会话再放三天：最后一条用户消息更久远，就该只寒暄。
  await put('chat_messages',{id:'k1',userId:user.id,role:'user',text:'在吗',createdAt:at(100)});
  const week=await knockState(user);
  assert.equal(week.knock.reason,'silence');
  assert.doesNotMatch(week.knock.text,/你说的「/,'隔太久不该精确复述旧事');
});

test('刚聊完不到二十小时不主动开口',async()=>{
  const user={id:'near-'+Math.random().toString(36).slice(2,9)};
  const {put}=await import('../lib/store.mjs');
  await put('chat_messages',{id:'n1',userId:user.id,role:'user',text:'在吗',createdAt:new Date(Date.now()-3600000).toISOString()});
  assert.equal((await knockState(user)).knock,null);
});
