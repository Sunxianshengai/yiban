<script setup lang="ts">
import { mdiSend } from '@mdi/js'
import { errorText } from '~/utils/uiText'

/**
 * Pal (AI companion) — the original talks to Journey's own server (renderer->main:palRequest IPC,
 * pal-assets.journey.cloud). No Journey server is cloned; this page calls a user-configured
 * OpenAI-compatible endpoint instead, so the feature is real when configured and honestly
 * "not configured" otherwise (no fake success).
 */
const endpoint = ref(localStorage.getItem('jr.palEndpoint') || '')
const apiKey = ref(localStorage.getItem('jr.palKey') || '')
watchEffect(() => {
  localStorage.setItem('jr.palEndpoint', endpoint.value)
  localStorage.setItem('jr.palKey', apiKey.value)
})

const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const input = ref('')
const sending = ref(false)
const error = ref('')

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  if (!endpoint.value) { error.value = '请先配置下方的服务地址。'; return }
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  error.value = ''
  try {
    const res = await fetch(endpoint.value.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.value}` },
      body: JSON.stringify({ model: localStorage.getItem('jr.palModel') || 'gpt-4o-mini', messages: [{ role: 'system', content: '你是一位温和的日记伙伴。用简体中文和用户交流，陪他们回顾生活，提出温和的问题，鼓励他们写下值得记住的时刻。' }, ...messages.value] }),
    })
    if (!res.ok) throw new Error(`服务请求失败（HTTP ${res.status}）。`)
    const data = await res.json()
    messages.value.push({ role: 'assistant', content: data.choices?.[0]?.message?.content || '（没有收到回复）' })
  } catch (e) {
    error.value = errorText(e, '请求失败，请检查服务地址和网络。')
  }
  sending.value = false
}
const palModel = ref(localStorage.getItem('jr.palModel') || 'gpt-4o-mini')
watchEffect(() => localStorage.setItem('jr.palModel', palModel.value))
const isMobile = useIsMobile()
const configured = computed(() => !!endpoint.value.trim())
</script>

<template>
  <div class="jr-page jr-pal">
    <!-- 移动未配置：原版式场景卡（证据 r04/12-pal），配置即进入对话 -->
    <div v-if="isMobile && !configured" class="jr-pal-scene">
      <div class="scene-card">
        <div class="scene-ico" aria-hidden="true">🧸</div>
        <h2>你的 Pal 正在等你</h2>
        <p>配置你的 Pal 服务地址后随时开始。密钥仅保存在本机。</p>
        <input v-model="endpoint" placeholder="服务地址，例如 https://api.openai.com/v1" aria-label="服务地址" />
        <input v-model="apiKey" type="password" placeholder="接口密钥（仅保存在本机）" aria-label="接口密钥" />
        <button class="jr-btn jr-btn-primary" style="width:100%">配置后自动进入对话</button>
      </div>
    </div>

    <template v-else>
      <h1>日记伙伴</h1>
      <div class="jr-pal-thread">
        <div v-if="!messages.length" class="jr-muted" style="margin:auto;text-align:center">
          <p style="font-size:34px">🧸🐑</p>
          <p>巴里和雪莉是你的日记伙伴。</p>
          <p class="jr-muted" style="font-size:12.5px;max-width:420px">
            连接你配置的
            <b>兼容 OpenAI 接口的服务</b> 后，即可使用日记伙伴。
          </p>
        </div>
        <div v-for="(m, i) in messages" :key="i" class="jr-pal-msg" :class="m.role">{{ m.content }}</div>
        <p v-if="error" class="jr-import-msg">{{ error }}</p>
      </div>

      <div class="jr-pal-config">
        <input v-model="endpoint" placeholder="服务地址，例如 https://api.openai.com/v1" />
        <input v-model="apiKey" type="password" placeholder="接口密钥（仅保存在本机）" />
        <input v-model="palModel" placeholder="模型名称" style="max-width:160px" />
      </div>
      <form class="jr-pal-input" @submit.prevent="send">
        <input v-model="input" type="text" placeholder="和日记伙伴聊聊…" />
        <button class="jr-btn" :disabled="sending"><JrIcon :path="mdiSend" :size="18" /></button>
      </form>
    </template>
  </div>
</template>

<style scoped>
/* 移动场景态（证据 r04） */
.jr-pal-scene { position: fixed; inset: 0; z-index: 10; display: flex; align-items: flex-end; justify-content: center; padding: 0 16px calc(84px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #cfd8dd 0%, #e7e3da 55%, #f3efe6 100%); }
.scene-card { width: 100%; max-width: 420px; background: var(--jr-bg); border-radius: 20px; box-shadow: 0 14px 44px rgba(0, 40, 50, 0.25); padding: 26px 22px 22px; text-align: center; display: flex; flex-direction: column; gap: 12px; }
.scene-card .scene-ico { font-size: 44px; }
.scene-card h2 { margin: 0; font-size: 21px; font-weight: 800; }
.scene-card p { margin: 0; font-size: 13px; color: var(--jr-on-surface-variant); }
.scene-card input { border: 1px solid var(--jr-outline-variant); border-radius: 10px; padding: 11px 12px; font-family: inherit; font-size: 14px; background: #fff; color: var(--jr-on-bg); }
[data-theme="dark"] .jr-pal-scene { background: linear-gradient(180deg, #1d2427 0%, #23282b 55%, #2b2b28 100%); }
[data-theme="dark"] .scene-card { background: #242b2e; }
</style>
