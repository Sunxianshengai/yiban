export const THEMES = ['家人', '老家', '旅行', '青春', '节日', '日常'];

// 个性化偏好：每位使用者（不分老人/子女）都可自定义属于自己的体验。
// 「单端口 + 个性化偏好」设计：同一套界面，按当前登录者的偏好自适应。
// 历史：曾有 AGE_GROUPS 四档身份皮肤（已移除），后来是五档主题色（豆绿/蜜桃/…）；
// 现按《忆伴 UI 设计方案》收敛为「字号 + 明暗主题 + 高对比度」——品牌色只有
// 深松绿一套，日间为默认，夜间不是日间的简单反相。
export const FONT_SCALES = [
  {id: 1.0, label: '标准'},
  {id: 1.15, label: '偏大'},
  {id: 1.3, label: '大'},
  {id: 1.5, label: '特大'},
];

// 外观主题：day 日间（暖白画布）/ night 夜间（深松绿夜色）。
export const APPEARANCES = [
  {id: 'day', label: '日间'},
  {id: 'night', label: '夜间'},
];

export const DEFAULT_PREFERENCES = {fontScale: 1.0, theme: 'day', highContrast: false};

// 只做白名单收敛：未知字段（包括历史数据里的 ageGroup、accent）一律丢弃，
// 读旧偏好时不会报错，也不会把已经下线的字段再写回去。
export function sanitizePreferences(input = {}) {
  return {
    fontScale: FONT_SCALES.some(f => f.id === input.fontScale) ? Number(input.fontScale) : DEFAULT_PREFERENCES.fontScale,
    theme: APPEARANCES.some(a => a.id === input.theme) ? input.theme : DEFAULT_PREFERENCES.theme,
    highContrast: Boolean(input.highContrast ?? DEFAULT_PREFERENCES.highContrast),
  };
}

export function tidyMemory(input, previous = {}) {
  const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
  const list = v => (Array.isArray(v) ? v : String(v || '').split(/[,，、]/)).map(x => text(x, 30)).filter(Boolean).slice(0, 15);
  const year = text(input.year ?? previous.year, 12);
  if (year && !/^\d{4}(?:年|年代)?$/.test(year)) throw new Error('年代请填写四位年份，例如 1995');
  const title = text(input.title ?? previous.title, 80);
  if (!title) throw new Error('请给这段记忆起一个名字');
  return {
    title, year, location: text(input.location ?? previous.location, 80),
    people: list(input.people ?? previous.people), tags: list(input.tags ?? previous.tags),
    theme: THEMES.includes(input.theme ?? previous.theme) ? (input.theme ?? previous.theme) : '家人',
    story: text(input.story ?? previous.story, 6000),
    status: (input.status ?? previous.status) === 'confirmed' ? 'confirmed' : 'draft',
    favorite: Boolean(input.favorite ?? previous.favorite),
    cover: previous.cover || null, audio: previous.audio || null, video: previous.video || null,
    assetType: previous.assetType || 'illustration',
    // subjectId：这段记忆是「谁的」回忆。全年龄段产品的地基——
    // 有了它才能给每个人排成长时间轴（A）、横排同一年全家人几岁（E）。
    // 允许为空：老数据没有这个字段，不能因为缺它就拒绝保存。
    subjectId: text(input.subjectId ?? previous.subjectId, 80) || null,
  };
}

export function searchMemories(memories, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return memories;
  const raw = q.replace(/(我想|想要|想|看看|看一下|找一下|找找|给我|有没有|的照片|照片|的故事|故事|播放|回忆|一下|记忆|请|还有|吗|呢)/g, ' ').trim();
  const aliases = { '女儿': ['小雨'], '妈妈': ['林阿姨'], '母亲': ['林阿姨'], '爸爸': ['陈叔叔'], '父亲': ['陈叔叔'], '旅游': ['旅行'], '过年': ['节日', '春节'], '年轻': ['青春'], '小时候': ['童年'], '故乡': ['老家'] };
  const terms = [...new Set([raw, ...raw.split(/\s+/), ...Object.entries(aliases).filter(([key]) => q.includes(key)).flatMap(([,v]) => v)].filter(Boolean))];
  if (!terms.length) return [];
  return memories.map(m => {
    const haystack = [m.title, m.story, m.location, m.year, m.theme, ...m.people, ...m.tags].join(' ').toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { m, score };
  }).filter(x => x.score).sort((a,b) => b.score - a.score).map(x => x.m);
}

export function localOrganize(input) {
  const story = String(input.story || '').trim();
  const text = `${input.title || ''} ${story} ${input.location || ''}`;
  const rules = { 家人: ['家人', '女儿', '儿子', '妈妈', '爸爸', '婚礼', '全家'], 老家: ['老家', '故乡', '院子', '家乡'], 旅行: ['旅行', '旅游', '杭州', '西湖', '火车'], 青春: ['毕业', '学校', '青春', '大学', '年轻'], 节日: ['春节', '过年', '中秋', '生日', '团圆'], 日常: ['做饭', '菜', '散步', '花', '日常'] };
  const detected = Object.entries(rules).filter(([,words]) => words.some(w => text.includes(w))).map(([theme]) => theme);
  const yearMatch = text.match(/(?:19|20)\d{2}/);
  return {
    title: String(input.title || '一段家庭记忆'),
    story: story || '请补充这张照片背后的故事：当时有哪些家人、在哪里、发生了什么？',
    year: input.year || yearMatch?.[0] || '', location: input.location || '',
    people: Array.isArray(input.people) ? input.people : String(input.people || '').split(/[,，、]/).filter(Boolean),
    theme: detected[0] || input.theme || '家人', tags: [...new Set([...(input.tags || []), ...detected])].slice(0, 12),
    mode: 'local', note: '本地整理依据你填写的文字提取标签和年份，不会识别照片人物，也不会推测家庭事实。',
  };
}

export function storyFromMemories(memories, title) {
  const fragments = memories.map(m => `${m.year ? m.year + '年，' : ''}${m.location ? '在' + m.location + '，' : ''}${m.story || m.title}`);
  return `《${title}》\n\n${fragments.join('\n\n')}\n\n这些由家人保存的片段，组成了我们共同的记忆。`;
}
