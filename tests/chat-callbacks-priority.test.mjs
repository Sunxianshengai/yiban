import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractCallbacks,knockState,listCallbacks} from '../lib/chat-callbacks.mjs';
import {all,put} from '../lib/store.mjs';

process.env.YIBAN_DATA_DIR=(process.env.YIBAN_DATA_DIR||'.data-test-callbacks')+'-prio-'+process.pid;

// 「明天要去医院做体检，有点紧张」会同时留下一条 promise 和一条 mood。
// 隔天再问时该问体检，而不是把「紧张」再翻一遍。
test('同时有答应的事和情绪时，优先提起那件具体的事',async()=>{
  const user={id:'prio-'+Math.random().toString(36).slice(2,9)};
  await extractCallbacks(user,{text:'我明天要去医院做体检，有点紧张'});
  const items=(await listCallbacks(user)).items;
  assert.ok(items.some(i=>i.kind==='promise'),'应有 promise 类型的话头');
  assert.ok(items.some(i=>i.kind==='mood'),'应有 mood 类型的话头');

  for(const item of await all('chat_callbacks'))if(item.userId===user.id)await put('chat_callbacks',{...item,dueAt:new Date(Date.now()-60000).toISOString()});
  await put('chat_messages',{id:'p1',userId:user.id,role:'user',text:'我明天要去医院做体检，有点紧张',createdAt:new Date(Date.now()-30*3600000).toISOString()});

  const {knock}=await knockState(user);
  assert.equal(knock.reason,'promise','情绪不该压过具体安排');
  assert.match(knock.hook,/体检/);
});

test('只有情绪时照常提起情绪',async()=>{
  const user={id:'mood-'+Math.random().toString(36).slice(2,9)};
  await extractCallbacks(user,{text:'最近加班好多，有点崩溃'});
  for(const item of await all('chat_callbacks'))if(item.userId===user.id)await put('chat_callbacks',{...item,dueAt:new Date(Date.now()-60000).toISOString()});
  await put('chat_messages',{id:'m2',userId:user.id,role:'user',text:'最近加班好多，有点崩溃',createdAt:new Date(Date.now()-30*3600000).toISOString()});
  const {knock}=await knockState(user);
  assert.equal(knock.reason,'mood');
  assert.match(knock.text,/你说的「.+」，后来怎么样了？/);
});
