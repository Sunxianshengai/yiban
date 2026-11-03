import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qwenVoiceRequest} from '../lib/qwen-companion-voice.mjs';
test('slow voice enrollment gets over 90 seconds while queries retain their shorter deadline',async t=>{
  const old=process.env.QWEN_VOICE_API_KEY;process.env.QWEN_VOICE_API_KEY='test-key';
  t.after(()=>{if(old===undefined)delete process.env.QWEN_VOICE_API_KEY;else process.env.QWEN_VOICE_API_KEY=old;});
  const timeouts=[];t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return new AbortController().signal;});
  t.mock.method(globalThis,'fetch',async()=>Response.json({output:{voice_id:'test-voice'}}));
  await qwenVoiceRequest({action:'create_voice'});await qwenVoiceRequest({action:'query_voice',voice_id:'test-voice'});
  assert.ok(timeouts[0]>90000&&timeouts[0]<120000,'enrollment must outlast the observed slow creation within the route limit');
  assert.equal(timeouts[1],45000);
});
