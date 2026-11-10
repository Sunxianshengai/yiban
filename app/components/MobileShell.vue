<script setup lang="ts">
import { mdiBookOutline, mdiCalendarMonthOutline, mdiImageOutline, mdiMapOutline, mdiPanda, mdiMagnify, mdiAccount, mdiCellphone, mdiCheck, mdiCloudOutline, mdiChevronRight } from '@mdi/js'

// 移动壳对照 Journey Android 6.0.2 证据(evidence/mobile-derived/ui-structure.md §1 + r03):
// 顶部胶囊栏(logo=日记本下拉+搜索+头像) + 底部五 tab(Journey/日历/媒体/地图册/Pal)
// 头像与搜索同进搜索页;logo 点开日记本下拉(本地✓+云服务,同 r03 证据)
const tabs = [
  { to: '/', label: 'Journey', icon: mdiBookOutline },
  { to: '/calendar', label: '日历', icon: mdiCalendarMonthOutline },
  { to: '/media', label: '媒体', icon: mdiImageOutline },
  { to: '/atlas', label: '地图册', icon: mdiMapOutline },
  { to: '/pal', label: 'Pal', icon: mdiPanda },
] as const
const route = useRoute()
const journalMenu = ref(false)
function isActive(to: string) {
  return to === '/' ? route.path === '/' || route.path === '/starred' : route.path.startsWith(to)
}
</script>

<template>
  <div class="jr-mshell">
    <header class="jr-mtopbar">
      <div class="pill">
        <button class="brand" aria-label="日记本切换" :aria-expanded="journalMenu" @click="journalMenu = !journalMenu">
          <JrIcon :path="mdiBookOutline" :size="22" class="brand-ico" />
          <span class="brand-t">JOURNEY</span>
        </button>
        <div v-if="journalMenu" class="jr-journal-pop" @click.stop>
          <div class="jrow on">
            <JrIcon :path="mdiCellphone" :size="20" />
            <span class="jt">本地</span>
            <JrIcon :path="mdiCheck" :size="18" class="jck" />
          </div>
          <NuxtLink to="/cloud" class="jrow" @click="journalMenu = false">
            <JrIcon :path="mdiCloudOutline" :size="20" />
            <span class="jt">云服务</span>
            <JrIcon :path="mdiChevronRight" :size="18" class="jck muted" />
          </NuxtLink>
        </div>
        <span class="vr" aria-hidden="true" />
        <NuxtLink to="/search" class="ico" aria-label="搜索"><JrIcon :path="mdiMagnify" :size="22" /></NuxtLink>
        <NuxtLink to="/search" class="ico avatar" aria-label="账户"><JrIcon :path="mdiAccount" :size="20" /></NuxtLink>
      </div>
    </header>

    <main class="jr-mbody" @click="journalMenu = false">
      <slot />
    </main>

    <nav class="jr-mtabs" aria-label="主导航">
      <NuxtLink
        v-for="t in tabs" :key="t.to" :to="t.to"
        class="tab" :class="{ on: isActive(t.to) }"
      >
        <span class="tico"><JrIcon :path="t.icon" :size="24" /></span>
        <span class="tlabel">{{ t.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.jr-mshell { height: 100%; display: flex; flex-direction: column; background: var(--jr-bg); }
.jr-mtopbar { padding: 12px 14px 6px; position: relative; z-index: 40; }
.jr-mtopbar .pill {
  display: flex; align-items: center; gap: 4px;
  background: #fff; border-radius: 999px; padding: 8px 10px 8px 18px;
  box-shadow: 0 1px 6px rgba(0, 60, 70, 0.08);
  border: 1px solid #eef4f6;
}
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--jr-primary); flex: 1; min-width: 0; background: none; border: 0; padding: 0; text-align: left; }
.brand-t { font-weight: 800; letter-spacing: 3px; font-size: 16px; color: var(--jr-primary); }
.brand-ico { color: var(--jr-primary); }
.jr-journal-pop {
  position: absolute; left: 26px; top: 64px; min-width: 330px;
  background: #eef2f4; border-radius: 12px; padding: 6px;
  box-shadow: 0 8px 28px rgba(0, 40, 50, 0.18); z-index: 50;
}
.jrow { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 10px; color: var(--jr-on-bg); text-decoration: none; width: 100%; background: none; border: 0; font-size: 15.5px; font-weight: 600; font-family: inherit; }
.jrow.on { background: #dfe6e9; }
.jrow .jt { flex: 1; text-align: left; }
.jrow .jck { color: var(--jr-on-bg); }
.jrow .jck.muted { color: var(--jr-outline); }
.vr { width: 1px; align-self: stretch; background: var(--jr-outline-variant); margin: 2px 6px; }
.ico { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; color: var(--jr-on-bg); text-decoration: none; }
.ico:active { background: var(--jr-surface-variant); }
.ico.avatar { background: var(--jr-primary-container); color: #001f27; }
.ico.avatar svg { color: #33247c; }
.jr-mbody { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.jr-mtabs {
  display: flex; align-items: stretch;
  background: #eef4f6; border-top: 1px solid #e3edf0;
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
}
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; color: var(--jr-on-surface-variant); padding: 2px 0; }
.tab .tico { display: flex; align-items: center; justify-content: center; width: 56px; height: 34px; border-radius: 999px; }
.tab.on { color: var(--jr-primary); font-weight: 700; }
.tab.on .tico { background: var(--jr-secondary-container); }
.tlabel { font-size: 11.5px; }
/* 深色主题:壳面走暗层 */
[data-theme="dark"] .jr-mtopbar .pill { background: var(--jr-layer, #303638); border-color: var(--jr-outline-variant); box-shadow: none; }
[data-theme="dark"] .jr-journal-pop { background: var(--jr-layer-high, #3a4144); }
[data-theme="dark"] .jrow.on { background: var(--jr-layer-highest, #303638); }
[data-theme="dark"] .jr-mtabs { background: var(--jr-layer, #242a2c); border-top-color: var(--jr-outline-variant); }
[data-theme="dark"] .tab { color: #9fb0b5; }
[data-theme="dark"] .tab.on { color: var(--jr-primary-fixed-dim, #85d1e8); }
[data-theme="dark"] .tab.on .tico { background: #2b4449; }
</style>
