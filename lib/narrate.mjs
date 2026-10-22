// 让回忆主人「自己讲」这一段记忆。
//
// 三件事，成本从低到高：
//   1. 口述稿：模型按记忆原文改写成第一人称，只允许复用原文事实（几百 token）。
//   2. 声音：交给 voice.mjs 的 CosyVoice 用复刻音色念出来（1 元/万字符，约 0.03 元/段）。
//   3. 动起来：可选调用万相图生视频，异步任务 + 结果转存 Blob + 长期缓存（1.5~6 元/条）。
//
// 设计原则（与 voice.mjs 一脉相承）：
//   - 默认便宜：不加视频就是「一张会呼吸的照片 + 一段声音」。
//   - 按需付费：视频只有用户主动点才生成，命中缓存不再计费。
//   - 失败不吞错：生成不出来就说原因，不拿本地模板冒充。
//
// 一个刻意的取舍：视频走「无声 + 前端叠我们自己的配音」，不传 audio_url。
// 原因是 DashScope 的 audio_url 必须是公网可访问，而我们的媒体是私有 Blob；
// 而且这是张照片不是人物视频，对口型本来就没意义。关掉声音还能省一半钱。

import {createHash} from 'node:crypto';
import {callModel, ModelError} from './ai.mjs';

// 口述稿长度：TTS 按字符计费，也是给人听的，太长会烦。
export const MAX_SCRIPT = 800;
// 送进图生视频的图片上限（base64 后约 1.37 倍，别把请求体撑爆）。
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const VIDEO_RESOLUTIONS = ['480P', '720P'];
export const VIDEO_DEFAULT_RESOLUTION = '480P';
export const VIDEO_DEFAULT_SECONDS = 5;
export const VIDEO_MIN_SECONDS = 2;
export const VIDEO_MAX_SECONDS = 15;

const NARRATION_SYSTEM = `你是一位家庭记忆的转述者。家属把一段老人的往事整理成了文字，现在要用老人自己的口吻，讲给家里人听。

硬规矩，一条都不能破：
1. 只用这段记忆里明确写着的事实。没写的年份、地名、人名、职业、天气，一律不许补。
2. 用第一人称「我」。语气像老人在饭桌边慢慢讲，不要书面语，不要抒情排比。
3. 不评价、不总结人生道理、不劝人。就讲这件事本身。
4. 不提「记忆」「归档」「模型」「文档」这类词。
5. 篇幅 150 到 400 字之间，能一口气念完。
6. 直接输出要念出口的话。不要标题、不要分段符号、不要舞台提示、不要引号包裹。`;

/**
 * 清洗模型吐出来的口述稿：去掉代码围栏、markdown 标记、多余引号与空白。
 * 模型偶尔会把整段用引号包起来，或者加上「以下是口述稿：」的开头，都要剥掉。
 */
export function cleanScript(raw) {
  let text = String(raw || '');
  text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  // 去掉「以下是……：」这类前言
  text = text.replace(/^\s*(以下是|下面是|口述稿[:：]|旁白[:：])[^\n]*\n+/, '');
  // 去掉整体包裹的一对引号
  text = text.trim();
  if (/^["“「『].*["”」』]$/s.test(text)) text = text.slice(1, -1).trim();
  // markdown 强调符号
  text = text.replace(/^\s*#{1,6}\s*/gm, '').replace(/\*\*/g, '');
  // 舞台提示行：(停顿) （看向窗外）
  text = text.replace(/^\s*[（(][^）)]{0,20}[）)]\s*$/gm, '');
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return text.slice(0, MAX_SCRIPT);
}

export function buildNarrationPrompt(memory, subjectName) {
  const facts = {
    主角: subjectName || '这位家人',
    标题: memory?.title || '',
    年份: memory?.year || '',
    地点: memory?.location || '',
    人物: (memory?.people || []).join('、'),
    主题: memory?.theme || '',
    原文: String(memory?.story || '').slice(0, 3000),
  };
  return `请把下面这段真实往事改写成 ${facts['主角']} 的第一人称口述。只许用这里给出的事实。\n\n${JSON.stringify(facts, null, 1)}`;
}

/**
 * 生成口述稿。模型没配或返回空就抛错——不静默降级。
 */
export async function generateNarration(memory, subjectName) {
  if (!memory) throw new ModelError('没有找到这段记忆', 404);
  const story = String(memory.story || '').trim();
  const title = String(memory.title || '').trim();
  if (!story && !title) throw new ModelError('这段记忆还没有内容，写一点再让它开口', 400);
  const text = await callModel(
    [{role: 'system', content: NARRATION_SYSTEM}, {role: 'user', content: buildNarrationPrompt(memory, subjectName)}],
    {temperature: 0.7, maxTokens: 700, timeout: 45000},
  );
  const script = cleanScript(text);
  if (script.length < 20) throw new ModelError('模型这次几乎没写出内容，请重试', 502);
  return script;
}

/**
 * 选谁来讲这段记忆：优先记忆里点名、且已经复刻过声音的那位。
 * 没有复刻过声音的人讲不了，所以 voiceId 是硬条件。
 */
export function pickNarrator(memory, members) {
  const list = Array.isArray(members) ? members : [];
  const ready = list.filter(member => member?.voiceId);
  if (!ready.length) return null;
  const named = (memory?.people || []).map(name => String(name).trim()).filter(Boolean);
  for (const name of named) {
    const hit = ready.find(member => member.name === name);
    if (hit) return hit;
  }
  return ready[0];
}

/** 同一段记忆被改动过，稿子就该重写。把 updatedAt 纳入键里。 */
export function narrationKey(memoryId, memberId, memoryVersion = '') {
  const digest = createHash('sha256')
    .update(`${memoryId}|${memberId}|${memoryVersion}`)
    .digest('base64url');
  return `nar-${digest.slice(0, 32)}`;
}

/** 视频缓存键：稿子、音色、分辨率、时长任一变化都要重生成。 */
export function videoKey({memoryId, memberId, voiceId, script, resolution, duration}) {
  const digest = createHash('sha256')
    .update([memoryId, memberId, voiceId || '', script || '', resolution, duration].join('|'))
    .digest('base64url');
  return `vid-${digest.slice(0, 32)}`;
}

/**
 * 给图生视频的提示词。只描述镜头怎么动，不许描述「发生了什么」——
 * 一旦让模型自由发挥，它就会开始编造照片里没有的人。
 */
export function buildVideoPrompt(memory) {
  const bits = ['镜头缓慢向前推进，画面有极轻微的手持呼吸感，光线自然流动，人物神态自然放松。', '保持原照片的构图、人物长相和服装，不要增加或减少任何人和物体。'];
  if (memory?.location) bits.push(`环境是${String(memory.location).slice(0, 30)}的实景，不要改变季节。`);
  return bits.join('');
}

export function videoConfigured() {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}

function dashscopeHost() {
  return process.env.DASHSCOPE_WORKSPACE_ID
    ? `${process.env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com`
    : 'dashscope.aliyuncs.com';
}

export function clampResolution(value) {
  const upper = String(value || '').toUpperCase();
  return VIDEO_RESOLUTIONS.includes(upper) ? upper : VIDEO_DEFAULT_RESOLUTION;
}

export function clampSeconds(value) {
  // null / '' / undefined 都是「没传」，要回落到默认，不能被 Number() 当成 0 再夹成最小值。
  if (value === null || value === undefined || value === '') return VIDEO_DEFAULT_SECONDS;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return VIDEO_DEFAULT_SECONDS;
  return Math.min(VIDEO_MAX_SECONDS, Math.max(VIDEO_MIN_SECONDS, n));
}

/**
 * 建一个图生视频任务。两步式：这里只拿 task_id，结果靠 fetchVideoTask 轮询。
 * 绝不在一个请求里等视频——Vercel 函数扛不住，项目里 voice 那 60 秒轮询就是前车之鉴。
 */
export async function createVideoTask({imageDataUri, prompt, resolution, duration}) {
  if (!videoConfigured()) throw new Error('未配置 DASHSCOPE_API_KEY，无法生成视频');
  if (!imageDataUri || !String(imageDataUri).startsWith('data:')) throw new Error('这张照片暂时没法送去生成，先换一张封面');
  const model = process.env.DASHSCOPE_VIDEO_MODEL || 'wan2.6-i2v-flash';
  const res = await fetch(`https://${dashscopeHost()}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model,
      input: {prompt, img_url: imageDataUri},
      parameters: {
        resolution: clampResolution(resolution),
        duration: clampSeconds(duration),
        // 关掉模型自己配的声音：我们前端叠自己的克隆配音，既省钱又是那个人的声音。
        audio: false,
        prompt_extend: true,
        watermark: false,
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const taskId = json?.output?.task_id;
  if (!res.ok || !taskId) throw new Error(json?.message || '视频任务创建失败');
  return {taskId, model};
}

/**
 * 查一次任务。返回 {status, videoUrl, message}。
 * status: pending | succeeded | failed
 * 注意 videoUrl 只有 24 小时有效期，拿到就要立刻转存。
 */
export async function fetchVideoTask(taskId) {
  if (!videoConfigured()) throw new Error('未配置 DASHSCOPE_API_KEY，无法查询视频任务');
  const res = await fetch(`https://${dashscopeHost()}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    headers: {Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`},
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || '查询视频任务失败');
  const output = json?.output || {};
  const raw = String(output.task_status || '').toUpperCase();
  if (raw === 'SUCCEEDED') return {status: 'succeeded', videoUrl: output.video_url || null};
  if (raw === 'FAILED' || raw === 'CANCELED' || raw === 'UNKNOWN') {
    return {status: 'failed', message: output.message || output.code || '生成失败'};
  }
  return {status: 'pending'};
}
