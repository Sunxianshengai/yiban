<script setup lang="ts">
import {
  mdiCheckCircleOutline,
  mdiDotsHorizontal,
  mdiFlagOutline,
  mdiSend,
  mdiShieldCheckOutline,
  mdiThumbDownOutline,
  mdiThumbUpOutline,
  mdiTrashCanOutline,
} from '@mdi/js'
import { answerOdysseyQuestion, type OdysseyCitation } from '~/utils/odysseyEngine'

interface OdysseyTurn {
  id: number
  question: string
  answer: string
  citations: OdysseyCitation[]
  mode: 'local' | 'ai'
  timestamp: number
  feedback?: 'up' | 'down'
  reported?: boolean
}

const DAILY_QUOTA = 20
const CONSENT_KEY = 'jr.odysseyConsent'
const QUOTA_KEY = 'jr.odysseyQuota'
const REPORT_KEY = 'jr.odysseyReports'

const { entries, refresh } = useEntries()
const prompt = ref('')
const history = ref<OdysseyTurn[]>([])
const menuOpen = ref(false)
const busy = ref(false)
const thread = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const editingEntryId = ref<number | null>(null)
const reportBanner = ref('')

const consented = ref(import.meta.client ? localStorage.getItem(CONSENT_KEY) === '1' : false)
const blockedIds = ref<number[]>(loadReportedIds())
const quotaUsed = ref(loadTodayQuota())

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadTodayQuota(): number {
  if (!import.meta.client) return 0
  try {
    const raw = localStorage.getItem(QUOTA_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return parsed.date === todayKey() ? Number(parsed.used || 0) : 0
  } catch {
    return 0
  }
}

function incrementQuota() {
  quotaUsed.value += 1
  if (import.meta.client) {
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: todayKey(), used: quotaUsed.value }))
  }
}

function loadReportedIds(): number[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(REPORT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.map((r: any) => Number(r.entryId)).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

function grantConsent() {
  consented.value = true
  if (import.meta.client) localStorage.setItem(CONSENT_KEY, '1')
}

function revokeConsent() {
  consented.value = false
  menuOpen.value = false
  if (import.meta.client) localStorage.removeItem(CONSENT_KEY)
}

const limitReached = computed(() => quotaUsed.value >= DAILY_QUOTA)
const remainingQuota = computed(() => Math.max(0, DAILY_QUOTA - quotaUsed.value))
const avatar = [true, true, false, true, false, true, false, true, true]

onMounted(async () => {
  if (!entries.value.length) await refresh()
})

async function ask(preset?: string) {
  const q = (preset ?? prompt.value).trim()
  if (!q || busy.value || !consented.value || limitReached.value) return
  if (!preset) prompt.value = ''
  busy.value = true
  try {
    if (!entries.value.length) await refresh()
    const res = await answerOdysseyQuestion(q, entries.value, blockedIds.value)
    incrementQuota()
    history.value.push({
      id: Date.now(),
      question: q,
      answer: res.text,
      citations: res.citations,
      mode: res.mode,
      timestamp: Date.now(),
    })
  } finally {
    busy.value = false
    await nextTick()
    if (thread.value) thread.value.scrollTop = thread.value.scrollHeight
  }
}

function setFeedback(turn: OdysseyTurn, vote: 'up' | 'down') {
  turn.feedback = turn.feedback === vote ? undefined : vote
}

function reportTurn(turn: OdysseyTurn) {
  turn.reported = true
  const entryIds = turn.citations.map((c) => c.entryId)
  if (import.meta.client) {
    try {
      const existing = JSON.parse(localStorage.getItem(REPORT_KEY) || '[]')
      const next = [
        ...(Array.isArray(existing) ? existing : []),
        ...entryIds.map((entryId) => ({ entryId, question: turn.question, at: new Date().toISOString() })),
      ]
      localStorage.setItem(REPORT_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
  }
  blockedIds.value = [...new Set([...blockedIds.value, ...entryIds])]
  reportBanner.value = entryIds.length
    ? `已记录反馈，并将本次引用的 ${entryIds.length} 篇日记从后续问答检索中屏蔽。`
    : '已记录本次回答的问题反馈。'
  setTimeout(() => { reportBanner.value = '' }, 4000)
}

async function reset() {
  history.value = []
  prompt.value = ''
  menuOpen.value = false
  await nextTick()
  input.value?.focus()
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit' }).format(timestamp)
}
</script>

<template>
  <section class="jr-odyssey" aria-labelledby="odyssey-title">
    <header class="jr-odyssey-bar">
      <div class="jr-odyssey-head">
        <h1 id="odyssey-title">旅程日记问答</h1>
        <span class="jr-odyssey-quota">今日配额 {{ remainingQuota }} / {{ DAILY_QUOTA }}</span>
      </div>
      <div class="jr-odyssey-menu" @keydown.esc="menuOpen = false">
        <button type="button" class="jr-odyssey-icon" aria-label="日记问答选项" :aria-expanded="menuOpen" aria-controls="jr-odyssey-options" @click="menuOpen = !menuOpen">
          <JrIcon :path="mdiDotsHorizontal" :size="24" />
        </button>
        <div v-show="menuOpen" id="jr-odyssey-options" class="jr-odyssey-options">
          <a href="https://journey.cloud/gptTerms" target="_blank" rel="noopener noreferrer">日记问答服务条款</a>
          <button v-if="consented" type="button" @click="revokeConsent">
            <JrIcon :path="mdiShieldCheckOutline" :size="17" /> 撤回检索授权
          </button>
          <button v-if="history.length" type="button" @click="reset">
            <JrIcon :path="mdiTrashCanOutline" :size="17" /> 重置会话
          </button>
        </div>
      </div>
    </header>

    <div v-if="reportBanner" class="jr-odyssey-notice" role="status">
      <JrIcon :path="mdiCheckCircleOutline" :size="16" /> {{ reportBanner }}
    </div>

    <div ref="thread" class="jr-odyssey-thread" role="log" aria-label="日记问答会话">
      <article v-if="!consented" class="jr-odyssey-consent">
        <div class="jr-odyssey-consent-title">
          <JrIcon :path="mdiShieldCheckOutline" :size="20" />
          <span>开启日记检索与问答授权</span>
        </div>
        <p>
          开启后，旅程日记问答会在本地检索你的日记文本、时间与地点标签以生成回答并附带原文引用；若你在「设置 → 日记伙伴」中配置了兼容 OpenAI 的接口，也会用该模型润色总结。你可以随时在右上角菜单撤回授权。
        </p>
        <button type="button" class="jr-btn jr-btn-primary" @click="grantConsent">同意并开启日记问答</button>
      </article>

      <article class="jr-odyssey-message">
        <div class="jr-odyssey-avatar" aria-hidden="true">
          <span v-for="(active, index) in avatar" :key="index" :class="{ active }" />
        </div>
        <div class="jr-odyssey-bubble">
          <p>你好，我是旅程日记问答助手（已接入你本机的 {{ entries.length }} 篇日记）。你可以直接点击或输入问题：</p>
          <div class="jr-odyssey-prompts">
            <button type="button" class="jr-chip" :disabled="!consented" @click="ask('我今年一共写了多少篇日记？')">今年写了多少篇日记？</button>
            <button type="button" class="jr-chip" :disabled="!consented" @click="ask('总结一下我最近两周写了什么')">最近两周写了什么？</button>
            <button type="button" class="jr-chip" :disabled="!consented" @click="ask('按月统计我今年写了多少篇日记')">按月统计日记数量</button>
          </div>
          <small>旅程日记问答 · 本地检索 &amp; AI 辅助</small>
        </div>
      </article>

      <template v-for="turn in history" :key="turn.id">
        <div class="jr-odyssey-user-row">
          <div class="jr-odyssey-user-bubble">{{ turn.question }}</div>
        </div>
        <article class="jr-odyssey-message">
          <div class="jr-odyssey-avatar" aria-hidden="true">
            <span v-for="(active, dot) in avatar" :key="dot" :class="{ active }" />
          </div>
          <div class="jr-odyssey-bubble">
            <p class="jr-odyssey-answer">{{ turn.answer }}</p>

            <div v-if="turn.citations.length" class="jr-odyssey-cites">
              <div class="jr-odyssey-cites-title">原文引用（点击查看/编辑）</div>
              <button
                v-for="cite in turn.citations"
                :key="cite.entryId"
                type="button"
                class="jr-odyssey-cite"
                @click="editingEntryId = cite.entryId"
              >
                <span class="jr-odyssey-cite-date">{{ cite.dateLabel }}<template v-if="cite.address"> · {{ cite.address }}</template></span>
                <span class="jr-odyssey-cite-snippet">{{ cite.snippet }}</span>
              </button>
            </div>

            <div class="jr-odyssey-actions">
              <small>{{ turn.mode === 'ai' ? 'AI 综合回答' : '本地检索回答' }} · {{ timeLabel(turn.timestamp) }}</small>
              <div class="jr-odyssey-fb">
                <button type="button" :class="{ on: turn.feedback === 'up' }" aria-label="有帮助" @click="setFeedback(turn, 'up')">
                  <JrIcon :path="mdiThumbUpOutline" :size="15" />
                </button>
                <button type="button" :class="{ on: turn.feedback === 'down' }" aria-label="无帮助" @click="setFeedback(turn, 'down')">
                  <JrIcon :path="mdiThumbDownOutline" :size="15" />
                </button>
                <button type="button" :disabled="turn.reported" aria-label="举报或屏蔽引用" @click="reportTurn(turn)">
                  <JrIcon :path="mdiFlagOutline" :size="15" />
                  <span>{{ turn.reported ? '已举报' : '举报' }}</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      </template>
    </div>

    <form class="jr-odyssey-input" @submit.prevent="ask()">
      <input
        ref="input"
        v-model="prompt"
        type="text"
        aria-label="询问关于日记的问题"
        :placeholder="!consented ? '请先点击上方「同意并开启日记问答」' : limitReached ? '今日配额已用完，明日自动重置' : '问我一个关于日记的问题…'"
        :disabled="!consented || limitReached || busy"
      />
      <button class="jr-btn jr-btn-primary" aria-label="发送问题" :disabled="!consented || !prompt.trim() || limitReached || busy">
        <JrIcon :path="mdiSend" :size="20" />
      </button>
    </form>

    <EntryEditor
      v-if="editingEntryId != null"
      :entry-id="editingEntryId"
      @done="editingEntryId = null; refresh()"
    />
  </section>
</template>

<style scoped>
.jr-odyssey { display: flex; flex-direction: column; height: 100%; min-width: 0; background: var(--jr-bg); }
.jr-odyssey-bar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 26px; border-bottom: 1px solid var(--jr-outline-variant); }
.jr-odyssey-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.jr-odyssey-bar h1 { font-size: 20px; margin: 0; }
.jr-odyssey-quota { font-size: 12px; padding: 3px 9px; border-radius: 999px; background: var(--jr-surface-variant); color: var(--jr-on-surface-variant); }
.jr-odyssey-notice { display: flex; align-items: center; gap: 6px; padding: 8px 26px; font-size: 12.5px; background: var(--jr-primary-container); color: var(--jr-on-primary-container); }
.jr-odyssey-icon { display: grid; place-items: center; border: 0; border-radius: 8px; width: 36px; height: 36px; background: transparent; color: var(--jr-on-bg); }
.jr-odyssey-icon:hover { background: var(--jr-surface-variant); }
.jr-odyssey-options { position: absolute; top: 61px; right: 24px; z-index: 2; min-width: 180px; padding: 6px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; background: var(--jr-surface); box-shadow: 0 4px 16px #0002; }
.jr-odyssey-options :is(a, button) { display: flex; align-items: center; gap: 8px; text-align: left; width: 100%; padding: 9px; background: transparent; border: 0; border-radius: 6px; font-size: 13px; color: var(--jr-on-bg); text-decoration: none; cursor: pointer; }
.jr-odyssey-options :is(a, button):hover { background: var(--jr-surface-variant); }
.jr-odyssey-thread { flex: 1; min-height: 0; overflow-y: auto; padding: 24px clamp(14px, 4vw, 48px); }
.jr-odyssey-consent { max-width: 820px; margin: 0 auto 20px; padding: 18px 20px; border-radius: 14px; border: 1px solid var(--jr-primary); background: color-mix(in srgb, var(--jr-primary-container) 35%, var(--jr-surface)); }
.jr-odyssey-consent-title { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 8px; color: var(--jr-primary); }
.jr-odyssey-consent p { margin: 0 0 12px; font-size: 13.5px; line-height: 1.6; }
.jr-odyssey-message { display: flex; align-items: flex-start; gap: 14px; max-width: 820px; margin: 0 auto 20px; }
.jr-odyssey-user-row { display: flex; justify-content: flex-end; max-width: 820px; margin: 0 auto 14px; }
.jr-odyssey-user-bubble { max-width: 78%; padding: 10px 16px; border-radius: 14px 14px 4px 14px; background: var(--jr-primary); color: var(--jr-on-primary); font-size: 14px; line-height: 1.5; }
.jr-odyssey-avatar { flex: 0 0 56px; height: 56px; padding: 11px; display: grid; gap: 4px; grid-template-columns: repeat(3, 1fr); border-radius: 12px; background: color-mix(in srgb, var(--jr-tertiary) 23%, var(--jr-surface)); color: var(--jr-tertiary); }
.jr-odyssey-avatar span { aspect-ratio: 1; border-radius: 50%; background: currentColor; opacity: .22; }
.jr-odyssey-avatar span.active { opacity: 1; }
.jr-odyssey-bubble { flex: 1; min-width: 0; border-radius: 12px; background: var(--jr-secondary-container); color: var(--jr-on-secondary-container); padding: 16px 20px; line-height: 1.55; }
.jr-odyssey-bubble p { margin: 0 0 10px; }
.jr-odyssey-answer { white-space: pre-line; }
.jr-odyssey-prompts { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
.jr-odyssey-cites { margin-top: 12px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--jr-outline-variant) 55%, transparent); display: grid; gap: 6px; }
.jr-odyssey-cites-title { font-size: 12px; font-weight: 700; opacity: .8; }
.jr-odyssey-cite { text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--jr-outline-variant); background: var(--jr-surface); color: var(--jr-on-bg); cursor: pointer; }
.jr-odyssey-cite:hover { border-color: var(--jr-primary); }
.jr-odyssey-cite-date { font-size: 11.5px; font-weight: 700; color: var(--jr-primary); }
.jr-odyssey-cite-snippet { font-size: 12.5px; color: var(--jr-on-surface-variant); }
.jr-odyssey-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.jr-odyssey-actions small { font-size: 12px; opacity: .78; }
.jr-odyssey-fb { display: flex; align-items: center; gap: 4px; }
.jr-odyssey-fb button { display: inline-flex; align-items: center; gap: 3px; border: 0; border-radius: 6px; padding: 4px 7px; background: transparent; color: inherit; font-size: 12px; cursor: pointer; opacity: .75; }
.jr-odyssey-fb button:hover, .jr-odyssey-fb button.on { background: color-mix(in srgb, var(--jr-primary) 18%, transparent); opacity: 1; }
.jr-odyssey-input { display: flex; gap: 8px; width: min(100%, 916px); margin: 0 auto; padding: 16px clamp(14px, 4vw, 48px) 23px; }
.jr-odyssey-input input { flex: 1; min-width: 0; padding: 12px 14px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; background: var(--jr-surface); color: var(--jr-on-bg); }
.jr-odyssey-input button:disabled { opacity: .55; cursor: default; }
@media (max-width: 640px) {
  .jr-odyssey-bar { padding: 12px; }
  .jr-odyssey-message { gap: 8px; }
  .jr-odyssey-avatar { flex-basis: 40px; height: 40px; padding: 7px; gap: 3px; }
  .jr-odyssey-bubble { padding: 12px; }
}
</style>
