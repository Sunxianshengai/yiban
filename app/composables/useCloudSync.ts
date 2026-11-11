import type { EntryV2, MediaFileV2 } from '~/utils/db'
import { db, computeTokens, htmlToPreview, newCloudId } from '~/utils/db'
import { listTombstones, clearTombstones, listMediaTombstones, clearMediaTombstones } from '~/composables/useEntries'
import { cloudApi, type CloudUser, type WireEntry, type WireMedia } from '~/utils/cloudApi'

/**
 * 云同步：本地优先，用户显式开启后才上传。
 *
 * 为什么这样设计：
 * - 日记先写进 IndexedDB，断网照样能写；同步是可选的开关，不是使用前提。
 * - 同步只搬"变更"：本地用 dateModified / updatedAt 做增量，服务端用 (user_id, client_id) 对齐。
 * - 附件大，走私有 Blob 直传：先问服务端要一次性 PUT 地址，浏览器直接传，不经过函数。
 */
const SWITCH_KEY = 'jr.cloudSync'
const LAST_KEY = 'jr.cloudSyncAt'
const SINCE_KEY = 'jr.cloudSyncSince'

export interface SyncOutcome {
  ok: boolean
  message: string
  uploaded?: number
  downloaded?: number
  mediaUploaded?: number
}

/**
 * 登录态与开关是所有页面共享的一份状态。
 * 之前每次调用 useCloudSync() 都新建 ref：设置页写进去的 user 和别的组件读到的不一定是同一份，
 * 更糟的是「刚开始确认登录态」（Neon 冷启动 1–5 秒）时用户点开关，会被告知「先登录」——
 * 明明已经登录。所以放到模块级单例，并单独记一个 checking。
 */
const user = ref<CloudUser | null>(null)
const enabled = ref(typeof localStorage === 'undefined' ? false : localStorage.getItem(SWITCH_KEY) === '1')
const lastSyncAt = ref(typeof localStorage === 'undefined' ? '' : localStorage.getItem(LAST_KEY) || '')
const busy = ref(false)
const error = ref('')
/** 是否还在向服务端确认登录态；此时不能断言「未登录」。 */
const checking = ref(true)
let refreshed = false

function entryClientId(entry: EntryV2) {
  // 必须用跨设备稳定的 cloudId。早期版本用自增 id，两台机器的第一篇都是 1，会互相覆盖。
  return entry.cloudId || String(entry.id)
}

function toWire(entry: EntryV2, tagTitles: string[]): WireEntry {
  const { id: _id, text, previewText, timezone, dateOfJournal, dateModified, ...rest } = entry
  return {
    clientId: entryClientId(entry),
    text,
    previewText,
    timezone,
    dateOfJournal: new Date(dateOfJournal).toISOString(),
    dateModified: new Date(dateModified).toISOString(),
    // 其余业务字段（地点/天气/心情/收藏…）整体塞进 fields，避免每加一个字段就改服务端
    fields: rest as Record<string, unknown>,
    tagTitles,
    deleted: false,
  }
}

/** 每次登录/登出都自增；用来丢弃「发出更早、回来更晚」的 me() 结果。 */
let authGeneration = 0

/** 问服务端要当前登录用户；确认期间 checking 为 true，别把它当成「未登录」。 */
async function refreshUser() {
  const generation = authGeneration
  checking.value = true
  try {
    const r = await cloudApi.me()
    // 登录请求可能先回来：这时 me() 的旧结果已经过时，不能覆盖刚登录的用户
    if (generation === authGeneration) user.value = r.user
  } catch {
    if (generation === authGeneration) user.value = null
  } finally {
    if (generation === authGeneration) {
      checking.value = false
      refreshed = true
    }
  }
}

export function useCloudSync() {

  async function register(email: string, password: string) {
    error.value = ''
    try {
      const r = await cloudApi.register(email, password)
      authGeneration++
      user.value = r.user
      checking.value = false
      refreshed = true
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    }
  }

  async function login(email: string, password: string) {
    error.value = ''
    try {
      const r = await cloudApi.login(email, password)
      authGeneration++
      user.value = r.user
      checking.value = false
      refreshed = true
      return true
    } catch (e) {
      error.value = (e as Error).message
      return false
    }
  }

  async function logout() {
    try { await cloudApi.logout() } catch { /* 已经掉线也算退出成功 */ }
    authGeneration++
    user.value = null
    checking.value = false
    setEnabled(false)
  }

  function setEnabled(value: boolean) {
    enabled.value = value
    localStorage.setItem(SWITCH_KEY, value ? '1' : '0')
  }

  /** 把本地日记整理成线上格式（含标签标题）。 */
  async function localWire(): Promise<WireEntry[]> {
    const tagById = new Map((await db.tagWordsV2.toArray()).flatMap(t => (t.id == null ? [] : [[t.id, t.title] as const])))
    const rows = await db.entriesV2.toArray()
    // 导入等旧路径建行时没有 cloudId：推送前补上并落库，否则会拿自增 id 当云端主键
    for (const entry of rows) {
      if (!entry.cloudId && entry.id != null) {
        entry.cloudId = newCloudId()
        await db.entriesV2.update(entry.id, { cloudId: entry.cloudId })
      }
    }
    const live = rows.map((entry) => {
      const titles = (entry.tagWordIds ?? []).flatMap(id => (tagById.get(id) ? [tagById.get(id)!] : []))
      return toWire(entry, titles)
    })
    // 本机删掉的日记也要让云端知道，否则换台设备它还在
    const tombstones = listTombstones().map((clientId): WireEntry => ({
      clientId,
      text: '',
      previewText: '',
      timezone: 'UTC',
      dateOfJournal: new Date(0).toISOString(),
      dateModified: new Date().toISOString(),
      fields: {},
      tagTitles: [],
      deleted: true,
    }))
    return [...live, ...tombstones]
  }

  /** 服务端条目写回本地：本地没有就新建，云端更新更晚就覆盖正文与字段。 */
  async function applyRemote(entry: WireEntry) {
    const fields = (entry.fields ?? {}) as Partial<EntryV2>
    // 按 cloudId 找本地行；早先用自增 id 当主键的旧行会被 v3 迁移补上 cloudId
    const existing = await db.entriesV2.where('cloudId').equals(entry.clientId).first()
      ?? (Number.isFinite(Number(entry.clientId)) ? await db.entriesV2.get(Number(entry.clientId)) : undefined)
    if (entry.deleted) {
      if (existing?.id != null) await db.entriesV2.delete(existing.id)
      return 0
    }
    const dateOfJournal = new Date(entry.dateOfJournal)
    const dateModified = new Date(entry.dateModified)
    const base: EntryV2 = {
      linkedAccountId: fields.linkedAccountId ?? '',
      timezone: entry.timezone || 'UTC',
      type: fields.type || 'journal',
      ...fields,
      text: entry.text,
      previewText: entry.previewText || htmlToPreview(entry.text),
      dateOfJournal,
      dateModified,
      synced: 1,
      ...computeTokens(dateOfJournal),
    }
    if (existing?.id != null) {
      if (+new Date(existing.dateModified) >= +dateModified) return 0
      await db.entriesV2.update(existing.id, base)
      return 1
    }
    await db.entriesV2.add(base)
    return 1
  }

  /** 上传还没传过的附件（只传本地有 blob 的）。 */
  async function uploadPendingMedia(): Promise<number> {
    const rows = await db.mediaFilesV2.toArray()
    let uploaded = 0
    for (const row of rows) {
      if (!row.blob || row.id == null || row.jId == null) continue
      if (row.remotePathname) continue
      const entry = await db.entriesV2.get(row.jId)
      if (!entry?.id) continue
      // 附件路径要挂在稳定的 cloudId 下，否则另一台设备算出来的路径对不上
      if (!entry.cloudId) {
        entry.cloudId = newCloudId()
        await db.entriesV2.update(entry.id, { cloudId: entry.cloudId })
      }
      if (!row.cloudId) {
        row.cloudId = newCloudId()
        await db.mediaFilesV2.update(row.id, { cloudId: row.cloudId })
      }
      const entryClientId = entry.cloudId
      const mediaClientId = row.cloudId
      try {
        const { pathname, uploadUrl } = await cloudApi.uploadUrl({
          mediaClientId,
          entryClientId,
          fileName: row.fileName,
          mimeType: row.mimeType || 'application/octet-stream',
          sizeBytes: row.blob.size,
          position: row.position,
        })
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': row.mimeType || 'application/octet-stream' },
          body: row.blob,
        })
        if (!res.ok) throw new Error(`附件上传失败（${res.status}）`)
        await db.mediaFilesV2.update(row.id, { remotePathname: pathname, uploaded: 1 })
        uploaded++
      } catch (e) {
        error.value = (e as Error).message
        break
      }
    }
    return uploaded
  }

  /** 把云端附件元数据落到本地（无 blob，渲染时换预签名地址）。 */
  async function applyRemoteMedia(media: WireMedia) {
    // 两把钥匙都能对上行：pathname 是上传路径，cloudId 是同步主键（重传/换路径时以 cloudId 为准）
    const existing = await db.mediaFilesV2.where('remotePathname').equals(media.pathname).first()
      ?? await db.mediaFilesV2.where('cloudId').equals(media.clientId).first()
    if (media.deleted) {
      if (existing?.id != null) await db.mediaFilesV2.delete(existing.id)
      return 0
    }
    // 用 cloudId 反查所属日记：本地主键每台设备都不一样
    const entry = await db.entriesV2.where('cloudId').equals(media.entryClientId).first()
    if (!entry?.id) return 0
    if (existing?.id != null) {
      if (existing.remotePathname !== media.pathname) {
        await db.mediaFilesV2.update(existing.id, { remotePathname: media.pathname })
      }
      return 0
    }
    await db.mediaFilesV2.add({
      linkedAccountId: entry.linkedAccountId ?? '',
      cloudId: media.clientId,
      jId: entry.id,
      createdAt: new Date(media.updatedAt),
      fileName: media.fileName,
      mimeType: media.mimeType,
      ext: (media.fileName.split('.').pop() || '').toLowerCase(),
      position: media.position,
      uploaded: 1,
      remotePathname: media.pathname,
    })
    return 1
  }

  /** 全部同步：推本地 → 拉云端 → 传附件 → 拉附件清单。 */
  async function syncAll(): Promise<SyncOutcome> {
    // 还在确认登录态时不能断言「未登录」——Neon 冷启动要 1–5 秒，用户手快就会撞上
    if (checking.value && !user.value) {
      await refreshUser()
    }
    if (!user.value) return { ok: false, message: '请先登录账号，再同步日记。' }
    if (!enabled.value) return { ok: false, message: '同步开关没打开：日记只存在这台设备上。' }
    if (busy.value) return { ok: false, message: '正在同步，请稍候。' }
    busy.value = true
    error.value = ''
    try {
      const since = localStorage.getItem(SINCE_KEY) || undefined
      const outgoing = await localWire()
      const pushed = await cloudApi.push(outgoing)
      // 推送成功就把本地行标记为已同步，列表里不再显示「等待上传」
      for (const wire of outgoing) {
        if (!wire.deleted) await db.entriesV2.where('cloudId').equals(wire.clientId).modify({ synced: 1 })
      }

      let downloaded = 0
      for (const entry of pushed.entries) downloaded += await applyRemote(entry)

      const pulled = await cloudApi.pull(since)
      for (const entry of pulled.entries) downloaded += await applyRemote(entry)

      const mediaUploaded = await uploadPendingMedia()
      // 本机删掉的附件先告诉服务端（软删除），再拉清单 —— 顺序反了会把刚删的拉回来
      const mediaDead = listMediaTombstones()
      if (mediaDead.length) await cloudApi.deleteMedia(mediaDead)
      const mediaPulled = await cloudApi.pullMedia(since)
      for (const item of mediaPulled.media) await applyRemoteMedia(item)

      const stamp = new Date()
      lastSyncAt.value = new Intl.DateTimeFormat('zh-CN', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      }).format(stamp)
      localStorage.setItem(LAST_KEY, lastSyncAt.value)
      localStorage.setItem(SINCE_KEY, pulled.serverTime)
      // 墓碑已经推给服务端了，别下次再推一遍
      clearTombstones(listTombstones())
      clearMediaTombstones(mediaDead)
      const extra = mediaUploaded ? `，上传 ${mediaUploaded} 个附件` : ''
      return { ok: true, message: `已同步：${outgoing.length} 篇上行，${downloaded} 篇下行${extra}。`, downloaded, mediaUploaded }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    } finally {
      busy.value = false
    }
  }

  // 只在首次挂载时问一次服务端；之后由登录/登出自己更新，避免每次进页面都等 Neon
  onMounted(() => { if (!refreshed) refreshUser() })

  return { user, enabled, lastSyncAt, busy, error, checking, refreshUser, register, login, logout, setEnabled, syncAll }
}
