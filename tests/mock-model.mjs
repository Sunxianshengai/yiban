// 本地假模型服务：给 E2E 用的。
//
// 忆伴的 AI 功能（整理记忆、写专辑故事、润色人生模拟、家伴/角色对话）现在
// 全部只走真模型，本地不再有预置对白。测试要跑通这些路径，就得有一个真的
// 会回话的东西——但不能依赖网络，也不能烧真钱。
//
// 这个服务按 OpenAI 的格式收请求，然后看系统提示判断这次是哪一种任务，
// 分别返回该任务的形状（聊天返回话，整理返回 JSON，故事返回正文）。
// 它不复述真实答案，只保证「协议通、形状对」，让界面与路由的代码路径被真正走一遍。
//
// 启动：node tests/mock-model.mjs   （端口默认 3799，可用 MOCK_PORT 覆盖）
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 3799);

// 消息内容有两种形状：纯字符串，或 [{type:'text',text}] 数组（整理记忆带照片时用后者）。
const textOf = content => Array.isArray(content)
  ? content.filter(item => item?.type === 'text' || typeof item?.text === 'string').map(item => item.text || '').join('\n')
  : String(content || '');

const systemOf = messages => textOf(messages.find(item => item.role === 'system')?.content);
const lastUser = messages => textOf([...messages].reverse().find(item => item.role === 'user')?.content);

/** 从系统提示里认出这次是谁在说话。 */
function speakerOf(system) {
  const quoted = system.match(/「([^」]{1,12})」/);
  if (quoted) return quoted[1];
  if (/家伴/.test(system)) return '家伴';
  return '对方';
}

/** 认出这次喂了哪段记忆，好在回话里提一句——测试靠它确认记忆真的进了上下文。 */
function memoryOf(messages) {
  const block = messages.find(item => item.role === 'system' && /^他家里的事：|^你记得的事：/.test(item.content));
  if (!block) return '';
  const line = block.content.split('\n').find(item => item.startsWith('·') || item.startsWith('他家里的事'));
  return line ? line.replace(/^[·\s]+/, '').slice(0, 40) : '';
}

/** 聊天类：家伴 / 角色。 */
function chat(system, messages) {
  const user = lastUser(messages);
  const speaker = speakerOf(system);
  const memory = memoryOf(messages);
  if (/不想活|自杀|撑不下去/.test(user)) {
    return `${speaker}：这话我不敢轻飘飘地接。先给一个你信得过的人打个电话，也可以打 12356，那边 24 小时有人。`;
  }
  const echo = user.length > 24 ? `${user.slice(0, 24)}…` : user;
  const tail = memory ? `你提的那个我记着：${memory}。` : '你慢慢说，我不催你。';
  return `${speaker}：听见了，关于「${echo}」，${tail}`;
}

/** 整理记忆：把用户已有的事实搬进约定好的 JSON 形状，一个字新事实都不加。 */
function organize(messages) {
  let input = {};
  try {
    // 提示词末尾才是那串 JSON，前面还跟着一句交代任务的话。
    const text = lastUser(messages);
    input = JSON.parse(text.slice(text.indexOf('{')));
  } catch { /* 形状不对就返回空壳，让上层的「请手动整理」生效 */ }
  const text = String(input.story || input.title || '');
  const year = (text.match(/(19|20)\d{2}/) || [String(input.year || '')])[0];
  return JSON.stringify({
    title: String(input.title || text.slice(0, 12) || '家里的这一天'),
    story: String(input.story || text),
    year: String(input.year || year || ''),
    location: String(input.location || ''),
    people: Array.isArray(input.people) ? input.people : [],
    theme: '家人',
    tags: ['家人', '日常'],
  });
}

/** 专辑故事：只用给定的事实，把它们串成短句。 */
function story(messages) {
  let payload = {};
  try { payload = JSON.parse(lastUser(messages)); } catch { /* 下面会退化成空故事 */ }
  const listed = (payload.memories || []).map(item => [item.year && `${item.year}年`, item.location, `「${item.title}」`].filter(Boolean).join('，'));
  return `${payload.title || '一本家里的相册'}。${listed.join('；')}。这些日子都还在。`;
}

/** 人生模拟的场景润色：保持事实字段不动，只把处境写得更像当年。 */
function scenes(messages) {
  let payload = {};
  try { payload = JSON.parse(lastUser(messages)); } catch { /* 空壳也行，上层会保留本地场景 */ }
  const list = Array.isArray(payload.scenes) ? payload.scenes : [];
  return JSON.stringify({
    scenes: list.map(item => ({
      memoryTitle: item.title || item.memoryTitle || '',
      situation: `（模型改写）${String(item.situation || '').slice(0, 120)}`,
      choices: (item.choices || []).map(choice => ({label: `（模型改写）${choice.label || ''}`})),
    })),
  });
}


/** 人生推演：一幕一幕地写。按提示里的幕数与「是否最后一幕」给出不同内容，让 E2E 能走出多幕。 */
function lifeStage(messages) {
  const user = lastUser(messages);
  const which = Number((user.match(/请写第\s*(\d+)\s*幕/) || [])[1] || 1);
  const free = (user.match(/而是自己写了：「([\s\S]{1,200}?)」/) || [])[1];
  const body = {
    narration: `（假模型）第 ${which} 幕：${free ? `你把「${free.slice(0, 40)}」说出了口。` : '窗外光线一点点暗下去。'}桌上那杯水还没喝完。`,
    choices: [
      {label: '往前再走一步', hint: '不甘心', deltas: {勇气: 1}},
      {label: '留下来把话说完', hint: '放不下', deltas: {牵挂: 1}},
      {label: '什么也不做', hint: '先放着', deltas: {坦然: 1}},
    ],
    ending: which >= 3,
  };
  if (free) body.freeDeltas = {勇气: 2, 牵挂: 1};
  return JSON.stringify(body);
}

/** 人生推演结局：一段收束文字，不下发分数。 */
function lifeEnding() {
  return '（假模型）后来这个人还是留在了原地，把日子过成了根。最放不下的始终是那几个人。这是假设，跟真实发生过的那一段不一样。';
}

function answer(messages) {
  const system = systemOf(messages);
  if (/整理这段家庭记忆|家庭记忆整理助手/.test(system)) return organize(messages);
  if (/家庭故事编辑/.test(system)) return story(messages);
  if (/人生岔路|人生推演/.test(system)) return /收束|结局|第二人称/.test(lastUser(messages)) && !/请写第/.test(lastUser(messages)) ? lifeEnding() : lifeStage(messages);
  if (/人生模拟/.test(system)) return scenes(messages);
  return chat(system, messages);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.includes('/chat/completions')) {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: {message: 'not found'}}));
    return;
  }
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* 空 body 也照常回一句 */ }
    const content = answer(Array.isArray(body.messages) ? body.messages : []);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({choices: [{message: {role: 'assistant', content}}]}));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-model] listening on http://127.0.0.1:${PORT}/v1/chat/completions`);
});
