<script setup lang="ts">
import { mdiArrowDown, mdiChevronLeft, mdiChevronRight, mdiCloseCircle, mdiCloud, mdiSeal } from '@mdi/js'
import logo from '~/assets/membership/journey-3d-icon.png'

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const scrollArea = ref<HTMLElement>()
const plans = ref(false)
const canScroll = ref(true)
let overviewOffset = 0

const benefits = [
  { name: '端到端加密', description: '日记从创建到存储均受加密保护。' },
  { name: '共享日记', description: '和家人朋友一起记录与分享回忆。' },
  { name: '网页分享链接', description: '分享旅程云同步中选中的日记。' },
  { name: '日记教练', description: '通过写作练习和引导提示养成记录习惯。' },
  { name: '日记问答', description: '询问关于日记的问题，回顾答案引用的条目。', to: '/odyssey' },
  { name: '打印与导出', description: '从云端打印日记，或导出为 EPUB 和 DOCX。' },
]

function updateScroll() {
  const area = scrollArea.value
  canScroll.value = !!area && area.scrollHeight - area.clientHeight - area.scrollTop > 2
}

function scrollDown() {
  const area = scrollArea.value
  if (area) area.scrollBy({ top: area.clientHeight * 0.85, behavior: 'smooth' })
}

function close() {
  dialog.value?.close()
  emit('close')
}

async function changePage(showPlans: boolean) {
  const area = scrollArea.value
  if (showPlans) overviewOffset = area?.scrollTop ?? 0
  plans.value = showPlans
  await nextTick()
  if (area) area.scrollTop = showPlans ? 0 : overviewOffset
  updateScroll()
}

onMounted(() => {
  dialog.value?.showModal()
  updateScroll()
})
</script>

<template>
  <dialog ref="dialog" class="jr-membership" aria-labelledby="jr-membership-title" @cancel.prevent="close" @click.self="close">
    <div class="jr-membership-frame">
      <button type="button" class="jr-membership-close" aria-label="关闭会员弹窗" autofocus @click="close">
        <JrIcon :path="mdiCloseCircle" :size="20" />
      </button>
      <button v-if="plans" type="button" class="jr-membership-back" aria-label="返回会员介绍" @click="changePage(false)">
        <JrIcon :path="mdiChevronLeft" :size="22" />
      </button>

      <div ref="scrollArea" class="jr-membership-content" @scroll="updateScroll">
        <header class="jr-membership-header">
          <img :src="logo" alt="" width="74" height="74" />
          <h2 id="jr-membership-title">会员</h2>
          <p v-if="!plans">开通会员，即可获得 10 GB 的旅程云同步空间。</p>
          <p v-else>选择会员套餐。</p>
        </header>

        <template v-if="!plans">
          <div class="jr-membership-feature-grid">
            <article class="jr-membership-feature jr-membership-sync">
              <h3><JrIcon :path="mdiCloud" :size="24" /> 跨平台同步</h3>
              <div class="jr-membership-devices" role="img" aria-label="旅程日记的手机、电脑和平板界面">
                <div class="jr-membership-device jr-membership-laptop"><span>我的日记</span><b>时间线</b></div>
                <div class="jr-membership-device jr-membership-tablet"><span>往日回忆</span><b>今天</b></div>
                <div class="jr-membership-device jr-membership-phone"><span>日记</span><b>今天</b></div>
              </div>
              <p>在手机上开始写日记，在平板上回顾，也可以回到电脑上继续写。</p>
            </article>
            <article class="jr-membership-feature jr-membership-trust">
              <h3><JrIcon :path="mdiSeal" :size="24" /> 值得信赖的日记平台</h3>
              <div class="jr-membership-stat"><strong>超过 10 年</strong><span>数百万用户</span></div>
              <p>十余年来，旅程日记帮助用户集中保存私人日记和珍贵回忆。</p>
            </article>
            <article v-for="benefit in benefits" :key="benefit.name" class="jr-membership-feature jr-membership-benefit">
              <h3>{{ benefit.name }}</h3>
              <p>{{ benefit.description }}</p>
              <NuxtLink v-if="benefit.to" :to="benefit.to" @click="close">打开日记问答</NuxtLink>
            </article>
          </div>
          <h3 class="jr-membership-section">大家喜欢旅程日记</h3>
          <div class="jr-membership-awards">
            <div><JrIcon :path="mdiSeal" :size="32" /><strong>2023 年度精选</strong><span>谷歌应用商店</span></div>
            <div><JrIcon :path="mdiSeal" :size="32" /><strong>今日推荐</strong><span>苹果应用商店</span></div>
          </div>
          <h3 class="jr-membership-section">常见问题</h3>
          <details>
            <summary>如何开通会员？</summary>
            <p>会员权益绑定旅程账号。可在官方网站查看当前套餐。</p>
          </details>
          <details>
            <summary>如何恢复购买？</summary>
            <p>请登录购买时使用的旅程账号。</p>
          </details>
        </template>
        <template v-else>
          <div class="jr-membership-plan-grid">
            <article v-for="period in ['按月', '按年', '终身']" :key="period" class="jr-membership-feature jr-membership-benefit">
              <h3>{{ period }}</h3>
            </article>
          </div>
          <p class="jr-membership-account">请前往旅程官网查看价格，并登录账号完成购买。</p>
        </template>
      </div>

      <footer class="jr-membership-footer">
        <button v-if="canScroll" type="button" class="jr-membership-scroll" aria-label="向下查看更多权益" @click="scrollDown">
          <JrIcon :path="mdiArrowDown" :size="16" />
        </button>
        <button v-if="!plans" type="button" class="jr-membership-cta" @click="changePage(true)">
          免费获取 10 GB 存储空间 <JrIcon :path="mdiChevronRight" :size="18" />
        </button>
        <a v-else class="jr-membership-cta" href="https://journey.cloud/membership" target="_blank" rel="noopener noreferrer">
          在旅程官网查看会员套餐 <JrIcon :path="mdiChevronRight" :size="18" />
        </a>
        <div class="jr-membership-links">
          <a href="https://journey.cloud/termsGeneral" target="_blank" rel="noopener noreferrer">使用条款</a>
          <span aria-hidden="true">·</span>
          <a href="https://journey.cloud/policy" target="_blank" rel="noopener noreferrer">隐私政策</a>
          <span aria-hidden="true">·</span>
          <button type="button" disabled title="请登录后恢复购买">恢复购买</button>
          <span aria-hidden="true">·</span>
          <a href="https://support.journey.cloud" target="_blank" rel="noopener noreferrer">帮助中心</a>
        </div>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.jr-membership {
  --membership-surface: color-mix(in srgb, var(--jr-secondary-container) 62%, var(--jr-surface));
  width: min(850px, calc(100vw - 28px)); height: min(756px, calc(100dvh - 44px));
  max-width: none; max-height: none; padding: 0; border: 1px solid var(--jr-outline-variant);
  border-radius: 12px; background: var(--membership-surface); color: var(--jr-on-bg);
  box-shadow: 0 16px 44px #0003; overflow: hidden;
}
.jr-membership::backdrop { background: #171c1e66; }
.jr-membership-frame { display: flex; flex-direction: column; height: 100%; position: relative; }
.jr-membership-close, .jr-membership-back {
  position: absolute; z-index: 1; top: 14px; border: 0; border-radius: 50%; padding: 5px;
  display: grid; place-items: center; background: var(--membership-surface); color: var(--jr-on-surface-variant);
}
.jr-membership-close { right: 15px; }
.jr-membership-back { left: 15px; }
.jr-membership-content { flex: 1; min-height: 0; overflow-y: auto; padding: 59px clamp(20px, 6vw, 56px) 45px; }
.jr-membership-header { text-align: center; margin-bottom: 25px; }
.jr-membership-header img { object-fit: contain; }
.jr-membership-header h2 { text-transform: uppercase; letter-spacing: 0.37em; font-size: 16px; margin: 12px 0; }
.jr-membership-header p { margin: 0; line-height: 1.4; }
.jr-membership-feature-grid, .jr-membership-awards, .jr-membership-plan-grid { display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.jr-membership-feature { border-radius: 12px; padding: 28px; }
.jr-membership-feature h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 19px; }
.jr-membership-feature p { margin: 16px 0 0; line-height: 1.42; }
.jr-membership-sync, .jr-membership-benefit { background: color-mix(in srgb, var(--jr-secondary-container) 76%, var(--jr-surface-variant)); }
.jr-membership-sync, .jr-membership-trust { min-height: 400px; }
.jr-membership-sync h3, .jr-membership-benefit a { color: var(--jr-primary); }
.jr-membership-sync p, .jr-membership-trust p { text-align: center; }
.jr-membership-trust { background: #070707; color: #fff; }
.jr-membership-devices, .jr-membership-stat { width: 100%; height: 188px; margin-top: 12px; }
.jr-membership-devices { position: relative; }
.jr-membership-device { position: absolute; display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 3px solid #253338; border-radius: 7px; background: #f5fafc; color: #164450; box-shadow: 0 5px 9px #142e3a33; font-size: 11px; }
.jr-membership-device b { padding: 4px; border-radius: 4px; background: #cee7ef; }
.jr-membership-device::after { content: ''; flex: 1; background: repeating-linear-gradient(#dbe4e7 0 2px, transparent 2px 10px); }
.jr-membership-laptop { width: 63%; height: 108px; top: 35px; left: 11%; }
.jr-membership-tablet { width: 42%; height: 87px; top: 60px; right: 0; }
.jr-membership-phone { width: 24%; height: 74px; top: 76px; left: 0; padding: 4px; }
.jr-membership-stat { display: grid; place-content: end center; gap: 6px; padding-bottom: 15px; text-align: center; }
.jr-membership-stat strong { font-size: 31px; color: #ffe142; }
.jr-membership-stat span { font-size: 22px; color: #aaa; font-weight: 700; }
.jr-membership-benefit a { display: inline-block; margin-top: 14px; font-weight: 700; }
.jr-membership-section { text-align: center; margin: 38px 0 18px; }
.jr-membership-awards div { display: grid; justify-items: center; align-content: center; gap: 6px; min-height: 140px; padding: 16px; border-radius: 10px; background: var(--jr-surface); }
.jr-membership-awards svg { color: var(--jr-primary); }
.jr-membership-content details { padding: 12px; border-bottom: 1px solid var(--jr-outline-variant); }
.jr-membership-content summary { cursor: pointer; }
.jr-membership-plan-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); text-align: center; }
.jr-membership-plan-grid h3 { justify-content: center; }
.jr-membership-account { text-align: center; margin: 22px 0; }
.jr-membership-footer { position: relative; padding: 19px 12px 27px; text-align: center; background: var(--membership-surface); }
.jr-membership-footer::before { content: ''; position: absolute; pointer-events: none; inset: -27px 0 auto; height: 28px; background: linear-gradient(transparent, var(--membership-surface)); }
.jr-membership-scroll { position: absolute; left: 50%; top: -53px; transform: translateX(-50%); display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--jr-surface); color: var(--jr-on-bg); box-shadow: 0 1px 5px #0003; }
.jr-membership-cta { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 13px clamp(20px, 5vw, 48px); border: 0; border-radius: 100px; background: var(--jr-primary); color: var(--jr-on-primary); font-size: 13px; font-weight: 800; text-transform: uppercase; text-decoration: none; }
.jr-membership-links { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 7px; margin-top: 11px; font-size: 12px; }
.jr-membership-links a, .jr-membership-links button { color: var(--jr-primary); text-decoration: none; }
.jr-membership-links button { font: inherit; border: 0; padding: 0; background: none; }
.jr-membership-links button:disabled { opacity: .62; cursor: default; }
@media (max-width: 640px) {
  .jr-membership-feature-grid, .jr-membership-plan-grid { grid-template-columns: 1fr; }
  .jr-membership-content { padding-top: 47px; }
  .jr-membership-feature { padding: 19px; }
}
</style>
