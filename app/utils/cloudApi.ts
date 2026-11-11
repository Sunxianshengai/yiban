/**
 * 云同步的 HTTP 封装。
 *
 * 全部走同源请求，会话是 HttpOnly cookie（浏览器自动带），前端不接触 token。
 * Windows 版复用同一套端点，只是把 cookie 换成它自己保存的会话。
 */

export interface CloudUser {
  id: string
  email: string
}

export interface WireEntry {
  clientId: string
  text: string
  previewText: string
  timezone: string
  dateOfJournal: string
  dateModified: string
  fields: Record<string, unknown>
  tagTitles: string[]
  deleted: boolean
  updatedAt: string
}

export interface WireMedia {
  clientId: string
  entryClientId: string
  pathname: string
  fileName: string
  mimeType: string
  sizeBytes: number
  position: number
  deleted: boolean
  updatedAt: string
}

/** 把服务端的错误体翻成人看得懂的一句话。 */
function explain(error: unknown): string {
  const e = error as { statusMessage?: string; data?: { statusMessage?: string; message?: string }; message?: string }
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || e?.message || '网络异常，请稍后再试。'
}

async function call<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  try {
    return await $fetch<T>(path, { method, body: body as Record<string, unknown> | undefined })
  } catch (error) {
    throw new Error(explain(error))
  }
}

export const cloudApi = {
  me: () => call<{ user: CloudUser | null }>('/api/auth/me', 'GET'),
  register: (email: string, password: string) => call<{ user: CloudUser }>('/api/auth/register', 'POST', { email, password }),
  login: (email: string, password: string) => call<{ user: CloudUser }>('/api/auth/login', 'POST', { email, password }),
  logout: () => call<{ ok: boolean }>('/api/auth/logout', 'POST'),

  pull: (since?: string) =>
    call<{ entries: WireEntry[]; serverTime: string }>(`/api/entries${since ? `?since=${encodeURIComponent(since)}` : ''}`, 'GET'),
  push: (entries: WireEntry[]) =>
    call<{ entries: WireEntry[]; serverTime: string }>('/api/entries/push', 'POST', { entries }),

  pullMedia: (since?: string) =>
    call<{ media: WireMedia[]; serverTime: string }>(`/api/media${since ? `?since=${encodeURIComponent(since)}` : ''}`, 'GET'),
  uploadUrl: (body: { mediaClientId: string; entryClientId: string; fileName: string; mimeType: string; sizeBytes: number; position: number }) =>
    call<{ pathname: string; uploadUrl: string }>('/api/media/upload-url', 'POST', body),
  downloadUrls: (pathnames: string[]) => call<{ urls: Record<string, string> }>('/api/media/url', 'POST', { pathnames }),
  deleteMedia: (clientIds: string[]) => call<{ ok: boolean }>('/api/media/delete', 'POST', { clientIds }),
}
