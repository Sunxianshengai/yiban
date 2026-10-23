// 声音克隆与合成（忆伴 · 阿里云百炼 CosyVoice-v3-Flash）
// 设计原则：
//   1. 多成员：每个家庭成员可各自复刻自己的音色，结果以 voiceId 存于 members 文档。
//   2. 缓存：同一 (voiceId, text, params) 的合成结果缓存到 voice_cache 集合，避免重复计费（1元/万字符）。
//   3. 降级：未配置 DASHSCOPE_API_KEY / 未复刻 / 调用失败时，调用方回退到浏览器 speechSynthesis。
//   4. 合规：所有合成音频均为「AI 合成声音」，UI 须显式标注（见《生成式人工智能服务管理暂行办法》）。

import {createHash} from 'node:crypto';

const PROVIDER = 'cosyvoice';
// 声音复刻（克隆）专属域名：华北2（北京）。Workspace 不同则替换为对应区域域名。
const CUSTOMIZATION_HOST = process.env.DASHSCOPE_WORKSPACE_ID
  ? `${process.env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com`
  : 'cn-beijing.maas.aliyuncs.com';
const CUSTOMIZATION_URL = `https://${CUSTOMIZATION_HOST}/api/v1/services/audio/tts/customization`;
// 实时合成（TTS）公共网关。
const SYNTH_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

function apiKey() {
  return process.env.DASHSCOPE_API_KEY;
}

export function voiceConfigured() {
  return Boolean(apiKey());
}

// 基于文本 + 音色 + 参数生成稳定缓存键。
function cacheKey(voiceId, text, { format = 'mp3', rate = 1, pitch = 1 } = {}) {
  const normalized = String(text || '').trim();
  return createHash('sha256').update(JSON.stringify([voiceId, normalized, format, rate, pitch])).digest('hex');
}

// 把已上传到 Vercel Blob 的音频 url 取为 buffer（fetch 即可，Blob 私有 url 自带签名）。
async function fetchAudioBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`读取音频失败 (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 为一个成员复刻音色。
 * @param {object} input
 * @param {string} input.memberId 成员 id（用于回写 voiceId）
 * @param {string} input.audioUrl 已上传到 Blob 的录音 url（/api/media/xxx 或完整 Blob url）
 * @param {boolean} [input.consent] 必须显式 true：本人同意用这段录音复刻自己的声音
 * @returns {Promise<{voiceId:string,status:string}>}
 */
export async function enrollVoice({ memberId, audioUrl, consent }) {
  if (!voiceConfigured()) throw new Error('未配置 DASHSCOPE_API_KEY，无法复刻声音');
  if (consent !== true) throw new Error('必须本人明确同意才能复刻声音');
  const res = await fetch(CUSTOMIZATION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: 'cosyvoice-v3-flash',
      input: { audio: audioUrl, audio_format: 'auto' },
      parameters: { target_model: 'cosyvoice-v3-flash' },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const taskId = json?.output?.task_id || json?.task_id;
  if (!res.ok || !taskId) {
    throw new Error(json?.message || '复刻请求失败');
  }
  // 轮询异步任务（最长约 60s）。克隆成功后才拿到 voiceId。
  const voiceId = await pollCustomizationTask(taskId);
  if (!voiceId) throw new Error('复刻超时，请稍后重试');
  return { voiceId, status: 'ready' };
}

async function pollCustomizationTask(taskId, timeoutMs = 60000) {
  const start = Date.now();
  const url = `${CUSTOMIZATION_URL}/tasks/${taskId}`;
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey()}` } });
    const json = await res.json().catch(() => ({}));
    const task = json?.output || json;
    const status = task?.task_status || task?.status;
    if (status === 'SUCCEEDED' || status === 'succeeded') {
      return task?.results?.[0]?.voice_id || task?.voice_id || task?.custom_voice_id;
    }
    if (status === 'FAILED' || status === 'failed') {
      throw new Error(task?.message || '复刻失败');
    }
  }
  return null;
}

/**
 * 合成语音，返回音频地址（DashScope 临时 url 或 data URI）。
 * 计费缓存由调用方（路由层）负责：先查 voice_cache，未命中再调用本函数并把结果落盘到 Blob。
 * @param {object} input
 * @param {string} input.voiceId 复刻得到的音色 id
 * @param {string} input.text 要朗读的文本（计费字符数）
 * @param {object} [input.options] { format, rate, pitch }
 * @returns {Promise<{audioUrl:string,format:string}>}
 */
export async function synthesizeVoice({ voiceId, text, options = {} }) {
  if (!voiceConfigured()) throw new Error('未配置 DASHSCOPE_API_KEY，无法合成');
  if (!voiceId) throw new Error('该成员尚未复刻声音');
  const normalized = String(text || '').trim();
  if (!normalized) throw new Error('合成文本为空');
  const res = await fetch(SYNTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'cosyvoice-v3-flash',
      input: {
        text: normalized,
        voice: voiceId,
        format: options.format || 'mp3',
        rate: options.rate || 1,
        pitch: options.pitch || 1,
      },
      parameters: {},
    }),
  });
  const json = await res.json().catch(() => ({}));
  const audioItem = json?.output?.audio?.audio?.[0];
  if (!res.ok || !audioItem) {
    throw new Error(json?.message || '合成失败');
  }
  // audioItem 可能是 {url} 或 {data:base64}
  let audioUrl = null;
  if (typeof audioItem === 'string') {
    audioUrl = audioItem;
  } else if (audioItem.url) {
    audioUrl = audioItem.url;
  } else if (audioItem.data) {
    // 内联 base64：交给调用方落盘到 Blob，这里原样回传 data URI，由路由层转存。
    audioUrl = `data:audio/${options.format || 'mp3'};base64,${audioItem.data}`;
  }
  if (!audioUrl) throw new Error('合成结果解析失败');
  return { audioUrl, format: options.format || 'mp3' };
}

export const voiceProvider = PROVIDER;
export { fetchAudioBuffer, cacheKey };
