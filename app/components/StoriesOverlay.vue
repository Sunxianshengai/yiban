<script setup lang="ts">
import { mdiClose } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

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
  const words = monthEntries.reduce((n, e) => n + (e.previewText || '').split(/\s+/).filter(Boolean).length, 0)
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
    title: `${stats.value.total} entries and counting`,
    lines: [
      `${stats.value.monthCount} entries this month · ${stats.value.words} words`,
      stats.value.streak > 1 ? `🔥 ${stats.value.streak}-day streak` : 'Write today to start a streak',
    ],
  })
  if (props.throwbacks.length) {
    const t = props.throwbacks[0]
    const d = new Date(t.dateOfJournal)
    list.push({
      kind: 'throwback',
      title: `On this day in ${d.getFullYear()}`,
      lines: [(t.previewText || '').slice(0, 90)],
    })
  }
  list.push({
    kind: 'coach',
    title: 'Coach',
    lines: ['How are you feeling today? Write it down — your future self will thank you.'],
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
      <div class="jr-sc-kind">{{ cards[idx].kind === 'stats' ? 'Your Journal' : cards[idx].kind === 'throwback' ? 'Throwback' : 'Coach' }}</div>
      <h2>{{ cards[idx].title }}</h2>
      <p v-for="(l, i) in cards[idx].lines" :key="i">{{ l }}</p>
      <span class="jr-sc-hint">Tap to continue</span>
    </div>
  </div>
</template>
