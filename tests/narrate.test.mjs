import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanScript,pickNarrator,narrationKey,videoKey,buildVideoPrompt,buildNarrationPrompt,
  clampResolution,clampSeconds,MAX_SCRIPT,MAX_IMAGE_BYTES,VIDEO_RESOLUTIONS,
  VIDEO_MIN_SECONDS,VIDEO_MAX_SECONDS,VIDEO_DEFAULT_SECONDS,VIDEO_DEFAULT_RESOLUTION,
} from '../lib/narrate.mjs';

const memory={
  id:'mem-1',title:'那年冬天',year:'1987',location:'沈阳',
  people:['小雨','陈叔叔'],theme:'家人',
  story:'那年冬天很冷，我带着小雨去车站接人，雪下了整整一夜。',
};

// ── 口述稿清洗 ───────────────────────────────────────────────

test('cleanScript：剥掉代码围栏与「以下是」前言',()=>{
  const raw='```text\n以下是口述稿：\n那年冬天很冷，我带着小雨去车站接人，雪下了一整夜。\n```';
  const out=cleanScript(raw);
  assert.ok(!out.includes('```'),'不该留下围栏');
  assert.ok(!out.includes('以下是'),'不该留下前言');
  assert.ok(out.startsWith('那年冬天'),`正文应从事实开始，实际：${out.slice(0,20)}`);
});

test('cleanScript：整体包裹的引号要剥掉，但句内引号保留',()=>{
  assert.equal(cleanScript('“我那天说过‘别走’，她没听见。”'),'我那天说过‘别走’，她没听见。');
  assert.equal(cleanScript('「就这么定了」'),'就这么定了');
});

test('cleanScript：去掉舞台提示行与 markdown 标题',()=>{
  const out=cleanScript('# 那年冬天\n（停顿）\n我推开门，雪落了一肩。\n\n\n（看向窗外）');
  assert.equal(out,'那年冬天\n我推开门，雪落了一肩。');
});

test('cleanScript：超长截断到 MAX_SCRIPT，且不破坏开头',()=>{
  const long='雪'.repeat(MAX_SCRIPT+500);
  const out=cleanScript(long);
  assert.equal(out.length,MAX_SCRIPT);
  assert.ok(out.startsWith('雪'));
});

test('cleanScript：空输入不抛错，返回空串',()=>{
  for(const value of ['',null,undefined]){
    assert.equal(cleanScript(value),'');
  }
});

// ── 选讲述人 ─────────────────────────────────────────────────

test('pickNarrator：优先记忆里点名的、且复刻过声音的那位',()=>{
  const members=[
    {id:'m1',name:'林阿姨',voiceId:'v1'},
    {id:'m2',name:'小雨',voiceId:'v2'},
  ];
  assert.equal(pickNarrator({people:['小雨']},members).id,'m2');
});

test('pickNarrator：点名的人没复刻声音时，退到任何一位能讲的',()=>{
  const members=[{id:'m1',name:'林阿姨',voiceId:'v1'}];
  assert.equal(pickNarrator({people:['小雨']},members).id,'m1');
});

test('pickNarrator：一个人都没复刻声音就返回 null——不能拿默认值冒充',()=>{
  assert.equal(pickNarrator(memory,[{id:'m1',name:'林阿姨',voiceId:null}]),null);
  assert.equal(pickNarrator(memory,[]),null);
  assert.equal(pickNarrator(memory,null),null);
});

test('pickNarrator：没有 people 时退回第一位可讲的',()=>{
  const members=[{id:'m1',name:'林阿姨',voiceId:'v1'},{id:'m2',name:'小雨',voiceId:'v2'}];
  assert.equal(pickNarrator({},members).id,'m1');
});

// ── 缓存键 ───────────────────────────────────────────────────

test('narrationKey：同一记忆同一讲述人稳定，改动记忆就变',()=>{
  const a=narrationKey('mem-1','m1','v1');
  assert.equal(a,narrationKey('mem-1','m1','v1'));
  assert.notEqual(a,narrationKey('mem-1','m1','v2'));
  assert.notEqual(a,narrationKey('mem-2','m1','v1'));
  assert.notEqual(a,narrationKey('mem-1','m2','v1'));
  assert.match(a,/^nar-[A-Za-z0-9_-]{32}$/);
});

test('videoKey：稿子/音色/分辨率/时长任一变化都要重生成',()=>{
  const base={memoryId:'mem-1',memberId:'m1',voiceId:'v1',script:'一段话',resolution:'480P',duration:5};
  const key=videoKey(base);
  assert.equal(key,videoKey({...base}));
  assert.notEqual(key,videoKey({...base,script:'另一段话'}));
  assert.notEqual(key,videoKey({...base,voiceId:'v2'}));
  assert.notEqual(key,videoKey({...base,resolution:'720P'}));
  assert.notEqual(key,videoKey({...base,duration:10}));
  assert.match(key,/^vid-[A-Za-z0-9_-]{32}$/);
});

// ── 提示词 ───────────────────────────────────────────────────

test('buildNarrationPrompt：原文与人物都带给模型，且截到 3000 字',()=>{
  const prompt=buildNarrationPrompt({...memory,story:'雪'.repeat(5000)},'林阿姨');
  assert.ok(prompt.includes('林阿姨'));
  assert.ok(prompt.includes('沈阳'));
  assert.ok(prompt.includes('小雨'));
  // story 被截到 3000，不该出现 5000 个雪
  assert.ok(!prompt.includes('雪'.repeat(3001)),'原文必须截断');
  assert.ok(prompt.includes('只许用这里给出的事实'));
});

test('buildVideoPrompt：只描述镜头运动，并锁死不许增减人物',()=>{
  const prompt=buildVideoPrompt(memory);
  assert.ok(prompt.includes('镜头缓慢向前推进'));
  assert.ok(prompt.includes('不要增加或减少任何人和物体'));
  // 不许把故事内容写进提示词，否则模型会开始编造画面
  assert.ok(!prompt.includes(memory.story),'不该把故事原文塞进视频提示词');
});

// ── 参数夹取 ─────────────────────────────────────────────────

test('clampResolution：只认白名单，其它一律回落默认',()=>{
  assert.equal(clampResolution('480P'),'480P');
  assert.equal(clampResolution('720p'),'720P');
  assert.equal(clampResolution('1080P'),VIDEO_DEFAULT_RESOLUTION);
  assert.equal(clampResolution(undefined),VIDEO_DEFAULT_RESOLUTION);
  assert.deepEqual(VIDEO_RESOLUTIONS,['480P','720P']);
});

test('clampSeconds：夹在上下限之间，非法值回落默认',()=>{
  assert.equal(clampSeconds(5),5);
  assert.equal(clampSeconds(1),VIDEO_MIN_SECONDS);
  assert.equal(clampSeconds(99),VIDEO_MAX_SECONDS);
  assert.equal(clampSeconds('abc'),VIDEO_DEFAULT_SECONDS);
  assert.equal(clampSeconds(null),VIDEO_DEFAULT_SECONDS);
});

test('图片上限存在且合理——base64 后会涨约 1.37 倍',()=>{
  assert.ok(MAX_IMAGE_BYTES>0);
  // 4MB 的图 base64 后约 5.5MB，仍在请求体可接受范围内
  assert.ok(MAX_IMAGE_BYTES<=6*1024*1024);
});
