<script setup lang="ts">
// Day One 中列顶部视图切换胶囊（ia-map middleColumn.header；09/63 截图：灰底圆角容器，激活项天蓝底白图标）
import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiCalendarMonth } from '@mdi/js'

const route = useRoute()
const views = [
  { to: '/', icon: mdiFormatListBulleted, label: '列表视图', exact: true },
  { to: '/media', icon: mdiImageMultipleOutline, label: '媒体视图' },
  { to: '/calendar', icon: mdiCalendarMonth, label: '日历视图' },
]
const active = (to: string, exact?: boolean) => (exact ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <div class="jr-view-pills" role="tablist" aria-label="视图切换">
    <NuxtLink
      v-for="v in views" :key="v.to" :to="v.to" class="jr-vpill" role="tab"
      :aria-selected="active(v.to, v.exact)" :aria-label="v.label"
      :class="{ on: active(v.to, v.exact) }"
    >
      <JrIcon :path="v.icon" :size="18" />
    </NuxtLink>
  </div>
</template>

<style scoped>
.jr-view-pills { display: flex; gap: 4px; align-items: center; background: var(--jr-surface-variant); border-radius: 999px; padding: 4px; width: max-content; }
.jr-vpill { display: flex; align-items: center; justify-content: center; width: 36px; height: 28px; border-radius: 999px; color: var(--jr-secondary); text-decoration: none; }
.jr-vpill:hover { background: var(--jr-hover); }
.jr-vpill.on { background: var(--jr-primary); color: var(--jr-on-primary); }
.jr-vpill.on:hover { background: var(--jr-primary); }
</style>
