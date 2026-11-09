<script setup lang="ts">
import { mdiArrowDown, mdiChevronLeft, mdiChevronRight, mdiCloseCircle, mdiCloud, mdiSeal } from '@mdi/js'
import logo from '~/assets/membership/journey-3d-icon.png'
import devices from '~/assets/membership/ios-addson-cross-platform.png'
import playAward from '~/assets/membership/google-play-best-of-2023.png'
import appAward from '~/assets/membership/app-store-of-the-day.png'

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const scrollArea = ref<HTMLElement>()
const plans = ref(false)
const canScroll = ref(true)
let overviewOffset = 0

const benefits = [
  { name: 'End-to-end Encryption', description: 'Keep your journal encrypted from creation to storage.' },
  { name: 'Shared Journals', description: 'Write and share memories with friends and family.' },
  { name: 'Shared Web Links', description: 'Share selected entries from Journey Cloud Sync.' },
  { name: 'Journey Coach', description: 'Follow guided programs and writing prompts.' },
  { name: 'Odyssey AI', description: 'Ask questions about your journal and revisit the entries behind the answer.', to: '/odyssey' },
  { name: 'Print & Export', description: 'Print from the cloud and export your entries to ePub or DOCX.' },
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
      <button type="button" class="jr-membership-close" aria-label="Close membership" autofocus @click="close">
        <JrIcon :path="mdiCloseCircle" :size="20" />
      </button>
      <button v-if="plans" type="button" class="jr-membership-back" aria-label="Back to membership" @click="changePage(false)">
        <JrIcon :path="mdiChevronLeft" :size="22" />
      </button>

      <div ref="scrollArea" class="jr-membership-content" @scroll="updateScroll">
        <header class="jr-membership-header">
          <img :src="logo" alt="" width="74" height="74" />
          <h2 id="jr-membership-title">Membership</h2>
          <p v-if="!plans">Start your Membership now and get 10GB of storage on Journey Cloud Sync for free.</p>
          <p v-else>Choose a Membership plan.</p>
        </header>

        <template v-if="!plans">
          <div class="jr-membership-feature-grid">
            <article class="jr-membership-feature jr-membership-sync">
              <h3><JrIcon :path="mdiCloud" :size="24" /> Cross-platform Sync</h3>
              <img :src="devices" alt="Journey on phone, laptop and tablet" class="jr-membership-devices" />
              <p>Keep your journal in sync across devices. Start an entry on your phone, revisit it on your tablet, or finish writing at your desktop.</p>
            </article>
            <article class="jr-membership-feature jr-membership-trust">
              <h3><JrIcon :path="mdiSeal" :size="24" /> Trusted Journal Platform</h3>
              <div class="jr-membership-stat"><strong>10+ Years</strong><span>Millions of Users</span></div>
              <p>Journey has safeguarded personal journals for over a decade, helping people keep their private entries and memories together.</p>
            </article>
            <article v-for="benefit in benefits" :key="benefit.name" class="jr-membership-feature jr-membership-benefit">
              <h3>{{ benefit.name }}</h3>
              <p>{{ benefit.description }}</p>
              <NuxtLink v-if="benefit.to" :to="benefit.to" @click="close">Open Odyssey</NuxtLink>
            </article>
          </div>
          <h3 class="jr-membership-section">People Love Journey.</h3>
          <div class="jr-membership-awards">
            <img :src="playAward" alt="Google Play Best of 2023" />
            <img :src="appAward" alt="App of the Day, App Store" />
          </div>
          <h3 class="jr-membership-section">Frequently Asked Questions</h3>
          <details>
            <summary>How do I activate Membership?</summary>
            <p>Membership is tied to your Journey account. You can view the current plans on Journey’s website.</p>
          </details>
          <details>
            <summary>How do I restore a purchase?</summary>
            <p>Sign in to the Journey account associated with the purchase.</p>
          </details>
        </template>
        <template v-else>
          <div class="jr-membership-plan-grid">
            <article v-for="period in ['Monthly', 'Annual', 'Lifetime']" :key="period" class="jr-membership-feature jr-membership-benefit">
              <h3>{{ period }}</h3>
            </article>
          </div>
          <p class="jr-membership-account">Current prices and checkout are available through your Journey account.</p>
        </template>
      </div>

      <footer class="jr-membership-footer">
        <button v-if="canScroll" type="button" class="jr-membership-scroll" aria-label="Scroll to more benefits" @click="scrollDown">
          <JrIcon :path="mdiArrowDown" :size="16" />
        </button>
        <button v-if="!plans" type="button" class="jr-membership-cta" @click="changePage(true)">
          Get 10GB of Storage For Free <JrIcon :path="mdiChevronRight" :size="18" />
        </button>
        <a v-else class="jr-membership-cta" href="https://journey.cloud/membership" target="_blank" rel="noopener noreferrer">
          View Membership on Journey <JrIcon :path="mdiChevronRight" :size="18" />
        </a>
        <div class="jr-membership-links">
          <a href="https://journey.cloud/termsGeneral" target="_blank" rel="noopener noreferrer">Terms of Use</a>
          <span aria-hidden="true">·</span>
          <a href="https://journey.cloud/policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          <span aria-hidden="true">·</span>
          <button type="button" disabled title="Sign in to restore a purchase">Restore Purchase</button>
          <span aria-hidden="true">·</span>
          <a href="https://support.journey.cloud" target="_blank" rel="noopener noreferrer">Help Desk</a>
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
.jr-membership-devices { display: block; object-fit: contain; }
.jr-membership-stat { display: grid; place-content: end center; gap: 6px; padding-bottom: 15px; text-align: center; }
.jr-membership-stat strong { font-size: 31px; color: #ffe142; }
.jr-membership-stat span { font-size: 22px; color: #aaa; font-weight: 700; }
.jr-membership-benefit a { display: inline-block; margin-top: 14px; font-weight: 700; }
.jr-membership-section { text-align: center; margin: 38px 0 18px; }
.jr-membership-awards img { width: 100%; height: 156px; object-fit: contain; padding: 16px; border-radius: 10px; background: var(--jr-surface); }
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
