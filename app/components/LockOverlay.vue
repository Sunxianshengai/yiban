<script setup lang="ts">
/**
 * PIN lock per original Security settings. Unlock lives in sessionStorage so a new
 * browser session locks again (closest web analog to app-launch lock).
 */
const emit = defineEmits<{ (e: 'unlocked'): void }>()
const stored = localStorage.getItem('jr.pinHash') || ''
const pin = ref('')
const err = ref('')
const unlocked = ref(!stored)

async function tryPin() {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin.value))
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hash === stored) {
    sessionStorage.setItem('jr.unlocked', '1')
    unlocked.value = true
    emit('unlocked')
  } else {
    err.value = '密码不正确。'
    pin.value = ''
  }
}
</script>

<template>
  <div v-if="!unlocked" class="jr-lock">
    <div class="jr-lock-card">
      <div style="font-size:44px">🔒</div>
      <h2>输入密码</h2>
      <input
        v-model="pin"
        type="password"
        inputmode="numeric"
        maxlength="8"
        class="jr-lock-input"
        autofocus
        @keydown.enter="tryPin"
      />
      <p v-if="err" class="jr-lock-err">{{ err }}</p>
      <button class="jr-btn jr-btn-primary" @click="tryPin">解锁</button>
    </div>
  </div>
</template>
