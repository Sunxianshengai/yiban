import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONAS, RELATIONS, MAX_NOTES, MAX_TEXT,
  retrieveMemories, memoryLine, sanitizeCompanion, openingLine,
  buildMessages, localNotes, personaById,
} from '../lib/companion.mjs';
import * as companionModule from '../lib/companion.mjs';
const localReplyExport = companionModule.localReply;

const memory = (patch = {}) => ({
  id: 'm1', title: '外婆家的灶台', year: '1998', location: '绍兴', theme: '老家',
  people: ['外婆', '小雨'], story: '灶台上一口大铁锅，外婆总是把锅巴留给我。',
  status: 'confirmed', ...patch,
});

test('检索只按关键词命中，不相干的记忆不会被顶上来说成「我记得」', () => {
  const hit = retrieveMemories([memory(), memory({ id: 'm2', title: '公司年会', story: '在酒店吃了顿饭', people: ['同事'], location: '上海', theme: '日常' })], '外婆家的灶台还记得吗');
  assert.equal(hit[0].id, 'm1');
  assert.ok(hit.every(m => m.id !== 'm2'));
  // 完全没有共同字眼时不该硬凑一条出来
  assert.deepEqual(retrieveMemories([memory()], '今天股票怎么样'), []);
});

test('直接叫出家人名字是最强信号', () => {
  const hit = retrieveMemories([
    memory({ id: 'a', title: '过年', story: '一起包饺子', people: ['陈叔叔'], location: '家里' }),
    memory({ id: 'b', title: '扫墓', story: '山上很安静', people: ['外婆'], location: '乡下' }),
  ], '陈叔叔今年还好吗', 1);
  assert.equal(hit[0].id, 'a');
});

test('memoryLine 只用原文事实，字段缺失不出现 undefined', () => {
  assert.match(memoryLine(memory()), /1998年/);
  assert.match(memoryLine(memory()), /在绍兴/);
  assert.match(memoryLine(memory()), /锅巴/);
  const bare = memoryLine(memory({ year: '', location: '', people: undefined, story: '' }));
  assert.doesNotMatch(bare, /undefined/);
  assert.match(bare, /外婆家的灶台/);
});

test('配置字段经过白名单收敛', () => {
  const config = sanitizeCompanion({ name: '  小忆  ', personaId: 'teasing', relation: '老朋友', color: 'red', evil: 'x' });
  assert.equal(config.name, '小忆');
  assert.equal(config.personaId, 'teasing');
  assert.equal(config.relation, '老朋友');
  assert.equal(config.voiceMemberId, null);
  assert.ok(!('evil' in config));
  // 非法值回落到默认，不抛错
  const fallback = sanitizeCompanion({ name: '', personaId: 'nope', relation: '外星人' });
  assert.equal(fallback.name, '家伴');
  assert.equal(fallback.personaId, PERSONAS[0].id);
  assert.equal(fallback.relation, '家里人');
  // 名字超长截断
  assert.equal(sanitizeCompanion({ name: 'x'.repeat(50) }).name.length, 20);
  // 第二次保存沿用上一次的值
  const kept = sanitizeCompanion({}, { name: '阿福', personaId: 'quiet', relation: '老伴', voiceMemberId: 'member-1' });
  assert.equal(kept.name, '阿福');
  assert.equal(kept.voiceMemberId, 'member-1');
  assert.equal(kept.color, personaById('quiet').color);
});

test('开场白有由头：纪念日优先，其次记忆，最后才是人设寒暄', () => {
  const anniversary = openingLine({}, { anniversaries: [{ title: '结婚纪念日', date: '06-18' }], memories: [memory()], today: new Date(2024, 5, 18) });
  assert.equal(anniversary.source, 'anniversary');
  assert.match(anniversary.text, /结婚纪念日/);

  const fromMemory = openingLine({}, { anniversaries: [], memories: [memory()], today: new Date(2024, 5, 19) });
  assert.equal(fromMemory.source, 'memory');
  assert.match(fromMemory.text, /1998年/);
  assert.match(fromMemory.text, /外婆家的灶台/);

  const persona = openingLine({ personaId: 'teasing' }, { memories: [], anniversaries: [] });
  assert.equal(persona.source, 'persona');
  assert.equal(persona.text, personaById('teasing').opener);
});

test('发给模型的消息里写死红线：不编造、不自伤挽留、承认是 AI', () => {
  const messages = buildMessages({ name: '阿福', personaId: 'steady', relation: '老朋友' }, {
    history: [{ role: 'user', text: '你好' }, { role: 'companion', text: '坐吧' }],
    text: '外婆家的灶台还在吗',
    memories: [memory()],
    notes: ['喜欢喝豆浆'],
  });
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  assert.match(system, /这个我还真不知道/);
  assert.match(system, /绝不编造/);
  assert.match(system, /心理援助热线/);
  assert.match(system, /被问到你是不是 AI/);
  assert.match(system, /喜欢喝豆浆/);
  assert.match(system, /外婆家的灶台/);
  // 角色映射：内部 companion → 模型侧 assistant
  assert.deepEqual(messages.filter(m => m.role !== 'system').map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(messages.at(-1).content, '外婆家的灶台还在吗');
});

test('历史只带最近 12 条，其余靠 notes 承载', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'companion' : 'user', text: `第${i}句` }));
  const messages = buildMessages({}, { history, text: '现在' });
  const dialogue = messages.filter(m => m.role !== 'system');
  assert.equal(dialogue.length, 13);
  assert.equal(dialogue[0].content, '第18句');
});

test('不再有本地回话：模块里没有模板应答的出口', () => {
  // 对话交给模型，本地一句话都不预备。导出面里出现任何 reply 生成器都算退回去了。
  assert.equal(localReplyExport, undefined, 'companion.mjs 不该再导出 localReply');
});

test('系统提示词要求危机时给出家里人 + 热线 12356', () => {
  const system = buildMessages({}, { text: '我真的不想活了' })[0].content;
  assert.match(system, /12356/);
  assert.match(system, /家里/);
});

test('记事本只收用户说过的短句，去重并限长', () => {
  const messages = [
    { role: 'user', text: '我喜欢喝豆浆' },
    { role: 'companion', text: '我记得了' },
    { role: 'user', text: '我喜欢喝豆浆' },
    { role: 'user', text: '这'.repeat(80) },
    { role: 'user', text: '周末常去公园' },
  ];
  const notes = localNotes(messages, ['原来爱吃甜的']);
  assert.deepEqual(notes.slice(0, 2), ['原来爱吃甜的', '我喜欢喝豆浆']);
  assert.ok(notes.includes('周末常去公园'));
  assert.ok(notes.every(n => n.length <= 40));
  assert.equal(notes.length <= MAX_NOTES, true);
  // 已有记事本不会被覆盖掉
  assert.ok(localNotes([], ['旧的']).includes('旧的'));
});

test('常量的口径与 UI 文案一致', () => {
  assert.equal(MAX_TEXT, 500);
  assert.equal(MAX_NOTES, 12);
  assert.ok(PERSONAS.length >= 5);
  assert.ok(PERSONAS.every(p => p.id && p.name && p.opener && p.color));
  assert.ok(RELATIONS.includes('老伴'));
  assert.equal(personaById('不存在'), PERSONAS[0]);
});
