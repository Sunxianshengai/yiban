<script setup lang="ts">
import { mdiDotsHorizontal, mdiSend, mdiTrashCanOutline } from '@mdi/js'

const prompt = ref('')
const history = ref<number[]>([])
const menuOpen = ref(false)
const thread = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const limitReached = computed(() => history.value.length >= 9)
const avatar = [true, true, false, true, false, true, false, true, true]

async function ask() {
  if (!prompt.value.trim() || limitReached.value) return
  prompt.value = ''
  history.value.push(Date.now())
  await nextTick()
  const area = thread.value
  if (area) area.scrollTop = area.scrollHeight
}

async function reset() {
  history.value = []
  prompt.value = ''
  menuOpen.value = false
  await nextTick()
  input.value?.focus()
}

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(timestamp)
}
</script>

<template>
  <section class="jr-odyssey" aria-labelledby="odyssey-title">
    <header class="jr-odyssey-bar">
      <h1 id="odyssey-title">Journey Odyssey AI</h1>
      <div class="jr-odyssey-menu" @keydown.esc="menuOpen = false">
        <button type="button" class="jr-odyssey-icon" aria-label="Odyssey options" :aria-expanded="menuOpen" aria-controls="jr-odyssey-options" @click="menuOpen = !menuOpen">
          <JrIcon :path="mdiDotsHorizontal" :size="24" />
        </button>
        <div v-show="menuOpen" id="jr-odyssey-options" class="jr-odyssey-options">
          <a href="https://journey.cloud/gptTerms" target="_blank" rel="noopener noreferrer">Journey Odyssey AI Terms Of Service</a>
          <button v-if="history.length" type="button" @click="reset">
            <JrIcon :path="mdiTrashCanOutline" :size="17" /> Reset Session
          </button>
        </div>
      </div>
    </header>

    <div ref="thread" class="jr-odyssey-thread" role="log" aria-label="Odyssey conversation">
      <article class="jr-odyssey-message">
        <div class="jr-odyssey-avatar" aria-hidden="true">
          <span v-for="(active, index) in avatar" :key="index" :class="{ active }" />
        </div>
        <div class="jr-odyssey-bubble">
          <p>Hello, I am Journey Odyssey AI, your AI journal assistant. Please ask me a question about your journal. Here are some questions to get you started:</p>
          <ul>
            <li>How many entries did I write in 2023?</li>
            <li>Tell me one thing I did in 2023.</li>
            <li>Summarize what I did on Christmas last year.</li>
            <li>Give me a month-by-month breakdown of my journal entries in Q4 of 2023.</li>
          </ul>
          <small>Journey Odyssey AI</small>
        </div>
      </article>
      <article v-for="(timestamp, index) in history" :key="index" class="jr-odyssey-message">
        <div class="jr-odyssey-avatar" aria-hidden="true">
          <span v-for="(active, dot) in avatar" :key="dot" :class="{ active }" />
        </div>
        <div class="jr-odyssey-bubble">
          <p>Please sign in to continue.</p>
          <p class="jr-odyssey-account">Odyssey requires a Journey account and a supported Journey Sync Drive.</p>
          <a class="jr-btn jr-btn-primary" href="https://journey.cloud/app/" target="_blank" rel="noopener noreferrer">Sign in on Journey</a>
          <small>Journey Odyssey AI · {{ timeLabel(timestamp) }}</small>
        </div>
      </article>
    </div>

    <form class="jr-odyssey-input" @submit.prevent="ask">
      <input ref="input" v-model="prompt" type="text" aria-label="Ask about your journal" placeholder="Ask me a question about your journal." :disabled="limitReached" />
      <button class="jr-btn jr-btn-primary" aria-label="Send question" :disabled="!prompt.trim() || limitReached">
        <JrIcon :path="mdiSend" :size="20" />
      </button>
    </form>
  </section>
</template>

<style scoped>
.jr-odyssey { display: flex; flex-direction: column; height: 100%; min-width: 0; background: var(--jr-bg); }
.jr-odyssey-bar { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 26px; border-bottom: 1px solid var(--jr-outline-variant); }
.jr-odyssey-bar h1 { font-size: 20px; margin: 0; }
.jr-odyssey-icon { display: grid; place-items: center; border: 0; border-radius: 8px; width: 36px; height: 36px; background: transparent; color: var(--jr-on-bg); }
.jr-odyssey-icon:hover { background: var(--jr-surface-variant); }
.jr-odyssey-options { position: absolute; top: 61px; right: 24px; z-index: 1; min-width: 180px; padding: 6px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; background: var(--jr-surface); box-shadow: 0 4px 16px #0002; }
.jr-odyssey-options :is(a, button) { display: flex; align-items: center; gap: 8px; text-align: left; width: 100%; padding: 9px; background: transparent; border: 0; border-radius: 6px; font-size: 13px; color: var(--jr-on-bg); text-decoration: none; }
.jr-odyssey-options :is(a, button):hover { background: var(--jr-surface-variant); }
.jr-odyssey-thread { flex: 1; min-height: 0; overflow-y: auto; padding: 26px clamp(14px, 4vw, 48px); }
.jr-odyssey-message { display: flex; align-items: flex-start; gap: 14px; max-width: 820px; margin: 0 auto 20px; }
.jr-odyssey-avatar { flex: 0 0 56px; height: 56px; padding: 11px; display: grid; gap: 4px; grid-template-columns: repeat(3, 1fr); border-radius: 12px; background: color-mix(in srgb, var(--jr-tertiary) 23%, var(--jr-surface)); color: var(--jr-tertiary); }
.jr-odyssey-avatar span { aspect-ratio: 1; border-radius: 50%; background: currentColor; opacity: .22; }
.jr-odyssey-avatar span.active { opacity: 1; }
.jr-odyssey-bubble { min-width: 0; border-radius: 12px; background: var(--jr-secondary-container); color: var(--jr-on-secondary-container); padding: 16px 20px; line-height: 1.55; }
.jr-odyssey-bubble p { margin: 0 0 10px; }
.jr-odyssey-bubble ul { margin: 6px 0 12px; padding-inline-start: 22px; }
.jr-odyssey-bubble small { display: block; margin-top: 8px; font-size: 12px; }
.jr-odyssey-account { font-size: 14px; }
.jr-odyssey-bubble a { text-decoration: none; }
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
