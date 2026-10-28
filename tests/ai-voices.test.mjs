import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_VOICES,validAiVoice,shouldSynthesizeVoice} from '../lib/ai-voices.mjs';

test('AI voice presets whitelist and validation',()=>{
  assert.ok(AI_VOICES.length>=3);
  assert.ok(validAiVoice(null));assert.ok(validAiVoice(AI_VOICES[0].id));
  assert.ok(!validAiVoice('made-up-voice'));
});

test('voice synthesis only fires on explicit request with voice and config',()=>{
  const directives=['这轮尽量用语音回应；如果当前发不了语音，就像朋友一样自然说明现在发不了，不要假装发过'];
  assert.equal(shouldSynthesizeVoice({directives,voice:'longwan',configured:true}),true);
  assert.equal(shouldSynthesizeVoice({directives:[],voice:'longwan',configured:true}),false,'没说要语音就不合成');
  assert.equal(shouldSynthesizeVoice({directives,voice:null,configured:true}),false,'没选音色不合成');
  assert.equal(shouldSynthesizeVoice({directives,voice:'longwan',configured:false}),false,'未配置服务不合成');
  assert.equal(shouldSynthesizeVoice({directives:['这轮只回一句'],voice:'longwan',configured:true}),false,'别的指令不触发');
});
