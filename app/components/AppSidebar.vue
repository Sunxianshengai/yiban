<script setup lang="ts">
import {
  mdiCogOutline,
  mdiCloudOutline,
  mdiFeather,
  mdiMapMarkerOutline,
  mdiPlus,
  mdiCalendarBlankOutline,
  mdiStarOutline,
  mdiTagOutline,
  mdiPawOutline,
  mdiMagnify,
  mdiBookOpenOutline,
  mdiCompassOutline,
} from '@mdi/js'
import { db } from '~/utils/db'

const emit = defineEmits<{ (e: 'navigate'): void }>()
const { visible: petVisible, toggle: togglePet } = usePetWidget()
const route = useRoute()
const search = ref('')
const tagsOpen = ref(false)
const { listTags } = useEntries()
const tags = ref<{ id?: number; title: string }[]>([])
const entryCount = ref(0)
const starredCount = ref(0)

onMounted(async () => {
  tags.value = await listTags()
  entryCount.value = await db.entriesV2.filter((e) => !e.deleted).count()
  starredCount.value = await db.entriesV2.filter((e) => !e.deleted && !!e.favourite).count()
})
const settingsOpen = useState('jr.settingsOpen', () => false)
</script>

<template>
  <aside class="jr-sidebar" @click="(e) => { if ((e.target as HTMLElement).closest('a, button')) emit('navigate') }">
    <!-- 顶部 Brand 与操作按钮 -->
    <div class="jr-side-top-bar">
      <div class="jr-brand">
        <span class="jr-logo-badge">J</span>
        <span class="jr-brand-name">旅程日记</span>
      </div>
      <div class="jr-side-actions">
        <NuxtLink to="/cloud" class="jr-side-icon-btn" title="云服务" aria-label="云服务">
          <JrIcon :path="mdiCloudOutline" :size="19" />
        </NuxtLink>
        <button type="button" class="jr-side-icon-btn" aria-label="打开设置" :aria-expanded="settingsOpen" @click="settingsOpen = true">
          <JrIcon :path="mdiCogOutline" :size="19" />
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <form class="jr-search" @submit.prevent="navigateTo(`/search?q=${encodeURIComponent(search)}`)">
      <JrIcon :path="mdiMagnify" :size="17" />
      <input v-model="search" type="text" placeholder="搜索日记、回忆、标签..." />
    </form>

    <!-- 导航：今天 · 时间线 & 写作伙伴 (Pal) -->
    <NuxtLink to="/" class="jr-nav-item" :class="{ active: route.path === '/' }">
      <JrIcon :path="mdiCalendarBlankOutline" :size="20" />
      <span class="jr-nav-text">今天 · 时间线</span>
      <span class="jr-badge">{{ entryCount }}</span>
    </NuxtLink>

    <NuxtLink to="/pal" class="jr-nav-item" :class="{ active: route.path.startsWith('/pal') }">
      <JrIcon :path="mdiFeather" :size="20" />
      <span class="jr-nav-text">写作伙伴 (Pal)</span>
      <span class="jr-sublabel">灵感</span>
    </NuxtLink>

    <!-- 「日记本」分组 -->
    <div class="jr-side-section">
      <span>日记本</span>
      <button type="button" class="jr-side-add" aria-label="添加日记本" @click="navigateTo('/cloud')">
        <JrIcon :path="mdiPlus" :size="15" />
      </button>
    </div>

    <NuxtLink to="/" class="jr-nav-item jr-journal-item" :class="{ active: route.path === '/' }">
      <JrIcon :path="mdiBookOpenOutline" :size="18" style="color:#44C0FF" />
      <span class="jr-nav-text">日常随笔</span>
      <span class="jr-badge-sub">{{ entryCount || 28 }}</span>
    </NuxtLink>

    <NuxtLink to="/search/results?q=%E6%97%85%E8%A1%8C" class="jr-nav-item jr-journal-item" :class="{ active: route.path === '/search/results' && route.query.q === '旅行' }">
      <JrIcon :path="mdiCompassOutline" :size="18" style="color:#10B981" />
      <span class="jr-nav-text">旅途记录</span>
      <span class="jr-badge-sub">12</span>
    </NuxtLink>

    <NuxtLink to="/search/results?starred=1&favourite=true" class="jr-nav-item jr-journal-item" :class="{ active: route.path === '/search/results' && route.query.starred === '1' }">
      <JrIcon :path="mdiStarOutline" :size="18" style="color:#A855F7" />
      <span class="jr-nav-text">星标精选</span>
      <span class="jr-badge-sub">{{ starredCount || 6 }}</span>
    </NuxtLink>

    <NuxtLink to="/atlas" class="jr-nav-item" :class="{ active: route.path.startsWith('/atlas') }">
      <JrIcon :path="mdiMapMarkerOutline" :size="19" />
      <span class="jr-nav-text">位置历史记录</span>
    </NuxtLink>

    <div class="jr-nav-sep" />

    <!-- 标签 -->
    <button class="jr-section-label" style="border:0;background:none" @click="tagsOpen = !tagsOpen">
      <span>标签</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" :style="{ transform: tagsOpen ? 'rotate(180deg)' : '' }"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
    </button>
    <template v-if="tagsOpen">
      <p v-if="!tags.length" class="jr-muted" style="font-size:12px;padding:4px 14px">暂无标签</p>
      <NuxtLink v-for="t in tags" :key="t.id" :to="{ path: '/search/results', query: { tags: String(t.id) } }" class="jr-nav-item" :class="{ active: route.path === '/search/results' && String(route.query.tags || '').split(',').includes(String(t.id)) }">
        <JrIcon :path="mdiTagOutline" :size="18" />
        <span style="overflow:hidden;text-overflow:ellipsis">{{ t.title }}</span>
      </NuxtLink>
    </template>

    <!-- 底部小羊挂件卡片 -->
    <div class="jr-side-pet-card" @click="togglePet">
      <div class="pet-icon-wrap">
        <JrIcon :path="mdiPawOutline" :size="18" />
      </div>
      <div class="pet-info">
        <div class="pet-name">瞌睡小羊</div>
        <div class="pet-hint">伴你记录美好日常</div>
      </div>
      <span class="pet-status" :class="{ on: petVisible }">{{ petVisible ? '挂件开启' : '挂件隐藏' }}</span>
    </div>

    <SettingsView v-if="settingsOpen" @close="settingsOpen = false" />
  </aside>
</template>

<style scoped>
.jr-side-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 2px 8px;
}
.jr-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jr-logo-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--jr-primary);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(68, 192, 255, 0.3);
}
.jr-brand-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--jr-on-bg);
  letter-spacing: -0.2px;
}
.jr-side-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.jr-side-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--jr-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}
.jr-side-icon-btn:hover {
  background: var(--jr-hover);
  color: var(--jr-on-bg);
}
.jr-nav-text {
  flex: 1;
}
.jr-sublabel {
  font-size: 11.5px;
  color: var(--jr-outline);
}
.jr-badge-sub {
  color: var(--jr-outline);
  font-size: 12px;
}
.jr-side-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 6px 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--jr-outline);
}
.jr-side-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: var(--jr-surface-variant);
  color: var(--jr-on-surface-variant);
  cursor: pointer;
  transition: background 0.15s;
}
.jr-side-add:hover {
  background: var(--jr-hover);
  color: var(--jr-primary);
}
.jr-side-pet-card {
  margin-top: auto;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--jr-surface-variant);
  border: 1px solid var(--jr-outline-variant);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.jr-side-pet-card:hover {
  border-color: var(--jr-primary);
  background: var(--jr-hover);
}
.pet-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--jr-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--jr-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.pet-info {
  flex: 1;
  min-width: 0;
}
.pet-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--jr-on-bg);
}
.pet-hint {
  font-size: 11px;
  color: var(--jr-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pet-status {
  font-size: 11px;
  font-weight: 600;
  color: var(--jr-outline);
}
.pet-status.on {
  color: #10B981;
}
</style>
