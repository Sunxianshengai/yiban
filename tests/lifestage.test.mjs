import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,stageOfAge,ageAtYear,stageAtYear,MILESTONES,INTERVIEW,GROWTH_QUESTIONS,buildTimeline,buildParallel,milestoneProgress,sanitizeQuote,sanitizeCapsule,sanitizeBirthYear,capsuleState} from '../lib/lifestage.mjs';

test('七段人生阶段首尾相接且覆盖 0-200 岁', () => {
  assert.equal(STAGES.length, 7);
  for (let i = 1; i < STAGES.length; i++) assert.equal(STAGES[i].from, STAGES[i-1].to + 1);
  assert.equal(STAGES[0].from, 0);
  assert.ok(STAGES[STAGES.length-1].to >= 130);
});

test('年龄归段：边界年龄归在正确的段，超龄不越界', () => {
  assert.equal(stageOfAge(0).id, 'infancy');
  assert.equal(stageOfAge(6).id, 'infancy');
  assert.equal(stageOfAge(7).id, 'childhood');
  assert.equal(stageOfAge(13).id, 'teen');
  assert.equal(stageOfAge(19).id, 'youth');
  assert.equal(stageOfAge(31).id, 'prime');
  assert.equal(stageOfAge(51).id, 'midadult');
  assert.equal(stageOfAge(66).id, 'elder');
  assert.equal(stageOfAge(120).id, 'elder');
  assert.equal(stageOfAge(-1), null);
  assert.equal(stageOfAge('abc'), null);
});

test('年份转年龄：出生前或超出寿命的年份不猜', () => {
  assert.equal(ageAtYear(1990, 2020), 30);
  assert.equal(ageAtYear(1990, 1990), 0);
  assert.equal(ageAtYear(1990, 1989), null, '记忆年份早于出生年，不猜');
  assert.equal(ageAtYear(1990, 2200), null);
  assert.equal(ageAtYear(null, 2020), null);
  assert.equal(stageAtYear(1990, 1995).id, 'infancy');
  assert.equal(stageAtYear(1990, 2020).id, 'youth');
});

test('里程碑清单：key 唯一，且每段都有对应节点', () => {
  const keys = MILESTONES.map(m => m.key);
  assert.equal(new Set(keys).size, keys.length, 'key 必须唯一，否则勾选会串');
  const stageIds = new Set(STAGES.map(s => s.id));
  for (const m of MILESTONES) assert.ok(stageIds.has(m.stage), `${m.key} 的 stage 必须是七段之一`);
  assert.ok(MILESTONES.some(m => m.label.includes('金榜题名')), '中国家庭特有的节点要保留');
});

test('成长时间轴：按年份升序，算出年龄与阶段，并标出还缺哪几段', () => {
  const member = {id: 'm1', name: '小雨', birthYear: 1990};
  const memories = [
    {id: 'a', status: 'confirmed', year: '2000', title: '十岁那年', theme: '童年', cover: null},
    {id: 'b', status: 'confirmed', year: '1995', title: '五岁', theme: '家人', cover: null},
    {id: 'c', status: 'draft', year: '2010', title: '待确认的不算', theme: '日常', cover: null},
    {id: 'd', status: 'confirmed', year: '', title: '没年份的不算', theme: '日常', cover: null},
  ];
  const tl = buildTimeline(member, memories);
  assert.deepEqual(tl.items.map(x => x.memoryId), ['b', 'a']);
  assert.equal(tl.items[0].age, 5);
  assert.equal(tl.items[0].stage, 'infancy');
  assert.equal(tl.items[1].age, 10);
  assert.equal(tl.items[1].stage, 'childhood');
  assert.deepEqual(tl.coveredStages, ['infancy', 'childhood']);
  assert.ok(tl.missingStages.includes('elder'));
});

test('没有出生年也能排出时间轴，只是没有年龄', () => {
  const tl = buildTimeline({id: 'm2', name: '林阿姨'}, [{id: 'x', status: 'confirmed', year: '1988', title: '那年', theme: '老家', cover: null}]);
  assert.equal(tl.items.length, 1);
  assert.equal(tl.items[0].age, null);
  assert.equal(tl.items[0].stage, null);
});

test('家庭平行时间轴：同一年横排每个成员，早于出生的不出现', () => {
  const members = [
    {id: 'm1', name: '爸爸', birthYear: 1970, relation: '丈夫'},
    {id: 'm2', name: '小雨', birthYear: 2000, relation: '女儿'},
  ];
  const memories = [{id: 'p', status: 'confirmed', year: '2010', people: ['爸爸'], subjectId: 'm1', title: '下岗那年', cover: null}];
  const result = buildParallel(members, memories, 2010);
  assert.deepEqual(result.rows.map(r => r.name), ['爸爸', '小雨'], '按年龄从大到小排，符合「那年爸爸 40、小雨 10」的读法');
  assert.equal(result.rows[0].age, 40);
  assert.equal(result.rows[0].stage, 'prime');
  assert.equal(result.rows[0].memories.length, 1);
  assert.equal(result.rows[1].age, 10);
  assert.equal(result.rows[1].memories.length, 0);
  const tooEarly = buildParallel([{id: 'm2', name: '小雨', birthYear: 2000}], [], 1990);
  assert.equal(tooEarly.rows.length, 0, '人还没出生就不该出现');
});

test('里程碑完成度能算出还剩几个', () => {
  const p = milestoneProgress(['gaokao', 'first-job']);
  assert.equal(p.done, 2);
  assert.equal(p.total, MILESTONES.length);
  assert.ok(p.list.find(m => m.key === 'gaokao').done);
  assert.ok(!p.list.find(m => m.key === 'marriage').done);
});

test('童言童语：空话被拒，内容按长度截断', () => {
  assert.throws(() => sanitizeQuote({text: '   '}), /先记下这句话/);
  const q = sanitizeQuote({text: '妈妈是世界上最好看的人', memberId: 'm2', age: 5});
  assert.equal(q.text, '妈妈是世界上最好看的人');
  assert.equal(q.age, 5);
  assert.match(q.year, /^\d{4}$/);
  assert.equal(sanitizeQuote({text: 'x'.repeat(500)}).text.length, 300);
});

test('时间胶囊：必须有收信人和合法开启日期', () => {
  assert.throws(() => sanitizeCapsule({text: '', targetMemberId: 'm2', openAt: '2030-01-01'}), /写一句/);
  assert.throws(() => sanitizeCapsule({text: '给十年后的你', targetMemberId: '', openAt: '2030-01-01'}), /选一位/);
  assert.throws(() => sanitizeCapsule({text: '给十年后的你', targetMemberId: 'm2', openAt: '2030/01/01'}), /开启日期/);
  const c = sanitizeCapsule({text: '给十年后的你', targetMemberId: 'm2', openAt: '2030-01-01', title: '给小雨'});
  assert.equal(c.title, '给小雨');
  assert.equal(capsuleState(c, new Date('2029-01-01')).locked, true);
  assert.ok(capsuleState(c, new Date('2029-01-01')).daysLeft > 300);
  assert.equal(capsuleState(c, new Date('2031-01-01')).locked, false);
});

test('分龄采访与成长对比问题覆盖每一段', () => {
  for (const s of STAGES) assert.ok(Array.isArray(INTERVIEW[s.id]) && INTERVIEW[s.id].length >= 3, `${s.id} 至少要三个问题`);
  assert.ok(GROWTH_QUESTIONS.length >= 5);
  assert.equal(new Set(GROWTH_QUESTIONS.map(q => q.key)).size, GROWTH_QUESTIONS.length);
});

test('出生年份：只认 19xx/20xx，其余一律当成「没填」', () => {
  assert.equal(sanitizeBirthYear('1990'), '1990');
  assert.equal(sanitizeBirthYear(1990), '1990');
  assert.equal(sanitizeBirthYear(' 2001 '), '2001');
  assert.equal(sanitizeBirthYear('1865'), '', '1865 不可能是出生年，回落到空而不是报错');
  assert.equal(sanitizeBirthYear('199'), '', '位数不对就是没填');
  assert.equal(sanitizeBirthYear('19900'), '', '五位不是年份');
  assert.equal(sanitizeBirthYear(''), '');
  assert.equal(sanitizeBirthYear(null), '');
  assert.equal(sanitizeBirthYear(undefined), '');
  assert.equal(sanitizeBirthYear('某年'), '');
  assert.equal(sanitizeBirthYear('1990年'), '', '带「年」字的是记忆的年份写法，不是出生年字段');
});
