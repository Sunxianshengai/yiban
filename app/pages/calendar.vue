<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight, mdiPlus } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entriesOn } = useEntries()
const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth() + 1) // 1-based

const monthRows = ref<EntryV2[][]>([])
const monthLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year.value, month.value - 1, 1)))

async function load() {
  const list = await entriesOn(year.value, month.value)
  const byDay = new Map<number, EntryV2[]>()
  for (const e of list) {
    const d = new Date(e.dateOfJournal)
    if (!byDay.has(d.getDate())) byDay.set(d.getDate(), [])
    byDay.get(d.getDate())!.push(e)
  }
  const first = new Date(year.value, month.value - 1, 1)
  const startCol = (first.getDay() + 6) % 7 // Monday-first (original supports system/Mon/Sun; Mon used as default, setting pending)
  const daysInMonth = new Date(year.value, month.value, 0).getDate()
  const cells: (EntryV2[] | null)[] = Array(startCol).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(byDay.get(d) || [])
  while (cells.length % 7) cells.push(null)
  monthRows.value = []
  for (let i = 0; i < cells.length; i += 7) monthRows.value.push(cells.slice(i, i + 7))
}
onMounted(load)
watch([year, month], load)

function prev() { if (--month.value < 1) { month.value = 12; year.value-- } }
function next() { if (++month.value > 12) { month.value = 1; year.value++ } }
function dayLabel(cells: (EntryV2[] | null)[], idx: number) {
  const offset = cells.findIndex((c) => c !== null || idx >= 0)
  return idx
}
function dayNum(rowIdx: number, colIdx: number) {
  const flat = monthRows.value.flat()
  let day = 0
  for (let i = 0; i <= rowIdx * 7 + colIdx; i++) if (flat[i] !== null) day++
  return day
}
function cellsAt(rowIdx: number, colIdx: number) {
  return monthRows.value[rowIdx]?.[colIdx] ?? null
}
function isToday(rowIdx: number, colIdx: number) {
  return cellsAt(rowIdx, colIdx) !== null && dayNum(rowIdx, colIdx) === today.getDate() && month.value === today.getMonth() + 1 && year.value === today.getFullYear()
}

const editorOpen = ref(false)
const editorDate = ref<Date>(new Date())
function createOn(rowIdx: number, colIdx: number) {
  if (cellsAt(rowIdx, colIdx) === null) return
  editorDate.value = new Date(year.value, month.value - 1, dayNum(rowIdx, colIdx), 0, 0) // 00:00 per official calendar-create doc
  editorOpen.value = true
}
</script>

<template>
  <div class="jr-page jr-cal">
    <div class="jr-cal-head">
      <button class="jr-icon-btn" @click="prev"><JrIcon :path="mdiChevronLeft" :size="20" /></button>
      <h1>{{ monthLabel }}</h1>
      <button class="jr-icon-btn" @click="next"><JrIcon :path="mdiChevronRight" :size="20" /></button>
      <span style="flex:1" />
      <button class="jr-icon-btn" title="New entry today" @click="editorDate = new Date(); editorOpen = true"><JrIcon :path="mdiPlus" :size="20" /></button>
    </div>
    <div class="jr-cal-grid jr-cal-dow">
      <span v-for="d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="d">{{ d }}</span>
    </div>
    <div class="jr-cal-grid jr-cal-body">
      <template v-for="(row, r) in monthRows" :key="r">
        <div
          v-for="(c, ci) in row" :key="ci"
          class="jr-cal-cell" :class="{ off: c === null, today: isToday(r, ci), has: !!c?.length }"
          @click="createOn(r, ci)"
        >
          <template v-if="c !== null">
            <span class="jr-cal-day" :class="{ today: isToday(r, ci) }">{{ dayNum(r, ci) }}</span>
            <div class="jr-cal-entries">
              <div v-for="e in c.slice(0, 2)" :key="e.id" class="jr-cal-pill">{{ (e.previewText || '').slice(0, 22) || 'Entry' }}</div>
              <div v-if="c.length > 2" class="jr-cal-more">+{{ c.length - 2 }}</div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <EntryEditor v-if="editorOpen" :initial-date="editorDate" @done="editorOpen = false; load()" />
  </div>
</template>
