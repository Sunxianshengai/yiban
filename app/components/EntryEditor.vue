<script setup lang="ts">
import { mdiCalendarBlankOutline, mdiMapMarkerOutline, mdiWeatherSunny, mdiEmoticonOutline, mdiRun, mdiTagOutline, mdiFormatSize, mdiPlus, mdiFormatBold, mdiFormatItalic, mdiFormatStrikethrough, mdiFormatUnderline, mdiFormatColorText, mdiFormatAlignLeft, mdiFormatAlignCenter, mdiUndo, mdiRedo, mdiChevronDown, mdiChevronLeft, mdiChevronRight, mdiBookOpenOutline, mdiClose, mdiCheck, mdiFormatListBulleted, mdiFormatListNumbered, mdiCheckboxMarkedOutline } from '@mdi/js'
import type { EntryV2, TagWordV2 } from '~/utils/db'
import { db } from '~/utils/db'
import { fetchWeather, searchPlaces, WEATHER_EMOJI } from '~/utils/services'

const linkUrl = ref('')
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
const datePop = ref(false)
const dpMonth = ref(new Date().getMonth() + 1)
const dpYear = ref(new Date().getFullYear())
const dpTime = ref('')

const props = defineProps<{ entryId?: number; initialText?: string; initialDate?: Date; initialMeta?: Partial<EntryV2> }>()
const emit = defineEmits<{ (e: 'done'): void }>()

const area = ref<HTMLElement | null>(null)
const words = ref(0)
const chars = ref(0)
const hasContent = ref(false)
const date = ref(props.initialDate ? new Date(props.initialDate) : new Date())

const meta = ref<Partial<EntryV2>>({ ...props.initialMeta })
const openPop = ref<'style' | 'insert' | 'color' | 'loc' | 'weather' | 'mood' | 'activity' | 'tags' | null>(null)

const MOODS = ['excited', 'happy', 'calm', 'so-so', 'tired', 'sad', 'angry', 'anxious']
const ACTIVITIES = ['still', 'walking', 'running', 'cycling', 'driving', 'flying']
const WEATHER_ICONS = ['sun', 'partly', 'cloud', 'fog', 'rain', 'snow', 'storm']
const MOOD_LABEL: Record<string, string> = { excited: '😆', happy: '😊', calm: '😌', 'so-so': '😐', tired: '😪', sad: '😢', angry: '😠', anxious: '😰' }

const tags = ref<TagWordV2[]>([])
const tagInput = ref('')
const weatherBusy = ref(false)
const placeQuery = ref('')
const placeHits = ref<{ address: string; lat: number; lng: number }[]>([])
const placeBusy = ref(false)

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date.value).replace(' at ', ' At '),
)
const locLabel = computed(() => meta.value.address || (meta.value.lat != null ? `${meta.value.lat?.toFixed(4)}, ${meta.value.lng?.toFixed(4)}` : ''))

onMounted(async () => {
  if (props.initialText && area.value) {
    const { hydrateMediaHtml } = useEntries()
    area.value.innerHTML = await hydrateMediaHtml(props.initialText)
    recount()
  } else if (area.value && !area.value.innerHTML.trim()) {
    // seed an empty block so formatBlock/style commands always have a target
    area.value.innerHTML = '<p><br></p>'
  }
  tags.value = await useEntries().listTags()
  area.value?.focus()
})

function recount() {
  const t = area.value?.innerText || ''
  const wordsArr = t.trim().split(/\s+/).filter(Boolean)
  words.value = t.trim() ? wordsArr.length : 0
  chars.value = t.replace(/\n/g, '').length
  hasContent.value = !!t.trim() || !!area.value?.querySelector('img')
}

// Selection survives popover clicks: snapshot on edits, restore before commands.
let savedRange: Range | null = null
function saveSel() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount && area.value?.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange()
  }
}
function restoreSel() {
  if (savedRange && area.value?.contains(savedRange.startContainer)) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange)
  }
  area.value?.focus()
}

function cmd(name: string, val?: string) {
  restoreSel()
  document.execCommand(name, false, val)
  recount()
}

function setBlock(tag: string) {
  cmd('formatBlock', tag)
  openPop.value = null
}

function insertHtml(html: string) {
  cmd('insertHTML', html)
  openPop.value = null
}

/** Task list item (checkbox toggles natively inside contenteditable in Chromium). */
function insertTaskList() {
  cmd('insertHTML', '<ul class="jr-task"><li><label><input type="checkbox">Task</label></li></ul><p><br></p>')
  recount()
}

/** Markdown auto-convert on space, per official "partial Markdown auto conversion": #-h1..h3, >-quote, -/*-ul, 1.-ol, []-task. */
function onAreaKeydown(e: KeyboardEvent) {
  saveSel()
  // Tab / Shift+Tab adjust list indentation (official desktop behavior [J8])
  if (e.key === 'Tab') {
    const sel = window.getSelection()
    if (sel && area.value?.contains(sel.anchorNode)) {
      const li = (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('li')
      if (li) {
        e.preventDefault()
        document.execCommand(e.shiftKey ? 'outdent' : 'indent')
        saveSel()
        return
      }
    }
  }
  if (e.key !== ' ') return
  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed) return
  const node = sel.anchorNode
  if (!node || !area.value?.contains(node)) return
  // anchor may be a text node (char offset) or an element (child offset) — handle both
  let before: string
  if (node.nodeType === 3) before = (node.textContent || '').slice(0, sel.anchorOffset)
  else {
    const kids = Array.from(node.childNodes).slice(0, sel.anchorOffset)
    before = kids.map((c) => c.textContent || '').join('')
  }
  const line = before.split('\n').pop() || ''
  const rules: [RegExp, string | null, string | undefined][] = [
    [/^#$/, 'formatBlock', 'h1'],
    [/^##$/, 'formatBlock', 'h2'],
    [/^###$/, 'formatBlock', 'h3'],
    [/^>$/, 'formatBlock', 'blockquote'],
    [/^[-*]$/, 'insertUnorderedList', undefined],
    [/^1\.$/, 'insertOrderedList', undefined],
    [/^\[\]$/, 'task', undefined],
  ]
  for (const [re, cmdName, val] of rules) {
    if (!re.test(line)) continue
    e.preventDefault()
    for (let i = 0; i < line.length; i++) document.execCommand('delete')
    // apply on the LIVE selection — restoring a saved range here would point at deleted nodes
    if (cmdName === 'task') {
      // live selection (no restore — saved range points at deleted marker nodes)
      document.execCommand('insertHTML', false, '<ul class="jr-task"><li><label><input type="checkbox">Task</label></li></ul><p><br></p>')
    } else {
      document.execCommand(cmdName, false, val)
    }
    recount()
    return
  }
}

function setBlockKeep(tag: string) {
  restoreSel()
  document.execCommand('formatBlock', false, tag)
  recount()
}

// ---- date picker popover (mini month grid + time) ----
const dpCells = computed(() => {
  const first = new Date(dpYear.value, dpMonth.value - 1, 1)
  const startCol = (first.getDay() + 6) % 7
  const days = new Date(dpYear.value, dpMonth.value - 1, 0).getDate()
  const cells: (number | null)[] = Array(startCol).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
})
const dpLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(dpYear.value, dpMonth.value - 1, 1)))
function dpPrev() { if (--dpMonth.value < 1) { dpMonth.value = 12; dpYear.value-- } }
function dpNext() { if (++dpMonth.value > 12) { dpMonth.value = 1; dpYear.value++ } }
function openDatePicker() {
  const d = new Date(date.value)
  dpMonth.value = d.getMonth() + 1
  dpYear.value = d.getFullYear()
  const p = (n: number) => String(n).padStart(2, '0')
  dpTime.value = `${p(d.getHours())}:${p(d.getMinutes())}`
  datePop.value = true
}
function dpPick(day: number) {
  if (!day) return
  const [h, m] = (dpTime.value || '00:00').split(':').map(Number)
  date.value = new Date(dpYear.value, dpMonth.value - 1, day, h || 0, m || 0)
  datePop.value = false
}

function pickFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*,audio/*'
  input.multiple = true
  input.onchange = async () => {
    const files = Array.from(input.files || [])
    for (const f of files.slice(0, 20)) {
      if (f.type.startsWith('video/') && f.size > 200 * 1024 * 1024) continue // mp4 ≤200MB per official doc
      // stage: persist later on save with real entry id
      staged.value.push(f)
      const url = URL.createObjectURL(f)
      if (f.type.startsWith('image/')) {
        insertHtml(`<img src="${url}" data-stage="${staged.value.length - 1}" style="max-width:100%;border-radius:8px">`)
      } else if (f.type.startsWith('video/')) {
        insertHtml(`<video src="${url}" controls data-stage="${staged.value.length - 1}" style="max-width:100%;border-radius:8px"></video>`)
      } else {
        insertHtml(`<p><a data-stage="${staged.value.length - 1}" href="${url}">🎙 ${f.name}</a></p>`)
      }
    }
    openPop.value = null
  }
  input.click()
}

const staged = ref<File[]>([])

function useMyLocation() {
  navigator.geolocation?.getCurrentPosition(
    async (p) => {
      meta.value = { ...meta.value, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }
      weatherBusy.value = true
      const w = await fetchWeather(meta.value.lat!, meta.value.lng!)
      if (w) meta.value = { ...meta.value, weatherIcon: w.icon, weatherDegreeC: w.degreeC, weatherDescription: w.description }
      weatherBusy.value = false
    },
    () => {},
    { timeout: 6000 },
  )
}

async function searchPlace() {
  if (!placeQuery.value.trim()) return
  placeBusy.value = true
  placeHits.value = await searchPlaces(placeQuery.value)
  placeBusy.value = false
}

function pickPlace(h: { address: string; lat: number; lng: number }) {
  meta.value = { ...meta.value, address: h.address, lat: +h.lat.toFixed(6), lng: +h.lng.toFixed(6) }
  placeHits.value = []
}

async function ensureTagIfNew() {
  const t = tagInput.value.trim().toLowerCase()
  if (!t) return
  const tag = await useEntries().ensureTag(t)
  tags.value = await useEntries().listTags()
  const cur = meta.value.tagWordIds || []
  if (!cur.includes(tag.id!)) meta.value = { ...meta.value, tagWordIds: [...cur, tag.id!] }
  tagInput.value = ''
}

function toggleTag(t: TagWordV2) {
  const cur = meta.value.tagWordIds || []
  meta.value = { ...meta.value, tagWordIds: cur.includes(t.id!) ? cur.filter((x) => x !== t.id) : [...cur, t.id!] }
}

const stagedIds = ref<number[]>([])

async function save() {
  const { createEntry, updateEntry, attachMedia } = useEntries()
  let text = area.value?.innerHTML || ''
  if (text === '<p><br></p>' || text === '<div><br></div>') text = ''
  if (!text.trim() && !staged.value.length) { emit('done'); return }

  const savedIds: number[] = []
  for (const f of staged.value) savedIds.push(await attachMedia(0, f, savedIds.length))
  stagedIds.value = savedIds

  let finalText = text
  savedIds.forEach((id, i) => {
    finalText = finalText.replaceAll(`data-stage="${i}"`, `data-media-id="${id}"`)
  })

  let id: number
  if (props.entryId) {
    await updateEntry(props.entryId, finalText, date.value, meta.value)
    id = props.entryId
  } else {
    id = await createEntry(finalText, date.value, meta.value)
  }
  for (const mid of savedIds) {
    await db.mediaFilesV2.update(mid, { jId: id })
  }
  emit('done')
}
</script>

<template>
  <div class="jr-editor">
    <div class="jr-editor-head">
      <button class="dt" @click="openDatePicker">
        <JrIcon :path="mdiCalendarBlankOutline" :size="19" />
        <span>{{ dateLabel }}</span>
        <JrIcon :path="mdiChevronDown" :size="18" />
      </button>
      <button class="done" @click="save">Done</button>
      <div v-if="datePop" class="jr-pop jr-dp" @click.stop>
        <div class="jr-pop-head">
          <button class="tb" @click="dpPrev"><JrIcon :path="mdiChevronLeft" :size="16" /></button>
          <span style="flex:1;text-align:center">{{ dpLabel }}</span>
          <button class="tb" @click="dpNext"><JrIcon :path="mdiChevronRight" :size="16" /></button>
          <button class="tb" @click="datePop = false"><JrIcon :path="mdiClose" :size="16" /></button>
        </div>
        <div class="jr-dp-grid jr-dp-dow"><span v-for="(d, i) in ['M','T','W','T','F','S','S']" :key="i">{{ d }}</span></div>
        <div class="jr-dp-grid">
          <button
            v-for="(c, i) in dpCells" :key="i"
            class="jr-dp-cell" :class="{ off: !c }"
            @click="dpPick(c || 0)"
          >{{ c || '' }}</button>
        </div>
        <div class="jr-pop-row" style="margin-top:6px">
          <input v-model="dpTime" type="time" class="jr-pop-input" />
        </div>
      </div>
    </div>

    <div class="jr-editor-body">
      <div
        ref="area"
        class="jr-editor-area"
        contenteditable="true"
        :spellcheck="spellcheck"
        @input="recount(); saveSel()"
        @keydown="onAreaKeydown"
        @keyup="saveSel"
        @mouseup="saveSel"
      />
    </div>

    <!-- popovers -->
    <div v-if="openPop" class="jr-pop" @click.stop>
      <div class="jr-pop-head">
        <span>{{ openPop }}</span>
        <button class="tb" @click="openPop = null"><JrIcon :path="mdiClose" :size="16" /></button>
      </div>

      <template v-if="openPop === 'style'">
        <button class="jr-pop-item" @click="setBlock('p')">Body</button>
        <button class="jr-pop-item" @click="setBlock('h1')">Heading 1</button>
        <button class="jr-pop-item" @click="setBlock('h2')">Heading 2</button>
        <button class="jr-pop-item" @click="setBlock('h3')">Heading 3</button>
        <button class="jr-pop-item" @click="setBlock('blockquote')">Quote</button>
      </template>

      <template v-else-if="openPop === 'insert'">
        <button class="jr-pop-item" @click="insertHtml('<hr>')">Divider</button>
        <button class="jr-pop-item" @click="pickFile">Photo / Video / Audio</button>
        <div class="jr-pop-row">
          <input v-model="linkUrl" placeholder="https://…" style="flex:1" />
          <button class="jr-pop-item" style="width:auto" @click="insertHtml(`<a href='${linkUrl || '#'}' target='_blank'>${linkUrl || 'link'}</a>`)"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <button class="jr-pop-item" @click="insertHtml('<table border=\'1\' style=\'border-collapse:collapse\'><tr><th>H</th><th>H</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')">Table 2×2</button>
        <button class="jr-pop-item" @click="insertHtml('<code>code</code>')">Inline code</button>
      </template>

      <template v-else-if="openPop === 'color'">
        <div class="jr-colors">
          <button v-for="c in ['#171C1E', '#BA1A1A', '#C4781B', '#3d7a1e', '#00687B', '#585C7E', '#9c5bb5']" :key="c" class="jr-dot" :style="{ background: c }" @click="cmd('foreColor', c); openPop = null" />
        </div>
      </template>

      <template v-else-if="openPop === 'loc'">
        <div class="jr-pop-row">
          <input v-model="placeQuery" placeholder="Search places…" class="jr-pop-input" @keydown.enter.prevent="searchPlace" />
          <button class="jr-pop-item" style="width:auto" @click="searchPlace"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <div v-if="placeHits.length" class="jr-place-hits">
          <button v-for="h in placeHits" :key="h.address" class="jr-pop-item" @click="pickPlace(h); openPop = null">{{ h.address.slice(0, 70) }}</button>
        </div>
        <div class="jr-pop-row">
          <input v-model="meta.address" placeholder="Place address" class="jr-pop-input" />
        </div>
        <div class="jr-pop-row">
          <input v-model.number="meta.lat" type="number" step="any" placeholder="lat" class="jr-pop-input" />
          <input v-model.number="meta.lng" type="number" step="any" placeholder="lng" class="jr-pop-input" />
        </div>
        <button class="jr-pop-item" @click="useMyLocation">Use my location</button>
        <button v-if="meta.address || meta.lat != null" class="jr-pop-item jr-danger" @click="meta = { ...meta, address: undefined, lat: undefined, lng: undefined }; openPop = null">Remove location</button>
      </template>

      <template v-else-if="openPop === 'weather'">
        <button class="jr-pop-item" :disabled="weatherBusy" @click="useMyLocation">
          {{ weatherBusy ? 'Fetching…' : 'Fetch current weather (my location)' }}
        </button>
        <div class="jr-colors">
          <button v-for="w in WEATHER_ICONS" :key="w" class="jr-dot jr-wicon" :class="{ on: meta.weatherIcon === w }" @click="meta = { ...meta, weatherIcon: w }">{{ WEATHER_EMOJI[w] }}</button>
        </div>
        <div class="jr-pop-row">
          <input v-model.number="meta.weatherDegreeC" type="number" placeholder="°C" class="jr-pop-input" />
          <input v-model="meta.weatherPlace" placeholder="Place" class="jr-pop-input" />
        </div>
      </template>

      <template v-else-if="openPop === 'mood'">
        <div class="jr-colors">
          <button v-for="m in MOODS" :key="m" class="jr-dot jr-wicon" :class="{ on: meta.sentiment === m }" @click="meta = { ...meta, sentiment: meta.sentiment === m ? undefined : m }">{{ MOOD_LABEL[m] }}</button>
        </div>
      </template>

      <template v-else-if="openPop === 'activity'">
        <button v-for="a in ACTIVITIES" :key="a" class="jr-pop-item" :class="{ 'jr-on': meta.activity === a }" @click="meta = { ...meta, activity: meta.activity === a ? undefined : a }">{{ a }}</button>
      </template>

      <template v-else-if="openPop === 'tags'">
        <div class="jr-pop-row" style="margin-bottom:6px">
          <input v-model="tagInput" placeholder="new tag (no spaces)" class="jr-pop-input" @keydown.enter.prevent="ensureTagIfNew" />
          <button class="jr-pop-item" style="width:auto" @click="ensureTagIfNew"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <div v-if="stagedIds.length" class="jr-muted" style="font-size:12px;padding:0 12px 6px">{{ stagedIds.length }} file(s) staged</div>
        <div class="jr-chips">
          <button
            v-for="t in tags" :key="t.id"
            class="jr-chip" :class="{ on: (meta.tagWordIds || []).includes(t.id!) }"
            @click="toggleTag(t)"
          >{{ t.title }}</button>
        </div>
      </template>
    </div>

    <div class="jr-editor-toolbar">
      <button class="tb" title="Journal"><JrIcon :path="mdiBookOpenOutline" :size="20" /></button>
      <button class="tb" :class="{ 'jr-open': meta.address || meta.lat != null }" title="Location" @click="openPop = openPop === 'loc' ? null : 'loc'">
        <JrIcon :path="mdiMapMarkerOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.weatherIcon }" title="Weather" @click="openPop = openPop === 'weather' ? null : 'weather'">
        <JrIcon :path="mdiWeatherSunny" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.sentiment }" title="Mood" @click="openPop = openPop === 'mood' ? null : 'mood'">
        <JrIcon :path="mdiEmoticonOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.activity }" title="Activity" @click="openPop = openPop === 'activity' ? null : 'activity'">
        <JrIcon :path="mdiRun" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': (meta.tagWordIds || []).length }" title="Tags" @click="openPop = openPop === 'tags' ? null : 'tags'">
        <JrIcon :path="mdiTagOutline" :size="20" />
      </button>
      <div class="sep" />
      <button class="body-btn" @click="openPop = openPop === 'style' ? null : 'style'">
        <JrIcon :path="mdiFormatSize" :size="17" />
        <span>Body</span>
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <button class="body-btn" @click="openPop = openPop === 'insert' ? null : 'insert'">
        <JrIcon :path="mdiPlus" :size="17" />
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('bold')"><JrIcon :path="mdiFormatBold" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('italic')"><JrIcon :path="mdiFormatItalic" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('strikeThrough')"><JrIcon :path="mdiFormatStrikethrough" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('underline')"><JrIcon :path="mdiFormatUnderline" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="openPop = openPop === 'color' ? null : 'color'"><JrIcon :path="mdiFormatColorText" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" title="Bullet list" @click="cmd('insertUnorderedList')"><JrIcon :path="mdiFormatListBulleted" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="Numbered list" @click="cmd('insertOrderedList')"><JrIcon :path="mdiFormatListNumbered" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="Todo list" @click="insertTaskList()"><JrIcon :path="mdiCheckboxMarkedOutline" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyLeft')"><JrIcon :path="mdiFormatAlignLeft" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyCenter')"><JrIcon :path="mdiFormatAlignCenter" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('undo')"><JrIcon :path="mdiUndo" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('redo')"><JrIcon :path="mdiRedo" :size="19" /></button>
      <button class="words">
        <span>Words</span><span style="font-weight:700">{{ words }}</span>
        <span>·</span>
        <span>Characters</span><span style="font-weight:700">{{ chars }}</span>
      </button>
    </div>
  </div>
</template>
