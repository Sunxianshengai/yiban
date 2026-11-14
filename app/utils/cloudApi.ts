/**
 * 云同步的 HTTP 封装。
 *
 * 全部走同源请求，会话是 HttpOnly cookie（浏览器自动带），前端不接触 token。
 * Windows 版复用同一套端点，只是把 cookie 换成它自己保存的会话。
 */
import type { FamilyFeedMedia, FamilyFeedSocial } from './db'

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

// ---- 家庭组（附加功能） ----

export interface FamilyMemberInfo {
  userId: string
  nickname: string
  role: string
  joinedAt?: string
}

export interface FamilyGroupInfo {
  id: string
  name: string
  inviteCode: string
  ownerUserId: string
}

export interface FamilyState {
  group: FamilyGroupInfo | null
  me?: { userId: string; nickname: string; role: string }
  members?: FamilyMemberInfo[]
}

export interface FamilyFeedEntry {
  ownerUserId: string
  ownerNickname: string
  clientId: string
  text: string
  previewText: string
  timezone: string
  dateOfJournal: string
  dateModified: string
  fields: Record<string, unknown>
  media: FamilyFeedMedia[]
}

export interface FamilyFeed {
  members: FamilyMemberInfo[]
  entries: FamilyFeedEntry[]
  socials: FamilyFeedSocial[]
  serverTime: string
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

  // 家庭组：家人内容是在线特性，服务端按组过滤，私有日记永远不出现在这些接口里
  familyState: () => call<FamilyState>('/api/family/state', 'GET'),
  familyCreateGroup: (body: { name: string; nickname: string }) => call<FamilyState>('/api/family/group', 'POST', body),
  familyJoin: (body: { code: string; nickname: string }) => call<FamilyState>('/api/family/join', 'POST', body),
  familySetNickname: (nickname: string) => call<{ ok: boolean; nickname: string }>('/api/family/nickname', 'POST', { nickname }),
  familyLeave: () => call<{ ok: boolean; dissolved: boolean }>('/api/family/leave', 'POST', {}),
  familyFeed: () => call<FamilyFeed>('/api/family/feed', 'GET'),
  familyMediaUrls: (pathnames: string[]) => call<{ urls: Record<string, string> }>('/api/family/media-url', 'POST', { pathnames }),
  familySocial: (body: { entryOwnerUserId: string; entryClientId: string; kind: 'comment' | 'contribution'; content: string }) =>
    call<{ social: FamilyFeedSocial }>('/api/family/social', 'POST', body),
}
