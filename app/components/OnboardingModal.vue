<script setup lang="ts">
import { mdiAirballoonOutline, mdiBookOpenPageVariantOutline, mdiCellphone, mdiCheckDecagramOutline, mdiLockOutline, mdiPawOutline, mdiBellOutline } from '@mdi/js'

// Guest branch from Journey's OnboardingDialogView, indexed against all eight steps.
const emit = defineEmits<{ (e: 'finish'): void }>()
const isMobile = useIsMobile()
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

// 移动首启引导（证据 mobile/screens/01-06：3 屏 + 通知 + 完成页；通知接真实浏览器权限）
const mStep = ref(0)
const mSlides = [
  { t: '欢迎来到Journey！', d: '你的日记，你的伙伴。点击下一步即可开始。', cta: '开始写日记', skip: false },
  { t: '你的日记，你的伙伴。', d: 'Journey 帮助你记录日常点滴、回顾珍贵记忆，并打造一本多年后仍可随时翻阅的日记。', cta: '继续', skip: true },
  { t: '你的生活伙伴。', d: 'Journey是一个可以保管你的记忆并私下倾诉的地方。', cta: '继续', skip: true },
]
const mSlide = computed(() => mSlides[mStep.value]!)
async function mNext() {
  if (mStep.value < 2) mStep.value++
  else mStep.value = 3 // 通知步
}
async function mEnableNotifications() {
  try {
    if ('Notification' in window) await Notification.requestPermission()
  } catch { /* 通知权限被拒不阻塞引导 */ }
  mStep.value = 4
}
</script>

<template>
  <!-- 移动首启：3 屏 + 通知 + 完成页（对照原版 Android 走查） -->
  <div v-if="isMobile" class="jr-moboard" role="dialog" aria-modal="true" aria-label="引导">
    <div class="brand">JOURNEY</div>
    <div class="bar" role="progressbar" :aria-valuenow="mStep" aria-valuemin="0" aria-valuemax="4"><div class="fill" :style="{ width: `${(mStep + 1) / 4 * 100}%` }" /></div>

    <template v-if="mStep < 3">
      <div class="slide">
        <div class="hero" aria-hidden="true">📖</div>
        <h2>{{ mSlide.t }}</h2>
        <p>{{ mSlide.d }}</p>
        <button class="cta" @click="mNext">{{ mSlide.cta }} <span v-if="mSlide.cta === '开始写日记'">›</span></button>
        <button v-if="mSlide.skip" class="skip" @click="mStep = 3">跳过</button>
      </div>
    </template>

    <div v-else-if="mStep === 3" class="slide">
      <div class="hero"><JrIcon :path="mdiBellOutline" :size="56" /></div>
      <h2>获取通知！</h2>
      <p>通过开启提醒、教练提示等通知，养成记日志的习惯。</p>
      <button class="cta" @click="mEnableNotifications">启用通知</button>
      <button class="skip" @click="mStep = 4">稍后</button>
    </div>

    <div v-else class="slide">
      <div class="hero" aria-hidden="true">🎉</div>
      <h2>恭喜！</h2>
      <p>您可以开始使用Journey。Journey也可以在桌面应用程序和在线网站上使用。</p>
      <button class="cta" @click="finish">完成</button>
    </div>
  </div>

  <div v-else class="jr-onboard" role="dialog" aria-modal="true" aria-labelledby="jr-onboard-heading">
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

<style scoped>
/* 移动首启（证据 01-06） */
.jr-moboard { position: fixed; inset: 0; z-index: 60; background: linear-gradient(180deg, #f2f7f9 0%, #eaf1f4 100%); display: flex; flex-direction: column; align-items: center; padding: 0 24px; }
.jr-moboard .brand { margin-top: 26px; font-weight: 800; letter-spacing: 4px; font-size: 19px; color: var(--jr-primary); }
.jr-moboard .bar { width: 100%; height: 4px; background: #d5e5ea; border-radius: 2px; margin: 22px 0 0; overflow: hidden; }
.jr-moboard .fill { height: 100%; background: var(--jr-primary); transition: width .3s ease; }
.jr-moboard .slide { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; }
.jr-moboard .hero { font-size: 54px; margin-bottom: 18px; color: var(--jr-primary); }
.jr-moboard h2 { font-size: 26px; font-weight: 800; margin: 0 0 12px; color: var(--jr-primary); }
.jr-moboard p { font-size: 14.5px; color: var(--jr-on-surface-variant); line-height: 1.7; margin: 0 0 28px; max-width: 320px; }
.jr-moboard .cta { background: var(--jr-primary); color: var(--jr-on-primary); border: 0; border-radius: 999px; padding: 15px 44px; font-size: 16px; font-weight: 800; font-family: inherit; }
.jr-moboard .skip { margin-top: 16px; background: none; border: 0; color: var(--jr-on-surface-variant); font-size: 14px; font-family: inherit; padding: 8px 16px; }
</style>
