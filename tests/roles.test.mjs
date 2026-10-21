import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,CONCERNS,TONES,sanitizeRole,rolesByConcern,roleOpening,intentOf,localRoleReply,buildRoleMessages,roleById} from '../lib/roles.mjs';

test('角色库：十几个角色、身份原型不绑定真人', () => {
  assert.ok(ROLES.length >= 10, `角色太少：${ROLES.length}`);
  const ids = ROLES.map(role => role.id);
  assert.equal(new Set(ids).size, ids.length, '角色 id 不能重复');
  for (const role of ROLES) {
    assert.ok(role.name && role.blurb, `${role.id} 缺少名字或介绍`);
    assert.ok(role.concerns.length > 0, `${role.id} 没有归属任何困惑分类`);
    assert.ok(TONES.some(tone => tone.id === role.defaultTone), `${role.id} 的默认语气不在 TONES 里`);
    // 每张卡都要覆盖所有会用到的话术分支，否则某些心情会没有回应。
    for (const key of ['greet','tired','sad','stuck','memory','unknown','default']) {
      assert.ok(Array.isArray(role.lines[key]) && role.lines[key].length > 0, `${role.id} 缺 lines.${key}`);
    }
  }
  assert.equal(CONCERNS.length, 5);
});

test('sanitizeRole：非法值回落到安全默认，名字是称呼不是身份', () => {
  const fresh = sanitizeRole();
  assert.equal(fresh.roleId, ROLES[0].id);
  assert.equal(fresh.toneId, ROLES[0].defaultTone);
  assert.equal(fresh.name, ROLES[0].name);
  // 记忆默认不借用
  assert.equal(fresh.useMemories, false);

  const bad = sanitizeRole({roleId:'不存在的角色',toneId:'不存在的语气'});
  assert.equal(bad.roleId, ROLES[0].id);
  assert.equal(bad.toneId, ROLES[0].defaultTone);

  const named = sanitizeRole({roleId:'mother',name:'我妈'});
  assert.equal(named.name, '我妈');
  assert.equal(named.toneId, 'warm', '换角色时语气应跟着走默认值');

  const trimmed = sanitizeRole({name:'  这个名字特别特别特别长没人记得住  '});
  assert.ok(trimmed.name.length <= 12);

  // 保留上一轮的设定：只改语气不该把名字清掉
  const kept = sanitizeRole({toneId:'plain'}, {roleId:'father',name:'老爸',useMemories:true});
  assert.equal(kept.roleId, 'father');
  assert.equal(kept.name, '老爸');
  assert.equal(kept.useMemories, true);
});

test('rolesByConcern：按困惑选人', () => {
  const family = rolesByConcern('family');
  assert.ok(family.length >= 2);
  assert.ok(family.every(role => role.concerns.includes('family')));
  assert.equal(rolesByConcern().length, ROLES.length);
  assert.equal(rolesByConcern('不存在的分类').length, 0);
});

test('roleOpening：角色自己先开口', () => {
  for (const role of ROLES) {
    const opening = roleOpening(role);
    assert.equal(opening.text, role.lines.greet[0]);
    assert.equal(opening.source, 'role');
  }
});

test('intentOf：分得出累/难过/纠结/问句', () => {
  assert.equal(intentOf('今天好累'), 'tired');
  assert.equal(intentOf('我有点难受'), 'sad');
  assert.equal(intentOf('我不知道该不该辞职'), 'stuck');
  assert.equal(intentOf('你好'), 'greet');
  assert.equal(intentOf('明天会下雨吗'), 'unknown');
  assert.equal(intentOf(''), 'default');
});

test('intentOf：被最亲近的人否定，不能被「累」抢走', () => {
  // 这句话里既有「努力」也有委屈，落到 default 会得到一句「嗯，我听着呢」——敷衍得伤人。
  assert.equal(intentOf('我妈总说我不懂事，可我也很努力了'), 'misunderstood');
  assert.equal(intentOf('他们都不理解我'), 'misunderstood');
  assert.equal(intentOf('没人懂我'), 'misunderstood');
});

test('每个角色都接得住「被否定」这类话，且各说各的', () => {
  const texts = ROLES.map(role => localRoleReply({roleId:role.id,toneId:role.defaultTone}, {text:'我妈总说我不懂事，可我也很努力了'}).text);
  for (const text of texts) {
    assert.ok(!/^嗯/.test(text.trim()), `有人回了句敷衍的「嗯」：${text}`);
  }
  assert.ok(new Set(texts).size >= ROLES.length - 1, `回话重复太多，只有 ${new Set(texts).size} 种`);
});

test('危机优先：任何角色都先接住，再给热线', () => {
  for (const role of ROLES) {
    const reply = localRoleReply({roleId:role.id}, {text:'我不想活了'});
    assert.match(reply.text, /12356/, `${role.id} 没有给出求助热线`);
    assert.equal(reply.mode, 'local');
    assert.deepEqual(reply.memoryIds, []);
  }
});

test('同一句话，不同角色说出来的不一样', () => {
  const seen = new Set();
  for (const role of ROLES) {
    const reply = localRoleReply({roleId:role.id,toneId:role.defaultTone}, {text:'今天好累'});
    seen.add(reply.text);
  }
  // 这是这个功能成立的前提：如果十二个角色回同一句，换角色就没有意义。
  assert.ok(seen.size >= ROLES.length - 2, `只有 ${seen.size} 种不同回话，角色差异不够`);
});

test('同一句话，换个语气也不一样', () => {
  const texts = TONES.map(tone => localRoleReply({roleId:'mother',toneId:tone.id}, {text:'今天好累'}).text);
  assert.ok(new Set(texts).size >= 4, `只有 ${new Set(texts).size} 种语气变化`);
});

test('同一句话问两遍会换一句，但仍在这个角色的池子里', () => {
  const role = roleById('father');
  // 挑字数不同、但都归到「纠结」的两句，看长度取模能不能换到另一条。
  const a = localRoleReply({roleId:'father'}, {text:'我该怎么办呢'});
  const b = localRoleReply({roleId:'father'}, {text:'我该怎么办才好'});
  assert.notEqual(a.text, b.text, '不同长度应该挑到不同的话');
  assert.ok(role.lines.stuck.some(line => a.text.startsWith(line.slice(0, 8))));
});

test('记忆默认不借用；主动打开才提旧事', () => {
  const memories = [{id:'m1',title:'老院子里的桂花香',year:1988,location:'苏州',story:'那年秋天，院子里的桂花开了。'}];
  const off = localRoleReply({roleId:'grandma',useMemories:false}, {text:'今天好累',memories});
  assert.ok(!off.text.includes('桂花'), '没打开记忆却提到了旧事');
  assert.deepEqual(off.memoryIds, []);

  const on = localRoleReply({roleId:'grandma',useMemories:true}, {text:'今天好累',memories});
  assert.match(on.text, /桂花/);
  assert.match(on.text, /1988年/);
  assert.deepEqual(on.memoryIds, ['m1']);
});

test('buildRoleMessages：不借用记忆时明确告诉模型别装懂', () => {
  const off = buildRoleMessages({roleId:'brother',toneId:'fun',name:'哥'}, {text:'我该不该跳槽'});
  const system = off[0];
  assert.equal(system.role, 'system');
  assert.match(system.content, /不是他真实的家人/, '必须声明这是原型不是真人');
  assert.match(system.content, /12356/);
  assert.match(system.content, /别假装知道/);
  assert.ok(!off.some(item => item.content.includes('他家里的事')));

  const memories = [{id:'m1',title:'西湖',year:2015,location:'杭州',story:'一家人去了西湖。'}];
  const on = buildRoleMessages({roleId:'mother',useMemories:true}, {text:'还记得那次旅行吗',memories});
  // 注意：主提示词第 7 条里也有「他家里的事」这个说法，所以按记忆块的行首「· 」认。
  const memoryBlock = on.find(item => item.role === 'system' && item.content.startsWith('他家里的事：'));
  assert.ok(memoryBlock, '打开记忆后应该有记忆块');
  assert.match(memoryBlock.content, /西湖/);
});

test('buildRoleMessages：历史只带最近 12 条，且角色方映射成 assistant', () => {
  const history = Array.from({length:20}, (_,index) => ({role:index % 2 ? 'assistant' : 'user', text:`第${index}句`}));
  const messages = buildRoleMessages({roleId:'mentor'}, {history,text:'现在这句'});
  const dialog = messages.filter(item => item.role !== 'system');
  assert.equal(dialog.length, 13);
  assert.equal(dialog.at(-2).content, '第19句');
  assert.equal(dialog.at(-1).content, '现在这句');
  assert.equal(dialog.at(-2).role, 'assistant');
});
