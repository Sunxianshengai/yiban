import { cloudApi, type FamilyState, type FamilyFeed } from '~/utils/cloudApi'
import type { EntryV2, FamilyFeedSocial, FamilyTimelineEntry } from '~/utils/db'
import { computeTokens, htmlToPreview } from '~/utils/db'

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
  const busy = ref(false)
  const loaded = ref(false)
  const { user, checking } = useCloudSync()
  const { entries } = useEntries()

  /** 拉组状态 + 家人 feed（全量）。失败静默：保持上一次的内容。 */
  async function refreshFamily() {
    if (busy.value) return
    const gen = ++generation
    busy.value = true
    try {
      const s = await cloudApi.familyState()
      if (gen !== generation) return
      state.value = s
      feed.value = s.group ? await cloudApi.familyFeed() : { ...EMPTY_FEED }
      loaded.value = true
    } catch { /* 未登录或网络异常：保持现状 */ }
    finally { if (gen === generation) busy.value = false }
  }

  const localCloudIds = computed(() => new Set(entries.value.map(e => e.cloudId).filter((v): v is string => !!v)))

  /** feed 条目 → 时间线可用的只读行（EntryV2 形状 + familyAuthor 标记）。 */
  const familyEntries = computed<FamilyTimelineEntry[]>(() => {
    if (!state.value.group) return []
    const mine = state.value.me?.userId
    return feed.value.entries
      .filter(e => !(mine && e.ownerUserId === mine && localCloudIds.value.has(e.clientId)))
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

  /** 某条家庭日记下的全部互动（评论 + 追加段落，按时间升序）。 */
  function socialsFor(ownerUserId: string, entryClientId: string): FamilyFeedSocial[] {
    return feed.value.socials.filter(s => s.entryOwnerUserId === ownerUserId && s.entryClientId === entryClientId)
  }

  const seenAt = ref(typeof localStorage === 'undefined' ? 0 : Number(localStorage.getItem(SEEN_KEY) || 0))

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

  onMounted(() => {
    // 登录态确认后再拉（Neon 冷启动要 1–5 秒，确认期间别抢先断言未登录）
    watch([user, checking], ([u, c]) => {
      if (c) return
      if (u) {
        if (lastAutoUser !== u.id) {
          lastAutoUser = u.id
          void refreshFamily()
        }
      } else {
        generation++
        lastAutoUser = ''
        state.value = { group: null }
        feed.value = { ...EMPTY_FEED }
        loaded.value = false
      }
    }, { immediate: true })
  })

  return {
    state, feed, busy, loaded,
    refreshFamily, familyEntries,
    socialsFor, markFamilySeen, hasFamilyUnseen, hasFamilyUnseenForLocal,
  }
}
