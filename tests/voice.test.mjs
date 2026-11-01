import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {cacheKey,enrollVoice} from '../lib/voice.mjs';

test('复刻接口直接返回 voice_id 时应判定成功',async t=>{
  const previousKey=process.env.DASHSCOPE_API_KEY;
  const previousWorkspace=process.env.DASHSCOPE_WORKSPACE_ID;
  delete process.env.DASHSCOPE_WORKSPACE_ID;
  process.env.DASHSCOPE_API_KEY='test-key';
  t.after(()=>{if(previousKey===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previousKey;});
  t.after(()=>{if(previousWorkspace===undefined)delete process.env.DASHSCOPE_WORKSPACE_ID;else process.env.DASHSCOPE_WORKSPACE_ID=previousWorkspace;});
  const requests=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    requests.push({url:String(url),options});
    return Response.json({output:{voice_id:'cosyvoice-v3-flash-yiban-example'}});
  });
  assert.deepEqual(await enrollVoice({memberId:'member-1',audioUrl:'https://example.com/sample.wav',consent:true}),{voiceId:'cosyvoice-v3-flash-yiban-example',status:'ready'});
  assert.equal(requests.length,1);
  assert.deepEqual(JSON.parse(requests[0].options.body),{model:'voice-enrollment',input:{action:'create_voice',target_model:'cosyvoice-v3-flash',prefix:'yiban',audio:'https://example.com/sample.wav'}});
  assert.equal(requests[0].options.headers['X-DashScope-Async'],undefined);
  assert.equal(new URL(requests[0].url).hostname,'dashscope.aliyuncs.com');
});

test('私有录音的内联音频原样提交至业务空间接口并保留失败原因',async t=>{
  const previousKey=process.env.DASHSCOPE_API_KEY,previousWorkspace=process.env.DASHSCOPE_WORKSPACE_ID;
  process.env.DASHSCOPE_API_KEY='test-key';process.env.DASHSCOPE_WORKSPACE_ID='testworkspace';
  t.after(()=>{
    if(previousKey===undefined)delete process.env.DASHSCOPE_API_KEY;else process.env.DASHSCOPE_API_KEY=previousKey;
    if(previousWorkspace===undefined)delete process.env.DASHSCOPE_WORKSPACE_ID;else process.env.DASHSCOPE_WORKSPACE_ID=previousWorkspace;
  });
  const audio='data:audio/wav;base64,UklGRg==';
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(new URL(url).hostname,'testworkspace.cn-beijing.maas.aliyuncs.com');
    assert.equal(JSON.parse(options.body).input.audio,audio);
    return Response.json({code:'InvalidParameter',message:'音频过短'},{status:400});
  });
  await assert.rejects(enrollVoice({audioUrl:audio,consent:true}),/InvalidParameter：音频过短/);
});

test('语音缓存键区分长文本的后缀和朗读参数',()=>{
  const prefix='这是同一段很长的前缀文字'.repeat(8);
  assert.notEqual(cacheKey('voice-id',`${prefix}甲`),cacheKey('voice-id',`${prefix}乙`));
  assert.notEqual(cacheKey('voice-id',prefix,{rate:1}),cacheKey('voice-id',prefix,{rate:1.2}));
  assert.equal(cacheKey('voice-id',` ${prefix} `),cacheKey('voice-id',prefix));
});
