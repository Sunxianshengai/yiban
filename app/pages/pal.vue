<script setup lang="ts">
import { mdiSend, mdiMicrophone, mdiImageMultipleOutline, mdiClose, mdiHistory, mdiPencilOutline, mdiAutoFix, mdiBookOpenOutline, mdiCogOutline, mdiAccount } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { useEntries } from '~/composables/useEntries'
import { useVoiceNote } from '~/composables/useVoiceNote'
import { errorText } from '~/utils/uiText'
import { palChat, palTranscribe, getPalConfig, draftTextToHtml, type PalContentPart, type PalMessage } from '~/utils/palClient'
import type { PalDraft } from '~/components/PalDraftCard.vue'

/**
 * 日记伙伴（瞌睡小羊）——Pal 页改造（M-117）。
 *
 * 三种用法：
 * - 随手记：一句话/照片/语音 → 伙伴整理成草稿 → 用户确认后存成日记。
 * - 聊着写：伙伴问一两个具体问题，再把回答整理成可编辑草稿。
 * - 一起回看：只使用用户主动选中的那一篇日记（隐私硬约束，未选不能发）。
 *
 * AI 是用户自配的 OpenAI 兼容服务（本机保存密钥）；存储链路全部走本地 Dexie，AI 不落库。
 */

const { entries, saveEntry } = useEntries()
const isMobile = useIsMobile()
const photoInput = ref<HTMLInputElement | null>(null)

// ---- 配置 ----
// 配置表单已从本页移除（用户要求：页面直接就是对话界面），入口在 设置 → 日记伙伴。
// 每次发送都现读 localStorage，设置页保存完回来立即生效，无需刷新。
const cfg = computed(() => getPalConfig())
const configured = computed(() => !!cfg.value.endpoint.trim())
const NEED_CFG = '还没配置日记伙伴服务：在「设置 → 日记伙伴」里填入服务地址和密钥（仅保存在本机）。'

// ---- 小羊舞台：状态机 idle → thinking → awake ----
type PetStage = 'idle' | 'thinking' | 'awake'
const stage = ref<PetStage>('idle')
let awakeTimer: ReturnType<typeof setTimeout> | undefined
function setStage(next: PetStage) {
  stage.value = next
  clearTimeout(awakeTimer)
  if (next === 'awake') awakeTimer = setTimeout(() => { stage.value = 'idle' }, 4500)
}
onBeforeUnmount(() => clearTimeout(awakeTimer))

// ---- 模式与会话 ----
type Mode = 'capture' | 'guide' | 'review'
const mode = ref<Mode>('capture')
const modes = [
  { key: 'capture', label: '随手记', icon: mdiPencilOutline },
  { key: 'guide', label: '聊着写', icon: mdiAutoFix },
  { key: 'review', label: '一起回看', icon: mdiHistory },
] as const

interface ChatLine { role: 'user' | 'pal'; text: string; photos?: string[] }
const captureLines = ref<ChatLine[]>([])
const guideLines = ref<ChatLine[]>([])
const reviewLines = ref<ChatLine[]>([])
const lines = computed(() => mode.value === 'capture' ? captureLines.value : mode.value === 'guide' ? guideLines.value : reviewLines.value)

const busy = ref(false)
const error = ref('')
const draft = ref<PalDraft | null>(null)
const saving = ref(false)

// ---- 随手记 ----
const captureText = ref('')
const capturePhotos = ref<File[]>([])
const photoPreviews = ref<string[]>([])
function pickPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'))
  input.value = ''
  for (const file of picked) {
    if (capturePhotos.value.length >= 4) { error.value = '一条随手记最多带 4 张照片。'; break }
    capturePhotos.value.push(file)
    const reader = new FileReader()
    reader.onload = () => { photoPreviews.value.push(String(reader.result)) }
    reader.readAsDataURL(file)
  }
}
function removePhoto(index: number) {
  capturePhotos.value.splice(index, 1)
  photoPreviews.value.splice(index, 1)
}

// 语音：录完自动转写填进输入框，mp3 随草稿存为附件
const voiceFile = ref<File | null>(null)
const voice = useVoiceNote(async (file) => {
  voiceFile.value = file
  error.value = ''
  try {
    captureText.value = await palTranscribe(cfg.value.endpoint, cfg.value.apiKey, cfg.value.sttModel, file, file.name)
  } catch (e) {
    voiceFile.value = null
    error.value = (e as Error).message
  }
}, (message) => { error.value = message })

function toggleVoice() {
  if (voice.status.value === 'recording') voice.stop()
  else voice.start()
}

async function captureSend() {
  const text = captureText.value.trim()
  if (!text && !capturePhotos.value.length) return
  if (busy.value) return
  if (!configured.value) { error.value = NEED_CFG; return }
  error.value = ''
  captureLines.value.push({ role: 'user', text: text || '（照片）', photos: [...photoPreviews.value] })
  const sentPhotos = [...capturePhotos.value]
  const sentPreviews = [...photoPreviews.value]
  const sentAudio = voiceFile.value
  captureText.value = ''
  capturePhotos.value = []
  photoPreviews.value = []
  voiceFile.value = null
  busy.value = true
  setStage('thinking')
  try {
    const note = sentAudio ? `\n（用户同时发来一段录音附件，已随草稿保存。）` : ''
    const reply = await palChat(cfg.value.endpoint, cfg.value.apiKey, cfg.value.model, [
      { role: 'system', content: CAPTURE_SYS },
      { role: 'user', content: toContent(text + note, sentPhotos, sentPreviews) },
    ])
    captureLines.value.push({ role: 'pal', text: reply })
    draft.value = { text: reply, date: nowLocal(), photos: sentPhotos, audio: sentAudio }
    setStage('awake')
  } catch (e) {
    error.value = errorText(e, '整理失败，请稍后再试。')
    setStage('idle')
  } finally {
    busy.value = false
  }
}

// ---- 聊着写 ----
const guideText = ref('')
const guideTurns = ref(0)
async function guideSend() {
  const text = guideText.value.trim()
  if (!text || busy.value) return
  if (!configured.value) { error.value = NEED_CFG; return }
  error.value = ''
  guideText.value = ''
  guideLines.value.push({ role: 'user', text })
  busy.value = true
  setStage('thinking')
  try {
    const history: PalMessage[] = guideLines.value.slice(-8).map(l => ({ role: l.role === 'pal' ? 'assistant' : 'user', content: l.text }))
    const reply = await palChat(cfg.value.endpoint, cfg.value.apiKey, cfg.value.model, [
      { role: 'system', content: GUIDE_SYS },
      ...history,
    ])
    guideLines.value.push({ role: 'pal', text: reply })
    guideTurns.value++
    setStage('awake')
  } catch (e) {
    error.value = errorText(e, '请求失败，请稍后再试。')
    setStage('idle')
  } finally {
    busy.value = false
  }
}
async function guideCollect() {
  if (busy.value || !guideLines.value.length) return
  if (!configured.value) { error.value = NEED_CFG; return }
  error.value = ''
  busy.value = true
  setStage('thinking')
  try {
    const history = guideLines.value.map(l => `${l.role === 'user' ? '用户' : '伙伴'}：${l.text}`).join('\n')
    const reply = await palChat(cfg.value.endpoint, cfg.value.apiKey, cfg.value.model, [
      { role: 'system', content: GUIDE_SYS },
      { role: 'user', content: `以上是我们的对话：\n${history}\n\n现在把这次聊天整理成一篇日记草稿（第一人称、纯文本、不要标题、不要客套话，保留用户说过的细节）。` },
    ])
    draft.value = { text: reply, date: nowLocal(), photos: [] }
    setStage('awake')
  } catch (e) {
    error.value = errorText(e, '整理失败，请稍后再试。')
    setStage('idle')
  } finally {
    busy.value = false
  }
}

// ---- 一起回看（隐私：只有这里、且只有用户选中的那篇会进入提示词） ----
const searchQ = ref('')
const sharedEntry = ref<EntryV2 | null>(null)
const pickOpen = ref(false)
const sharedTitle = computed(() => {
  const e = sharedEntry.value
  if (!e) return ''
  const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(e.dateOfJournal))
  return `${date} · ${e.previewText.slice(0, 16)}`
})
const candidates = computed(() => {
  const q = searchQ.value.trim().toLowerCase()
  const rows = q ? entries.value.filter(e => e.previewText.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)) : entries.value
  return rows.slice(0, 30)
})
function share(entry: EntryV2) {
  sharedEntry.value = entry
  pickOpen.value = false
}
async function reviewAction(kind: 'look' | 'continue') {
  const entry = sharedEntry.value
  if (!entry || busy.value) return
  if (!configured.value) { error.value = NEED_CFG; return }
  error.value = ''
  reviewLines.value.push({ role: 'user', text: kind === 'look' ? '帮我回顾这篇日记。' : '帮我顺着这篇日记补写。' })
  busy.value = true
  setStage('thinking')
  try {
    const date = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(entry.dateOfJournal))
    const plain = entry.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || entry.previewText
    const ask = kind === 'look'
      ? '请回顾这篇日记：它记了什么、亮点是什么、当时是什么心情，用温和的口吻说给用户听（不要复述全文）。'
      : '请以同样的视角和语气为这篇日记补写一段后续（或把没写完的部分补全），作为一篇新草稿输出（第一人称、纯文本、不要标题）。'
    const reply = await palChat(cfg.value.endpoint, cfg.value.apiKey, cfg.value.model, [
      { role: 'system', content: REVIEW_SYS },
      { role: 'user', content: `【用户主动分享的日记 · ${date}】\n${plain}\n\n${ask}` },
    ])
    reviewLines.value.push({ role: 'pal', text: reply })
    setStage('awake')
    if (kind === 'continue') draft.value = { text: reply, date: nowLocal(), photos: [], source: sharedTitle.value }
  } catch (e) {
    error.value = errorText(e, '请求失败，请稍后再试。')
    setStage('idle')
  } finally {
    busy.value = false
  }
}

// ---- 提示词（随手记/聊着写不含任何日记内容；回看只注入用户选中的那一篇） ----
const CAPTURE_SYS = '你是日记伙伴「小羊」，一只爱打瞌睡的温柔小羊。用户会随手发来一句话、照片或语音转写。请把它整理成一篇日记草稿正文：保留用户的原话细节和语气，适度补全成通顺的第一人称日记（3-8 句），不要编造没有发生的事，不要标题，不要客套话，直接输出正文。除非用户主动分享，你没有任何用户的日记内容。'
const GUIDE_SYS = '你是日记伙伴「小羊」。用户想写日记但不知道怎么开头。你每次只问一到两个具体的问题，帮助用户回忆细节（例如：当时在哪、和谁、发生了什么、最难忘的瞬间、心情如何）。问题要短、具体、好回答。收集足够细节后，等待用户要求整理时再输出日记草稿（第一人称、纯文本、不要标题）。除非用户主动分享，你没有任何用户的日记内容。'
const REVIEW_SYS = '你是日记伙伴「小羊」。用户主动分享了一篇自己的日记给你（只有这一篇）。你基于这一篇帮用户回顾或补写。回顾要温和、具体、不啰嗦；补写要贴合原文的视角和语气。不要询问或想象这篇日记之外的其他日记内容。'

// ---- 草稿保存（真实存储链路：saveEntry → Dexie） ----
async function acceptDraft(d: PalDraft) {
  saving.value = true
  error.value = ''
  try {
    await saveEntry(undefined, draftTextToHtml(d.text), new Date(d.date), {}, [...d.photos, ...(d.audio ? [d.audio] : [])], [])
    draft.value = null
    setStage('awake')
    captureLines.value.push({ role: 'pal', text: '已存进你的日记本，去时间线看看吧。' })
    guideLines.value.push({ role: 'pal', text: '已存进你的日记本，去时间线看看吧。' })
    reviewLines.value.push({ role: 'pal', text: '已存进你的日记本（新的一篇，原文没有改动）。' })
  } catch (e) {
    error.value = errorText(e, '保存失败，请稍后再试。')
  } finally {
    saving.value = false
  }
}

// ---- 工具 ----
function toContent(text: string, photos: File[], previews: string[]): string | PalContentPart[] {
  if (!photos.length) return text
  return [
    { type: 'text', text: text || '（用户发来照片，请结合照片整理日记草稿。）' },
    ...previews.map(url => ({ type: 'image_url' as const, image_url: { url } })),
  ]
}
function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
function rowDate(e: EntryV2) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(e.dateOfJournal))
}
function switchMode(next: Mode) {
  mode.value = next
  error.value = ''
}

// 点小羊：房间给浮动反应（PalRoom 内），这里顺手叫醒它
function onMascotTap() {
  setStage('awake')
}
</script>

<template>
  <div class="jr-page jr-pal">
    <!-- 家具房间：移动端在顶部；桌面（≥901px）grid 放右栏做家具互动界面 -->
    <div class="jr-pal-room-slot">
      <PalRoom :stage="stage" @mascot-tap="onMascotTap" />
    </div>

    <!-- 对话列：桌面左栏 = QQ/微信式对话记录框 -->
    <div class="jr-pal-chat">
      <!-- 未配置：一行横幅引导去设置，不挡对话界面（配置表单已挪到 设置 → 日记伙伴） -->
      <div v-if="!configured" class="jr-pal-noai" role="status">
        <JrIcon :path="mdiCogOutline" :size="15" />
        <span>{{ isMobile ? '还没配置 AI 服务：设置 → 通用 → 日记伙伴服务' : '还没配置 AI 服务：侧栏「设置」→ 通用 → 日记伙伴' }}</span>
        <button v-if="isMobile" class="jr-link-btn" @click="navigateTo('/settings')">去设置</button>
      </div>

      <div class="jr-pal-chathead">
        <h1 v-if="!isMobile">日记伙伴</h1>
        <!-- 模式切换 -->
        <div class="jr-pal-tabs" role="tablist" aria-label="日记伙伴用法">
          <button v-for="m in modes" :key="m.key" class="jr-pal-tab" :class="{ on: mode === m.key }" role="tab"
            :aria-selected="mode === m.key" @click="switchMode(m.key)">
            <JrIcon :path="m.icon" :size="15" /> {{ m.label }}
          </button>
        </div>
      </div>

      <!-- 随手记 -->
      <section v-if="mode === 'capture'" class="jr-pal-pane">
        <div class="jr-pal-thread">
          <div v-if="!captureLines.length" class="jr-muted" style="margin:auto;text-align:center">
            <p>发一句话、几张照片或一段语音，小羊帮你收进草稿，确认后存成日记。</p>
          </div>
          <div v-for="(line, i) in captureLines" :key="i" class="msg-row" :class="line.role">
            <img v-if="line.role === 'pal'" class="msg-avatar" src="/pet/lamb-poster.webp" alt="小羊头像">
            <span v-else class="msg-avatar user"><JrIcon :path="mdiAccount" :size="17" /></span>
            <div class="jr-pal-msg" :class="line.role">
              <div v-if="line.photos?.length" class="line-photos">
                <img v-for="(url, pi) in line.photos" :key="pi" :src="url" alt="随手记照片">
              </div>
              {{ line.text }}
            </div>
          </div>
        </div>
        <div v-if="photoPreviews.length" class="photo-strip">
          <span v-for="(url, i) in photoPreviews" :key="i" class="photo-thumb">
            <img :src="url" alt="待发送照片">
            <button class="photo-x" :aria-label="`移除照片 ${i + 1}`" @click="removePhoto(i)"><JrIcon :path="mdiClose" :size="11" /></button>
          </span>
        </div>
        <p v-if="voice.status.value === 'recording'" class="jr-muted" style="font-size:12.5px">正在录音，说完再点一次麦克风…</p>
        <p v-else-if="voice.status.value === 'encoding'" class="jr-muted" style="font-size:12.5px">正在转写…</p>
        <form class="jr-pal-input" @submit.prevent="captureSend">
          <input v-model="captureText" type="text" placeholder="随手记点什么…" aria-label="随手记内容">
          <button class="jr-btn icon-btn" type="button" title="添加照片" @click="photoInput?.click()"><JrIcon :path="mdiImageMultipleOutline" :size="18" /></button>
          <input ref="photoInput" type="file" accept="image/*" multiple class="sr-input" @change="pickPhotos">
          <button v-if="voice.available" class="jr-btn icon-btn" :class="{ rec: voice.status.value === 'recording' }" type="button" :title="voice.status.value === 'recording' ? '结束录音' : '语音输入'" @click="toggleVoice"><JrIcon :path="mdiMicrophone" :size="18" /></button>
          <button class="jr-btn" :disabled="busy || (!captureText.trim() && !capturePhotos.length)"><JrIcon :path="mdiSend" :size="18" /></button>
        </form>
      </section>

      <!-- 聊着写 -->
      <section v-else-if="mode === 'guide'" class="jr-pal-pane">
        <div class="jr-pal-thread">
          <div v-if="!guideLines.length" class="jr-muted" style="margin:auto;text-align:center">
            <p>说说今天想写什么（比如"今天去爬山了"），小羊会问你一两个具体的问题，再把回答整理成草稿。</p>
          </div>
          <div v-for="(line, i) in guideLines" :key="i" class="msg-row" :class="line.role">
            <img v-if="line.role === 'pal'" class="msg-avatar" src="/pet/lamb-poster.webp" alt="小羊头像">
            <span v-else class="msg-avatar user"><JrIcon :path="mdiAccount" :size="17" /></span>
            <div class="jr-pal-msg" :class="line.role">{{ line.text }}</div>
          </div>
        </div>
        <form v-if="guideTurns === 0" class="jr-pal-input" @submit.prevent="guideSend">
          <input v-model="guideText" type="text" placeholder="今天想写什么？一句话就够…" aria-label="开场话题">
          <button class="jr-btn" :disabled="busy || !guideText.trim()"><JrIcon :path="mdiSend" :size="18" /></button>
        </form>
        <form v-else class="jr-pal-input" @submit.prevent="guideSend">
          <input v-model="guideText" type="text" placeholder="回答小羊的问题…" aria-label="回答">
          <button class="jr-btn" :disabled="busy || !guideText.trim()"><JrIcon :path="mdiSend" :size="18" /></button>
          <button class="jr-btn jr-btn-primary" type="button" :disabled="busy" @click="guideCollect">整理成草稿</button>
        </form>
      </section>

      <!-- 一起回看 -->
      <section v-else class="jr-pal-pane">
        <div class="jr-share-row">
          <template v-if="sharedEntry">
            <span class="share-badge"><JrIcon :path="mdiBookOpenOutline" :size="14" /> 已共享：{{ sharedTitle }}</span>
            <button class="jr-link-btn" @click="sharedEntry = null">取消共享</button>
          </template>
          <button v-else class="jr-btn" @click="pickOpen = !pickOpen"><JrIcon :path="mdiBookOpenOutline" :size="16" /> 选择一篇日记</button>
        </div>
        <div v-if="pickOpen && !sharedEntry" class="jr-pal-pick">
          <input v-model="searchQ" class="jr-pop-input pick-search" type="search" placeholder="搜索日记…" aria-label="搜索日记">
          <div class="pick-list">
            <div v-for="e in candidates" :key="e.id" class="jr-entry" @click="share(e)">
              <div class="date">{{ rowDate(e) }}</div>
              <div class="preview">{{ e.previewText }}</div>
            </div>
            <p v-if="!candidates.length" class="jr-muted" style="padding:10px">没有匹配的日记。</p>
          </div>
        </div>
        <div class="jr-pal-thread">
          <div v-if="!reviewLines.length" class="jr-muted" style="margin:auto;text-align:center">
            <p>先在上面选择一篇日记。只有你主动选中的这一篇会被分享给伙伴，其余日记不会离开这台设备。</p>
          </div>
          <div v-for="(line, i) in reviewLines" :key="i" class="msg-row" :class="line.role">
            <img v-if="line.role === 'pal'" class="msg-avatar" src="/pet/lamb-poster.webp" alt="小羊头像">
            <span v-else class="msg-avatar user"><JrIcon :path="mdiAccount" :size="17" /></span>
            <div class="jr-pal-msg" :class="line.role">{{ line.text }}</div>
          </div>
        </div>
        <div class="jr-pal-input">
          <button class="jr-btn" :disabled="busy || !sharedEntry" @click="reviewAction('look')">帮我回顾</button>
          <button class="jr-btn jr-btn-primary" :disabled="busy || !sharedEntry" @click="reviewAction('continue')">帮我补写</button>
        </div>
      </section>

      <!-- 草稿卡 -->
      <PalDraftCard v-if="draft" :draft="draft" :saving="saving" style="margin:14px 0" @save="acceptDraft" @discard="draft = null" />

      <p v-if="error" class="jr-import-msg" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.jr-pal { display: flex; flex-direction: column; gap: 12px; max-width: 760px; }
.jr-pal-room-slot { display: flex; }
/* 房间子元素全为绝对定位，无内容宽度：必须 flex:1 撑满槽位，否则量出 0 宽 */
.jr-pal-room-slot .jr-pal-room { flex: 1; min-width: 0; }
.jr-pal-chat { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.jr-pal-chathead { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

/* QQ/微信式消息行：头像 + 气泡，用户侧右对齐 */
.msg-row { display: flex; align-items: flex-end; gap: 8px; }
.msg-row.user { flex-direction: row-reverse; }
.msg-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex: none; background: var(--jr-surface-variant); color: var(--jr-on-surface-variant); display: flex; align-items: center; justify-content: center; border: 1px solid var(--jr-outline-variant); overflow: hidden; }

h1 { margin: 0; font-size: 22px; font-weight: 800; }

/* 桌面双栏（≥901px）：左=对话记录框（会话区填满、输入钉底），右=家具互动房间 */
@media (min-width: 901px) {
  .jr-pal { display: grid; grid-template-columns: minmax(400px, 1fr) minmax(440px, 560px); gap: 18px; max-width: 1280px; align-items: stretch; }
  .jr-pal-room-slot { grid-column: 2; grid-row: 1; }
  .jr-pal-room-slot .jr-pal-room { flex: 1; height: auto; min-height: 0; }
  .jr-pal-chat { grid-column: 1; grid-row: 1; height: max(600px, calc(100vh - 150px)); }
  .jr-pal-pane { flex: 1; min-height: 0; }
  .jr-pal-pane .jr-pal-thread { flex: 1; min-height: 0; max-height: none; }
}

/* 模式 tab */
.jr-pal-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.jr-pal-tab { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--jr-outline-variant); background: var(--jr-bg); color: var(--jr-on-surface-variant); border-radius: 999px; padding: 7px 14px; font-weight: 700; font-size: 13px; cursor: pointer; }
.jr-pal-tab.on { background: var(--jr-primary); border-color: var(--jr-primary); color: #fff; }

/* 会话面板 */
.jr-pal-pane { display: flex; flex-direction: column; gap: 10px; }
.jr-pal-thread { display: flex; flex-direction: column; gap: 8px; min-height: 120px; max-height: 300px; overflow-y: auto; padding: 4px; }
.jr-pal-msg { max-width: 82%; border-radius: 14px; padding: 9px 13px; font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; }
.jr-pal-msg.user { align-self: flex-end; background: var(--jr-primary); color: #fff; }
.jr-pal-msg.pal { align-self: flex-start; background: var(--jr-surface-variant); color: var(--jr-on-surface); }
.line-photos { display: flex; gap: 6px; margin-bottom: 6px; }
.line-photos img { width: 86px; height: 86px; object-fit: cover; border-radius: 10px; }

/* 随手记输入 */
.jr-pal-input { display: flex; gap: 8px; align-items: center; }
.jr-pal-input input[type="text"] { flex: 1; border: 1px solid var(--jr-outline-variant); border-radius: 999px; padding: 10px 16px; font-family: inherit; font-size: 14px; background: #fff; color: var(--jr-on-bg); }
[data-theme="dark"] .jr-pal-input input[type="text"] { background: #1d2427; }
.icon-btn { padding: 9px 11px; }
.icon-btn.rec { background: #d34f5e; color: #fff; }
.sr-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.photo-strip { display: flex; gap: 8px; flex-wrap: wrap; }
.photo-thumb { position: relative; }
.photo-thumb img { width: 64px; height: 64px; object-fit: cover; border-radius: 10px; }
.photo-x { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; border: 0; background: #444d50; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }

/* 回看 */
.jr-share-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.share-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--jr-primary-container); color: var(--jr-on-bg); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; }
.jr-link-btn { border: 0; background: none; color: var(--jr-on-surface-variant); font-size: 12.5px; cursor: pointer; padding: 2px 4px; }
.jr-pal-pick { border: 1px solid var(--jr-outline-variant); border-radius: var(--jr-radius); padding: 10px; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow: hidden; }
.pick-search { width: 100%; }
.pick-list { overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.pick-list .jr-entry { padding: 8px 10px; border-radius: 10px; cursor: pointer; }
.pick-list .jr-entry:hover { background: var(--jr-surface-variant); }
.pick-list .jr-entry .date { font-size: 12px; color: var(--jr-on-surface-variant); }
.pick-list .jr-entry .preview { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 未配置横幅：一行提示，别挡对话界面（表单在 设置 → 日记伙伴） */
.jr-pal-noai {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--jr-surface-variant);
  color: var(--jr-on-surface-variant);
  font-size: 12.5px;
}
.jr-pal-noai span { flex: 1; }

/* ≤600px：舞台变矮、面板通栏（沿用移动抽屉时代的布局约定） */
@media (max-width: 600px) {
  .jr-pal { padding: 0; gap: 10px; }
  .jr-pal-msg { max-width: 92%; }
  .jr-pal-thread { min-height: 40vh; max-height: none; }
}
</style>
