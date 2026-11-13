<script setup lang="ts">
import { mdiFormatListBulleted, mdiImageMultipleOutline, mdiCalendarMonth } from '@mdi/js'

const route = useRoute()
const views = [
  { to: '/', icon: mdiFormatListBulleted, label: '条目', exact: true },
  { to: '/media', icon: mdiImageMultipleOutline, label: '相册' },
  { to: '/calendar', icon: mdiCalendarMonth, label: '日历' },
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
      <JrIcon :path="v.icon" :size="16" />
      <span>{{ v.label }}</span>
    </NuxtLink>
  </div>
</template>

<style scoped>
.jr-view-pills {
  display: flex;
  gap: 3px;
  align-items: center;
  background: var(--jr-surface-variant);
  border-radius: 999px;
  padding: 3px;
  width: max-content;
}
.jr-vpill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  color: var(--jr-on-surface-variant);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.jr-vpill:hover {
  background: var(--jr-hover);
  color: var(--jr-on-bg);
}
.jr-vpill.on {
  background: var(--jr-primary);
  color: var(--jr-on-primary);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(68, 192, 255, 0.25);
}
.jr-vpill.on:hover {
  background: var(--jr-primary);
}
</style>
