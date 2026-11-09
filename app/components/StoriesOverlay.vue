<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { countWords } from '~/utils/uiText'

/**
 * Stories full-screen view — official description [J17]: full-screen cards with
 * stats, throwback recaps and Coach prompts, auto-advancing. Card VISUALS are not
 * captured from the original (never opened during baseline) — structure follows the
 * official description with real local data; visual fidelity marked pending in F-020.
 */
const props = defineProps<{ throwbacks: EntryV2[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { entries } = useEntries()

const stats = computed(() => {
  const now = new Date()
  const monthEntries = entries.value.filter((e) => {
    const d = new Date(e.dateOfJournal)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const words = monthEntries.reduce((n, e) => n + countWords(e.previewText || ''), 0)
  // streak: consecutive days ending today (or yesterday) with entries
  const days = new Set(entries.value.map((e) => new Date(e.dateOfJournal).toDateString()))
  let streak = 0
  const cur = new Date()
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1)
  while (days.has(cur.toDateString())) { streak++; cur.setDate(cur.getDate() - 1) }
  return { monthCount: monthEntries.length, words, streak, total: entries.value.length }
})

const cards = computed(() => {
  const list: { kind: string; title: string; lines: string[] }[] = []
  list.push({
    kind: 'stats',
    title: `已记录 ${stats.value.total} 篇日记`,
    lines: [
      `本月 ${stats.value.monthCount} 篇 · ${stats.value.words} 词`,
      stats.value.streak > 1 ? `🔥 已连续记录 ${stats.value.streak} 天` : '今天写一篇日记，开始连续记录。',
    ],
  })
  if (props.throwbacks.length) {
    const t = props.throwbacks[0]
    const d = new Date(t.dateOfJournal)
    list.push({
      kind: 'throwback',
      title: `${d.getFullYear()} 年的今天`,
      lines: [(t.previewText || '').slice(0, 90)],
    })
  }
  list.push({
    kind: 'coach',
    title: '日记教练',
    lines: ['今天感觉怎么样？写下来，留给未来的自己。'],
  })
  return list
})

const idx = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => { idx.value = (idx.value + 1) % cards.value.length }, 4500)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
function next() { idx.value = (idx.value + 1) % cards.value.length }
</script>

<template>
  <div class="jr-stories-full" @click="next">
    <button class="jr-stories-x" @click.stop="emit('close')"><JrIcon :path="mdiClose" :size="20" /></button>
    <div class="jr-stories-progress">
      <div v-for="(c, i) in cards" :key="i" class="jr-sp" :class="{ on: i <= idx }" />
    </div>
    <div class="jr-stories-card" :data-kind="cards[idx].kind">
      <div class="jr-sc-kind">{{ cards[idx].kind === 'stats' ? '你的日记' : cards[idx].kind === 'throwback' ? '往日回忆' : '日记教练' }}</div>
      <h2>{{ cards[idx].title }}</h2>
      <p v-for="(l, i) in cards[idx].lines" :key="i">{{ l }}</p>
      <span class="jr-sc-hint">点击继续</span>
    </div>
  </div>
</template>
