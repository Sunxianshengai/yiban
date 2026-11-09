<script setup lang="ts">
import { mdiAirballoonOutline, mdiBookOpenPageVariantOutline, mdiCellphone, mdiCheckDecagramOutline, mdiLockOutline, mdiPawOutline } from '@mdi/js'

// Guest branch from Journey's OnboardingDialogView, indexed against all eight steps.
const emit = defineEmits<{ (e: 'finish'): void }>()
const step = ref(0)
const cards = [
  { index: 1, t: '欢迎使用旅程日记！', d: '随身日记，伴你记录生活。点击「下一步」开始。', icon: mdiBookOpenPageVariantOutline },
  { index: 2, t: '你的生活伙伴', d: '在这里留住回忆，也可以私下写下自己的心事。', icon: mdiAirballoonOutline },
  { index: 3, t: '安全与隐私', d: '旅程日记十余年来帮助数百万用户保管私人日记。', icon: mdiLockOutline },
  { index: 4, t: '认识巴里和雪莉', d: '日记伙伴会倾听并陪你回顾，让记录更有趣。', icon: mdiPawOutline },
  { index: 5, t: '把回忆留在身边', d: '你可以使用本机日记，将回忆保存在这台设备上。', icon: mdiCellphone },
  { index: 8, t: '设置完成！', d: '现在可以开始写日记了。旅程日记提供桌面版和网页版。', icon: mdiCheckDecagramOutline },
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
      <span>旅程日记</span>
    </div>
    <div class="jr-onboard-bar" role="progressbar" aria-label="设置进度" :aria-valuenow="card.index" aria-valuemin="0" aria-valuemax="8"><div class="jr-onboard-fill" :style="{ width: `${card.index / 8 * 100}%` }" /></div>
    <div class="jr-onboard-card">
      <div class="jr-onboard-emoji" aria-hidden="true"><JrIcon :path="card.icon" :size="66" /></div>
      <h2 id="jr-onboard-heading">{{ card.t }}</h2>
      <p>{{ card.d }}</p>
      <button v-if="card.index === 5" class="jr-btn jr-btn-primary" @click="next">稍后</button>
      <button v-else-if="card.index === 8" class="jr-btn jr-btn-primary" @click="finish">开始使用</button>
      <button v-else class="jr-btn jr-btn-primary" @click="next">下一步 ›</button>
    </div>
  </div>
</template>
