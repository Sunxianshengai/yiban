<script setup lang="ts">
import { mdiSend } from '@mdi/js'

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
  if (!endpoint.value) { error.value = 'Configure an AI endpoint below first.'; return }
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  error.value = ''
  try {
    const res = await fetch(endpoint.value.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.value}` },
      body: JSON.stringify({ model: localStorage.getItem('jr.palModel') || 'gpt-4o-mini', messages: [{ role: 'system', content: 'You are Pal, a warm journaling companion. Reflect with the user, ask gentle questions, encourage capturing moments in their journal.' }, ...messages.value] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    messages.value.push({ role: 'assistant', content: data.choices?.[0]?.message?.content || '(empty reply)' })
  } catch (e) {
    error.value = `Request failed: ${(e as Error).message}`
  }
  sending.value = false
}
const palModel = ref(localStorage.getItem('jr.palModel') || 'gpt-4o-mini')
watchEffect(() => localStorage.setItem('jr.palModel', palModel.value))
</script>

<template>
  <div class="jr-page jr-pal">
    <h1>Pal</h1>
    <div class="jr-pal-thread">
      <div v-if="!messages.length" class="jr-muted" style="margin:auto;text-align:center">
        <p style="font-size:34px">🧸🐑</p>
        <p>Barry &amp; Sherry are your journaling companions.</p>
        <p class="jr-muted" style="font-size:12.5px;max-width:420px">
          The original Pal talks to Journey's own servers (palRequest IPC). This replica calls
          <b>your own OpenAI-compatible endpoint</b> instead — configure it below, or leave it unset
          (feature stays honestly unavailable, no fake success).
        </p>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="jr-pal-msg" :class="m.role">{{ m.content }}</div>
      <p v-if="error" class="jr-import-msg">{{ error }}</p>
    </div>

    <div class="jr-pal-config">
      <input v-model="endpoint" placeholder="Endpoint base URL, e.g. https://api.openai.com/v1" />
      <input v-model="apiKey" type="password" placeholder="API key (stored locally only)" />
      <input v-model="palModel" placeholder="model" style="max-width:160px" />
    </div>
    <form class="jr-pal-input" @submit.prevent="send">
      <input v-model="input" type="text" placeholder="Say something to your Pal…" />
      <button class="jr-btn" :disabled="sending"><JrIcon :path="mdiSend" :size="18" /></button>
    </form>
  </div>
</template>
