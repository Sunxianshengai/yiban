import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {streamChat} from '../lib/chat-model.mjs';

const originalFetch=globalThis.fetch;
const keys=['AI_API_URL','AI_API_KEY','AI_MODEL','COMPANION_CHAT_MODEL'];
const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
after(()=>{globalThis.fetch=originalFetch;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});

test('companion override reaches the real request without changing other model configuration',async()=>{
  Object.assign(process.env,{AI_API_URL:'https://api.deepseek.com/v1/chat/completions',AI_API_KEY:'mock',AI_MODEL:'other-task-model',COMPANION_CHAT_MODEL:'deepseek-v4-pro'});
  const bodies=[];
  globalThis.fetch=async(_url,request)=>{bodies.push(JSON.parse(request.body));return Response.json({choices:[{message:{content:'哦哦，点的啥？'}}]});};
  const output=[];for await(const delta of streamChat([{role:'user',content:'等外卖呢'}]))output.push(delta);
  assert.equal(output.join(''),'哦哦，点的啥？');
  assert.equal(bodies[0].model,'deepseek-v4-pro');
  assert.deepEqual(bodies[0].thinking,{type:'disabled'});
  assert.equal(bodies[0].stream,true);
  assert.equal((await import('../lib/ai.mjs')).modelConfig().model,'other-task-model');
  delete process.env.COMPANION_CHAT_MODEL;
  process.env.AI_API_URL='https://compatible.invalid/v1/chat/completions';
  for await(const _delta of streamChat([])){}
  assert.equal(bodies[1].model,'other-task-model');
  assert.equal('thinking' in bodies[1],false);
});
