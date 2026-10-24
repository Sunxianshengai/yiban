import {localOrganize, storyFromMemories} from './core.mjs';

// 服务商预设：填一个 key 就能用，不必再手抄一长串接口地址。
// 显式填了 AI_API_URL/AI_API_KEY/AI_MODEL 时一律以显式配置为准（兼容任何 OpenAI 格式的服务）。
const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    keyEnvs: ['DEEPSEEK_API_KEY'],
    docs: 'https://platform.deepseek.com/api_keys',
  },
  dashscope: {
    name: '阿里云百炼',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    keyEnvs: ['DASHSCOPE_API_KEY'],
    docs: 'https://bailian.console.aliyun.com/',
  },
};

/** 当前生效的模型配置。没有任何一项齐全时返回 null。 */
export function modelConfig() {
  const url = String(process.env.AI_API_URL || '').trim();
  const key = String(process.env.AI_API_KEY || '').trim();
  const model = String(process.env.AI_MODEL || '').trim();
  if (url && key && model) return {provider: 'custom', name: '自定义服务', url, key, model};
  const wanted = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const order = wanted && PROVIDERS[wanted] ? [wanted] : Object.keys(PROVIDERS);
  for (const id of order) {
    const provider = PROVIDERS[id];
    const envName = provider.keyEnvs.find(name => String(process.env[name] || '').trim());
    if (!envName) continue;
    return {
      provider: id,
      name: provider.name,
      url: provider.url,
      key: String(process.env[envName]).trim(),
      model: model || provider.model,
    };
  }
  return null;
}

export const aiReady = () => Boolean(modelConfig());
const enabled = aiReady;
/** 给界面用的说明：配好了就报服务商名字，没配就报缺什么。 */
export function aiStatus() {
  const config = modelConfig();
  if (config) return {ready: true, provider: config.provider, name: config.name, model: config.model};
  return {ready: false, provider: null, name: null, model: null};
}

/** 模型调用失败时抛这个，路由层好区分「服务商拒绝」和「我们自己写错了」。 */
export class ModelError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ModelError';
    this.status = status;
  }
}

export async function callModel(messages, options = {}) {
  const config = modelConfig();
  if (!config) throw new ModelError('还没有配置模型服务，请先在环境变量里填入模型密钥', 503);
  let parsed;
  try {
    parsed = new URL(config.url);
  } catch {
    throw new ModelError('模型接口地址格式不正确', 500);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new ModelError('模型接口地址需要使用 HTTP 或 HTTPS', 500);
  const body = {model: config.model, messages, temperature: options.temperature ?? 0.3};
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  let response;
  try {
    response = await fetch(parsed, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.key}`},
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout ?? 45000),
    });
  } catch (error) {
    // 超时、DNS、证书、断网都会落到这里。原文留给排查，人话留给界面。
    const reason = error?.name === 'TimeoutError' ? '请求超时' : '网络不通';
    throw new ModelError(`${config.name}${reason}，请稍后重试（${error?.message || '未知错误'}）`, 504);
  }
  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      // 各家服务的错误结构不同，能认出几个常见的就够定位了。
      const json = JSON.parse(text);
      detail = json?.error?.message || json?.message || json?.error || text;
    } catch {
      detail = '';
    }
    const hint = {
      401: '密钥无效或已过期',
      402: '账户余额不足',
      403: '密钥没有该模型的权限',
      429: '请求太频繁或额度用尽',
    }[response.status] || '服务返回错误';
    throw new ModelError(`${config.name}：${hint}${detail ? `（${String(detail).slice(0, 160)}）` : ''}`, response.status === 429 ? 429 : 502);
  }
  const result = await response.json().catch(() => null);
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ModelError(`${config.name}返回的内容格式不兼容`, 502);
  return content;
}

export async function organize(input, imageData = null) {
  if (!enabled()) return localOrganize(input);
  const content = [{type: 'text', text: `请整理这段家庭记忆，仅用提供的事实。照片只能描述可见场景，不可猜测人物身份、年份和关系。保留用户已填的人物/日期。输出纯JSON：title,story,year,location,people数组,theme（家人/老家/旅行/青春/节日/日常）,tags数组。不确定的字段留空。输入：${JSON.stringify(input)}`}];
  if (imageData) content.push({type: 'image_url', image_url: {url: imageData}});
  const text = await callModel([{role: 'system', content: '你是家庭记忆整理助手。不得编造家庭经历。输出必须由家属核对。'}, {role: 'user', content}]);
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let result;
  try { result = JSON.parse(clean); } catch { throw new Error('模型没有返回有效的结构化内容，请重试或手动整理'); }
  if(!result||Array.isArray(result)||typeof result!=='object'||
    typeof result.title!=='string'||!result.title.trim()||typeof result.story!=='string'||!result.story.trim())
    throw new ModelError('模型没有返回可用的记忆内容，请重试或手动整理',502);
  return {...result, mode: 'model', note: '模型整理结果，请核对人物、时间和故事事实后再发布。'};
}

// 陪伴对话：单轮。这里**不再有本地兜底**——聊天是模型的活，
// 模板回话只会让人以为机器在敷衍他。失败就把原因说清楚，让用户重发。
export async function chatWithCompanion(messages) {
  const text = await callModel(messages, {temperature: 0.85, maxTokens: 500, timeout: 40000});
  const clean = String(text || '').trim();
  if (!clean) throw new ModelError('模型这次没有返回内容，请再发一次', 502);
  return clean.slice(0, 1200);
}

// 换个角色说话。温度比家伴略低——角色是来帮人想事的，太飘就废了。
export async function chatWithRole(messages) {
  const text = await callModel(messages, {temperature: 0.75, maxTokens: 500, timeout: 40000});
  const clean = String(text || '').trim();
  if (!clean) throw new ModelError('模型这次没有返回内容，请再发一次', 502);
  return clean.slice(0, 1200);
}

// ── 人生推演（L3）：模型一幕一幕地写 ──────────────────────────────
// 三条硬规矩已经写进 system：起点事实照抄、往后全是「如果」、
// 不许让真实家人说出他们没说过的话，也不许给这一局打分排名。

const LIFE_SYSTEM = `你是一位擅长写「人生岔路」的中文小说家，正在为一个家庭做一件事：
把他们家里一段真实发生过的记忆当作起点，往后推演另一种可能的人生。

必须遵守：
1. 起点那一段（年份、地点、人物、发生的事）是事实，只能照抄，不能改写或补全。
2. 从第二幕开始，一切都是「如果」，不是真实发生过的事。不要写「他真的」「她后来确实」这类断言。
3. 绝对不能让真实存在的家人说出他们没说过的话、做出历史中没有记录的举动。他们可以出现，但只作为处境的一部分。
4. 不给这一局打分、排名、评级，不说「你选对了/选错了」。选择没有对错。
5. 不写医疗、法律、投资方面的具体建议。
6. 每一幕的处境要具体：写到一个可以落脚的场景、一件此刻正压在心上的事。
7. 人物的口吻要像那个年代的人，不要现代网络语。`;

const LIFE_STAGE_SCHEMA = `只输出纯 JSON，不要代码围栏，不要解释，结构严格如下：
{
  "narration": "这一幕的处境，第二人称写，120-260 个汉字，具体、克制、有画面",
  "choices": [
    {"label": "你此刻会怎么做（不超过 20 个字，是第一人称的动作或话语）", "hint": "这个选择的意味，不超过 14 个字", "deltas": {"勇气": 1, "牵挂": -1}},
    {"label": "...", "hint": "...", "deltas": {...}},
    {"label": "...", "hint": "...", "deltas": {...}}
  ],
  "ending": false
}
deltas 是可选的，只会用到这几个键：牵挂、勇气、守候、坦然、胆识、温情，每次取值 -2 到 +2，最多影响两个键。三个选项要有真实的分歧：一个往外、一个往里、一个停在原地或换个角度。
ending 表示「这一幕就是最后一幕」——只有当这个人的人生在这里已经能收束时才写 true，否则一律 false。`;

function lifeStateLine(stats = {}) {
  return Object.entries(stats).map(([key, value]) => `${key}${value}`).join('、');
}

function lifeHistory(run) {
  const lines = [];
  for (const stage of run.stages || []) {
    if (!stage.answer) continue;
    lines.push(`第${stage.index + 1}幕：${String(stage.narration || '').slice(0, 120)}…`);
    lines.push(`  他/她选择了：${stage.answer.label}`);
  }
  return lines.join('\n');
}

/** 生成下一幕。长度、选项、是否收尾，全由模型自己判断。 */
export async function generateLifeStage(run, {freeText} = {}) {
  const past = lifeHistory(run);
  const state = lifeStateLine(run.stats);
  const index = (run.stages || []).length;
  const free = freeText
    ? `\n玩家上一幕没有选我们给的选项，而是自己写了：「${freeText}」。
这一幕必须正面接住这句话的后果，不要当没发生。
同时请在 JSON 里加一个 "freeDeltas" 字段，判定这句话落到了哪几个属性上（取值 -3 到 +3，最多三个键）。`
    : '';
  const prompt = `【起点事实（必须照抄，不得改写）】
年代：${run.origin?.year || '不详'}
地点：${run.origin?.location || '不详'}
身边的人：${(run.origin?.people || []).join('、') || '不详'}
那天发生的事：${run.origin?.story || run.origin?.title}

【主角】${run.subjectName}

【此刻的属性】${state}

【已经走过的选择】
${past || '（这是第一幕，还没有做过任何选择）'}
${free}

现在请写第 ${index + 1} 幕。
- 幕数不设死，你觉得这个人的人生该走多长就走多长，但只要写够、收得住，就把 "ending" 设为 true。
- 已经超过 12 幕时请务必收尾。
- 如果这一幕是最后一幕，把处境收拢到「多年以后回望这一刻」，让人物有一次真正面对自己的机会。

${LIFE_STAGE_SCHEMA}`;

  const text = await callModel(
    [{role: 'system', content: LIFE_SYSTEM}, {role: 'user', content: prompt}],
    {temperature: 0.9, maxTokens: 1200, timeout: 45000},
  );
  return parseLifeStage(text, {withFreeDeltas: Boolean(freeText)});
}

/** 模型偶尔会裹代码围栏或多说两句，这里只做保守清洗，不猜内容。 */
export function parseLifeStage(text, {withFreeDeltas = false} = {}) {
  const clean = String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end <= start) throw new ModelError('模型这次没有给出有效的这一幕，请重试', 502);
    try {
      parsed = JSON.parse(clean.slice(start, end + 1));
    } catch {
      throw new ModelError('模型这次没有给出有效的这一幕，请重试', 502);
    }
  }
  const narration = String(parsed?.narration || '').trim().slice(0, 700);
  if (!narration) throw new ModelError('模型这次写空了这一幕，请重试', 502);
  const choices = (Array.isArray(parsed?.choices) ? parsed.choices : [])
    .map((choice, index) => ({
      // 模型只给文案，id 得我们发：前端回传的就是这个 id，
      // 少了它「点选项」永远匹配不上，只能一直走自由输入。
      id: `c${index}`,
      label: String(choice?.label || '').trim().slice(0, 40),
      hint: String(choice?.hint || '').trim().slice(0, 20),
      deltas: sanitizeDeltas(choice?.deltas),
    }))
    .filter(choice => choice.label)
    .slice(0, 3);
  if (choices.length < 2) throw new ModelError('模型这次给的选项不够用，请重试', 502);
  // 过滤掉空文案后 id 可能不连续，重排一遍，保证前端拿到的一定是 c0/c1/c2。
  choices.forEach((choice, index) => { choice.id = `c${index}`; });
  const stage = {
    narration,
    choices,
    ending: parsed?.ending === true,
  };
  // 玩家自己写的那句话，权重也交给模型判；没给就不动属性。
  if (withFreeDeltas) stage.freeDeltas = sanitizeDeltas(parsed?.freeDeltas);
  return stage;
}

const LIFE_STATS = ['牵挂', '勇气', '守候', '坦然', '胆识', '温情'];
export function sanitizeDeltas(input) {
  if (!input || typeof input !== 'object') return {};
  const deltas = {};
  let count = 0;
  for (const key of LIFE_STATS) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value === 0) continue;
    deltas[key] = Math.max(-2, Math.min(2, Math.round(value)));
    if (++count >= 2) break;
  }
  return deltas;
}

/** 结局那段话：只陈述这个人成了什么样，不评价好坏。 */
export async function generateLifeEnding(run) {
  const reading = Object.entries(run.stats || {}).sort((a, b) => b[1] - a[1]);
  const prompt = `主角：${run.subjectName}
起点：${run.origin?.year || ''}年，${run.origin?.location || ''}，${run.origin?.story || ''}
这一局走过的选择：
${lifeHistory(run)}
最后的属性：${lifeStateLine(run.stats)}（最重的是${reading[0]?.[0] || '坦然'}，最轻的是${reading.at(-1)?.[0] || '勇气'}）

请写 160-260 个汉字，第二人称，讲清三件事：
1) 这个人后来大概成了什么样的人（具体的行为倾向，不要形容词堆砌）；
2) 他/她最放不下的还是什么；
3) 一句话提醒：这是假设，跟真实发生过的那一段不一样。
不给分数，不排名，不说「你选对了」。只输出这段文字本身，不要任何标题或 JSON。`;
  const text = await callModel(
    [{role: 'system', content: LIFE_SYSTEM}, {role: 'user', content: prompt}],
    {temperature: 0.85, maxTokens: 600, timeout: 45000},
  );
  const clean = String(text || '').trim();
  if (!clean) throw new ModelError('模型这次没有写出结局，请重试', 502);
  return clean.slice(0, 900);
}

export async function generateStory(memories, title) {
  if (!enabled()) return {story: storyFromMemories(memories, title), mode: 'local'};
  const story = await callModel([{role: 'system', content: '你是家庭故事编辑。将已确认的记忆串联成温柔、短句的讲述。只能使用提供的事实，不能增加对话、关系、地点或事件。最多600字。'}, {role: 'user', content: JSON.stringify({title, memories: memories.map(m => ({title: m.title, year: m.year, location: m.location, people: m.people, story: m.story}))})}]);
  if(!story.trim())throw new ModelError('模型没有生成故事内容，请重试',502);
  return {story, mode: 'model'};
}
