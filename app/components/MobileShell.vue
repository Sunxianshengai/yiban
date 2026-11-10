<script setup lang="ts">
import { mdiBookOutline, mdiCalendarMonthOutline, mdiImageOutline, mdiMapOutline, mdiPanda, mdiMagnify, mdiAccount } from '@mdi/js'

// 移动壳对照 Journey Android 6.0.2 证据(evidence/mobile-derived/ui-structure.md §1):
// 顶部胶囊栏(logo+搜索+头像) + 底部五 tab(Journey/日历/媒体/地图册/Pal),头像与搜索同进搜索页
const tabs = [
  { to: '/', label: 'Journey', icon: mdiBookOutline },
  { to: '/calendar', label: '日历', icon: mdiCalendarMonthOutline },
  { to: '/media', label: '媒体', icon: mdiImageOutline },
  { to: '/atlas', label: '地图册', icon: mdiMapOutline },
  { to: '/pal', label: 'Pal', icon: mdiPanda },
] as const
const route = useRoute()
function isActive(to: string) {
  return to === '/' ? route.path === '/' || route.path === '/starred' : route.path.startsWith(to)
}
</script>

<template>
  <div class="jr-mshell">
    <header class="jr-mtopbar">
      <div class="pill">
        <NuxtLink to="/" class="brand" aria-label="Journey 首页">
          <JrIcon :path="mdiBookOutline" :size="22" class="brand-ico" />
          <span class="brand-t">JOURNEY</span>
        </NuxtLink>
        <span class="vr" aria-hidden="true" />
        <NuxtLink to="/search" class="ico" aria-label="搜索"><JrIcon :path="mdiMagnify" :size="22" /></NuxtLink>
        <NuxtLink to="/search" class="ico avatar" aria-label="账户"><JrIcon :path="mdiAccount" :size="20" /></NuxtLink>
      </div>
    </header>

    <main class="jr-mbody">
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
.jr-mtopbar { padding: 12px 14px 6px; }
.jr-mtopbar .pill {
  display: flex; align-items: center; gap: 4px;
  background: #fff; border-radius: 999px; padding: 8px 10px 8px 18px;
  box-shadow: 0 1px 6px rgba(0, 60, 70, 0.08);
  border: 1px solid #eef4f6;
}
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--jr-primary); flex: 1; min-width: 0; }
.brand-t { font-weight: 800; letter-spacing: 3px; font-size: 16px; color: var(--jr-primary); }
.brand-ico { color: var(--jr-primary); }
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
</style>
