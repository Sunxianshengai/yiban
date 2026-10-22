import test from 'node:test';
import assert from 'node:assert/strict';

// 人生推演的契约。
//
// 这一版的故事完全由模型现写，本地不再有模板，所以能被单测锁住的不是「文案」，
// 而是「边界」：属性怎么漂、什么时候收尾、什么绝不下发给前端、
// 以及玩家自己写的那句话不许被本地关键词假装判定。
import {
  STATS, STAT_META, MAX_STAGES, MAX_CHOICE_TEXT, MIN_STAT, MAX_STAT,
  startingStats, applyDeltas, axes, startRun, currentStage, recordChoice, deltasFromModel, publicRun,
} from '../lib/life.mjs';

const memory = {
  id: 'm1',
  title: '那年冬天全家搬回老家',
  year: '1998',
  location: '安徽无为',
  people: ['林阿姨', '小雨'],
  story: '1998年冬天，全家坐了一夜的火车回到老家，院子里的桂花树还在。',
  status: 'confirmed',
};

const stage = (index, ending = false) => ({
  index,
  narration: `第${index + 1}幕的处境`.repeat(3),
  choices: [
    {id: 'c0', label: '往前再走一步', hint: '不甘心', deltas: {勇气: 2}},
    {id: 'c1', label: '留下来把话说完', hint: '放不下', deltas: {牵挂: 2}},
    {id: 'c2', label: '什么也不做', hint: '先放着', deltas: {坦然: -1}},
  ],
  ending,
});

const runWith = (stages, extra = {}) => ({
  ...startRun({memory, subjectName: '林阿姨'}),
  id: 'run-1',
  stages,
  ...extra,
});

test('六个属性与界面元数据一一对应，颜色都落在既有色板上', () => {
  assert.deepEqual(STATS, ['牵挂', '勇气', '守候', '坦然', '胆识', '温情']);
  for (const key of STATS) {
    const meta = STAT_META[key];
    assert.ok(meta, `${key} 必须有元数据`);
    assert.equal(meta.label, key);
    assert.ok(meta.hint.length > 0, `${key} 必须有说明，界面靠它做 title`);
    assert.ok(['peach', 'gold', 'sage', 'lavender', 'blue'].includes(meta.color), `${key} 的颜色必须在色板上`);
  }
});

test('开局属性由起点记忆推出来，同一段记忆每次开局一致', () => {
  const first = startingStats(memory);
  const second = startingStats(memory);
  assert.deepEqual(first, second, '不随机：同一段记忆开局手感必须一样');
  assert.deepEqual(Object.keys(first).sort(), [...STATS].sort());
  // 「全家」「火车」「老家」会抬高牵挂/温情与勇气/胆识
  assert.ok(first.牵挂 > 4 && first.勇气 > 4);
  const plain = startingStats({title: '一个普通的下午', story: '什么也没发生。'});
  for (const key of STATS) assert.equal(plain[key], 4, '没有关键词时全取基准值');
});

test('属性漂移被夹在区间内，越界不会失控', () => {
  const high = applyDeltas(Object.fromEntries(STATS.map(k => [k, MAX_STAT])), {勇气: 5});
  assert.equal(high.勇气, MAX_STAT);
  const low = applyDeltas(Object.fromEntries(STATS.map(k => [k, MIN_STAT])), {勇气: -5});
  assert.equal(low.勇气, MIN_STAT);
  const untouched = applyDeltas({勇气: 7});
  assert.deepEqual(untouched, {勇气: 7}, 'deltas 里没有的键不许被顺手清零');
});

test('两条轴给出可读的倾向，而不是一个分数', () => {
  const out = axes({勇气: 9, 胆识: 8, 牵挂: 2, 守候: 2, 温情: 2});
  assert.equal(out.label, '往外走');
  const inward = axes({勇气: 2, 胆识: 2, 牵挂: 9, 守候: 8, 温情: 7});
  assert.equal(inward.label, '往里收');
  const middle = axes({勇气: 5, 胆识: 5, 牵挂: 5, 守候: 5, 温情: 5});
  assert.equal(middle.label, '停在中间');
  assert.ok(middle.balance >= 0 && middle.balance <= 100);
  assert.doesNotThrow(() => axes({}), '空属性不能把界面算崩');
});

test('没有起点记忆就不让开局', () => {
  assert.throws(() => startRun({memory: null}), /起点/);
});

test('起点事实照抄，超长文本被截断，不下发未确认字段', () => {
  const run = startRun({memory: {...memory, story: '很长'.repeat(2000)}, subjectName: '林阿姨'});
  assert.equal(run.origin.memoryId, 'm1');
  assert.equal(run.origin.year, '1998');
  assert.ok(run.origin.story.length <= 1200);
  assert.ok(run.origin.people.length <= 8);
  assert.equal(run.status, 'playing');
  assert.deepEqual(run.stages, []);
});

test('选择必须落在当前这一幕里，否则拒绝推进', () => {
  const run = runWith([stage(0)]);
  assert.throws(() => recordChoice(run, {choiceId: 'c9'}), /选项/);
  assert.throws(() => recordChoice(run, {}), /写一句/);
  const moved = recordChoice(run, {choiceId: 'c0'});
  assert.equal(moved.stageIndex, 1);
  assert.equal(moved.stages[0].answer.choiceId, 'c0');
  assert.deepEqual(moved.stats, applyDeltas(run.stats, {勇气: 2}));
});

test('自由输入只按模型的判定改属性，本地不猜关键词', () => {
  // 模型没给判定：一个字都不动。
  assert.deepEqual(deltasFromModel(undefined), {});
  assert.deepEqual(deltasFromModel({}), {});
  // 模型给了：只收六个合法键，单个夹到 ±3，最多三个。
  const judged = deltasFromModel({勇气: 2, 牵挂: -1, 未知键: 9, 守候: 0});
  assert.deepEqual(judged, {勇气: 2, 牵挂: -1});
  assert.deepEqual(deltasFromModel({勇气: 99}), {勇气: 3});
  const many = deltasFromModel({牵挂: 1, 勇气: 1, 守候: 1, 坦然: 1, 胆识: 1, 温情: 1});
  assert.equal(Object.keys(many).length, 3);

  // 走一遍：句子里的「回家」不许被本地当成「牵挂 +2」。
  const run = runWith([stage(0)]);
  const moved = recordChoice(run, {text: '我先回家看看，别的事往后放'});
  assert.equal(moved.stages[0].answer.freeText, '我先回家看看，别的事往后放');
  assert.deepEqual(moved.stages[0].answer.deltas, {}, '模型没判就不动属性');
  assert.deepEqual(moved.stats, run.stats);
});

test('自由输入超长时按上限截断', () => {
  const run = runWith([stage(0)]);
  const long = '如果'.repeat(500);
  const moved = recordChoice(run, {text: long});
  assert.equal(moved.stages[0].answer.freeText.length, MAX_CHOICE_TEXT);
});

test('什么时候收尾由模型决定，MAX_STAGES 只是安全阀', () => {
  // 模型说还没完，就继续——不按幕数硬砍。
  const open = recordChoice(runWith([stage(0)]), {choiceId: 'c1'});
  assert.equal(open.status, 'playing');
  // 模型说这是最后一幕，就收。
  const ended = recordChoice(runWith([stage(0, true)]), {choiceId: 'c1'});
  assert.equal(ended.status, 'finished');
  assert.ok(ended.finishedAt);
  // 安全阀：走到上限必须停，避免无限推演。
  const full = runWith(Array.from({length: MAX_STAGES}, (_, i) => stage(i)), {stageIndex: MAX_STAGES - 1});
  const capped = recordChoice(full, {choiceId: 'c0'});
  assert.equal(capped.status, 'finished');
});

test('已经结束的一局不能再推进', () => {
  const ended = recordChoice(runWith([stage(0, true)]), {choiceId: 'c1'});
  assert.equal(currentStage(ended), null);
  assert.throws(() => recordChoice(ended, {choiceId: 'c1'}), /结束/);
});

test('下发给前端时剥掉提示词与原始判定，中途不剧透结局', () => {
  const playing = publicRun(runWith([{...stage(0), freeDeltas: {勇气: 3}, prompt: '内部提示词'}]));
  const sent = playing.stages[0];
  assert.equal(sent.freeDeltas, undefined, 'freeDeltas 是内部判定，不下发');
  assert.equal(sent.prompt, undefined, '提示词不下发');
  assert.equal(playing.ending, null, '没走完就不给结局');
  assert.deepEqual(sent.choices.map(c => Object.keys(c).sort()), [['hint', 'id', 'label'], ['hint', 'id', 'label'], ['hint', 'id', 'label']], '选项只下发展示所需字段');

  const finished = publicRun(recordChoice(runWith([stage(0, true)]), {choiceId: 'c0'}));
  assert.equal(finished.status, 'finished');
  assert.ok(finished.ending, '走完必须给结局');
  assert.ok(finished.ending.text && finished.ending.disclaimer, '结局要带正文与免责说明');
});

test('界面的自由输入上限与常量一致', () => {
  // components/LifeSim.jsx 的 input maxLength 写死 200，这里锁住两边不再漂移。
  assert.equal(MAX_CHOICE_TEXT, 200);
});
