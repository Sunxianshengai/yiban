<script setup lang="ts">
import { mdiAirballoonOutline, mdiBookOpenPageVariantOutline, mdiCellphone, mdiCheckDecagramOutline, mdiLockOutline, mdiPawOutline } from '@mdi/js'

// Guest branch from Journey's OnboardingDialogView, indexed against all eight steps.
const emit = defineEmits<{ (e: 'finish'): void }>()
const step = ref(0)
const cards = [
  { index: 1, t: 'Welcome to Journey!', d: 'Your diary, your companion. Press next to get started.', icon: mdiBookOpenPageVariantOutline },
  { index: 2, t: 'Your Life Companion.', d: 'Journey is a place to keep your memories and confide in privately.', icon: mdiAirballoonOutline },
  { index: 3, t: 'Safe & Private.', d: 'Trusted by millions for over a decade, Journey keeps your journal yours.', icon: mdiLockOutline },
  { index: 4, t: 'Meet Barry & Sherry.', d: 'Your journaling companions are here to listen, reflect with you, and make journaling feel more joyful.', icon: mdiPawOutline },
  { index: 5, t: 'Keep Your Memories Forever.', d: 'Use the local journal to keep your memories on this device.', icon: mdiCellphone },
  { index: 8, t: 'Congratulations!', d: 'You can start using Journey. Journey is also available on desktop & online web.', icon: mdiCheckDecagramOutline },
]
const card = computed(() => cards[step.value]!)
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
  <div class="jr-onboard" role="dialog" aria-modal="true" aria-labelledby="jr-onboard-heading">
    <div class="jr-onboard-brand">
      <img src="/favicon.svg" width="26" height="26" alt="" />
      <span>JOURNEY</span>
    </div>
    <div class="jr-onboard-bar" role="progressbar" aria-label="Setup progress" :aria-valuenow="card.index" aria-valuemin="0" aria-valuemax="8"><div class="jr-onboard-fill" :style="{ width: `${card.index / 8 * 100}%` }" /></div>
    <div class="jr-onboard-card">
      <div class="jr-onboard-emoji" aria-hidden="true"><JrIcon :path="card.icon" :size="66" /></div>
      <h2 id="jr-onboard-heading">{{ card.t }}</h2>
      <p>{{ card.d }}</p>
      <button v-if="card.index === 5" class="jr-btn jr-btn-primary" @click="next">Later</button>
      <button v-else-if="card.index === 8" class="jr-btn jr-btn-primary" @click="finish">Ok, got it</button>
      <button v-else class="jr-btn jr-btn-primary" @click="next">Next ›</button>
    </div>
  </div>
</template>
