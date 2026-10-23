import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {cacheKey} from '../lib/voice.mjs';

test('语音缓存键区分长文本的后缀和朗读参数',()=>{
  const prefix='这是同一段很长的前缀文字'.repeat(8);
  assert.notEqual(cacheKey('voice-id',`${prefix}甲`),cacheKey('voice-id',`${prefix}乙`));
  assert.notEqual(cacheKey('voice-id',prefix,{rate:1}),cacheKey('voice-id',prefix,{rate:1.2}));
  assert.equal(cacheKey('voice-id',` ${prefix} `),cacheKey('voice-id',prefix));
});
