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
</script>

<template>
  <div class="jr-page jr-pal">
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
  </div>
</template>
