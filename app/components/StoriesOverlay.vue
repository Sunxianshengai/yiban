<script setup lang="ts">
import { mdiClose, mdiPause, mdiPlay, mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

/**
 * Stories 全屏视图 — 视觉对照原版实测（.scratch/cdp-capture/out/22-stories-fullscreen.png，2026-11-10）：
 * 深色全屏遮罩 + 右上 X + 暂停 + 分段进度条 + 底部翻页箭头 + 右侧下一卡预览。
 * 卡1 Statistics（N Entries · N Days + 近 6 个月 Last Year/This Year 柱状图）；
 * 卡2 日历（深色格，有日记日高亮）；卡3 Coach（web 变体被会员门控，复刻保留本地诚实版）；
 * 另按官方描述含 Throwback 回顾卡。
 */
const props = defineProps<{ throwbacks: EntryV2[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { entries } = useEntries()

const DURATION = 4500
const idx = ref(0)
const paused = ref(false)
let elapsed = 0
let startedAt = 0
let raf: number | null = null
const progress = ref(0)

const monthly = computed(() => {
  // 近 6 个月：thisYear = 今年该月篇数，lastYear = 去年同月篇数
  const now = new Date()
  const months: { label: string; m: number; thisYear: number; lastYear: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const count = (y: number) => entries.value.filter((e) => {
      const de = new Date(e.dateOfJournal)
      return de.getFullYear() === y && de.getMonth() === d.getMonth()
    }).length
    months.push({ label: `${d.getMonth() + 1}月`, m: d.getMonth(), thisYear: count(d.getFullYear()), lastYear: count(d.getFullYear() - 1) })
  }
  return months
})
const chartMax = computed(() => Math.max(1, ...monthly.value.flatMap((m) => [m.thisYear, m.lastYear])))

const daysWithEntries = computed(() => new Set(entries.value.map((e) => new Date(e.dateOfJournal).toDateString())))
const stats = computed(() => {
  const now = new Date()
  const monthEntries = entries.value.filter((e) => {
    const d = new Date(e.dateOfJournal)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  // streak: 连续记录天数（含今天或昨天起算）
  const days = daysWithEntries.value
  let streak = 0
  const cur = new Date()
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1)
  while (days.has(cur.toDateString())) { streak++; cur.setDate(cur.getDate() - 1) }
  return { monthCount: monthEntries.length, total: entries.value.length, days: days.size, streak }
})

const cards = computed(() => {
  const list: { kind: string }[] = [{ kind: 'stats' }]
  if (props.throwbacks.length) list.push({ kind: 'throwback' })
  list.push({ kind: 'calendar' })
  list.push({ kind: 'coach' })
  return list
})

function tick(ts: number) {
  if (!paused.value) {
    if (!startedAt) startedAt = ts
    progress.value = Math.min(1, (elapsed + (ts - startedAt)) / DURATION)
    if (progress.value >= 1) { advance(); elapsed = 0; startedAt = ts; }
  } else if (startedAt) { elapsed += ts - startedAt; startedAt = 0 }
  raf = requestAnimationFrame(tick)
}
function advance() { idx.value = (idx.value + 1) % cards.value.length; progress.value = 0 }
function go(delta: number) {
  idx.value = (idx.value + delta + cards.value.length) % cards.value.length
  progress.value = 0; elapsed = 0; startedAt = 0
}
function togglePause() { paused.value = !paused.value }
onMounted(() => { raf = requestAnimationFrame(tick) })
onBeforeUnmount(() => { if (raf) cancelAnimationFrame(raf) })

const calCells = computed(() => {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const cells: (null | { day: number; has: boolean; today: boolean })[] = []
  for (let i = 0; i < (first.getDay() + 1) % 7; i++) cells.push(null) // 周日起排
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), d)
    cells.push({ day: d, has: daysWithEntries.value.has(dt.toDateString()), today: d === now.getDate() })
  }
  return cells
})
const throwback = computed(() => {
  const t = props.throwbacks[0]
  if (!t) return null
  const d = new Date(t.dateOfJournal)
  return { year: d.getFullYear(), text: (t.previewText || '').slice(0, 110), monthDay: `${d.getMonth() + 1}月${d.getDate()}日` }
})
</script>

<template>
  <div class="jr-stories-full" @click="advance">
    <button class="jr-stories-x" aria-label="关闭" @click.stop="emit('close')"><JrIcon :path="mdiClose" :size="18" /></button>

    <div class="jr-stories-top">
      <button class="jr-stories-pause" :aria-label="paused ? '播放' : '暂停'" @click.stop="togglePause">
        <JrIcon :path="paused ? mdiPlay : mdiPause" :size="16" />
      </button>
      <div class="jr-stories-progress">
        <div v-for="(c, i) in cards" :key="i" class="jr-sp">
          <div v-if="i === idx" class="jr-sp-fill" :style="{ width: `${progress * 100}%` }" />
          <div v-else-if="i < idx" class="jr-sp-fill" style="width:100%" />
        </div>
      </div>
    </div>

    <div class="jr-stories-stage">
      <!-- 当前卡 -->
      <div class="jr-stories-card" :data-kind="cards[idx].kind">
        <template v-if="cards[idx].kind === 'stats'">
          <h2 class="jr-sc-title">统计</h2>
          <p class="jr-sc-sub">{{ stats.total }} 篇日记 · {{ stats.days }} 天</p>
          <div class="jr-sc-chart">
            <div v-for="m in monthly" :key="m.label" class="jr-sc-month">
              <div class="jr-sc-bars">
                <span class="jr-sc-bar last" :style="{ height: `${(m.lastYear / chartMax) * 100}%` }" />
                <span class="jr-sc-bar this" :style="{ height: `${(m.thisYear / chartMax) * 100}%` }" />
              </div>
              <span class="jr-sc-mlabel">{{ m.label }}</span>
            </div>
          </div>
          <div class="jr-sc-legend"><span class="lg lg-first lg-last" />去年 <span class="lg lg-this" />今年</div>
        </template>

        <template v-else-if="cards[idx].kind === 'throwback' && throwback">
          <h2 class="jr-sc-title">{{ throwback.year }} 年的今天</h2>
          <p class="jr-sc-sub">{{ throwback.monthDay }}</p>
          <p class="jr-sc-text">{{ throwback.text }}</p>
        </template>

        <template v-else-if="cards[idx].kind === 'calendar'">
          <h2 class="jr-sc-title">本月记录</h2>
          <div class="jr-sc-cal">
            <div v-for="(c, i) in calCells" :key="i" class="jr-sc-cell" :class="{ has: c?.has, today: c?.today, empty: !c }">
              <span v-if="c">{{ c.day }}</span>
            </div>
          </div>
        </template>

        <template v-else>
          <h2 class="jr-sc-title">日记教练</h2>
          <p class="jr-sc-text">今天感觉怎么样？写下来，留给未来的自己。</p>
        </template>
      </div>

      <!-- 右侧下一卡预览（原版设计） -->
      <div v-if="cards.length > 1" class="jr-stories-peek" aria-hidden="true">
        <div v-if="cards[(idx + 1) % cards.length].kind === 'calendar'" class="jr-sc-cal jr-peek-cal">
          <div v-for="(c, i) in calCells" :key="i" class="jr-sc-cell" :class="{ has: c?.has, today: c?.today, empty: !c }">
            <span v-if="c">{{ c.day }}</span>
          </div>
        </div>
        <div v-else class="jr-peek-blank" />
      </div>
    </div>

    <div class="jr-stories-nav" @click.stop>
      <button class="jr-stories-arrow" :disabled="idx === 0" aria-label="上一卡" @click="go(-1)"><JrIcon :path="mdiChevronLeft" :size="20" /></button>
      <button class="jr-stories-arrow" aria-label="下一卡" @click="advance"><JrIcon :path="mdiChevronRight" :size="20" /></button>
    </div>
  </div>
</template>
