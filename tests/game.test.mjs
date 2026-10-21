import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAITS,sceneFromMemory,publicGame,buildGame,currentScene,advance,summarize,promptForScene} from '../lib/game.mjs';

const memory = (patch = {}) => ({
  id: 'm1', title: '那年去杭州', year: '1995', location: '杭州', theme: '旅行',
  people: ['妈妈', '小雨'], story: '我们坐火车去西湖，雨下了一整天。', status: 'confirmed', ...patch,
});

test('场景只用记忆里已有的事实，不编造', () => {
  const scene = sceneFromMemory(memory(), {name: '小雨'});
  assert.equal(scene.memoryId, 'm1');
  assert.equal(scene.when, '1995 年');
  assert.match(scene.narration, /我们坐火车去西湖/);
  assert.match(scene.narration, /在杭州/);
  assert.match(scene.narration, /身边有 妈妈、小雨/);
  assert.equal(scene.choices.length, 3);
  assert.equal(scene.choices[0].id, 'c0');
  assert.equal(scene.allowFreeText, true);
  // 没有年份/地点的记忆也要能成场景，不能出现 "undefined 年"
  const bare = sceneFromMemory(memory({year: '', location: '', people: undefined}), {name: '小雨'});
  assert.equal(bare.when, '有一年');
  assert.doesNotMatch(bare.narration, /undefined/);
});

test('未知主题回落到日常处境，不会崩', () => {
  const scene = sceneFromMemory(memory({theme: '太空'}), {name: '小雨'});
  assert.equal(scene.choices.length, 3);
  assert.ok(scene.situation.length > 0);
});

test('发给前端的场景不含 truth，不提前剧透', () => {
  const game = buildGame({memories: [memory()], subject: {id: 'x', name: '小雨'}, user: {name: '小雨'}});
  const safe = publicGame(game);
  assert.ok(safe.scenes.every(scene => !('truth' in scene)));
  // 原始对象仍保留 truth，供服务端回扣事实
  assert.ok(game.scenes.every(scene => typeof scene.truth === 'string'));
});

test('没有已确认记忆时拒绝开局', () => {
  assert.throws(() => buildGame({memories: [], subject: {name: '小雨'}}), /还没有可用的已确认记忆/);
});

test('一局最多七段记忆，逐回合推进到结束', () => {
  const memories = Array.from({length: 10}, (_, i) => memory({id: `m${i}`, title: `第 ${i} 段`}));
  let game = buildGame({memories, subject: {id: null, name: '小雨'}, user: {name: '小雨'}});
  assert.equal(game.scenes.length, 7);
  assert.equal(game.status, 'playing');
  assert.equal(currentScene(game).memoryId, 'm0');

  for (let i = 0; i < 7; i += 1) {
    const scene = currentScene(game);
    game = advance(game, {choiceId: scene.choices[0].id});
    assert.equal(game.answers.length, i + 1);
    assert.equal(game.answers[i].memoryId, scene.memoryId);
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.sceneIndex, 7);
  assert.ok(game.summary);
  assert.equal(game.summary.total, 7);
  assert.equal(currentScene(game), null);
  // 结束后再推进不抛错，也不改变结果
  assert.equal(advance(game, {choiceId: 'c0'}).status, 'finished');
});

test('选项必须属于当前场景，自由输入不能为空', () => {
  const game = buildGame({memories: [memory()], subject: {name: '小雨'}});
  assert.throws(() => advance(game, {choiceId: 'nope'}), /这个选项不在当前场景里/);
  assert.throws(() => advance(game, {text: '   '}), /写一句你在这个路口会怎么做/);
});

test('自由输入按关键词归属倾向，超长文本截断', () => {
  const game = buildGame({memories: [memory()], subject: {name: '小雨'}});
  const cared = advance(game, {text: '我还是先回家看看我妈'});
  assert.ok(cared.answers[0].traits['牵挂'] > 0);
  assert.equal(cared.answers[0].freeText, '我还是先回家看看我妈');

  const long = advance(game, {text: '家'.repeat(500)});
  assert.equal(long.answers[0].freeText.length, 300);

  const unknown = advance(game, {text: '嗯'});
  assert.deepEqual(unknown.answers[0].traits, {坦然: 2});
});

test('小结只统计倾向，并明确区分想象与事实', () => {
  const scenes = [sceneFromMemory(memory(), {name: '小雨'})];
  const summary = summarize(scenes, [{traits: {牵挂: 3}}, {traits: {牵挂: 2, 勇气: 1}}], {name: '小雨'});
  assert.equal(summary.total, 2);
  assert.equal(summary.dominant, '牵挂');
  assert.equal(summary.ranked[0].trait, '牵挂');
  assert.equal(summary.ranked[0].value, 5);
  assert.deepEqual(summary.ranked.map(r => r.trait).sort(), [...TRAITS].sort());
  assert.match(summary.text, /它不是小雨的真实答案/);
  assert.equal(summarize(scenes, [], {name: '小雨'}).text, '还没有做出选择。');
});

test('模型提示词把事实与评价都框死', () => {
  const scenes = [sceneFromMemory(memory(), {name: '小雨'})];
  const [system, user] = promptForScene(scenes, {name: '小雨'}, [{label: '先把饭做完'}]);
  assert.match(system.content, /不得新增家人、地名、年份、事件/);
  assert.match(system.content, /不得评价哪种选择更好/);
  assert.match(user.content, /小雨/);
  assert.match(user.content, /我们坐火车去西湖/);
  assert.match(user.content, /先把饭做完/);
});
