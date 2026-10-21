import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,CONCERNS,TONES,KINDS,sanitizeRole,rolesByConcern,rolesByKind,roleOpening,buildRoleMessages,roleById} from '../lib/roles.mjs';

test('角色库：三十个角色、身份原型不绑定真人', () => {
  assert.ok(ROLES.length >= 20, `角色太少：${ROLES.length}`);
  const ids = ROLES.map(role => role.id);
  assert.equal(new Set(ids).size, ids.length, '角色 id 不能重复');
  for (const role of ROLES) {
    assert.ok(role.name && role.blurb, `${role.id} 缺少名字或介绍`);
    assert.ok(role.concerns.length > 0, `${role.id} 没有归属任何困惑分类`);
    assert.ok(TONES.some(tone => tone.id === role.defaultTone), `${role.id} 的默认语气不在 TONES 里`);
    assert.ok(KINDS.some(kind => kind.id === role.kind), `${role.id} 的来源分类不合法`);
    // lines 现在只剩开场白：回话全部由模型现写，不再有预置台词。
    assert.ok(Array.isArray(role.lines.greet) && role.lines.greet.length > 0, `${role.id} 缺开场白`);
    for (const key of Object.keys(role.lines)) {
      assert.equal(key, 'greet', `${role.id} 还留着预置对白 lines.${key}，本地回话已经去掉了`);
    }
  }
  assert.equal(CONCERNS.length, 5);
  assert.equal(KINDS.length, 3);
});

test('角色卡不写预置对白：整套库里没有情绪分支话术', () => {
  for (const role of ROLES) {
    for (const key of ['tired', 'sad', 'stuck', 'misunderstood', 'memory', 'unknown', 'default']) {
      assert.equal(role.lines[key], undefined, `${role.id} 仍然带着 lines.${key}`);
    }
  }
});

test('sanitizeRole：非法值回落到安全默认，名字是称呼不是身份', () => {
  const fresh = sanitizeRole();
  assert.equal(fresh.roleId, ROLES[0].id);
  assert.equal(fresh.toneId, ROLES[0].defaultTone);
  assert.equal(fresh.name, ROLES[0].name);
  // 记忆默认不借用
  assert.equal(fresh.useMemories, false);

  const bad = sanitizeRole({roleId: '不存在的角色', toneId: '不存在的语气'});
  assert.equal(bad.roleId, ROLES[0].id);
  assert.equal(bad.toneId, ROLES[0].defaultTone);

  const named = sanitizeRole({roleId: 'mother', name: '我妈'});
  assert.equal(named.name, '我妈');
  assert.equal(named.toneId, 'warm', '换角色时语气应跟着走默认值');

  const trimmed = sanitizeRole({name: '  这个名字特别特别特别长没人记得住  '});
  assert.ok(trimmed.name.length <= 12);

  // 保留上一轮的设定：只改语气不该把名字清掉
  const kept = sanitizeRole({toneId: 'plain'}, {roleId: 'father', name: '老爸', useMemories: true});
  assert.equal(kept.roleId, 'father');
  assert.equal(kept.name, '老爸');
  assert.equal(kept.useMemories, true);
});

test('rolesByConcern / rolesByKind：按困惑和按来源选人', () => {
  const family = rolesByConcern('family');
  assert.ok(family.length >= 2);
  assert.ok(family.every(role => role.concerns.includes('family')));
  assert.equal(rolesByConcern().length, ROLES.length);
  assert.equal(rolesByConcern('不存在的分类').length, 0);

  for (const kind of KINDS) {
    const list = rolesByKind(kind.id);
    assert.ok(list.length >= 3, `${kind.id} 只有 ${list.length} 个人`);
    assert.ok(list.every(role => role.kind === kind.id));
  }
  assert.equal(rolesByKind().length, ROLES.length);
});

test('roleOpening：角色自己先开口', () => {
  for (const role of ROLES) {
    const opening = roleOpening(role);
    assert.equal(opening.text, role.lines.greet[0]);
    assert.equal(opening.source, 'role');
  }
});

test('roleById：未知 id 回落第一个角色，不抛错', () => {
  assert.equal(roleById('sushi').id, 'sushi');
  assert.equal(roleById('不存在的角色').id, ROLES[0].id);
});

test('buildRoleMessages：不借用记忆时明确告诉模型别装懂', () => {
  const off = buildRoleMessages({roleId: 'brother', toneId: 'fun', name: '哥'}, {text: '我该不该跳槽'});
  const system = off[0];
  assert.equal(system.role, 'system');
  assert.match(system.content, /不是他真实的家人/, '必须声明这是原型不是真人');
  assert.match(system.content, /12356/);
  assert.match(system.content, /别假装知道/);
  assert.ok(!off.some(item => item.content.includes('他家里的事')));
});

test('buildRoleMessages：打开记忆才喂记忆块，行首标记可辨识', () => {
  const memories = [{id: 'm1', title: '西湖', year: 2015, location: '杭州', story: '一家人去了西湖。'}];
  const on = buildRoleMessages({roleId: 'mother', useMemories: true}, {text: '还记得那次旅行吗', memories});
  // 主提示词第 7 条里也有「他家里的事」这个说法，所以按记忆块的行首认。
  const memoryBlock = on.find(item => item.role === 'system' && item.content.startsWith('他家里的事：'));
  assert.ok(memoryBlock, '打开记忆后应该有记忆块');
  assert.match(memoryBlock.content, /西湖/);
});

test('buildRoleMessages：书里与史书里的人多一条「不编史实、不伪造名言」', () => {
  for (const role of ROLES.filter(item => item.kind !== 'life')) {
    const messages = buildRoleMessages({roleId: role.id}, {text: '你当年是怎么想的'});
    const system = messages[0].content;
    assert.match(system, /不.*伪造名言|伪造名言/, `${role.id} 缺少不许伪造名言的约束`);
    assert.match(system, /不细说|不要引经据典/, `${role.id} 缺少「这些我不细说」的退路`);
  }
  // 身边的人不该被这条约束框住，否则说话会变得像在背稿。
  const life = buildRoleMessages({roleId: 'mother'}, {text: '今天想吃什么'});
  assert.ok(!/伪造名言/.test(life[0].content));
});

test('buildRoleMessages：历史只带最近 12 条，且角色方映射成 assistant', () => {
  const history = Array.from({length: 20}, (_, index) => ({role: index % 2 ? 'role' : 'user', text: `第${index}句`}));
  const messages = buildRoleMessages({roleId: 'mentor'}, {history, text: '现在这句'});
  const dialog = messages.filter(item => item.role !== 'system');
  assert.equal(dialog.length, 13);
  assert.equal(dialog.at(-2).content, '第19句');
  assert.equal(dialog.at(-1).content, '现在这句');
  assert.equal(dialog.at(-2).role, 'assistant', '存的是 role，发给模型要还原成 assistant');
});
