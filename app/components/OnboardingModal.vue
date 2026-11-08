<script setup lang="ts">
import { mdiCheck } from '@mdi/js'

/**
 * First-run onboarding. Captured steps from the original (evidence/screenshots onb-0*.png):
 * step 3 "Safe & Private.", step 4 "Meet Barry & Sherry.", final "Keep Your Memories Forever."
 * with Sign In / Later. Steps 1-2, 5-7 were not captured (recorded as fidelity gap F-031);
 * no content is invented for them — flow shows the captured cards in order.
 */
const emit = defineEmits<{ (e: 'finish'): void }>()
const step = ref(0)
const cards = [
  { t: 'Safe & Private.', d: 'Trusted by millions for over a decade, Journey keeps your journal yours.', emoji: '🔒' },
  { t: 'Meet Barry & Sherry.', d: 'Your journaling companions are here to listen, reflect with you, and make journaling feel more joyful.', emoji: '🧸🐑' },
  { t: 'Keep Your Memories Forever.', d: "It's free to sync your memories & see them on any of the devices.", emoji: '📱' },
]
function next() {
  if (step.value < cards.length - 1) step.value++
  else finish()
}
function finish() {
  localStorage.setItem('jr.onboarded', '1')
  emit('finish')
}
</script>

<template>
  <div class="jr-onboard">
    <div class="jr-onboard-brand">
      <img src="/favicon.svg" width="26" height="26" alt="" />
      <span>JOURNEY</span>
    </div>
    <div class="jr-onboard-bar"><div class="jr-onboard-fill" :style="{ width: `${((step + 1) / cards.length) * 100}%` }" /></div>
    <div class="jr-onboard-card">
      <div class="jr-onboard-emoji">{{ cards[step].emoji }}</div>
      <h2>{{ cards[step].t }}</h2>
      <p>{{ cards[step].d }}</p>
      <button v-if="step < cards.length - 1" class="jr-btn jr-btn-primary" @click="next">Next ›</button>
      <template v-else>
        <button class="jr-btn jr-btn-primary" @click="finish">Start journaling</button>
        <p class="jr-muted" style="font-size:12px;margin-top:10px">Sign-in to Journey account is not part of this replica — the local journal starts immediately (original offers Sign In / Later).</p>
      </template>
    </div>
  </div>
</template>
