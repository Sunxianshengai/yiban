<script setup lang="ts">
import { mdiArrowLeft, mdiCalendarMonth, mdiPlus } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const route = useRoute()
const { entries, refresh, allMedia, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash } = useEntries()
const { firstDay, orderedWeekdays } = useWeekStart()
const today = new Date()
const monthFormat = new Intl.DateTimeFormat('zh-CN', { month: 'long', year: 'numeric' })
const shortMonth = new Intl.DateTimeFormat('zh-CN', { month: 'short' })
const fullDate = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit' })

function localDate(year: number, month: number, day = 1) {
  const date = new Date(0)
  date.setFullYear(year, month, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function dateKey(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function readDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year) return null
  const parsed = localDate(year!, month! - 1, day)
  return dateKey(parsed) === value ? parsed : null
}

const monthId = (date: Date) => date.getFullYear() * 12 + date.getMonth()
const dateInMonth = (id: number) => localDate(Math.floor(id / 12), id % 12)
const minMonth = 12
const maxMonth = 9999 * 12 + 11
const selectedDate = computed(() => readDate(route.query.date))
const selectedKey = computed(() => selectedDate.value ? dateKey(selectedDate.value) : null)
const targetMonth = (value: unknown) => typeof value === 'string' ? readDate(`${value}-01`) : null
const anchorMonth = ref(monthId(selectedDate.value || targetMonth(route.query.month) || today))
const startMonth = ref(Math.max(minMonth, anchorMonth.value - 2))
const endMonth = ref(Math.min(maxMonth, anchorMonth.value + 2))
const monthPane = ref<HTMLElement | null>(null)
const dayStrip = ref<HTMLElement | null>(null)
let lastMonthScroll: number | null = null
let extending = false
let restoringScroll = false

const byDay = computed(() => {
  const groups = new Map<string, EntryV2[]>()
  for (const entry of entries.value) {
    const key = dateKey(new Date(entry.dateOfJournal))
    const group = groups.get(key)
    if (group) group.push(entry)
    else groups.set(key, [entry])
  }
  return groups
})
const dayEntries = computed(() => selectedKey.value ? byDay.value.get(selectedKey.value) || [] : [])
const selectedEntry = computed(() => dayEntries.value.find(entry => entry.id === Number(route.query.entry)) || null)
const months = computed(() => Array.from({ length: endMonth.value - startMonth.value + 1 }, (_, index) => {
  const id = startMonth.value + index
  const first = dateInMonth(id)
  const startCol = (first.getDay() - firstDay.value + 7) % 7
  const days = localDate(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: ({ day: number; date: Date; key: string; items: EntryV2[] } | null)[] = Array(42).fill(null)
  for (let day = 1; day <= days; day++) {
    const date = localDate(first.getFullYear(), first.getMonth(), day)
    const key = dateKey(date)
    cells[startCol + day - 1] = { day, date, key, items: byDay.value.get(key) || [] }
  }
  return { id, label: monthFormat.format(first), cells }
}))
const daysAround = computed(() => {
  const selected = selectedDate.value
  if (!selected) return []
  return Array.from({ length: 31 }, (_, index) => {
    const date = localDate(selected.getFullYear(), selected.getMonth(), selected.getDate() + index - 15)
    return { date, key: dateKey(date) }
  }).filter(({ date }) => date.getFullYear() > 0 && date.getFullYear() <= 9999)
})

async function positionMonth() {
  restoringScroll = true
  await nextTick()
  const pane = monthPane.value
  const anchor = pane?.querySelector<HTMLElement>(`[data-month="${anchorMonth.value}"]`)
  if (pane && anchor) pane.scrollTop = lastMonthScroll ?? Math.max(0, anchor.offsetTop - 68)
  requestAnimationFrame(() => { restoringScroll = false })
}

async function extendMonths() {
  const pane = monthPane.value
  if (!pane || restoringScroll || extending) return
  const beforeHeight = pane.scrollHeight
  const beforeTop = pane.scrollTop
  const nearTop = beforeTop < 160 && startMonth.value > minMonth
  const nearBottom = beforeHeight - beforeTop - pane.clientHeight < 160 && endMonth.value < maxMonth
  if (!nearTop && !nearBottom) return
  extending = true
  if (nearTop) startMonth.value = Math.max(minMonth, startMonth.value - 4)
  else endMonth.value = Math.min(maxMonth, endMonth.value + 4)
  await nextTick()
  if (nearTop) pane.scrollTop = beforeTop + pane.scrollHeight - beforeHeight
  extending = false
}

async function chooseDay(key: string, replace = false) {
  if (monthPane.value) lastMonthScroll = monthPane.value.scrollTop
  await navigateTo({ path: '/calendar', query: { month: key.slice(0, 7), date: key } }, { replace })
}

function clearDay() {
  const month = route.query.month
  return navigateTo({ path: '/calendar', query: { month } })
}

async function selectEntry(entry?: EntryV2) {
  await navigateTo({ path: '/calendar', query: { ...route.query, entry: entry?.id } }, { replace: true })
}

async function positionDay() {
  await nextTick()
  const strip = dayStrip.value
  const day = strip?.querySelector<HTMLElement>('[aria-current="date"]')
  if (strip && day) strip.scrollLeft = day.offsetLeft - (strip.clientWidth - day.offsetWidth) / 2
}

watch(selectedKey, key => key ? positionDay() : positionMonth())
watch(() => route.query.month, month => {
  const target = targetMonth(month)
  if (!target || selectedKey.value) return
  const id = monthId(target)
  if (id !== anchorMonth.value && (lastMonthScroll == null || id < startMonth.value || id > endMonth.value)) resetMonths(id)
})

function resetMonths(id: number) {
  anchorMonth.value = id
  startMonth.value = Math.max(minMonth, id - 2)
  endMonth.value = Math.min(maxMonth, id + 2)
  lastMonthScroll = null
  void positionMonth()
}

const picker = ref<HTMLDialogElement | null>(null)
const pickMonth = ref(today.getMonth())
const pickYear = ref(today.getFullYear())
const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('zh-CN', { month: 'long' }).format(localDate(2000, month)))

function openPicker() {
  const pane = monthPane.value
  const middle = pane ? pane.scrollTop + pane.clientHeight / 2 : 0
  const visible = [...(pane?.querySelectorAll<HTMLElement>('[data-month]') || [])].find(section => section.offsetTop + section.offsetHeight > middle)
  const date = dateInMonth(visible ? Number(visible.dataset.month) : anchorMonth.value)
  pickMonth.value = date.getMonth()
  pickYear.value = date.getFullYear()
  picker.value?.showModal()
}

async function jumpToMonth() {
  if (!Number.isInteger(pickYear.value) || pickYear.value < 1 || pickYear.value > 9999) return
  const date = localDate(pickYear.value, pickMonth.value)
  picker.value?.close()
  resetMonths(monthId(date))
  await navigateTo({ path: '/calendar', query: { month: dateKey(date).slice(0, 7) } }, { replace: true })
}

const thumbs = shallowRef<Record<number, { url: string; video: boolean }>>({})
let thumbGeneration = 0
function releaseThumbnails() {
  for (const { url } of Object.values(thumbs.value)) URL.revokeObjectURL(url)
}
async function loadThumbnails() {
  const generation = ++thumbGeneration
  const rows = await allMedia()
  if (generation !== thumbGeneration) return
  const result: typeof thumbs.value = {}
  for (const media of rows) {
    if (media.jId == null || !media.blob || result[media.jId]) continue
    const video = media.mimeType.startsWith('video/')
    if (video || media.mimeType.startsWith('image/')) result[media.jId] = { url: URL.createObjectURL(media.blob), video }
  }
  releaseThumbnails()
  thumbs.value = result
}
function cellThumbnail(items: EntryV2[]) {
  const id = items[0]?.id
  return id == null ? undefined : thumbs.value[id]
}

const editorOpen = ref(false)
const editorDate = ref(today)
const editing = shallowRef<EntryV2 | null>(null)
const editingMeta = computed(() => {
  const entry = editing.value
  if (!entry) return undefined
  const { address, lat, lng, sentiment, activity, weatherIcon, weatherDegreeC, weatherPlace, weatherDescription, weatherId, tagWordIds } = entry
  return { address, lat, lng, sentiment, activity, weatherIcon, weatherDegreeC, weatherPlace, weatherDescription, weatherId, tagWordIds }
})

function openEditor(entry: EntryV2 | null = null) {
  editing.value = entry
  editorDate.value = entry ? new Date(entry.dateOfJournal) : selectedDate.value || new Date()
  editorOpen.value = true
}
async function onDone() {
  editorOpen.value = false
  editing.value = null
  await refresh()
  await loadThumbnails()
}
async function onTrash() {
  const id = selectedEntry.value?.id
  if (id == null) return
  await moveToTrash(id)
  await selectEntry()
  await loadThumbnails()
}

onMounted(async () => {
  if (selectedKey.value) await positionDay()
  else await positionMonth()
  await loadThumbnails()
})
onBeforeUnmount(() => { thumbGeneration++; releaseThumbnails() })
</script>

<template>
  <div class="jr-calendar-page">
    <header class="jr-calendar-toolbar">
      <button v-if="selectedDate" class="jr-icon-btn" type="button" title="返回日历" @click="clearDay"><JrIcon :path="mdiArrowLeft" :size="20" /></button>
      <h1><img src="/favicon.svg" alt=""> 旅程日记</h1>
      <button class="jr-calendar-add" type="button" title="新建日记" @click="openEditor()"><JrIcon :path="mdiPlus" :size="22" /></button>
    </header>
    <div class="jr-calendar-split">
      <section class="jr-calendar-leading" aria-label="日历">
        <template v-if="!selectedDate">
          <div class="jr-cal-grid jr-cal-dow">
            <span v-for="day in orderedWeekdays" :key="day">{{ day }}</span>
          </div>
          <div ref="monthPane" class="jr-calendar-months" @scroll.passive="extendMonths">
            <section v-for="month in months" :key="month.id" :data-month="month.id" class="jr-calendar-month">
              <h2>{{ month.label }}</h2>
              <div class="jr-cal-grid jr-cal-body">
                <template v-for="(cell, index) in month.cells" :key="index">
                  <button v-if="cell" type="button" class="jr-cal-cell" :class="{ today: cell.key === dateKey(today), has: cell.items.length, thumbnail: cellThumbnail(cell.items) }"
                    :title="fullDate.format(cell.date)" :aria-label="`${fullDate.format(cell.date)}${cell.items.length ? '，' + cell.items.length + ' 篇日记' : ''}`"
                    :aria-current="cell.key === dateKey(today) ? 'date' : undefined" @click="chooseDay(cell.key)">
                    <template v-if="cellThumbnail(cell.items)">
                      <video v-if="cellThumbnail(cell.items)?.video" :src="cellThumbnail(cell.items)?.url" muted preload="metadata" aria-hidden="true" />
                      <img v-else :src="cellThumbnail(cell.items)?.url" alt="" loading="lazy">
                    </template>
                    <span class="jr-cal-day">{{ cell.day }}</span>
                    <span v-if="cell.key === dateKey(today)" class="jr-calendar-today-dot" />
                  </button>
                  <span v-else class="jr-cal-cell off" aria-hidden="true" />
                </template>
              </div>
            </section>
          </div>
          <button class="jr-calendar-jump" type="button" title="跳转到指定年月" @click="openPicker"><JrIcon :path="mdiCalendarMonth" :size="22" /></button>
        </template>
        <template v-else>
          <div ref="dayStrip" class="jr-calendar-day-strip" aria-label="选择日期">
            <button v-for="day in daysAround" :key="day.key" type="button" :title="fullDate.format(day.date)"
              :aria-current="day.key === selectedKey ? 'date' : undefined" @click="chooseDay(day.key, true)">
              <strong>{{ String(day.date.getDate()).padStart(2, '0') }}</strong>
              <span>{{ shortMonth.format(day.date) }}</span>
              <span>{{ day.date.getFullYear() }}</span>
            </button>
          </div>
          <div class="jr-calendar-day-entries" aria-label="当天的日记">
            <div v-if="!dayEntries.length" class="jr-empty">
              <div class="big"><JrIcon :path="mdiCalendarMonth" :size="42" /></div>
              暂无日记。
            </div>
            <button v-for="entry in dayEntries" :key="entry.id" type="button" class="jr-entry jr-calendar-entry" :class="{ selected: selectedEntry?.id === entry.id }" @click="selectEntry(entry)">
              <span class="date">{{ timeFormat.format(entry.dateOfJournal) }}</span>
              <span class="preview">{{ entry.previewText || '无正文' }}</span>
            </button>
          </div>
        </template>
      </section>

      <section class="jr-detail-col jr-calendar-detail" :class="{ 'has-entry': selectedEntry }" aria-label="日记详情">
        <NuxtLink v-if="selectedEntry" class="jr-calendar-timeline" :to="{ path: '/', query: { entry: selectedEntry.id } }">在时间线中打开</NuxtLink>
        <EntryDetail :entry="selectedEntry" @edit="openEditor(selectedEntry)"
          @toggle-favourite="selectedEntry?.id != null && toggleFavourite(selectedEntry.id)"
          @duplicate="selectedEntry?.id != null && duplicateEntry(selectedEntry.id)"
          @save-as-template="selectedEntry?.id != null && saveAsTemplate(selectedEntry.id)" @trash="onTrash" />
      </section>
    </div>

    <dialog ref="picker" class="jr-calendar-picker" aria-labelledby="calendar-picker-title" @click.self="picker?.close()">
      <form @submit.prevent="jumpToMonth">
        <h2 id="calendar-picker-title">选择日期</h2>
        <div class="jr-calendar-picker-fields">
          <label>月份<select v-model.number="pickMonth" aria-label="月份"><option v-for="(name, index) in monthNames" :key="name" :value="index">{{ name }}</option></select></label>
          <label>年份<input v-model.number="pickYear" aria-label="年份" type="number" min="1" max="9999" required></label>
        </div>
        <div class="jr-calendar-picker-actions">
          <button class="jr-btn" type="button" @click="picker?.close()">取消</button>
          <button class="jr-btn" type="submit">完成</button>
        </div>
      </form>
    </dialog>

    <EntryEditor v-if="editorOpen" :entry-id="editing?.id" :initial-text="editing?.text" :initial-date="editorDate" :initial-meta="editingMeta" @done="onDone" />
  </div>
</template>

<style scoped>
.jr-calendar-page { display: flex; flex: 1; min-height: 0; flex-direction: column; background: var(--jr-surface); }
.jr-calendar-toolbar { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 16px 0 20px; background: var(--jr-secondary-container); border-bottom: 1px solid var(--jr-outline-variant); }
.jr-calendar-toolbar h1 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; letter-spacing: .03em; text-transform: uppercase; color: var(--jr-primary); }
.jr-calendar-toolbar img { width: 20px; height: 20px; }
.jr-calendar-add { display: grid; place-items: center; width: 40px; height: 40px; margin-left: auto; color: var(--jr-on-primary); background: var(--jr-primary); border: 0; border-radius: 12px; }
.jr-calendar-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); flex: 1; min-height: 0; }
.jr-calendar-leading { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; border-right: 1px solid var(--jr-outline-variant); }
.jr-calendar-leading .jr-cal-dow { gap: 0; margin: 0; padding: 6px 0; border-bottom: 1px solid var(--jr-outline-variant); color: var(--jr-on-surface-variant); background: var(--jr-surface); }
.jr-calendar-months { position: relative; flex: 1; overflow-y: auto; overflow-anchor: none; }
.jr-calendar-month { padding: 46px 0 24px; }
.jr-calendar-month h2 { margin: 0 14px 26px; font-size: 19px; }
.jr-calendar-month .jr-cal-body { gap: 2px; margin: 0; }
.jr-calendar-month .jr-cal-cell { display: grid; place-items: center; position: relative; aspect-ratio: 1; min-height: 0; padding: 0; border: 0; border-radius: 0; background: color-mix(in srgb, var(--jr-surface) 82%, var(--jr-secondary-container)); }
.jr-calendar-month .jr-cal-cell.off { background: color-mix(in srgb, var(--jr-secondary-container) 58%, var(--jr-surface)); }
.jr-calendar-month .jr-cal-cell.has { background: var(--jr-primary); }
.jr-calendar-month .jr-cal-cell.thumbnail { background: var(--jr-on-bg); }
.jr-calendar-month button.jr-cal-cell:hover { box-shadow: inset 0 0 0 2px var(--jr-primary-fixed-dim); }
.jr-calendar-month .jr-cal-day { z-index: 1; font-size: clamp(12px, 1.25vw, 16px); }
.jr-calendar-month .has .jr-cal-day { color: var(--jr-on-primary); }
.jr-calendar-month .jr-cal-cell :is(img, video) { width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover; opacity: .64; }
.jr-calendar-today-dot { position: absolute; bottom: 8%; width: 5px; height: 5px; border-radius: 50%; background: var(--jr-error); }
.jr-calendar-jump { display: grid; place-items: center; position: absolute; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; border: 0; background: var(--jr-tertiary-container, #dee0ff); color: var(--jr-on-tertiary-container, #141937); box-shadow: 0 2px 6px rgb(0 0 0 / 24%); }
.jr-calendar-day-strip { position: relative; display: flex; gap: 8px; overflow-x: auto; padding: 16px 12px 8px; scrollbar-width: thin; }
.jr-calendar-day-strip button { flex: 0 0 56px; display: grid; gap: 1px; padding: 8px 4px; border: 0; border-radius: 8px; background: var(--jr-surface-variant); color: var(--jr-on-surface-variant); }
.jr-calendar-day-strip button[aria-current='date'] { background: var(--jr-tertiary-container, #dee0ff); color: var(--jr-on-tertiary-container, #141937); }
.jr-calendar-day-strip button span { font-size: 11px; }
.jr-calendar-day-entries { padding: 0 14px; overflow: auto; }
.jr-calendar-entry { display: grid; gap: 6px; text-align: left; width: 100%; border: 0; background: transparent; }
.jr-calendar-entry.selected { background: var(--jr-secondary-container); }
.jr-calendar-timeline { align-self: flex-end; margin: 12px 18px 0; color: var(--jr-primary); font-size: 13px; }
.jr-calendar-picker { width: min(330px, calc(100vw - 32px)); padding: 20px; border: 1px solid var(--jr-outline-variant); border-radius: 16px; color: var(--jr-on-bg); background: var(--jr-surface); }
.jr-calendar-picker::backdrop { background: rgb(0 0 0 / 32%); }
.jr-calendar-picker h2 { margin: 0 0 16px; font-size: 18px; }
.jr-calendar-picker-fields { display: grid; grid-template-columns: 1fr 100px; gap: 12px; }
.jr-calendar-picker-fields label { display: grid; gap: 6px; font-size: 13px; }
.jr-calendar-picker-fields :is(select, input) { width: 100%; padding: 8px; border: 1px solid var(--jr-outline-variant); border-radius: 8px; color: inherit; background: var(--jr-surface); }
.jr-calendar-picker-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
@media (max-width: 900px) {
  .jr-calendar-split { grid-template-columns: minmax(0, 1fr); }
  .jr-calendar-detail:not(.has-entry) { display: none; }
  .jr-calendar-detail.has-entry { max-height: 45vh; border-top: 1px solid var(--jr-outline-variant); }
  .jr-calendar-split:has(.has-entry) { grid-template-rows: minmax(0, 1fr) minmax(0, auto); }
}
</style>
