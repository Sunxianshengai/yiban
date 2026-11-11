/**
 * 日记伙伴的 AI 客户端（OpenAI 兼容接口）。
 *
 * 服务地址/密钥/模型由用户在本机配置（localStorage），只存在这台设备上。
 * 网页版直连同源之外的 API 需要对方允许跨域（大多数兼容网关都允许）；
 * 失败时把 HTTP 错误翻成人话，不假装成功。
 */

export interface PalConfig {
  endpoint: string
  apiKey: string
  model: string
  sttModel: string
}

export type PalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface PalMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | PalContentPart[]
}

const KEYS = { endpoint: 'jr.palEndpoint', apiKey: 'jr.palKey', model: 'jr.palModel', sttModel: 'jr.palSttModel' } as const

export function getPalConfig(): PalConfig {
  if (typeof localStorage === 'undefined') return { endpoint: '', apiKey: '', model: 'gpt-4o-mini', sttModel: 'whisper-1' }
  return {
    endpoint: localStorage.getItem(KEYS.endpoint) || '',
    apiKey: localStorage.getItem(KEYS.apiKey) || '',
    model: localStorage.getItem(KEYS.model) || 'gpt-4o-mini',
    sttModel: localStorage.getItem(KEYS.sttModel) || 'whisper-1',
  }
}

export function setPalConfig(patch: Partial<PalConfig>) {
  if (typeof localStorage === 'undefined') return
  for (const [field, key] of Object.entries(KEYS) as [keyof PalConfig, string][]) {
    const value = patch[field]
    if (value !== undefined) localStorage.setItem(key, value)
  }
}

/** 把各种失败翻成一句话（HTTP 错误体、网络异常、配置缺失）。 */
function explain(error: unknown): string {
  const e = error as { message?: string; cause?: { message?: string } }
  return e?.message || e?.cause?.message || '请求失败，请检查服务地址和网络。'
}

function base(url: string) {
  return url.replace(/\/$/, '')
}

/** 对话补全。messages 直接透传（system 提示词由调用方组装，图片走 vision content 数组）。 */
export async function palChat(endpoint: string, apiKey: string, model: string, messages: PalMessage[]): Promise<string> {
  if (!endpoint.trim()) throw new Error('请先在下方配置服务地址。')
  let res: Response
  try {
    res = await fetch(base(endpoint) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages, temperature: 0.7 }),
    })
  } catch (error) {
    throw new Error(explain(error))
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message || body?.message || ''
    } catch { /* 非 JSON 错误体就用状态码 */ }
    throw new Error(`服务请求失败（HTTP ${res.status}）${detail ? `：${detail}` : '。'}`)
  }
  const data = await res.json()
  const text: unknown = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('服务返回了空回复。')
  return text.trim()
}

/** 语音转文字（/audio/transcriptions）。不支持该端点的服务会得到诚实报错。 */
export async function palTranscribe(endpoint: string, apiKey: string, sttModel: string, file: Blob, fileName: string): Promise<string> {
  if (!endpoint.trim()) throw new Error('请先在下方配置服务地址。')
  const form = new FormData()
  form.append('file', file, fileName)
  form.append('model', sttModel || 'whisper-1')
  let res: Response
  try {
    res = await fetch(base(endpoint) + '/audio/transcriptions', {
      method: 'POST',
      ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
      body: form,
    })
  } catch (error) {
    throw new Error(explain(error))
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message || body?.message || ''
    } catch { /* 忽略 */ }
    throw new Error(`语音转写失败（HTTP ${res.status}）${detail ? `：${detail}` : '。请确认服务支持 /audio/transcriptions 接口。'}`)
  }
  const data = await res.json()
  const text: unknown = data?.text
  if (typeof text !== 'string' || !text.trim()) throw new Error('转写结果为空。')
  return text.trim()
}

/** 纯文本草稿 → 日记正文 HTML（条目正文存的是 HTML，逐段包 <p>）。 */
export function draftTextToHtml(text: string): string {
  return text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
}
