<script setup lang="ts">
import { mdiCalendarBlankOutline, mdiMapMarkerOutline, mdiWeatherSunny, mdiEmoticonOutline, mdiRun, mdiTagOutline, mdiFormatSize, mdiPlus, mdiFormatBold, mdiFormatItalic, mdiFormatStrikethrough, mdiFormatUnderline, mdiFormatColorText, mdiFormatAlignLeft, mdiFormatAlignCenter, mdiUndo, mdiRedo, mdiChevronDown, mdiChevronLeft, mdiChevronRight, mdiBookOpenOutline, mdiClose, mdiCheck, mdiFormatListBulleted, mdiFormatListNumbered, mdiCheckboxMarkedOutline } from '@mdi/js'
import type { EntryV2, MediaFileV2, TagWordV2 } from '~/utils/db'
import { journalFragment, journalHtml, renderJournal } from '~/utils/journalHtml'
import { fetchWeather, searchPlaces, WEATHER_EMOJI } from '~/utils/services'
import { activities, journalActivity, journalSentiment, sentiments } from '~/utils/journalOptions'
import { desktopBridge, readEditorMedia } from '~/utils/desktopBridge'
import type { DesktopMediaReply } from '~/utils/desktopBridge'
import { countWords, errorText } from '~/utils/uiText'

const linkUrl = ref('')
const imageUrl = ref('')
const insertError = ref('')
const tableCell = shallowRef<HTMLTableCellElement | null>(null)
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
const datePop = ref(false)
const dpMonth = ref(new Date().getMonth() + 1)
const dpYear = ref(new Date().getFullYear())
const dpTime = ref('')

const props = defineProps<{ entryId?: number; initialText?: string; initialDate?: Date; initialMeta?: Partial<EntryV2> }>()
const emit = defineEmits<{ (e: 'done'): void }>()
const { listMediaFor, listTags, ensureTag, saveEntry } = useEntries()

const area = ref<HTMLElement | null>(null)
const words = ref(0)
const chars = ref(0)
const hasContent = ref(false)
const date = ref(props.initialDate ? new Date(props.initialDate) : new Date())

const meta = ref<Partial<EntryV2>>({ ...props.initialMeta })
const popoverLabels = {
  style: '段落样式', insert: '插入', table: '表格', color: '文字颜色', loc: '地点',
  weather: '天气', mood: '心情', activity: '活动', tags: '标签', templates: '模板',
}
const openPop = ref<keyof typeof popoverLabels | null>(null)

const WEATHER_ICONS = ['sun', 'partly', 'cloud', 'fog', 'rain', 'snow', 'storm']
const selectedMood = computed(() => journalSentiment(meta.value.sentiment)?.value)
const selectedActivity = computed(() => journalActivity(meta.value.activity)?.value)

const tags = ref<TagWordV2[]>([])
const tagInput = ref('')
const tagError = ref('')
const weatherBusy = ref(false)
const placeQuery = ref('')
const placeHits = ref<{ address: string; lat: number; lng: number }[]>([])
const placeBusy = ref(false)
const templates = ref<{ id?: number; name: string; content: string }[]>([])
const touched = ref(false)
const savedMedia = shallowRef<MediaFileV2[]>([])
const staged = shallowRef<File[]>([])
const removedMedia = ref<number[]>([])
const previewUrls: string[] = []
const attachmentNote = ref('')
const saving = ref(false)
const checkingFiles = ref(false)
const nativePicking = ref(false)
const desktop = desktopBridge()
const attachmentLimit = desktop ? 4 : 20
const initialReady = ref(props.entryId == null)
const photoPrompt = shallowRef<{ name: string; date?: Date; location?: { lat: number; lng: number } }>()
const usePhotoDate = ref(true)
const usePhotoLocation = ref(true)
let disposed = false
let unsubscribeSave: (() => void) | undefined
const voice = useVoiceNote(file => addAttachments([file], true), message => { attachmentNote.value = message })
const recordingStatus = voice.status

async function loadTemplates() {
  const { miscDb } = await import('~/utils/db')
  templates.value = (await miscDb.templates.toArray()).map((t) => ({ id: t.id, name: t.name, content: t.content }))
}
function openTemplates() {
  openPop.value = 'templates'
  loadTemplates()
}
function insertTemplate(t: { content: string }) {
  const html = journalHtml(journalFragment(t.content?.trim() || ''))
  if (area.value && !area.value.innerHTML.replace(/<p><br><\/p>|<br>/g, '').trim()) {
    area.value.innerHTML = html
  } else {
    document.execCommand('insertHTML', false, html + '<p><br></p>')
  }
  recount()
  openPop.value = null
}

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date.value),
)
const locLabel = computed(() => meta.value.address || (meta.value.lat != null ? `${meta.value.lat?.toFixed(4)}, ${meta.value.lng?.toFixed(4)}` : ''))

onMounted(async () => {
  unsubscribeSave = desktop?.on('saveAndCloseIfDirty', () => { void save() })
  if (props.entryId != null) savedMedia.value = await listMediaFor(props.entryId)
  if (disposed) return
  if (props.initialText && area.value) {
    area.value.innerHTML = renderJournal(props.initialText, savedMedia.value, row => {
      if (!row.blob) return
      const url = URL.createObjectURL(row.blob)
      previewUrls.push(url)
      return url
    }, false)
    recount()
  } else if (area.value && !area.value.innerHTML.trim()) {
    // seed an empty block so formatBlock/style commands always have a target
    area.value.innerHTML = '<p><br></p>'
  }
  initialReady.value = true
  tags.value = await listTags()
  area.value?.focus()
})

onBeforeUnmount(() => {
  disposed = true
  unsubscribeSave?.()
  for (const url of previewUrls) URL.revokeObjectURL(url)
})

function recount() {
  const t = area.value?.innerText || ''
  words.value = countWords(t)
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
  cmd('insertHTML', '<ul class="jr-task"><li><label><input type="checkbox">待办事项</label></li></ul><p><br></p>')
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
      document.execCommand('insertHTML', false, '<ul class="jr-task"><li><label><input type="checkbox">待办事项</label></li></ul><p><br></p>')
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
const { firstDay, orderedWeekdays } = useWeekStart()
const dpCells = computed(() => {
  const first = new Date(dpYear.value, dpMonth.value - 1, 1)
  const startCol = (first.getDay() - firstDay.value + 7) % 7
  const days = new Date(dpYear.value, dpMonth.value - 1, 0).getDate()
  const cells: (number | null)[] = Array(startCol).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
})
const dpLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', year: 'numeric' }).format(new Date(dpYear.value, dpMonth.value - 1, 1)))
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
  if (desktop) { void pickDesktopFiles(); return }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*,audio/*'
  input.multiple = true
  input.onchange = () => void addAttachments(Array.from(input.files ?? []))
  input.click()
}

async function pickDesktopFiles(dropped?: File[]) {
  if (!desktop || nativePicking.value || checkingFiles.value || saving.value) return
  nativePicking.value = true
  attachmentNote.value = ''
  try {
    const options = { src: '', userIsMember: false, userIsPaid: false, filesCount: attachmentCount.value }
    const reply = dropped
      ? await desktop.pickDroppedFiles(dropped, options)
      : await desktop.invoke<DesktopMediaReply>('pickFiles', {
        ...options, title: '添加媒体', selectBtnLabel: '添加', filterNameExt: '照片、视频和音频',
        exts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'heic', 'mp3', 'mp4', 'mov', 'wav', 'webp', 'webm'],
      })
    if (reply?.status) {
      const files = await readEditorMedia(desktop, reply.filePaths, reply.fileNames || dropped?.map(file => file.name))
      if (!disposed) await addAttachments(files, false, reply.metadata)
    } else if (reply?.errorCode === 'unavailable_file_path' && dropped) {
      await addAttachments(dropped)
    } else if (reply?.errorCode) {
      attachmentNote.value = reply.errorCode === 'exceed_files_count' ? `每篇日记最多可添加 ${attachmentLimit} 个附件。`
        : reply.errorCode === 'exceed_file_size' ? '有附件超过 200 MB。' : '无法添加所选文件。'
      openPop.value = null
    }
  } catch (error) {
    attachmentNote.value = errorText(error, '无法添加所选文件。')
    openPop.value = null
  } finally { nativePicking.value = false }
}

function startVoiceNote() {
  if (attachmentCount.value >= attachmentLimit) {
    attachmentNote.value = `每篇日记最多可添加 ${attachmentLimit} 个附件。`
    openPop.value = null
    return
  }
  openPop.value = null
  void voice.start()
}

const activeMedia = computed(() => savedMedia.value.filter(row => !removedMedia.value.includes(row.id!)))
const attachmentCount = computed(() => activeMedia.value.length + staged.value.length)

function readAudioDuration(file: File) {
  return new Promise<number | undefined>(resolve => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    const timeout = setTimeout(() => finish(), 3000)
    function finish(duration?: number) {
      clearTimeout(timeout)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish()
    audio.src = url
  })
}

async function addAttachments(files: File[], recorded = false, nativeMetadata?: DesktopMediaReply['metadata']) {
  if (!files.length || checkingFiles.value || saving.value) return
  checkingFiles.value = true
  const errors: string[] = []
  try {
    for (const file of files) {
      if (attachmentCount.value >= attachmentLimit) {
        errors.push(`每篇日记最多可添加 ${attachmentLimit} 个附件。`)
        break
      }
      if (!/^(image|video|audio)\//.test(file.type) || file.type === 'image/svg+xml' || file.size === 0) {
        errors.push(`不支持此附件：${file.name}。`)
        continue
      }
      if (file.size > 200 * 1024 * 1024) {
        errors.push(`${file.name} 超过 200 MB。`)
        continue
      }
      if (file.type.startsWith('audio/') && !recorded) {
        const seconds = await readAudioDuration(file)
        if (seconds != null && seconds > 600 && Number.isFinite(seconds)) {
          errors.push(`${file.name} 超过 10 分钟。`)
          continue
        }
      }
      if (disposed) return
      staged.value = [...staged.value, file]
      if (!photoPrompt.value && /^(image|video)\//.test(file.type) && nativeMetadata) {
        const rawDate = nativeMetadata.date ? new Date(nativeMetadata.date) : undefined
        const date = rawDate && Number.isFinite(+rawDate) ? rawDate : undefined
        const location = nativeMetadata.location
        if (date || location) {
          usePhotoDate.value = !!date
          usePhotoLocation.value = !!location
          photoPrompt.value = { name: file.name, date, location }
        }
      } else if (!photoPrompt.value && file.type.startsWith('image/')) {
        const { readPhotoMetadata } = await import('~/utils/photoMetadata')
        const info = await readPhotoMetadata(file).catch(() => undefined)
        if (info && (info.date || info.location)) {
          usePhotoDate.value = !!info.date
          usePhotoLocation.value = !!info.location
          photoPrompt.value = { name: file.name, ...info }
        }
      }
    }
    attachmentNote.value = errors.join(' ')
    openPop.value = null
  } finally {
    checkingFiles.value = false
  }
}

function applyPhotoMetadata() {
  const info = photoPrompt.value
  if (!info) return
  if (usePhotoDate.value && info.date) date.value = info.date
  if (usePhotoLocation.value && info.location) meta.value = { ...meta.value, ...info.location, address: undefined }
  photoPrompt.value = undefined
}

function removeAttachment(id: number) {
  removedMedia.value.push(id)
  area.value?.querySelectorAll(`[data-media-id="${id}"]`).forEach(node => node.remove())
  recount()
}

function onFileDrop(event: DragEvent) {
  if (!event.dataTransfer?.files.length) return
  event.preventDefault()
  const files = Array.from(event.dataTransfer.files)
  if (desktop) void pickDesktopFiles(files)
  else void addAttachments(files)
}

function onPaste(event: ClipboardEvent) {
  const html = event.clipboardData?.getData('text/html')
  if (!html) return
  event.preventDefault()
  document.execCommand('insertHTML', false, journalHtml(journalFragment(html)))
  recount()
  saveSel()
}

function insertWebMedia(image: boolean) {
  try {
    const url = new URL((image ? imageUrl : linkUrl).value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('不支持此网址。')
    let element: HTMLElement
    if (image) {
      const img = document.createElement('img')
      img.src = url.href
      img.alt = '网络图片'
      element = img
    } else {
      const link = document.createElement('a')
      link.href = url.href
      link.textContent = url.href
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      element = link
    }
    insertError.value = ''
    insertHtml(element.outerHTML)
  } catch { insertError.value = '请输入有效的 HTTP 或 HTTPS 网址。' }
}

function openTableMenu(event: MouseEvent) {
  const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td, th')
  if (!cell || !area.value?.contains(cell)) return
  event.preventDefault()
  tableCell.value = cell
  openPop.value = 'table'
}

function editTable(action: 'addRow' | 'removeRow' | 'addColumn' | 'removeColumn' | 'left' | 'center' | 'right' | 'remove') {
  const cell = tableCell.value
  const row = cell?.closest<HTMLTableRowElement>('tr')
  const table = row?.closest<HTMLTableElement>('table')
  if (!cell || !row || !table || !area.value?.contains(table)) return
  const columnIndex = cell.cellIndex
  if (action === 'addRow') {
    const next = table.insertRow(row.rowIndex + 1)
    for (let i = 0; i < row.cells.length; i++) next.insertCell().append(document.createElement('br'))
  } else if (action === 'removeRow') {
    if (table.rows.length === 1) table.remove()
    else table.deleteRow(row.rowIndex)
  } else if (action === 'addColumn') {
    for (const current of table.rows) {
      const column = current.insertCell(Math.min(columnIndex + 1, current.cells.length))
      column.append(document.createElement('br'))
    }
  } else if (action === 'removeColumn') {
    if (row.cells.length === 1) table.remove()
    else for (const current of table.rows) if (columnIndex < current.cells.length) current.deleteCell(columnIndex)
  } else if (action === 'remove') table.remove()
  else cell.style.textAlign = action
  tableCell.value = null
  openPop.value = null
  recount()
}

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
  if (!/^[\p{L}\p{N}]+$/u.test(t)) { tagError.value = '标签只能包含文字或数字。'; return }
  tagError.value = ''
  const tag = await ensureTag(t)
  tags.value = await useEntries().listTags()
  const cur = meta.value.tagWordIds || []
  if (!cur.includes(tag.id!)) meta.value = { ...meta.value, tagWordIds: [...cur, tag.id!] }
  tagInput.value = ''
}

function toggleTag(t: TagWordV2) {
  const cur = meta.value.tagWordIds || []
  meta.value = { ...meta.value, tagWordIds: cur.includes(t.id!) ? cur.filter((x) => x !== t.id) : [...cur, t.id!] }
}

async function save() {
  if (!initialReady.value || saving.value || checkingFiles.value || nativePicking.value || recordingStatus.value !== 'idle') return
  const text = area.value?.innerHTML || ''
  const empty = !area.value?.textContent?.trim() && !area.value?.querySelector('img,video,audio,hr,table')
  if (props.entryId == null && empty && !attachmentCount.value) { emit('done'); return }
  saving.value = true
  try {
    await saveEntry(props.entryId, empty ? '' : text, date.value, meta.value, staged.value, removedMedia.value)
    emit('done')
  } catch (error) {
    attachmentNote.value = errorText(error, '无法保存日记，请重试。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="jr-editor" @dragover="($event.dataTransfer?.types || []).includes('Files') && $event.preventDefault()" @drop="onFileDrop">
    <div class="jr-editor-head">
      <button class="dt" @click="openDatePicker">
        <JrIcon :path="mdiCalendarBlankOutline" :size="19" />
        <span>{{ dateLabel }}</span>
        <JrIcon :path="mdiChevronDown" :size="18" />
      </button>
      <button class="done" :disabled="!initialReady || saving || checkingFiles || nativePicking || recordingStatus !== 'idle'" @click="save">{{ saving ? '正在保存…' : '完成' }}</button>
      <div v-if="datePop" class="jr-pop jr-dp" @click.stop>
        <div class="jr-pop-head">
          <button class="tb" @click="dpPrev"><JrIcon :path="mdiChevronLeft" :size="16" /></button>
          <span style="flex:1;text-align:center">{{ dpLabel }}</span>
          <button class="tb" @click="dpNext"><JrIcon :path="mdiChevronRight" :size="16" /></button>
          <button class="tb" @click="datePop = false"><JrIcon :path="mdiClose" :size="16" /></button>
        </div>
        <div class="jr-dp-grid jr-dp-dow"><span v-for="d in orderedWeekdays" :key="d" :title="d">{{ d.slice(-1) }}</span></div>
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

    <div class="jr-editor-body" style="position:relative">
      <div v-if="!touched && !hasContent && !attachmentCount" class="jr-editor-ph">
        开始写日记，或选择 <button class="jr-template-chip" @click.stop="openTemplates"><JrIcon :path="mdiBookOpenOutline" :size="13" /> 模板</button>。
      </div>
      <div
        ref="area"
        class="jr-editor-area"
        :contenteditable="initialReady ? 'true' : 'false'"
        :spellcheck="spellcheck"
        @input="recount(); saveSel(); touched = true"
        @paste="onPaste"
        @contextmenu="openTableMenu"
        @keydown="onAreaKeydown"
        @keyup="saveSel"
        @mouseup="saveSel"
        @mousedown="touched = true"
      />
    </div>

    <!-- popovers -->
    <div v-if="attachmentCount || attachmentNote || recordingStatus !== 'idle'" class="jr-attachments" aria-label="日记附件">
      <div v-if="attachmentCount" class="jr-attachment-list">
        <div v-for="file in activeMedia" :key="file.id" class="jr-attachment">
          <span :title="file.fileName">{{ file.fileName }}</span>
          <button class="jr-icon-btn" :aria-label="`移除 ${file.fileName}`" @click="removeAttachment(file.id!)"><JrIcon :path="mdiClose" :size="15" /></button>
        </div>
        <div v-for="(file, index) in staged" :key="index" class="jr-attachment">
          <span :title="file.name">{{ file.name }}</span>
          <button class="jr-icon-btn" :aria-label="`移除 ${file.name}`" @click="staged = staged.filter((_, i) => i !== index)"><JrIcon :path="mdiClose" :size="15" /></button>
        </div>
      </div>
      <p v-if="attachmentNote" role="status">{{ attachmentNote }}</p>
      <button v-if="recordingStatus === 'recording'" class="jr-btn jr-danger" @click="voice.stop()">停止录音</button>
      <p v-else-if="recordingStatus === 'requesting'" role="status">正在请求麦克风权限…</p>
      <p v-else-if="recordingStatus === 'encoding'" role="status">正在处理录音…</p>
    </div>

    <div v-if="photoPrompt" class="jr-pop" role="dialog" aria-label="照片信息">
      <div class="jr-pop-head">采用以下照片中的信息 {{ photoPrompt.name }}?</div>
      <label v-if="photoPrompt.date" class="jr-set-check">
        <input v-model="usePhotoDate" type="checkbox" /> 拍摄时间：{{ photoPrompt.date.toLocaleString('zh-CN') }}
      </label>
      <label v-if="photoPrompt.location" class="jr-set-check">
        <input v-model="usePhotoLocation" type="checkbox" /> 拍摄地点：{{ photoPrompt.location.lat.toFixed(4) }}，{{ photoPrompt.location.lng.toFixed(4) }}
      </label>
      <div class="jr-pop-row">
        <button class="jr-btn" @click="photoPrompt = undefined">保留当前信息</button>
        <button class="jr-btn jr-btn-primary" @click="applyPhotoMetadata">使用选中的信息</button>
      </div>
    </div>

    <div v-if="openPop" class="jr-pop" @click.stop>
      <div class="jr-pop-head">
        <span>{{ popoverLabels[openPop] }}</span>
        <button class="tb" @click="openPop = null"><JrIcon :path="mdiClose" :size="16" /></button>
      </div>

      <template v-if="openPop === 'templates'">
        <div v-if="!templates.length" class="jr-muted" style="font-size:13px;padding:6px 12px 10px">
          暂无自定义模板。可在日记的「更多」菜单中将它存为模板。
        </div>
        <button v-for="t in templates" :key="t.id" class="jr-pop-item" @click="insertTemplate(t)">
          {{ t.name }}
        </button>
      </template>
      <template v-if="openPop === 'style'">
        <button class="jr-pop-item" @click="setBlock('p')">正文</button>
        <button class="jr-pop-item" @click="setBlock('h1')">一级标题</button>
        <button class="jr-pop-item" @click="setBlock('h2')">二级标题</button>
        <button class="jr-pop-item" @click="setBlock('h3')">三级标题</button>
        <button class="jr-pop-item" @click="setBlock('blockquote')">引用</button>
      </template>

      <template v-else-if="openPop === 'insert'">
        <button class="jr-pop-item" @click="insertHtml('<hr>')">分隔线</button>
        <button class="jr-pop-item" @click="pickFile">照片、视频或音频</button>
        <button v-if="voice.available" class="jr-pop-item" :disabled="recordingStatus !== 'idle'" @click="startVoiceNote">录制语音</button>
        <div class="jr-pop-row">
          <input v-model="linkUrl" placeholder="https://…" style="flex:1" />
          <button class="jr-pop-item" style="width:auto" aria-label="插入链接" @click="insertWebMedia(false)"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <div class="jr-pop-row">
          <input v-model="imageUrl" aria-label="图片网址" placeholder="图片网址" style="flex:1" />
          <button class="jr-pop-item" style="width:auto" aria-label="插入网络图片" @click="insertWebMedia(true)"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <p v-if="insertError" role="status">{{ insertError }}</p>
        <button class="jr-pop-item" @click="insertHtml('<table border=\'1\' style=\'border-collapse:collapse\'><tr><th>标题</th><th>标题</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>')">2×2 表格</button>
        <button class="jr-pop-item" @click="insertHtml('<code>代码</code>')">行内代码</button>
      </template>

      <template v-else-if="openPop === 'table'">
        <button class="jr-pop-item" @click="editTable('addRow')">在下方插入一行</button>
        <button class="jr-pop-item" @click="editTable('addColumn')">在右侧插入一列</button>
        <button class="jr-pop-item" @click="editTable('removeRow')">删除此行</button>
        <button class="jr-pop-item" @click="editTable('removeColumn')">删除此列</button>
        <div class="jr-pop-row">
          <button class="jr-pop-item" @click="editTable('left')">左对齐</button>
          <button class="jr-pop-item" @click="editTable('center')">居中</button>
          <button class="jr-pop-item" @click="editTable('right')">右对齐</button>
        </div>
        <button class="jr-pop-item jr-danger" @click="editTable('remove')">删除表格</button>
      </template>

      <template v-else-if="openPop === 'color'">
        <div class="jr-colors">
          <button v-for="c in ['#171C1E', '#BA1A1A', '#C4781B', '#3d7a1e', '#00687B', '#585C7E', '#9c5bb5']" :key="c" class="jr-dot" :style="{ background: c }" @click="cmd('foreColor', c); openPop = null" />
        </div>
      </template>

      <template v-else-if="openPop === 'loc'">
        <div class="jr-pop-row">
          <input v-model="placeQuery" placeholder="搜索地点…" class="jr-pop-input" @keydown.enter.prevent="searchPlace" />
          <button class="jr-pop-item" style="width:auto" @click="searchPlace"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <div v-if="placeHits.length" class="jr-place-hits">
          <button v-for="h in placeHits" :key="h.address" class="jr-pop-item" @click="pickPlace(h); openPop = null">{{ h.address.slice(0, 70) }}</button>
        </div>
        <div class="jr-pop-row">
          <input v-model="meta.address" placeholder="地点地址" class="jr-pop-input" />
        </div>
        <div class="jr-pop-row">
          <input v-model.number="meta.lat" type="number" step="any" placeholder="纬度" class="jr-pop-input" />
          <input v-model.number="meta.lng" type="number" step="any" placeholder="经度" class="jr-pop-input" />
        </div>
        <button class="jr-pop-item" @click="useMyLocation">使用当前位置</button>
        <button v-if="meta.address || meta.lat != null" class="jr-pop-item jr-danger" @click="meta = { ...meta, address: undefined, lat: undefined, lng: undefined }; openPop = null">移除地点</button>
      </template>

      <template v-else-if="openPop === 'weather'">
        <button class="jr-pop-item" :disabled="weatherBusy" @click="useMyLocation">
          {{ weatherBusy ? '正在获取…' : '获取当前位置的天气' }}
        </button>
        <div class="jr-colors">
          <button v-for="w in WEATHER_ICONS" :key="w" class="jr-dot jr-wicon" :class="{ on: meta.weatherIcon === w }" @click="meta = { ...meta, weatherIcon: w }">{{ WEATHER_EMOJI[w] }}</button>
        </div>
        <div class="jr-pop-row">
          <input v-model.number="meta.weatherDegreeC" type="number" placeholder="°C" class="jr-pop-input" />
          <input v-model="meta.weatherPlace" placeholder="地点" class="jr-pop-input" />
        </div>
      </template>

      <template v-else-if="openPop === 'mood'">
        <div class="jr-colors">
          <button v-for="m in sentiments" :key="m.value" class="jr-dot jr-wicon" :class="{ on: selectedMood === m.value }" :title="m.label" :aria-label="m.label" @click="meta.sentiment = m.value"><JrIcon :path="m.icon" :size="20" :style="{ color: m.color }" /></button>
        </div>
        <button class="jr-pop-item" @click="meta.sentiment = undefined">无</button>
      </template>

      <template v-else-if="openPop === 'activity'">
        <button v-for="a in activities" :key="a.value" class="jr-pop-item" :class="{ 'jr-on': selectedActivity === a.value }" @click="meta.activity = a.value"><JrIcon :path="a.icon" :size="18" /> {{ a.label }}</button>
        <button class="jr-pop-item" @click="meta.activity = undefined">无</button>
      </template>

      <template v-else-if="openPop === 'tags'">
        <div class="jr-pop-row" style="margin-bottom:6px">
          <input v-model="tagInput" placeholder="输入新标签（不含空格）" class="jr-pop-input" @keydown.enter.prevent="ensureTagIfNew" />
          <button class="jr-pop-item" style="width:auto" @click="ensureTagIfNew"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <p v-if="tagError" role="status">{{ tagError }}</p>
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
      <button class="tb" title="日记"><JrIcon :path="mdiBookOpenOutline" :size="20" /></button>
      <button class="tb" :class="{ 'jr-open': meta.address || meta.lat != null }" title="地点" @click="openPop = openPop === 'loc' ? null : 'loc'">
        <JrIcon :path="mdiMapMarkerOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.weatherIcon }" title="天气" @click="openPop = openPop === 'weather' ? null : 'weather'">
        <JrIcon :path="mdiWeatherSunny" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.sentiment }" title="心情" @click="openPop = openPop === 'mood' ? null : 'mood'">
        <JrIcon :path="mdiEmoticonOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.activity }" title="活动" @click="openPop = openPop === 'activity' ? null : 'activity'">
        <JrIcon :path="mdiRun" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': (meta.tagWordIds || []).length }" title="标签" @click="openPop = openPop === 'tags' ? null : 'tags'">
        <JrIcon :path="mdiTagOutline" :size="20" />
      </button>
      <div class="sep" />
      <button class="body-btn" @click="openPop = openPop === 'style' ? null : 'style'">
        <JrIcon :path="mdiFormatSize" :size="17" />
        <span>正文</span>
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <button class="body-btn" title="插入" @click="openPop = openPop === 'insert' ? null : 'insert'">
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
      <button class="tb" :disabled="!hasContent" title="项目列表" @click="cmd('insertUnorderedList')"><JrIcon :path="mdiFormatListBulleted" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="编号列表" @click="cmd('insertOrderedList')"><JrIcon :path="mdiFormatListNumbered" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="待办列表" @click="insertTaskList()"><JrIcon :path="mdiCheckboxMarkedOutline" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyLeft')"><JrIcon :path="mdiFormatAlignLeft" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('justifyCenter')"><JrIcon :path="mdiFormatAlignCenter" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" @click="cmd('undo')"><JrIcon :path="mdiUndo" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" @click="cmd('redo')"><JrIcon :path="mdiRedo" :size="19" /></button>
      <button class="words">
        <span>词数</span><span style="font-weight:700">{{ words }}</span>
        <span>·</span>
        <span>字数</span><span style="font-weight:700">{{ chars }}</span>
      </button>
    </div>
  </div>
</template>
