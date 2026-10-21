// 人生模拟：以家庭记忆库为剧本的文字游戏。
//
// 三条必须守住的线（否则这个功能会伤害它想服务的人）：
//  1. 事实只来自记忆库（status==='confirmed'）。剧本里的年份、地点、人物一律照抄，
//     不改写、不补全。
//  2. 选项是「如果」——玩家做的选择是想象的分支，不是对过去的判断。
//     所以每个选择落地后都要回扣真实记录：「真实发生的是……」，把想象与事实分开。
//  3. 不做对错评价。没有「选错了」，只有「你会怎么选」，结尾按倾向汇总成一段小结。
//
// 未配置模型时（本地模式）也必须能完整玩完，不靠模型现编。

export const TRAITS = ['牵挂', '勇气', '守候', '坦然'];

const TRAIT_COLORS = {牵挂: 'peach', 勇气: 'gold', 守候: 'sage', 坦然: 'lavender'};

// 每个主题给一组「处境」，让同一段记忆在不同家庭里也能问出合理的岔路。
// 文案刻意保持中性：不暗示哪个选项更好。
const SITUATIONS = {
  家人: {scene: '家里有事，所有人都在等你开口', options: [['先把这一顿饭做完，稳住大家', {牵挂: 2, 守候: 1}], ['把心里的难处说出来', {坦然: 2, 勇气: 1}], ['一个人扛下来，别让他们担心', {守候: 2, 牵挂: 1}]]},
  老家: {scene: '老屋那边传来消息，需要有人回去一趟', options: [['收拾东西当天就走', {牵挂: 2, 勇气: 1}], ['先把手头的事安排妥当再回', {坦然: 2, 守候: 1}], ['托人先照应，自己留在这里', {守候: 2, 坦然: 1}]]},
  旅行: {scene: '出发前一晚，行李还没收完', options: [['说走就走，路上再想', {勇气: 2, 坦然: 1}], ['把行程一条条写清楚', {坦然: 2, 守候: 1}], ['先问清楚家里每个人的想法', {牵挂: 2, 守候: 1}]]},
  青春: {scene: '面前有两条路，都通向不明白的地方', options: [['挑看起来更难的那条', {勇气: 2, 坦然: 1}], ['听长辈的，走稳妥的', {守候: 2, 牵挂: 1}], ['先去试一试，不行再退回来', {坦然: 2, 勇气: 1}]]},
  节日: {scene: '一年里难得的团聚，桌边还空着一个位置', options: [['一直等到人齐了才动筷', {牵挂: 2, 守候: 1}], ['把空位的样子记住，也说笑', {坦然: 2, 牵挂: 1}], ['端起杯，先敬还没到的人', {牵挂: 1, 勇气: 1, 坦然: 1}]]},
  日常: {scene: '一个再普通不过的下午，忽然有了空隙', options: [['找点事做，别停下来', {守候: 2, 牵挂: 1}], ['坐下来，什么都不做', {坦然: 2, 守候: 1}], ['给很久没联系的人打个电话', {牵挂: 2, 勇气: 1}]]},
};

const FALLBACK = SITUATIONS.日常;

// 把一段记忆变成一个可玩的场景。narration 只用记忆里已有的事实。
export function sceneFromMemory(memory, subject) {
  const who = subject?.name || 'TA';
  const situation = SITUATIONS[memory.theme] || FALLBACK;
  const when = memory.year ? `${memory.year} 年` : '有一年';
  const where = memory.location ? `在${memory.location}` : '';
  const cast = Array.isArray(memory.people) && memory.people.length ? memory.people.join('、') : '';
  const narration = [memory.story || '', `那时${where ? '，' + where : ''}${cast ? `，身边有 ${cast}` : ''}。`]
    .filter(Boolean).join('\n\n');
  return {
    memoryId: memory.id,
    year: memory.year || '',
    location: memory.location || '',
    theme: memory.theme || '日常',
    title: memory.title,
    who,
    when,
    narration,
    situation: situation.scene,
    choices: situation.options.map(([label, traits], index) => ({
      id: `c${index}`,
      label,
      traits,
    })),
    // 真实记忆就是「实际发生的那条线」，选择落地后才回扣，让玩家看清想象与事实的边界。
    truth: memory.story || memory.title,
    // 每个场景都允许自己输入一句话，不强迫从三项里挑。
    allowFreeText: true,
  };
}

// 发给前端前剥掉 truth：没走到的场景不该提前剧透「真实结局」。
// 已经答过的回合由 answer.truth 带出（回扣环节要用）。
export function publicGame(game) {
  return {
    ...game,
    scenes: game.scenes.map(({truth, ...rest}) => rest),
  };
}

function emptyTally() {
  return Object.fromEntries(TRAITS.map(trait => [trait, 0]));
}

function addTraits(tally, traits = {}) {
  for (const [trait, value] of Object.entries(traits)) if (trait in tally) tally[trait] += Number(value) || 0;
  return tally;
}

// 自由输入没有预设 traits：按关键词给一个温和的归属，认不出就归到「坦然」。
function traitsFromText(text) {
  const value = String(text || '');
  const rules = [
    ['牵挂', /(家人|妈妈|爸爸|女儿|儿子|孩子|他们|想|担心|回家|等)/],
    ['勇气', /(决定|敢|试|走|辞|闯|说出口|拒绝|答应)/],
    ['守候', /(留|守|等|照顾|陪着|习惯|一直|坚持)/],
    ['坦然', /(算了|放下|接受|无所谓|算了|顺其自然|不在意|也行)/],
  ];
  const hits = rules.filter(([, pattern]) => pattern.test(value));
  if (!hits.length) return {坦然: 2};
  return Object.fromEntries(hits.map(([trait]) => [trait, 2]));
}

export function summarize(scenes, answers, subject) {
  const tally = emptyTally();
  for (const answer of answers) addTraits(tally, answer.traits);
  const ranked = TRAITS.map(trait => ({trait, value: tally[trait], color: TRAIT_COLORS[trait]})).sort((a, b) => b.value - a.value);
  const top = ranked[0];
  const who = subject?.name || '这段人生';
  const total = answers.length;
  const dominant = top && top.value > 0 ? top.trait : '坦然';
  const lines = {
    牵挂: `${who}的选择里，最常出现的是「牵挂」——先想别人，再想自己。`,
    勇气: `${who}的选择里，最常出现的是「勇气」——难的路，也愿意走上去看看。`,
    守候: `${who}的选择里，最常出现的是「守候」——不声张，把日子一天天守住。`,
    坦然: `${who}的选择里，最常出现的是「坦然」——事情来了就接住，不与自己较劲。`,
  };
  return {
    total,
    tally,
    ranked,
    dominant,
    text: total
      ? `${lines[dominant]}\n\n这是你在 ${total} 个岔路口做出的选择。它不是${who}的真实答案——真实的答案，在下面这些记忆里。`
      : `还没有做出选择。`,
  };
}

export function buildGame({memories, subject, user}) {
  // 按年份顺着走：一段人生应该从最早的那段回忆开始，而不是从库里取出来的顺序。
  const ordered = [...memories].sort((a, b) => {
    const left = Number(a.year) || Number.MAX_SAFE_INTEGER;
    const right = Number(b.year) || Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const scenes = ordered.slice(0, 7).map(memory => sceneFromMemory(memory, subject || {name: user?.name}));
  if (!scenes.length) throw new Error('还没有可用的已确认记忆。先发布一段记忆，再来走这条路。');
  return {
    id: null,
    subjectId: subject?.id || null,
    subjectName: subject?.name || user?.name || '家人',
    title: `${subject?.name || user?.name || '家人'}的人生模拟`,
    sceneIndex: 0,
    answers: [],
    scenes,
    tally: emptyTally(),
    status: 'playing',
    mode: 'local',
  };
}

export function currentScene(game) {
  return game.scenes[game.sceneIndex] || null;
}

// 推进一个回合：记录选择（或自由输入），给出回扣真实记忆的回响。
export function advance(game, input) {
  const scene = currentScene(game);
  if (!scene) return game;
  let traits, label, freeText = null;
  if (input?.choiceId) {
    const choice = scene.choices.find(item => item.id === input.choiceId);
    if (!choice) throw new Error('这个选项不在当前场景里');
    traits = choice.traits;
    label = choice.label;
  } else {
    const text = String(input?.text || '').trim().slice(0, 300);
    if (!text) throw new Error('写一句你在这个路口会怎么做');
    traits = traitsFromText(text);
    label = text;
    freeText = text;
  }
  const answers = [...game.answers, {memoryId: scene.memoryId, label, traits, freeText, at: new Date().toISOString()}];
  const tally = addTraits({...game.tally}, traits);
  const sceneIndex = game.sceneIndex + 1;
  const finished = sceneIndex >= game.scenes.length;
  return {
    ...game,
    sceneIndex,
    answers,
    tally,
    status: finished ? 'finished' : 'playing',
    summary: finished ? summarize(game.scenes, answers, {name: game.subjectName}) : null,
  };
}

// AI 增强：用模型把场景问得更贴合人物，但事实框死在给出的记忆里。
// 失败或未配置时调用方应该回落到本地场景，不要抛给用户。
export function promptForScene(scenes, subject, answers) {
  return [
    {role: 'system', content: '你在帮一个家庭做「人生模拟」：把家里已确认的记忆，变成让家人站在当年那个人位置上做选择的岔路口。严格遵守：只能使用给定记忆里的事实，不得新增家人、地名、年份、事件；不得评价哪种选择更好；不得替家人下结论；每个场景给 3 个选项，外加允许玩家自己写。输出纯 JSON。'},
    {role: 'user', content: `人物：${subject?.name || '家人'}。已有记忆：${JSON.stringify(scenes.map(s => ({year: s.year, title: s.title, story: s.truth, location: s.location, theme: s.theme})))}。已做过的选择：${JSON.stringify(answers.map(a => a.label))}。请为每一段记忆生成一个岔路口，格式：{"scenes":[{"memoryTitle":"","situation":"一句处境描述","choices":[{"label":"","hint":""}]}]}`},
  ];
}
