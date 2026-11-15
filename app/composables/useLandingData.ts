import type { EntryV2, MediaFileV2 } from '~/utils/db'
import { db } from '~/utils/db'
import { WEATHER_EMOJI } from '~/utils/services'
import { familyAvatarColor } from '~/utils/familyUi'
import { cloudApi } from '~/utils/cloudApi'

/**
 * 落地页演示数据：能拿到真实数据就展示真实的（自己的日记/照片/家人动态/心情曲线），
 * 拿不到（新访客/未登录）就用一套精写的示例日记本兜底。
 * 「真实优先」是这个页面的灵魂——用户在落地页看到的就是应用里自己的样子。
 */

export interface LandingEntry {
  key: string
  title: string
  snippet: string
  date: Date
  weekday: string
  day: number
  monthDay: string
  weatherEmoji?: string
  temp?: number
  place?: string
  mood?: string
  photo?: string      // objectURL（本地 blob），远端附件不取（落地页不要求登录）
  fav?: boolean
}

export interface LandingFamily {
  name: string
  members: { label: string; color: string }[]
  unread: boolean
  lines: { who: string; color: string; kind: '评论' | '追加'; text: string }[]
  latest: string
  real: boolean
}

const weekdayCn = (d: Date) => new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(d)
const stripTags = (s: string) => (s || '').replace(/<[^>]*>/g, '').trim()

function entryToLanding(e: EntryV2, photo?: string): LandingEntry {
  const text = stripTags(e.previewText || e.text)
  const lines = text.split('\n').filter(Boolean)
  const d = new Date(e.dateOfJournal)
  return {
    key: e.cloudId || String(e.id),
    title: (lines[0] || '无标题日记').slice(0, 24),
    snippet: (lines.slice(1).join(' ') || text).slice(0, 44),
    date: d,
    weekday: weekdayCn(d),
    day: d.getDate(),
    monthDay: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(d),
    weatherEmoji: e.weatherIcon ? WEATHER_EMOJI[e.weatherIcon] : undefined,
    temp: e.weatherDegreeC,
    place: e.address?.slice(0, 12),
    mood: e.sentiment === 'happy' ? '😊' : e.sentiment === 'excited' ? '😆' : e.sentiment === 'sad' ? '😢' : e.sentiment === 'down' ? '😪' : undefined,
    photo,
    fav: !!e.favourite,
  }
}

/* 示例日记本：日期动态取最近几天，细节按真实 UI 的信息密度写 */
function sampleEntries(): LandingEntry[] {
  const now = Date.now()
  const mk = (agoDays: number, hour: number, minute: number, e: Omit<LandingEntry, 'date' | 'weekday' | 'day' | 'monthDay' | 'key'>): LandingEntry => {
    const d = new Date(now - agoDays * 864e5)
    d.setHours(hour, minute, 0, 0)
    return {
      key: `sample-${agoDays}`,
      date: d,
      weekday: weekdayCn(d),
      day: d.getDate(),
      monthDay: new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(d),
      ...e,
    }
  }
  return [
    mk(0, 19, 42, {
      title: '天台上的晚风',
      snippet: '晚霞把整座城市染成橘子汽水的颜色，风把一整周的疲惫都吹散了。',
      weatherEmoji: '☀️', temp: 24, place: '滨江公园',
      mood: '😊', fav: true,
    }),
    mk(1, 21, 8, {
      title: '第一次做提拉米苏',
      snippet: '手指饼干泡咖啡时碎掉了半根，马斯卡彭倒是打得意外顺滑。冷藏三小时后，口感竟然像店里卖的。',
      mood: '😆',
    }),
    mk(2, 7, 26, {
      title: '雨中跑步五公里',
      snippet: '雨点打在帽檐上，配速刚刚好。跑到江边时一只白鹭贴着水面飞过去。',
      weatherEmoji: '🌧️', temp: 19, place: '江滨步道',
      photo: undefined,
    }),
    mk(3, 23, 5, {
      title: '加班到深夜的一天',
      snippet: '改到第七版还是被打回。但下班路上便利店的热豆浆，还是把这一天救回来了。',
      mood: '😪',
    }),
  ]
}

function sampleFamily(): LandingFamily {
  return {
    name: '我的家庭',
    members: [
      { label: '小', color: '#4CAF50' },
      { label: '满', color: '#F59E0B' },
      { label: '程', color: '#3F51B5' },
    ],
    unread: true,
    real: false,
    lines: [
      { who: '小满', color: '#F59E0B', kind: '评论', text: '照片拍得真好！下次登山带上我～' },
      { who: '小程', color: '#3F51B5', kind: '追加', text: '补充：回来路上买的板栗很甜，全家人都说好。' },
    ],
    latest: '小满：明天早上记得一起吃早餐！',
  }
}

export function useLandingData() {
  const { entries } = useEntries()
  const { state: familyState, feed: familyFeed } = useFamilySync()
  const photoUrls: string[] = []

  /** 最近 3 篇（真实或示例） */
  const heroEntries = computed<LandingEntry[]>(() => {
    try {
      const real = entries.value
        .slice()
        .sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal))
        .slice(0, 3)
      if (!real.length) return sampleEntries().slice(0, 3)
      return real.map(entryToLanding)
    } catch (e: any) {
      return [{
        key: 'err',
        title: 'ERR ' + (e?.message || String(e)),
        snippet: String(e?.stack || '').slice(0, 200),
        date: new Date(), weekday: '', day: 0, monthDay: '',
      }]
    }
  })

  const hasRealEntries = computed(() => entries.value.length > 0)

  /** 第一篇的详情照（Hero 右栏）：本地 blob 优先，其次远端附件换预签名地址（已登录时可用）。
   *  entries 是异步从 Dexie 读的，用 watch 等数据到位后执行一次。 */
  const heroPhoto = ref<string | undefined>()
  let photoRan = false
  watch(entries, async (list) => {
    if (photoRan || !list.length) return
    photoRan = true
    try {
      const first = list[0]
      if (first.id == null) return
      const media = await db.mediaFilesV2.where('jId').equals(first.id).sortBy('position')
      const img = media.find(m => m.mimeType.startsWith('image/'))
      if (!img) return
      if (img.blob) {
        const url = URL.createObjectURL(img.blob)
        photoUrls.push(url)
        heroPhoto.value = url
      } else if (img.remotePathname) {
        const { urls } = await cloudApi.downloadUrls([img.remotePathname])
        heroPhoto.value = urls[img.remotePathname]
      }
    } catch { /* 落地页不因照片失败受影响 */ }
  }, { immediate: true })
  onBeforeUnmount(() => { for (const u of photoUrls) URL.revokeObjectURL(u) })

  /** 心情月历：最近 28 天，真实 sentiment（0 无记录 1 低落 2 平静 3 开心）；无数据用示例 */
  const moodCells = computed<number[]>(() => {
    if (!entries.value.length) {
      return [2, 3, 1, 2, 0, 1, 3, 1, 2, 2, 3, 1, 0, 2, 3, 1, 2, 2, 3, 1, 2, 2, 0, 1, 3, 2, 1, 2]
    }
    const byDay = new Map<string, number>()
    for (const e of entries.value) {
      const d = new Date(e.dateOfJournal)
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const v = e.sentiment === 'happy' || e.sentiment === 'excited' ? 3 : e.sentiment === 'sad' || e.sentiment === 'down' ? 1 : 2
      byDay.set(k, v)
    }
    const out: number[] = []
    const today = new Date()
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
      out.push(byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? 0)
    }
    return out
  })

  /** 家庭预览：真实组（云端之家/成员/最新互动），未加入用示例 */
  const family = computed<LandingFamily>(() => {
    const group = familyState.value.group
    if (!group) return sampleFamily()
    const members = (familyState.value.members || []).map(m => ({
      label: (m.nickname || '家').trim().slice(0, 1).toUpperCase() || '家',
      color: familyAvatarColor(m.userId),
    }))
    const socials = familyFeed.value.socials.slice(-2)
    const mine = familyState.value.me?.userId
    const latestOther = familyFeed.value.entries.find(e => e.ownerUserId !== mine)
    const lines = socials.map(s => ({
      who: s.authorNickname,
      color: familyAvatarColor(s.authorUserId),
      kind: s.kind === 'contribution' ? '追加' as const : '评论' as const,
      text: s.content.split('\n')[0].slice(0, 30),
    }))
    return {
      name: group.name,
      members: members.length ? members : [{ label: '家', color: '#4CAF50' }],
      unread: lines.length > 0,
      real: true,
      lines: lines.length ? lines : [{ who: '家人', color: '#4CAF50', kind: '评论' as const, text: '还没有互动，去写第一篇共享日记吧。' }],
      latest: latestOther ? `${latestOther.ownerNickname}：${stripTags(latestOther.previewText).slice(0, 24)}` : '',
    }
  })

  /** 统计：真实条数/照片/连续天数（照概览页语义）；新访客展示示例本规模 */
  const totalEntries = computed(() => entries.value.length || 12)
  const photoCount = ref(0)
  const streakCount = computed(() => {
    const dates = new Set(entries.value.map(e => new Date(e.dateOfJournal).toDateString()))
    const d = new Date()
    if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
    let n = 0
    while (dates.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1) }
    return n
  })
  onMounted(async () => {
    try { photoCount.value = await db.mediaFilesV2.count() } catch { /* 统计失败不阻塞 */ }
  })

  /** 怀旧：一年前的今天（真实），没有则示例 */
  const throwback = computed(() => {
    const today = new Date()
    const hit = entries.value.find((e) => {
      const d = new Date(e.dateOfJournal)
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear()
    })
    if (hit) {
      const years = today.getFullYear() - new Date(hit.dateOfJournal).getFullYear()
      const text = stripTags(hit.previewText || hit.text).slice(0, 26)
      return { years: `${years} 年前`, text: text || '那天的日记', real: true }
    }
    return { years: '1 年前', text: '也是这样的秋天，我们在操场拍毕业照', real: false }
  })

  /** 媒体 tab：真实照片（本地 blob 优先，其余远端预签名；最多 4 张），否则示例 */
  const mediaThumbs = ref<string[]>([])
  let mediaRan = false
  watch(entries, async (list) => {
    if (mediaRan || !list.length) return
    mediaRan = true
    try {
      const rows = (await db.mediaFilesV2.toArray()).filter(m => m.mimeType.startsWith('image/')).slice(0, 4)
      const urlByRow = new Map<number, string>()
      for (const m of rows) {
        if (m.blob) {
          const url = URL.createObjectURL(m.blob)
          photoUrls.push(url)
          if (m.id != null) urlByRow.set(m.id, url)
        }
      }
      const remote = rows.filter(m => !m.blob && m.remotePathname).map(m => m.remotePathname!)
      if (remote.length) {
        const { urls } = await cloudApi.downloadUrls(remote)
        for (const m of rows) {
          if (!m.blob && m.remotePathname && urls[m.remotePathname] && m.id != null) {
            urlByRow.set(m.id, urls[m.remotePathname])
          }
        }
      }
      mediaThumbs.value = rows.map(m => (m.id != null ? urlByRow.get(m.id) : undefined)).filter((u): u is string => !!u)
    } catch { /* 媒体失败不阻塞 */ }
  }, { immediate: true })

  /** 地图册：真实有定位的条目（相对位置散点） */
  const mapPins = computed(() => {
    const withGeo = entries.value.filter(e => e.lat != null && e.lng != null).slice(0, 3)
    if (!withGeo.length) return [{ x: 18, y: 30 }, { x: 46, y: 55 }, { x: 72, y: 24 }]
    return withGeo.map((_, i) => [{ x: 18, y: 30 }, { x: 46, y: 55 }, { x: 72, y: 24 }][i])
  })

  /** 日历：真实当月有日记的日子 */
  const calendarDays = computed<Set<number>>(() => {
    const now = new Date()
    return new Set(entries.value
      .map(e => new Date(e.dateOfJournal))
      .filter(d => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth())
      .map(d => d.getDate()))
  })

  return {
    heroEntries, heroPhoto, hasRealEntries,
    moodCells, family, totalEntries, photoCount, streakCount,
    throwback, mediaThumbs, mapPins, calendarDays,
  }
}
