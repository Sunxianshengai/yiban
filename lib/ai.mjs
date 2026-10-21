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
  return {...result, mode: 'model', note: '模型整理结果，请核对人物、时间和故事事实后再发布。'};
}

// 人生模拟的场景润色：把本地生成的三岔路口交给模型，让处境更像那个人的当年。
// 只允许改写「处境」与「选项的措辞」，事实字段（年份/地点/真相）由调用方保留。
export async function enrichScenes(localScenes, subject, answers = [], promptForScene) {
  if (!enabled()) return null;
  try {
    const text = await callModel(promptForScene(localScenes, subject, answers), {temperature: 0.6, maxTokens: 1600, timeout: 30000});
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed?.scenes)) return null;
    return localScenes.map((scene, index) => {
      const draft = parsed.scenes.find(s => s?.memoryTitle === scene.title) || parsed.scenes[index];
      if (!draft?.situation) return scene;
      const choices = Array.isArray(draft.choices) && draft.choices.length >= 2
        ? draft.choices.slice(0, 3).map((choice, i) => ({...scene.choices[i] || scene.choices[0], id: `c${i}`, label: String(choice.label || '').slice(0, 80) || scene.choices[i]?.label || ''}))
        : scene.choices;
      return {...scene, situation: String(draft.situation).slice(0, 160), choices};
    });
  } catch {
    // 润色失败不影响游戏：调用方继续用本地场景。
    return null;
  }
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

export async function generateStory(memories, title) {
  if (!enabled()) return {story: storyFromMemories(memories, title), mode: 'local'};
  const story = await callModel([{role: 'system', content: '你是家庭故事编辑。将已确认的记忆串联成温柔、短句的讲述。只能使用提供的事实，不能增加对话、关系、地点或事件。最多600字。'}, {role: 'user', content: JSON.stringify({title, memories: memories.map(m => ({title: m.title, year: m.year, location: m.location, people: m.people, story: m.story}))})}]);
  return {story, mode: 'model'};
}
