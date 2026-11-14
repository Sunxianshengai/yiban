<script setup lang="ts">
import { mdiCalendarBlankOutline, mdiMapMarkerOutline, mdiWeatherSunny, mdiEmoticonOutline, mdiRun, mdiTagOutline, mdiPlus, mdiFormatBold, mdiFormatItalic, mdiFormatStrikethrough, mdiFormatUnderline, mdiFormatAlignLeft, mdiFormatAlignCenter, mdiUndo, mdiRedo, mdiChevronDown, mdiChevronLeft, mdiChevronRight, mdiClose, mdiCheck, mdiFormatListBulleted, mdiFormatListNumbered, mdiCheckboxMarkedOutline, mdiFormatPilcrow, mdiFormatHeader1, mdiFormatHeader2, mdiFormatHeader3, mdiFormatQuoteOpen, mdiFormatListChecks, mdiLink, mdiImage, mdiTable, mdiBorderHorizontal, mdiPalette, mdiMarker, mdiWaterOff, mdiImageMultipleOutline, mdiApps, mdiFormatAlignRight, mdiCodeTags, mdiFormatIndentIncrease, mdiFormatIndentDecrease, mdiAccountMultipleOutline, mdiLockOutline } from '@mdi/js'
import type { EntryV2, MediaFileV2, TagWordV2 } from '~/utils/db'
import { miscDb } from '~/utils/db'
import { journalFragment, journalHtml, renderJournal } from '~/utils/journalHtml'
import { WEATHER_EMOJI } from '~/utils/services'
import { amapInfoHint, amapWeatherIcon, fetchAmapWeather, getAmapWebKey, reverseGeocodeAmap, searchAmapPlacesResult } from '~/utils/amap'
import type { AmapPlaceHit } from '~/utils/amap'
import { activities, journalActivity, journalSentiment, sentiments } from '~/utils/journalOptions'
import { desktopBridge, readEditorMedia } from '~/utils/desktopBridge'
import type { DesktopMediaReply } from '~/utils/desktopBridge'
import { countWords, errorText } from '~/utils/uiText'

const linkUrl = ref('')
const imageUrl = ref('')
const insertError = ref('')
const insertSub = ref<'link' | 'image' | 'table' | null>(null)
const colorSub = ref<'color' | 'highlight' | null>(null)
const tableRows = ref(2)
const tableCols = ref(2)
const currentBlock = ref('p')
const templateDialog = ref(false)
const coachNote = ref('')
const popX = ref<number | null>(null)
const popY = ref<number | null>(null)
const tableCell = shallowRef<HTMLTableCellElement | null>(null)
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
const datePop = ref(false)
const dpMonth = ref(new Date().getMonth() + 1)
const dpYear = ref(new Date().getFullYear())
const dpTime = ref('')

const props = defineProps<{ entryId?: number; initialText?: string; initialDate?: Date; initialMeta?: Partial<EntryV2>; inline?: boolean }>()
const emit = defineEmits<{ (e: 'done', savedId?: number): void }>()
const isMobile = useIsMobile()
const { listMediaFor, listTags, ensureTag, saveEntry } = useEntries()
const { urlForSync: mediaUrl, prefetch: prefetchMedia } = useMediaResolver()

const area = ref<HTMLElement | null>(null)
const editorPane = ref<HTMLElement | null>(null)
const discardDialog = ref<HTMLDialogElement | null>(null)
const words = ref(0)
const chars = ref(0)
const hasContent = ref(false)
const date = ref(props.initialDate ? new Date(props.initialDate) : new Date())

const meta = ref<Partial<EntryV2>>({ ...props.initialMeta })
const popoverLabels = {
  style: '段落样式', insert: '插入', table: '表格', color: '文字颜色', loc: '地点',
  weather: '天气', mood: '心情', activity: '活动', tags: '标签', media: '媒体', family: '共享范围',
}
// style/insert/color 在原版是无标题纯菜单（v-menu），不渲染头
const headlessPops: ReadonlySet<keyof typeof popoverLabels> = new Set(['style', 'insert', 'color'])
const openPop = ref<keyof typeof popoverLabels | null>(null)

const WEATHER_ICONS = ['sun', 'partly', 'cloud', 'fog', 'rain', 'snow', 'storm']
const selectedMood = computed(() => journalSentiment(meta.value.sentiment)?.value)
const selectedActivity = computed(() => journalActivity(meta.value.activity)?.value)

// 家庭组（附加功能）：加入组后才出现「共享家人」开关；visibility 随 meta 走 saveEntry → fields 上云
const { state: familyState } = useFamilySync()
const familyJoined = computed(() => !!familyState.value.group)

const tags = ref<TagWordV2[]>([])
const tagInput = ref('')
const tagError = ref('')
const weatherBusy = ref(false)
const placeQuery = ref('')
const placeCity = ref('')
const placeHits = ref<AmapPlaceHit[]>([])
const placeBusy = ref(false)
const placeError = ref('')
const weatherError = ref('')
/** 已选地点缺 adcode（旧记录/手填坐标）时，天气无法定位行政区 */
const needsAdcode = computed(() => meta.value.lat != null && meta.value.lng != null && !meta.value.adcode)
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
const initialReady = ref(false)
let initialDraftState = ''
const photoPrompt = shallowRef<{ name: string; date?: Date; location?: { lat: number; lng: number } }>()
const usePhotoDate = ref(true)
const usePhotoLocation = ref(true)
let disposed = false
let unsubscribeSave: (() => void) | undefined
const voice = useVoiceNote(file => addAttachments([file], true), message => { attachmentNote.value = message })
const recordingStatus = voice.status

async function renameTemplate(t: { id?: number; name: string }) {
  const name = window.prompt('重命名模板', t.name)?.trim()
  if (!name || name === t.name || t.id == null) return
  const { miscDb } = await import('~/utils/db')
  await miscDb.templates.update(t.id, { name })
  await loadTemplates()
}
async function deleteTemplate(t: { id?: number; name: string }) {
  if (t.id == null || !window.confirm(`删除模板「${t.name}」？`)) return
  const { miscDb } = await import('~/utils/db')
  await miscDb.templates.delete(t.id)
  await loadTemplates()
}
async function loadTemplates() {
  const { miscDb } = await import('~/utils/db')
  templates.value = (await miscDb.templates.toArray()).map((t) => ({ id: t.id, name: t.name, content: t.content }))
}
function openTemplates() {
  templateDialog.value = true
  loadTemplates()
}
// 原版 Pick a Template 三区结构（evidence/derived/editor-overlays.json → template_dialog）
const coachTemplates = [
  { name: '目标设定', desc: '设定人生目标并规划更小的里程碑，让自己始终在轨道上。' },
  { name: '年度目标', desc: '通过设定年度目标，为长远生活做好准备。' },
  { name: '每周回顾', desc: '在一个地方回顾与反思你的一周。' },
  { name: '个人发展计划', desc: '构建一张路线图，保持在正轨上并达成目标。' },
  { name: '原子习惯记分卡', desc: '用简单的练习发现你应当改变哪些习惯。' },
  { name: '清晨五点俱乐部', desc: '加入 5AM 俱乐部，优化你的晨间日常。' },
  { name: '每周反思', desc: '以结构化的提示回顾本周的起伏。' },
  { name: '创建你自己的积极肯定', desc: '培养每天的积极心态。' },
  { name: '年中反思', desc: '回望并反思这一年过半的旅程。' },
  { name: '成长型思维模板', desc: '把固定型思维转变为成长型思维。' },
]
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
  // 云端来的附件没有本地 blob，先换预签名地址，否则编辑器里看不到
  await prefetchMedia(savedMedia.value)
  if (disposed) return
  function urlForMedia(row: MediaFileV2) {
    const url = mediaUrl(row)
    if (url?.startsWith('blob:')) previewUrls.push(url)
    return url
  }
  // 草稿 v2（bug04/05）：新条目与已有条目的未保存内容都入库，照片 blob 一并恢复
  const draft = await loadDraft(draftKey())
  if (disposed) return
  if (props.initialText && area.value) {
    if (draft && draft.text && draft.text !== props.initialText) {
      area.value.innerHTML = renderJournal(draft.text, savedMedia.value, urlForMedia, false)
      if (draft.date) date.value = new Date(draft.date)
      if (draft.meta) meta.value = { ...meta.value, ...draft.meta }
      removedMedia.value = [...(draft.removed || [])]
      staged.value = (draft.staged || []).map(b => new File([b.blob], b.name, { type: b.type }))
      draftRestored.value = '已恢复未保存的修改。'
    } else {
      area.value.innerHTML = renderJournal(props.initialText, savedMedia.value, urlForMedia, false)
    }
    recount()
  } else if (area.value && !area.value.innerHTML.trim()) {
    // 审计 #1：恢复未保存草稿（新条目）
    if (draft && draft.text) {
      area.value.innerHTML = draft.text
      if (draft.date) date.value = new Date(draft.date)
      if (draft.meta) meta.value = { ...meta.value, ...draft.meta }
      staged.value = (draft.staged || []).map(b => new File([b.blob], b.name, { type: b.type }))
      draftRestored.value = '已恢复未保存的草稿。'
    } else {
      try {
        const raw = localStorage.getItem('jr.draft')
        if (raw && props.entryId == null) {
          const d = JSON.parse(raw)
          area.value.innerHTML = d.text
          if (d.date) date.value = new Date(d.date)
          if (d.meta) meta.value = { ...meta.value, ...d.meta }
          draftRestored.value = '已恢复未保存的草稿。'
        }
      } catch { localStorage.removeItem('jr.draft') }
    }
    if (!area.value.innerHTML.trim()) {
      // seed an empty block so formatBlock/style commands always have a target
      area.value.innerHTML = '<p><br></p>'
    }
  }
  initialDraftState = draftState()
  initialReady.value = true
  tags.value = await listTags()
  area.value?.focus()
})

onBeforeUnmount(() => {
  if (props.inline && draftTimer != null) {
    clearTimeout(draftTimer)
    void persistDraft()
  }
  disposed = true
  unsubscribeSave?.()
  for (const url of previewUrls) URL.revokeObjectURL(url)
})


// ---- 草稿持久化 v2（bug04/05）：新条目与已有条目防抖写入 Misc.drafts，照片随草稿入库 ----
const DRAFT_KEY = 'jr.draft' // v1 遗留键，仅作旧数据迁移来源
let draftTimer: ReturnType<typeof setTimeout> | undefined
const draftRestored = ref('')
function draftKey() { return props.entryId == null ? 'new' : `entry:${props.entryId}` }
async function loadDraft(key: string) {
  try {
    return await miscDb.drafts.get(key)
  } catch { return undefined }
}
/** 已有条目的草稿文本回存为未解析形态（去 blob: src，保留 data-media-id），恢复时重新解析 */
function snapshotHtml(): string {
  const html = area.value?.innerHTML || ''
  if (props.entryId == null) return html
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  for (const node of Array.from(tpl.content.querySelectorAll('[data-media-id]'))) {
    node.removeAttribute('src')
    node.removeAttribute('href')
  }
  return tpl.innerHTML
}
function scheduleDraft() {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draftTimer = undefined
    void persistDraft()
  }, 600)
}
async function persistDraft() {
  const text = snapshotHtml()
  const nothingSaved = !text.replace(/<p><br><\/p>|<br>/g, '').trim()
    && !attachmentCount.value && !staged.value.length && !removedMedia.value.length
    && props.entryId == null
  if (nothingSaved) {
    clearDraft()
    return
  }
  try {
    await miscDb.drafts.put({
      key: draftKey(),
      text,
      date: date.value.getTime(),
      meta: JSON.parse(JSON.stringify(meta.value)),
      staged: staged.value.map(f => ({ name: f.name, type: f.type, blob: f })),
      removed: [...removedMedia.value],
      updatedAt: new Date(),
    })
  } catch { /* 草稿写失败不阻塞编辑 */ }
}
function clearDraft() {
  clearTimeout(draftTimer)
  draftTimer = undefined
  localStorage.removeItem(DRAFT_KEY)
  void miscDb.drafts.delete(draftKey()).catch(() => {})
}
// 元数据/附件变化也触发草稿（日期、天气、标签、增删照片——不只正文输入）
watch([date, meta, staged, removedMedia], () => { if (initialReady.value) scheduleDraft() }, { deep: true })
function draftState() {
  return JSON.stringify([snapshotHtml(), date.value.getTime(), meta.value])
}
async function discardChanges() {
  if (saving.value || checkingFiles.value || nativePicking.value || recordingStatus.value !== 'idle') return false
  const hasWork = draftRestored.value || staged.value.length || removedMedia.value.length
    || (initialDraftState && draftState() !== initialDraftState)
  if (hasWork) {
    const dialog = discardDialog.value
    if (!dialog) {
      if (!window.confirm('放弃未保存的内容并退出编辑？')) return false
    } else {
      if (dialog.open) return false
      dialog.returnValue = ''
      dialog.showModal()
      const confirmed = await new Promise<boolean>(resolve => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'discard'), { once: true })
      })
      if (!confirmed) return false
    }
  }
  clearDraft()
  return true
}
async function discardEntry() {
  if (await discardChanges()) emit('done')
}
defineExpose({ discardChanges })

// ---- 工具栏状态（审计 #3/#4）：撤销/重做深度 + 格式激活 ----
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const canUndo = ref(false)
const canRedo = ref(false)
const fmtState = ref({ bold: false, italic: false, strike: false, underline: false, align: 'left' })
function refreshToolbarState() {
  try {
    canUndo.value = document.queryCommandEnabled('undo') || undoDepth.value > 0
    canRedo.value = redoDepth.value > 0
    fmtState.value = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      strike: document.queryCommandState('strikeThrough'),
      underline: document.queryCommandState('underline'),
      align: (document.queryCommandState('justifyCenter') && 'center') || (document.queryCommandState('justifyRight') && 'right') || 'left',
    }
  } catch { /* 无选区时保持原值 */ }
}
// 撤销/重做深度：自维护计数（execCommand 不暴露历史深度）
const undoDepth = ref(0)
const redoDepth = ref(0)
function noteUndo() { undoDepth.value++; redoDepth.value = 0; refreshToolbarState() }
function doUndo() { restoreSel(); document.execCommand('undo'); recount(); refreshToolbarState() }
function doRedo() { restoreSel(); document.execCommand('redo'); recount(); refreshToolbarState() }

function recount() {
  const t = area.value?.innerText || ''
  words.value = countWords(t)
  chars.value = t.replace(/\n/g, '').length
  hasContent.value = !!t.trim() || !!area.value?.querySelector('img')
  refreshToolbarState()
}

// Selection survives popover clicks: snapshot on edits, restore before commands.
let savedRange: Range | null = null
function saveSel() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount && area.value?.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange()
    try { currentBlock.value = (document.queryCommandValue('formatBlock') || 'p').toLowerCase() } catch { /* 无选区时保持原值 */ }
    detectList()
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
  if (name === 'undo') { redoDepth.value++; undoDepth.value = Math.max(0, undoDepth.value - 1) }
  if (name === 'redo') { undoDepth.value++; redoDepth.value = Math.max(0, redoDepth.value - 1) }
}

function setBlock(tag: string) {
  cmd('formatBlock', tag)
  openPop.value = null
}

// 样式菜单：当前块/列表态检测（原版当前项 disabled + 勾）
const currentList = ref<'ul' | 'ol' | 'task' | null>(null)
function detectList() {
  const node = savedRange?.startContainer
  const el = node instanceof Element ? node : node?.parentElement
  const li = el?.closest('li')
  const ul = li?.closest('ul')
  currentList.value = ul ? (ul.classList.contains('jr-task') ? 'task' : 'ul') : el?.closest('ol') ? 'ol' : null
}
function isCurrentBlock(s: { tag: string; list?: string }) {
  if (s.list) return currentList.value === s.list
  return currentBlock.value === s.tag && !currentList.value
}
function pickBlock(s: { tag: string; list?: string }) {
  if (s.list === 'ol') cmd('insertOrderedList')
  else if (s.list === 'ul') cmd('insertUnorderedList')
  else if (s.list === 'task') insertTaskList()
  else setBlock(s.tag)
}

// 右栏里的工具菜单从触发控件下方展开，并限制在编辑区宽度内。
function positionPopover(anchor?: Element) {
  const rect = anchor?.getBoundingClientRect()
  const pane = props.inline ? editorPane.value?.getBoundingClientRect() : undefined
  popY.value = pane && rect ? Math.min(rect.bottom - pane.top + 4, pane.height / 2) : null
  popX.value = rect ? Math.max(8, Math.min(rect.left - (pane?.left ?? 0) - 12, (pane?.width ?? window.innerWidth) - 328)) : null
}

function togglePop(name: keyof typeof popoverLabels, ev?: MouseEvent) {
  if (openPop.value === name) { openPop.value = null; return }
  saveSel()
  openPop.value = name
  insertSub.value = null
  colorSub.value = null
  positionPopover((ev?.currentTarget as HTMLElement | undefined) ?? (ev?.target as HTMLElement | undefined))
}

// 菜单项点击不夺焦点（保住编辑器选区）；输入框不受影响
function onPopMousedown(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.closest("button.jr-pop-item")) e.preventDefault()
}

// 审计 #5：行内代码按钮（选区包装；无选区插占位）
function insertInlineCodeButton() {
  const sel = window.getSelection()
  const text = sel?.toString() || '代码'
  insertHtml('<code>' + esc(text) + '</code>&nbsp;')
}
// 审计 #5：缩进按钮（复用 Tab 逻辑；仅列表内生效）
function indentSelection(outdent: boolean) {
  const sel = window.getSelection()
  const anchor = sel?.anchorNode
  if (!anchor) return
  const el = anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement
  const li = el?.closest('li') as HTMLElement | null
  if (!li) return
  if (outdent) unNestListItem(li)
  else nestListItem(li)
  recount()
}

function insertTableGrid() {
  const rows = Math.max(1, Math.min(20, tableRows.value || 2))
  const cols = Math.max(1, Math.min(10, tableCols.value || 2))
  const head = `<tr>${Array.from({ length: cols }, () => '<th>标题</th>').join('')}</tr>`
  const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('')
  insertHtml(`<table border='1' style='border-collapse:collapse'>${head}${body}</table><p></p>`)
}

// Vuetify 3 VColorPicker 默认色板（原版颜色子面板直接使用库默认值）
const swatchRows = [
  ['#FFFFFF', '#FF5252', '#FFC107', '#4CAF50', '#00BCD4', '#3F51B5', '#9C27B0'],
  ['#000000', '#FF867F', '#FFD54F', '#81C784', '#4DD0E1', '#7986CB', '#BA68C8'],
  ['#5D4037', '#D32F2F', '#FBC02D', '#388E3C', '#00ACC1', '#303F9F', '#7B1FA2'],
  ['#795548', '#C62828', '#F9A825', '#43A047', '#0097A7', '#283593', '#6A1B9A'],
  ['#8D6E63', '#B71C1C', '#F57F17', '#2E7D32', '#00838F', '#1A237E', '#4A148C'],
]
function applySwatch(c: string) {
  restoreSel()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(colorSub.value === 'highlight' ? 'hiliteColor' : 'foreColor', false, c)
  recount()
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
  // 审计 #2：Esc 取消编辑（弹层打开时由各弹层自身处理）
  if (e.key === 'Escape' && !openPop.value && !datePop.value) { discardEntry(); return }
  // Tab / Shift+Tab adjust list indentation (official desktop behavior [J8])
  if (e.key === 'Tab') {
    const sel = window.getSelection()
    if (sel && sel.anchorNode && area.value?.contains(sel.anchorNode)) {
      const anchor = sel.anchorNode
      const el = anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement
      const li = el?.closest('li') as HTMLElement | null
      if (li) {
        e.preventDefault()
        // 原版为规范嵌套 li>ul>li；浏览器原生 indent 会产出 ul>ul 兄弟结构，故手动搬移
        const moved = e.shiftKey ? unNestListItem(li) : nestListItem(li)
        if (!moved) document.execCommand(e.shiftKey ? 'outdent' : 'indent')
        const r = document.createRange()
        r.selectNodeContents(li)
        r.collapse(false)
        sel.removeAllRanges()
        sel.addRange(r)
        saveSel()
        recount()
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
  // 行内代码：`text` 第二个反引号落下时转换（原版 markdown 引擎行为）
  const codeMatch = /`([^`\n]+)`$/.exec(line)
  if (codeMatch) {
    e.preventDefault()
    const dropLen = codeMatch[0].length
    for (let i = 0; i < dropLen; i++) document.execCommand('delete')
    // live selection（saved range 指向已删除的标记节点，不可恢复）
    document.execCommand('insertHTML', false, `<code>${esc(codeMatch[1] ?? '')}</code>&nbsp;`)
    recount()
    return
  }
  const rules: [RegExp, string | undefined, string | undefined][] = [
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
      document.execCommand(cmdName as string, false, val as string | undefined)
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

// Tab 缩进：把 li 移入前一项的子列表（规范 li>ul>li 结构）
function nestListItem(li: HTMLElement): boolean {
  const prev = li.previousElementSibling as HTMLElement | null
  if (!prev || prev.tagName !== 'LI') return false
  let sub = prev.querySelector(':scope > ul, :scope > ol') as HTMLElement | null
  if (!sub) {
    sub = document.createElement(li.parentElement?.tagName === 'OL' ? 'ol' : 'ul')
    prev.appendChild(sub)
  }
  sub.appendChild(li)
  return true
}

// Shift+Tab：li 提升到父列表中 ownerLi 之后；后续兄弟留在 li 下新子列表
function unNestListItem(li: HTMLElement): boolean {
  const parentList = li.parentElement
  if (!parentList) return false
  const ownerLi = parentList.closest('li') as HTMLElement | null
  if (!ownerLi?.parentElement) return false
  const rest: Element[] = []
  let n = li.nextElementSibling
  while (n) { rest.push(n); n = n.nextElementSibling }
  ownerLi.parentElement.insertBefore(li, ownerLi.nextSibling)
  if (rest.length) {
    const sub = document.createElement(parentList.tagName)
    rest.forEach((el) => sub.appendChild(el))
    li.appendChild(sub)
  }
  return true
}

// 审计 #8：单篇日记时区（meta.timezone 在原版 schema 内）
const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const COMMON_TZ = ['Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC']
const tzDraft = ref(deviceTz)
watch(datePop, (v) => { if (v) tzDraft.value = meta.value.timezone || deviceTz })

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
  // 审计 #8：时区写回条目 meta（原版 schema 字段 timezone）
  meta.value = { ...meta.value, timezone: tzDraft.value }
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
  if (usePhotoLocation.value && info.location) meta.value = { ...meta.value, ...info.location, address: undefined, adcode: undefined, locationSource: 'gps' }
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
  positionPopover(cell)
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

// 定位与天气解耦：定位只在用户点击后请求，失败有明确提示（原版审计 #9）
const locBusy = ref(false)
const locError = ref('')

/** 用浏览器定位（WGS-84）。随后反查高德拿到地址与行政区编码（GCJ-02）。 */
function useMyLocation(fillWeather = false) {
  if (!navigator.geolocation) { locError.value = '此浏览器不支持定位。'; return }
  locBusy.value = true
  locError.value = ''
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      const lat = +p.coords.latitude.toFixed(6)
      const lng = +p.coords.longitude.toFixed(6)
      meta.value = { ...meta.value, lat, lng, locationSource: 'gps' }
      // 反查地址：高德只接受 GCJ-02，这里让 amap 层负责转换
      const info = await reverseGeocodeAmap(lng, lat)
      if (info) {
        meta.value = {
          ...meta.value,
          address: info.address || meta.value.address,
          adcode: info.adcode || meta.value.adcode,
        }
      }
      locBusy.value = false
      if (fillWeather) await fillWeatherFromLocation()
    },
    (err) => {
      locBusy.value = false
      locError.value = err.code === err.PERMISSION_DENIED ? '定位权限被拒绝。可在浏览器地址栏重新允许，或手动填写地点。' : err.code === err.TIMEOUT ? '定位超时，请重试或手动填写地点。' : '定位失败，请重试或手动填写地点。'
    },
    { timeout: 8000, enableHighAccuracy: true },
  )
}

/** 用当前地点的行政区编码查实况天气；缺 adcode 时先反查一次。 */
async function fillWeatherFromLocation() {
  if (meta.value.lat == null || meta.value.lng == null) {
    weatherError.value = '请先选择地点，再获取天气。'
    return
  }
  weatherBusy.value = true
  weatherError.value = ''
  try {
    let adcode = meta.value.adcode
    if (!adcode) {
      const info = await reverseGeocodeAmap(meta.value.lng!, meta.value.lat!)
      if (info?.adcode) {
        adcode = info.adcode
        meta.value = { ...meta.value, adcode, address: meta.value.address || info.address }
      }
    }
    if (!adcode) { weatherError.value = '无法确定所在行政区，请重新选择地点。'; return }
    const w = await fetchAmapWeather(adcode)
    if (!w) { weatherError.value = '天气服务暂时不可用，请检查密钥或稍后再试。'; return }
    meta.value = {
      ...meta.value,
      weatherIcon: amapWeatherIcon(w.weather),
      weatherDegreeC: w.degreeC,
      weatherDescription: w.weather,
    }
  } catch {
    weatherError.value = '天气请求失败，请检查网络后重试。'
  } finally {
    weatherBusy.value = false
  }
}

async function searchPlace() {
  const q = placeQuery.value.trim()
  if (!q) return
  if (!getAmapWebKey()) { placeError.value = '尚未配置「Web服务」Key，可在设置 → 通用 → 地点里填写。'; return }
  placeBusy.value = true
  placeError.value = ''
  try {
    const { hits, error, info } = await searchAmapPlacesResult(q, placeCity.value.trim())
    placeHits.value = hits
    // 区分「真的没搜到」和「搜索服务用不了」，否则用户会一直换关键词
    if (error === 'service') placeError.value = `地点搜索失败：${amapInfoHint(info)}。请在 设置 → 通用 → 地点 检查 Key。`
    else if (error === 'network') placeError.value = '地点搜索超时或网络不可用，请检查网络后重试。'
    else if (!hits.length) placeError.value = '没有找到匹配的地点，可换个说法或手动填写。'
  } catch {
    placeError.value = '地点搜索失败，请检查网络后重试。'
  } finally {
    placeBusy.value = false
  }
}

function pickPlace(h: AmapPlaceHit) {
  meta.value = {
    ...meta.value,
    address: h.detail || h.name,
    lat: +h.lat.toFixed(6),
    lng: +h.lng.toFixed(6),
    adcode: h.adcode,
    locationSource: 'amap',
  }
  placeHits.value = []
  placeError.value = ''
}

/** 手填地点名时坐标不再可信，清掉旧坐标避免地图标错位置 */
function onManualAddressInput(value: string) {
  meta.value = { ...meta.value, address: value, lat: undefined, lng: undefined, adcode: undefined, locationSource: undefined }
}

function clearPlace() {
  meta.value = { ...meta.value, address: undefined, lat: undefined, lng: undefined, adcode: undefined, locationSource: undefined }
  placeHits.value = []
  placeError.value = ''
  locError.value = ''
}

// 兼容旧调用的包装（天气弹层里的定位按钮）
function useMyLocationForWeather() { useMyLocation(true) }

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
  if (props.entryId == null && empty && !attachmentCount.value) {
    clearDraft()
    emit('done')
    return
  }
  saving.value = true
  try {
    const savedId = await saveEntry(props.entryId, empty ? '' : text, date.value, meta.value, staged.value, removedMedia.value)
    clearDraft()
    emit('done', savedId)
  } catch (error) {
    attachmentNote.value = errorText(error, '无法保存日记，请重试。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div ref="editorPane" class="jr-editor" :class="{ 'jr-editor-inline': inline }" @dragover="($event.dataTransfer?.types || []).includes('Files') && $event.preventDefault()" @drop="onFileDrop">
    <dialog v-if="inline" ref="discardDialog" class="jr-editor-discard" aria-label="放弃未保存的修改">
      <p>放弃未保存的内容并退出编辑？</p>
      <form method="dialog">
        <button class="jr-btn" value="keep" autofocus>继续编辑</button>
        <button class="jr-btn jr-btn-danger" value="discard">放弃修改</button>
      </form>
    </dialog>
    <p v-if="draftRestored" class="jr-draft-note" role="status">{{ draftRestored }}</p>
    <div class="jr-editor-head">
      <button class="dt" @click="openDatePicker">
        <JrIcon :path="mdiCalendarBlankOutline" :size="19" />
        <span>{{ dateLabel }}</span>
        <JrIcon :path="mdiChevronDown" :size="18" />
      </button>
      <button class="jr-icon-btn" type="button" title="取消编辑（Esc）" aria-label="取消编辑" :disabled="saving" @click="discardEntry"><JrIcon :path="mdiClose" :size="20" /></button>
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
        <div class="jr-pop-row">
          <select v-model="tzDraft" class="jr-pop-input" aria-label="时区">
            <option :value="deviceTz">本机时区（{{ deviceTz }}）</option>
            <option v-for="tz in COMMON_TZ" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="jr-editor-body" style="position:relative">
      <div v-if="!touched && !hasContent && !attachmentCount" class="jr-editor-ph">
        开始写日记，或选择 <button class="jr-template-chip" @click.stop="openTemplates"><JrIcon :path="mdiApps" :size="13" /> 模板</button>。
      </div>
      <div
        ref="area"
        class="jr-editor-area"
        role="textbox"
        aria-label="日记正文"
        aria-multiline="true"
        :contenteditable="initialReady ? 'true' : 'false'"
        :spellcheck="spellcheck"
        @input="recount(); saveSel(); touched = true; scheduleDraft(); noteUndo()"
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

    <div v-if="openPop" class="jr-pop jr-editor-tool-pop" :style="{
      left: popX == null ? undefined : `${popX}px`,
      transform: popX == null ? undefined : 'none',
      '--jr-editor-pop-top': popY == null ? undefined : `${popY}px`,
    }" @click.stop @mousedown="onPopMousedown">
      <!-- 移动端所有弹层为底部抽屉(证据 s02),抽屉带标题头(含段落样式) -->
      <div v-if="!headlessPops.has(openPop) || isMobile" class="jr-pop-head">
        <span>{{ popoverLabels[openPop] }}</span>
        <button class="tb" @click="openPop = null"><JrIcon :path="mdiClose" :size="16" /></button>
      </div>

      <template v-if="openPop === 'style'">
        <button
          v-for="s in [
            { tag: 'p', icon: mdiFormatPilcrow, label: '正文' },
            { tag: 'h1', icon: mdiFormatHeader1, label: '标题 1' },
            { tag: 'h2', icon: mdiFormatHeader2, label: '标题 2' },
            { tag: 'h3', icon: mdiFormatHeader3, label: '标题 3' },
            { tag: 'blockquote', icon: mdiFormatQuoteOpen, label: '引用' },
            { tag: 'ol', icon: mdiFormatListNumbered, label: '有序列表', list: 'ol' },
            { tag: 'ul', icon: mdiFormatListBulleted, label: '无序列表', list: 'ul' },
            { tag: 'ul jr-task', icon: mdiFormatListChecks, label: '任务列表', list: 'task' },
          ]" :key="s.tag"
          class="jr-pop-item" :disabled="isCurrentBlock(s)" @click="pickBlock(s)"
        >
          <JrIcon :path="s.icon" :size="17" class="jr-pop-ico" />
          <span style="flex:1">{{ s.label }}</span>
          <JrIcon v-if="isCurrentBlock(s)" :path="mdiCheck" :size="15" class="jr-check" />
        </button>
      </template>

      <template v-else-if="openPop === 'insert'">
        <template v-if="!insertSub">
          <button class="jr-pop-item" @click="insertSub = 'link'"><JrIcon :path="mdiLink" :size="17" class="jr-pop-ico" /> 插入 链接</button>
          <button class="jr-pop-item" @click="insertSub = 'image'"><JrIcon :path="mdiImage" :size="17" class="jr-pop-ico" /> 插入 从网址获取的图片</button>
          <button class="jr-pop-item" @click="insertSub = 'table'"><JrIcon :path="mdiTable" :size="17" class="jr-pop-ico" /> 插入 表格</button>
          <button class="jr-pop-item" @click="insertHtml('<hr>')"><JrIcon :path="mdiBorderHorizontal" :size="17" class="jr-pop-ico" /> 插入 分隔线</button>
        </template>
        <template v-else-if="insertSub === 'link'">
          <div class="jr-pop-row">
            <input v-model="linkUrl" placeholder="https://…" class="jr-pop-input" @keydown.enter.prevent="insertWebMedia(false)" />
          </div>
          <button class="jr-pop-item" @click="insertWebMedia(false)"><JrIcon :path="mdiCheck" :size="15" class="jr-pop-ico" /> 插入链接</button>
        </template>
        <template v-else-if="insertSub === 'image'">
          <div class="jr-pop-row">
            <input v-model="imageUrl" aria-label="图片网址" placeholder="https://…（图片）" class="jr-pop-input" @keydown.enter.prevent="insertWebMedia(true)" />
          </div>
          <button class="jr-pop-item" @click="insertWebMedia(true)"><JrIcon :path="mdiCheck" :size="15" class="jr-pop-ico" /> 插入图片</button>
        </template>
        <template v-else-if="insertSub === 'table'">
          <p class="jr-muted" style="font-size:12.5px;padding:4px 12px 0">请输入行数和列数</p>
          <div class="jr-pop-row">
            <label style="font-size:13px;display:flex;align-items:center;gap:6px">行 <input v-model.number="tableRows" type="number" min="1" max="20" class="jr-pop-input" style="width:70px" /></label>
            <label style="font-size:13px;display:flex;align-items:center;gap:6px">列 <input v-model.number="tableCols" type="number" min="1" max="10" class="jr-pop-input" style="width:70px" /></label>
          </div>
          <button class="jr-pop-item" @click="insertTableGrid()"><JrIcon :path="mdiCheck" :size="15" class="jr-pop-ico" /> 插入表格</button>
        </template>
        <p v-if="insertError" role="status">{{ insertError }}</p>
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
        <template v-if="!colorSub">
          <button class="jr-pop-item" @click="colorSub = 'color'"><JrIcon :path="mdiPalette" :size="17" class="jr-pop-ico" /> 颜色</button>
          <button class="jr-pop-item" @click="colorSub = 'highlight'"><JrIcon :path="mdiMarker" :size="17" class="jr-pop-ico" /> 高亮</button>
          <button class="jr-pop-item" @click="cmd('removeFormat'); openPop = null"><JrIcon :path="mdiWaterOff" :size="17" class="jr-pop-ico" /> 移除颜色</button>
        </template>
        <template v-else>
          <div class="jr-swatch-grid">
            <template v-for="(row, r) in swatchRows" :key="r">
              <button v-for="c in row" :key="c" class="jr-swatch" :style="{ background: c }" :title="c" @click="applySwatch(c)" />
            </template>
          </div>
        </template>
      </template>

      <template v-else-if="openPop === 'media'">
        <button class="jr-pop-item" @click="pickFile"><JrIcon :path="mdiImageMultipleOutline" :size="17" class="jr-pop-ico" /> 照片、视频或音频</button>
        <button v-if="voice.available" class="jr-pop-item" :disabled="recordingStatus !== 'idle'" @click="startVoiceNote"><JrIcon :path="mdiCheck" :size="17" class="jr-pop-ico" /> 录制语音笔记</button>
      </template>

      <template v-else-if="openPop === 'loc'">
        <p v-if="locError" class="jr-muted" role="status" style="padding:0 12px">{{ locError }}</p>
        <div class="jr-pop-row">
          <input v-model="placeQuery" placeholder="搜索地点…" class="jr-pop-input" @keydown.enter.prevent="searchPlace" />
          <button class="jr-pop-item" style="width:auto" :disabled="placeBusy" @click="searchPlace"><JrIcon :path="mdiCheck" :size="16" /></button>
        </div>
        <div class="jr-pop-row">
          <input v-model="placeCity" placeholder="城市（可选，用于区分同名）" class="jr-pop-input" @keydown.enter.prevent="searchPlace" />
        </div>
        <p v-if="placeError" class="jr-muted" role="status" style="padding:0 12px">{{ placeError }}</p>
        <div v-if="placeHits.length" class="jr-place-hits">
          <button v-for="h in placeHits" :key="h.name + h.lat + h.lng" class="jr-pop-item jr-place-hit" @click="pickPlace(h); openPop = null">
            <b>{{ h.name }}</b>
            <span class="jr-muted">{{ h.detail }}</span>
          </button>
        </div>
        <div class="jr-pop-row">
          <input :value="meta.address" placeholder="手动填写地点名" class="jr-pop-input" @input="onManualAddressInput(($event.target as HTMLInputElement).value)" />
        </div>
        <div class="jr-pop-row">
          <input v-model.number="meta.lat" type="number" step="any" placeholder="纬度" class="jr-pop-input" />
          <input v-model.number="meta.lng" type="number" step="any" placeholder="经度" class="jr-pop-input" />
        </div>
        <p v-if="meta.lat != null && !meta.locationSource" class="jr-muted" role="status" style="padding:0 12px">
          这条位置的坐标来源不明（旧记录）。若在地图上位置有偏移，请重新搜索选点。
        </p>
        <button class="jr-pop-item" @click="useMyLocation(false)" :disabled="locBusy">{{ locBusy ? '正在定位…' : '使用当前位置' }}</button>
        <button v-if="meta.address || meta.lat != null" class="jr-pop-item jr-danger" @click="clearPlace(); openPop = null">移除地点</button>
      </template>

      <template v-else-if="openPop === 'weather'">
        <p v-if="locError" class="jr-muted" role="status" style="padding:0 12px">{{ locError }}</p>
        <p v-if="weatherError" class="jr-muted" role="status" style="padding:0 12px">{{ weatherError }}</p>
        <button class="jr-pop-item" :disabled="weatherBusy || locBusy" @click="fillWeatherFromLocation">
          {{ weatherBusy ? '正在获取…' : '按当前地点获取天气' }}
        </button>
        <button class="jr-pop-item" :disabled="weatherBusy || locBusy" @click="useMyLocationForWeather">
          {{ locBusy ? '正在定位…' : '用当前位置的天气' }}
        </button>
        <p v-if="needsAdcode" class="jr-muted" style="padding:0 12px;font-size:12px">当前地点没有行政区编码（旧记录），将先反查一次。</p>
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

      <template v-else-if="openPop === 'family'">
        <p class="jr-muted" style="font-size:12px;padding:2px 12px 6px;line-height:1.6">
          共享后，家人能在自己的时间线看到这篇日记，可以评论、也可以在文末追加段落；原文只有你能改。
        </p>
        <button class="jr-pop-item" :class="{ 'jr-on': meta.visibility !== 'family' }" @click="meta.visibility = 'private'; openPop = null">
          <JrIcon :path="mdiLockOutline" :size="18" class="jr-pop-ico" />
          <span style="flex:1">仅自己</span>
          <JrIcon v-if="meta.visibility !== 'family'" :path="mdiCheck" :size="15" class="jr-check" />
        </button>
        <button class="jr-pop-item" :class="{ 'jr-on': meta.visibility === 'family' }" @click="meta.visibility = 'family'; openPop = null">
          <JrIcon :path="mdiAccountMultipleOutline" :size="18" class="jr-pop-ico" />
          <span style="flex:1">共享给家人</span>
          <JrIcon v-if="meta.visibility === 'family'" :path="mdiCheck" :size="15" class="jr-check" />
        </button>
      </template>
    </div>

    <div class="jr-editor-toolbar">
      <button class="tb" :class="{ 'jr-open': attachmentCount || staged.length }" title="媒体" @click="togglePop('media', $event)">
        <JrIcon :path="mdiImageMultipleOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.address || meta.lat != null }" title="地点" @click="togglePop('loc', $event)">
        <JrIcon :path="mdiMapMarkerOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.weatherIcon }" title="天气" @click="togglePop('weather', $event)">
        <JrIcon :path="mdiWeatherSunny" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.sentiment }" title="心情" @click="togglePop('mood', $event)">
        <JrIcon :path="mdiEmoticonOutline" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': meta.activity }" title="活动" @click="togglePop('activity', $event)">
        <JrIcon :path="mdiRun" :size="20" />
      </button>
      <button class="tb" :class="{ 'jr-open': (meta.tagWordIds || []).length }" title="标签" @click="togglePop('tags', $event)">
        <JrIcon :path="mdiTagOutline" :size="20" />
      </button>
      <button v-if="familyJoined" class="tb" :class="{ 'jr-open': meta.visibility === 'family' }" title="共享家人" @click="togglePop('family', $event)">
        <JrIcon :path="mdiAccountMultipleOutline" :size="20" />
      </button>
      <div class="sep" />
      <button class="body-btn" @click="togglePop('style', $event)">
        <JrIcon :path="mdiFormatPilcrow" :size="17" />
        <span>正文</span>
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <button class="body-btn" title="插入" @click="togglePop('insert', $event)">
        <JrIcon :path="mdiPlus" :size="17" />
        <JrIcon :path="mdiChevronDown" :size="16" />
      </button>
      <div class="sep" />
      <button class="tb" :class='{ on: fmtState.bold }' :disabled="!hasContent" :aria-pressed="fmtState.bold" title="粗体" @click="cmd('bold')"><JrIcon :path="mdiFormatBold" :size="19" /></button>
      <button class="tb" :class='{ on: fmtState.italic }' :disabled="!hasContent" :aria-pressed="fmtState.italic" title="斜体" @click="cmd('italic')"><JrIcon :path="mdiFormatItalic" :size="19" /></button>
      <button class="tb" :class='{ on: fmtState.strike }' :disabled="!hasContent" :aria-pressed="fmtState.strike" title="删除线" @click="cmd('strikeThrough')"><JrIcon :path="mdiFormatStrikethrough" :size="19" /></button>
      <button class="tb" :class='{ on: fmtState.underline }' :disabled="!hasContent" :aria-pressed="fmtState.underline" title="下划线" @click="cmd('underline')"><JrIcon :path="mdiFormatUnderline" :size="19" /></button>
      <button class="tb beach-btn" :disabled="!hasContent" title="颜色" @click="togglePop('color', $event)">
        <span class="beach-ball" aria-hidden="true" />
        <JrIcon :path="mdiChevronDown" :size="14" />
      </button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent" title="项目列表" @click="cmd('insertUnorderedList')"><JrIcon :path="mdiFormatListBulleted" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="编号列表" @click="cmd('insertOrderedList')"><JrIcon :path="mdiFormatListNumbered" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="待办列表" @click="insertTaskList()"><JrIcon :path="mdiCheckboxMarkedOutline" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="行内代码" @click="insertInlineCodeButton()"><JrIcon :path="mdiCodeTags" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="增加缩进（列表内 Tab）" @click="indentSelection(false)"><JrIcon :path="mdiFormatIndentIncrease" :size="19" /></button>
      <button class="tb" :disabled="!hasContent" title="减少缩进（列表内 Shift+Tab）" @click="indentSelection(true)"><JrIcon :path="mdiFormatIndentDecrease" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :class="{ on: fmtState.align === 'left' }" :disabled="!hasContent" title="左对齐" :aria-pressed="fmtState.align === 'left'" @click="cmd('justifyLeft')"><JrIcon :path="mdiFormatAlignLeft" :size="19" /></button>
      <button class="tb" :class="{ on: fmtState.align === 'center' }" :disabled="!hasContent" title="居中" :aria-pressed="fmtState.align === 'center'" @click="cmd('justifyCenter')"><JrIcon :path="mdiFormatAlignCenter" :size="19" /></button>
      <button class="tb" :class="{ on: fmtState.align === 'right' }" :disabled="!hasContent" title="右对齐" :aria-pressed="fmtState.align === 'right'" @click="cmd('justifyRight')"><JrIcon :path="mdiFormatAlignRight" :size="19" /></button>
      <div class="sep" />
      <button class="tb" :disabled="!hasContent || !canUndo" title="撤销" @click="doUndo"><JrIcon :path="mdiUndo" :size="19" /></button>
      <button class="tb" :disabled="!hasContent || !canRedo" title="重做" @click="doRedo"><JrIcon :path="mdiRedo" :size="19" /></button>
      <button class="words">
        <span>词数</span><span style="font-weight:700">{{ words }}</span>
        <span>·</span>
        <span>字数</span><span style="font-weight:700">{{ chars }}</span>
      </button>
    </div>

    <!-- 选择模板对话框（原版 Pick a Template 三区结构；教练模板目录来自证据，内容依赖 Journey 云端，不伪造） -->
    <div v-if="templateDialog" class="jr-modal-mask" @click.self="templateDialog = false">
      <div class="jr-modal jr-tpl-modal" role="dialog" aria-label="选择模板">
        <button class="jr-modal-x" aria-label="关闭" @click="templateDialog = false"><JrIcon :path="mdiClose" :size="15" /></button>
        <h2 class="jr-tpl-title">选择模板</h2>
        <div class="jr-tpl-body">
          <div class="jr-tpl-sec-head"><span>教练模板</span><span class="jr-tpl-viewall">查看全部 ›</span></div>
          <div class="jr-tpl-cards">
            <button v-for="c in coachTemplates" :key="c.name" class="jr-tpl-card" @click="coachNote = `「${c.name}」的模板内容来自 Journey 云端，登录原版账户后可用。`">
              <div class="jr-tpl-cover" aria-hidden="true">{{ c.name.slice(0, 1) }}</div>
              <div class="jr-tpl-name">{{ c.name }} <span class="jr-tpl-free">FREE</span></div>
              <div class="jr-tpl-desc">{{ c.desc }}</div>
            </button>
          </div>
          <p v-if="coachNote" role="status" class="jr-import-msg">{{ coachNote }}</p>
          <div class="jr-tpl-sec-head"><span>自定义模板</span></div>
          <div v-if="!templates.length" class="jr-muted jr-tpl-empty">暂无内容</div>
          <div v-for="t in templates" :key="t.id" class="jr-share-acct">
            <button class="jr-pop-item" style="flex:1" @click="insertTemplate(t); templateDialog = false">{{ t.name }}</button>
            <button class="jr-icon-btn" title="重命名" aria-label="重命名模板" @click="renameTemplate(t)"><JrIcon :path="mdiPencil" :size="16" /></button>
            <button class="jr-link-danger" @click="deleteTemplate(t)">删除</button>
          </div>
          <div class="jr-tpl-sec-head"><span>离线模板</span></div>
          <div class="jr-muted jr-tpl-empty">暂无内容</div>
        </div>
      </div>
    </div>
  </div>
</template>
