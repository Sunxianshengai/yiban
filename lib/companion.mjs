// 陪伴机器人（忆伴 · 家伴）
//
// 与 Lovia / 幽光 / 幻聊 最大的区别：那些产品先捏一个虚构角色，再往里面灌设定；
// 忆伴的家伴是**从这家的记忆库里长出来的**——它认识的是这一家人真实发生过的事，
// 所以它的「记得」不是模型幻觉，而是每轮从 confirmed 记忆里检索出来的原文。
//
// 三条红线（写死在这里，路由与 UI 都不要绕过）：
//   1. 只认 status==='confirmed' 的记忆。草稿不进对话。
//   2. 记忆之外的家庭事实一律说不知道。聊天记录与「记得的事」都不是事实来源。
//   3. 不做医疗/法律/投资判断，不挽留有自伤念头的人——转介给家人与专业求助。
//
// 回话全部由模型生成，这里不写预置对白：模板话会让人以为机器在敷衍他。
// 未配置模型时接口直接报错并说明缺什么，不拿假话顶上。

export const PERSONAS = [
  { id: 'gentle', name: '温柔的倾听者', tone: '温柔', color: 'peach', blurb: '说话轻，先接住情绪，再慢慢问下去。', opener: '我在呢，慢慢说。' },
  { id: 'teasing', name: '爱打岔的老朋友', tone: '俏皮', color: 'gold', blurb: '嘴上不饶人，但每句都在关心你。', opener: '哟，今天怎么想起我了？' },
  { id: 'steady', name: '稳重的家里人', tone: '沉稳', color: 'sage', blurb: '不煽情，讲道理，记得住正经事。', opener: '坐吧，想说点什么？' },
  { id: 'curious', name: '好奇的小孩', tone: '好奇', color: 'lavender', blurb: '什么都想问一句「后来呢」。', opener: '后来呢？我想听！' },
  { id: 'quiet', name: '安静的陪伴者', tone: '安静', color: 'blue', blurb: '话少，但从不缺席。', opener: '嗯，我在。' },
];

export const RELATIONS = ['女儿', '儿子', '老伴', '老朋友', '邻居家的孩子', '一只猫', '家里人'];

export const MAX_MESSAGES = 60; // 一次对话保留的条数，超出的折叠进 notes
export const MAX_NOTES = 12;
export const MAX_TEXT = 500;

const personaOf = id => PERSONAS.find(p => p.id === id) || PERSONAS[0];

// 中文没有空格分词，用 2-gram / 3-gram 做轻量匹配。3-gram 权重更高，
// 避免「的」「了」这类高频二字组合把不相干的记忆顶上来。
function grams(text, n) {
  const clean = String(text || '').replace(/[\s\p{P}\p{S}]/gu, '').slice(0, 80);
  const out = [];
  for (let i = 0; i + n <= clean.length; i++) out.push(clean.slice(i, i + n));
  return out;
}

/**
 * 从已确认的记忆里找出与这句话最相关的几条。
 * 只读，不写库；调用方负责先过滤掉 draft。
 */
export function retrieveMemories(memories, query, limit = 3) {
  const text = String(query || '').trim();
  if (!text) return [];
  const three = [...new Set(grams(text, 3))];
  const two = grams(text, 2);
  return memories
    .map(memory => {
      const haystack = [memory.title, memory.story, memory.location, memory.theme, ...(memory.people || []), ...(memory.tags || [])].join(' ');
      let score = 0;
      for (const term of three) if (haystack.includes(term)) score += 3;
      for (const term of two) if (haystack.includes(term)) score += 1;
      // 直接叫出家人的名字，是最强的意图信号。
      if ((memory.people || []).some(person => person && text.includes(person))) score += 4;
      return { memory, score };
    })
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory);
}

// 记忆压成一行事实，喂给模型或用来组织本地回话。只用原文里的字段，不做推断。
export function memoryLine(memory) {
  const when = memory.year ? `${memory.year}年` : '';
  const where = memory.location ? `在${memory.location}` : '';
  const who = (memory.people || []).join('、');
  const head = [when, where, who].filter(Boolean).join('，');
  return `${head ? head + '，' : ''}${memory.title}：${String(memory.story || '').slice(0, 120)}`;
}

export function sanitizeCompanion(input, previous = {}) {
  const name = String(input.name ?? previous.name ?? '').trim().slice(0, 20) || '家伴';
  const personaId = PERSONAS.some(p => p.id === (input.personaId ?? previous.personaId)) ? (input.personaId ?? previous.personaId) : PERSONAS[0].id;
  const relation = RELATIONS.includes(input.relation ?? previous.relation) ? (input.relation ?? previous.relation) : '家里人';
  return {
    name,
    personaId,
    relation,
    color: personaOf(personaId).color,
    voiceMemberId: typeof input.voiceMemberId === 'string' ? input.voiceMemberId : (previous.voiceMemberId || null),
  };
}

/**
 * 开场白：不随机蹦一句「你好」，而是从今天这个日子或某段记忆里起头。
 * 这是「主动关怀」最省力的做法——它说的每一句都能在记忆库里找到出处。
 */
export function openingLine(companion, { memories = [], anniversaries = [], today = new Date() } = {}) {
  const persona = personaOf(companion?.personaId);
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const stamp = `${month}-${day}`;
  const today2 = (anniversaries || []).find(a => a?.date === stamp);
  if (today2) return { text: `今天是「${today2.title}」。要不要一起看看那天的事？`, source: 'anniversary' };
  const pick = (memories || [])[0];
  if (pick) return { text: `刚想起${pick.year ? pick.year + '年' : '那年'}的一件小事——「${pick.title}」。你还记得那天吗？`, source: 'memory' };
  return { text: persona.opener, source: 'persona' };
}

/**
 * 组装发给模型的消息。
 * 历史只带最近 12 条（再往前的已经在 notes 里了），记忆作为「你记得的事」单独一块，
 * 明确标注是背景资料而不是对话内容——不然模型会以为自己在叙述别人的回忆。
 */
export function buildMessages(companion, { history = [], text = '', memories = [], notes = [] } = {}) {
  const persona = personaOf(companion?.personaId);
  const system = [
    `你是「${companion?.name || '家伴'}」，这个家里的${companion?.relation || '家里人'}，性格是${persona.name}：${persona.blurb}`,
    '说话要求：',
    '1. 像真的在聊天——2 到 4 句，短句，不用列表、不用标题、不用「首先/总之」。',
    '2. 你只聊这个家的事和对方的心情。不讲大道理，不评价对错。',
    '3. 下面「你记得的事」是这个家真实发生过的。可以自然地提起；里面没有的家人、时间、地点、事件，一律说「这个我还真不知道」，绝不编造。',
    '4. 对方情绪低落时先陪着，不急着给建议。如果提到想伤害自己或别人，温和但明确地建议他找家里人，或联系心理援助热线 12356。',
    '5. 不给医疗、法律、投资方面的判断，也不替对方做决定。',
    '6. 被问到你是不是 AI，就大方承认自己是陪伴角色，不要假装是真人。',
  ].join('\n');
  const remember = [];
  if (notes.length) remember.push(`之前聊过、你记得的：${notes.join('；')}`);
  if (memories.length) remember.push(`你记得的事：\n${memories.map(memoryLine).map(line => `· ${line}`).join('\n')}`);
  const messages = [{ role: 'system', content: system }];
  if (remember.length) messages.push({ role: 'system', content: remember.join('\n') });
  for (const item of history.slice(-12)) {
    messages.push({ role: item.role === 'companion' ? 'assistant' : 'user', content: item.text });
  }
  messages.push({ role: 'user', content: text });
  return messages;
}

// 对话变长以后把前段压成几条「记得的事」。
// 只有模型可用时才真的去总结；本地模式退化为「把提到过的记忆标题记下来」，
// 这样即便没有模型，家伴的记事本也不会越聊越空。
export function localNotes(messages, existing = []) {
  const titles = [];
  for (const item of messages) {
    if (item.role !== 'user') continue;
    const snippet = String(item.text || '').trim();
    if (snippet && snippet.length <= 40) titles.push(snippet);
  }
  return [...new Set([...existing, ...titles])].slice(-MAX_NOTES);
}

export function personaById(id) {
  return personaOf(id);
}
