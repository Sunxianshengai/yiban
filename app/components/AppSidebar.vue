<script setup lang="ts">
import { mdiMagnify, mdiFormatListBulleted, mdiCalendarMonth, mdiImageMultipleOutline, mdiMapOutline, mdiRobotOutline, mdiCogOutline, mdiCloudOutline, mdiChatProcessingOutline, mdiPuzzleOutline, mdiStarOutline, mdiLogout } from '@mdi/js'

const route = useRoute()
const search = ref('')
const tagsOpen = ref(false)

const nav = [
  { to: '/', label: 'Timeline', icon: mdiFormatListBulleted, exact: true },
  { to: '/calendar', label: 'Calendar', icon: mdiCalendarMonth },
  { to: '/media', label: 'Media', icon: mdiImageMultipleOutline },
  { to: '/atlas', label: 'Atlas', icon: mdiMapOutline },
  { to: '/pal', label: 'Pal', icon: mdiRobotOutline },
]
const utils = [
  { to: '/settings', label: 'Settings', icon: mdiCogOutline },
  { to: '/cloud', label: 'Cloud Services', icon: mdiCloudOutline, badge: '1' },
  { to: '/chat', label: 'Chat with Your Journal', icon: mdiChatProcessingOutline },
  { to: '/addons', label: 'Addons', icon: mdiPuzzleOutline },
]
</script>

<template>
  <aside class="jr-sidebar">
    <form class="jr-search" @submit.prevent="navigateTo(`/search?q=${encodeURIComponent(search)}`)">
      <JrIcon :path="mdiMagnify" :size="19" />
      <input v-model="search" type="text" placeholder="Search" />
    </form>

    <NuxtLink
      v-for="n in nav"
      :key="n.to"
      :to="n.to"
      class="jr-nav-item"
      :class="{ active: n.exact ? route.path === '/' : route.path.startsWith(n.to) }"
    >
      <JrIcon :path="n.icon" :size="21" />
      <span>{{ n.label }}</span>
    </NuxtLink>

    <div class="jr-nav-sep" />

    <NuxtLink v-for="n in utils" :key="n.to" :to="n.to" class="jr-nav-item" :class="{ active: route.path === n.to }">
      <JrIcon :path="n.icon" :size="21" />
      <span>{{ n.label }}</span>
      <span v-if="n.badge" class="jr-badge">{{ n.badge }}</span>
    </NuxtLink>

    <button class="jr-section-label" style="border:0;background:none" @click="tagsOpen = !tagsOpen">
      <span>Tags</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" :style="{ transform: tagsOpen ? 'rotate(180deg)' : '' }"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
    </button>
    <template v-if="tagsOpen">
      <NuxtLink to="/starred" class="jr-nav-item" :class="{ active: route.path === '/starred' }">
        <JrIcon :path="mdiStarOutline" :size="21" />
        <span>Starred</span>
      </NuxtLink>
    </template>

    <div class="jr-sidebar-footer">
      <div class="jr-avatar guest">U</div>
      <div class="who">
        <div class="name">User</div>
        <div class="tier">Free</div>
      </div>
      <JrIcon :path="mdiLogout" :size="20" style="color: var(--jr-secondary)" />
    </div>
  </aside>
</template>
