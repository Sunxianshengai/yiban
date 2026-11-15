import { cloudApi, type FamilyState, type FamilyFeed } from '~/utils/cloudApi'
import type { EntryV2, FamilyFeedSocial, FamilyTimelineEntry } from '~/utils/db'
import { computeTokens, htmlToPreview } from '~/utils/db'
import { listTombstones } from '~/composables/useEntries'

/**
 * 家庭组（附加功能）：登录后拉取组状态与家人公共日记 feed。
 *
 * 设计取舍：
 * - 家人内容不进 Dexie —— 它是在线特性（作者随时可能改回私有），保存在 useState 里，
 *   进应用/手动刷新时全量拉取，服务端 feed 也是全量返回，天然覆盖「撤回公共标记/删除」。
 * - feed 条目合成为 FamilyTimelineEntry（EntryV2 形状 + 稳定负数 id + familyAuthor 标记），
 *   时间线/详情把家人条目和本地条目同等对待，但家人条目永远只读。
 * - 自己的公共条目在 feed 里也有一份：本地已有同 cloudId 行就跳过（时间线不重复）；
 *   本地还没有（比如换了设备没来得及同步）就用 feed 那份兜底展示。
 */
const SEEN_KEY = 'jr.familySeenAt'
const EMPTY_FEED: FamilyFeed = { members: [], entries: [], socials: [], serverTime: '' }

/** 每个登录用户只自动拉一次；加入/创建组等动作后手动 refreshFamily() */
let lastAutoUser = ''
/** feed key → 合成负数 id（会话内稳定，时间线 v-for key 与缩略图索引都用它） */
const negativeIds = new Map<string, number>()
let generation = 0

function familyKeyOf(e: { ownerUserId: string; clientId: string }) {
  return `${e.ownerUserId}:${e.clientId}`
}

export function useFamilySync() {
  // useState 必须在 setup 上下文里调用（不能放模块顶层），跨组件共享靠同一个 key
  const state = useState<FamilyState>('jr.familyState', () => ({ group: null }))
  const feed = useState<FamilyFeed>('jr.familyFeed', () => ({ ...EMPTY_FEED }))
  const busy = useState('jr.familyBusy', () => false)
  const loaded = useState('jr.familyLoaded', () => false)
  const error = useState('jr.familyError', () => '')
  const { user, checking } = useCloudSync()
  const { entries } = useEntries()

  /** 拉组状态和时间线，只有当前账号的最新请求可以写入。 */
  async function refreshFamily() {
    const userId = user.value?.id
    if (!userId) return false
    const gen = ++generation
    busy.value = true
    error.value = ''
    try {
      const s = await cloudApi.familyState()
      if (gen !== generation || user.value?.id !== userId) return false
      if (state.value.group?.id !== s.group?.id) feed.value = { ...EMPTY_FEED }
      state.value = s
      const next = s.group ? await cloudApi.familyFeed() : { ...EMPTY_FEED }
      if (gen !== generation || user.value?.id !== userId) return false
      feed.value = next
      loaded.value = true
      return true
    } catch {
      if (gen === generation) error.value = '无法刷新小家，请重试。'
      return false
    } finally { if (gen === generation) busy.value = false }
  }

  const localCloudIds = computed(() => new Set(entries.value.map(e => e.cloudId).filter((v): v is string => !!v)))

  /** 家庭时间线以服务端已发布的版本为准。 */
  const sharedEntries = computed<FamilyTimelineEntry[]>(() => {
    if (!state.value.group) return []
    return feed.value.entries
      .map((e) => {
        const key = familyKeyOf(e)
        let neg = negativeIds.get(key)
        if (neg == null) { neg = -(negativeIds.size + 1); negativeIds.set(key, neg) }
        const fields = (e.fields ?? {}) as Partial<EntryV2>
        const dateOfJournal = new Date(e.dateOfJournal)
        return {
          id: neg,
          linkedAccountId: '',
          ...fields,
          // cloudId 用原始 clientId：评论/追加段落的定位、红点比对都要和服务端
          // socials 的 entryClientId（原始 clientId）对上；去重用的是上面组合 key
          cloudId: e.clientId,
          text: e.text,
          previewText: e.previewText || htmlToPreview(e.text),
          timezone: e.timezone || 'UTC',
          dateOfJournal,
          dateModified: new Date(e.dateModified),
          synced: 1,
          ...computeTokens(dateOfJournal),
          familyAuthor: { ownerUserId: e.ownerUserId, ownerNickname: e.ownerNickname },
          familyMedia: e.media,
        }
      })
  })

  // 原有时间线与本地条目混排，同一篇只显示一次。
  const familyEntries = computed(() => {
    const mine = state.value.me?.userId
    const deadCloudIds = new Set(listTombstones())
    return sharedEntries.value.filter(e => e.familyAuthor?.ownerUserId !== mine || !e.cloudId
      || (!localCloudIds.value.has(e.cloudId) && !deadCloudIds.has(e.cloudId)))
  })

  /** 某条家庭日记下的全部互动（评论 + 追加段落，按时间升序）。 */
  function socialsFor(ownerUserId: string, entryClientId: string): FamilyFeedSocial[] {
    return feed.value.socials.filter(s => s.entryOwnerUserId === ownerUserId && s.entryClientId === entryClientId)
  }

  const seenAt = useState('jr.familySeenAt', () => Number(localStorage.getItem(SEEN_KEY) || 0))

  /** 打开一篇家庭相关日记时调用：从此刻起新互动才算未读。 */
  function markFamilySeen() {
    seenAt.value = Date.now()
    try { localStorage.setItem(SEEN_KEY, String(seenAt.value)) } catch { /* 隐私模式等：红点只影响本次会话 */ }
  }

  /** 时间线红点：该条日记在上次查看后有新互动。excludeSelf 让作者不被自己的评论打扰。 */
  function hasFamilyUnseen(ownerUserId: string, entryClientId: string, excludeAuthorUserId?: string) {
    return feed.value.socials.some((s) => {
      if (s.entryOwnerUserId !== ownerUserId || s.entryClientId !== entryClientId) return false
      if (excludeAuthorUserId && s.authorUserId === excludeAuthorUserId) return false
      return +new Date(s.createdAt) > seenAt.value
    })
  }

  /** 自己的本地日记（visibility=family）是否被家人互动过。 */
  function hasFamilyUnseenForLocal(entry: EntryV2) {
    const me = state.value.me?.userId
    if (entry.visibility !== 'family' || !entry.cloudId || !me) return false
    return hasFamilyUnseen(me, entry.cloudId, me)
  }

  /** 侧栏家庭卡聚合红点：有任何不是我发的互动晚于上次查看。 */
  function hasAnyFamilyUnseen() {
    const me = state.value.me?.userId
    return feed.value.socials.some((s) => {
      if (me && s.authorUserId === me) return false
      return +new Date(s.createdAt) > seenAt.value
    })
  }

  onMounted(() => {
    // 登录态确认后再拉（Neon 冷启动要 1–5 秒，确认期间别抢先断言未登录）
    watch([user, checking], ([u, c]) => {
      if (c) return
      const userId = u?.id || ''
      if (lastAutoUser === userId) return
      generation++
      lastAutoUser = userId
      state.value = { group: null }
      feed.value = { ...EMPTY_FEED }
      busy.value = false
      loaded.value = false
      error.value = ''
      if (userId) void refreshFamily()
    }, { immediate: true })
  })

  return {
    state, feed, busy, loaded, error,
    refreshFamily, familyEntries, sharedEntries,
    socialsFor, markFamilySeen, hasFamilyUnseen, hasFamilyUnseenForLocal, hasAnyFamilyUnseen,
  }
}
