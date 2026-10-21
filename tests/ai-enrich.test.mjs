import test from 'node:test';
import assert from 'node:assert/strict';

// 人生模拟的模型润色分支：本地 .env.local 没配模型，production 才会走这里。
// 用假的 fetch 覆盖 callModel，验证「模型只能改措辞，事实字段一律保留」。
process.env.AI_API_URL = 'https://example.invalid/v1/chat/completions';
process.env.AI_API_KEY = 'test-key';
process.env.AI_MODEL = 'test-model';

const {enrichScenes, aiReady} = await import('../lib/ai.mjs');
const {sceneFromMemory, promptForScene} = await import('../lib/game.mjs');

const scene = () => sceneFromMemory({
  id: 'm1', title: '那年去杭州', year: '1995', location: '杭州', theme: '旅行',
  people: ['妈妈', '小雨'], story: '我们坐火车去西湖，雨下了一整天。',
}, {name: '小雨'});

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = original; }
};

const reply = payload => async () => ({ok: true, status: 200, json: async () => ({choices: [{message: {content: payload}}]})});

test('模型润色只替换处境与选项措辞，事实字段原样保留', async () => {
  assert.equal(aiReady(), true);
  const local = [scene()];
  const payload = JSON.stringify({
    scenes: [{
      memoryTitle: '那年去杭州',
      situation: '火车就快开了，行李还摊在床上',
      choices: [{label: '先帮妈妈把东西收好'}, {label: '拉着箱子就往站台跑'}, {label: '说不去了，改天再走'}],
    }],
  });
  const result = await withFetch(reply('```json\n' + payload + '\n```'), () => enrichScenes(local, {name: '小雨'}, [], promptForScene));

  assert.equal(result.length, 1);
  const enriched = result[0];
  assert.equal(enriched.situation, '火车就快开了，行李还摊在床上');
  assert.equal(enriched.choices[0].label, '先帮妈妈把东西收好');
  assert.equal(enriched.choices.length, 3);
  // 事实不能被动到
  assert.equal(enriched.truth, local[0].truth);
  assert.equal(enriched.year, '1995');
  assert.equal(enriched.location, '杭州');
  assert.equal(enriched.memoryId, 'm1');
  assert.equal(enriched.narration, local[0].narration);
  // traits 是本地打分依据，不能丢
  assert.deepEqual(enriched.choices.map(c => c.traits), local[0].choices.map(c => c.traits));
  assert.deepEqual(enriched.choices.map(c => c.id), ['c0', 'c1', 'c2']);
});

test('模型返回坏 JSON / 缺字段 / 报错时返回 null，调用方回落本地场景', async () => {
  const local = [scene()];
  const run = impl => withFetch(impl, () => enrichScenes(local, {name: '小雨'}, [], promptForScene));

  assert.equal(await run(reply('这不是 JSON')), null);
  assert.equal(await run(reply(JSON.stringify({scenes: 'nope'}))), null);
  assert.equal(await run(reply(JSON.stringify({}))), null);
  assert.equal(await run(async () => ({ok: false, status: 500, json: async () => ({})})), null);
  assert.equal(await run(async () => { throw new Error('network down'); }), null);

  // 只给一个场景时，其余场景保持原样返回而不是丢失
  const partial = await run(reply(JSON.stringify({scenes: [{memoryTitle: '别的标题', situation: '一个处境', choices: [{label: 'A'}, {label: 'B'}]}]})));
  assert.equal(partial.length, 1);
  assert.equal(partial[0].situation, '一个处境');
  assert.equal(partial[0].truth, local[0].truth);
});

test('模型给出的超长文本被截断，避免灌进界面', async () => {
  const long = '很'.repeat(400);
  const result = await withFetch(
    reply(JSON.stringify({scenes: [{memoryTitle: '那年去杭州', situation: long, choices: [{label: long}, {label: 'B'}]}]})),
    () => enrichScenes([scene()], {name: '小雨'}, [], promptForScene),
  );
  assert.equal(result[0].situation.length, 160);
  assert.equal(result[0].choices[0].label.length, 80);
});
