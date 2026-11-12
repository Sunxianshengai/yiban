<script setup lang="ts">
import { mdiMagnify, mdiFormatListBulleted, mdiCalendarMonth, mdiImageMultipleOutline, mdiMapOutline, mdiRobotOutline, mdiCogOutline, mdiCloudOutline, mdiChatProcessingOutline, mdiWalletGiftcard, mdiStarOutline, mdiTagOutline, mdiLogout, mdiPawOutline, mdiPawOffOutline } from '@mdi/js'

const emit = defineEmits<{ (e: 'navigate'): void }>()
// 主界面右下角小羊的显隐，和移动顶栏 / 设置里的开关是同一份状态
const { visible: petVisible, toggle: togglePet } = usePetWidget()
const route = useRoute()
const search = ref('')
const tagsOpen = ref(false)
const membershipOpen = useMembershipDialog()
// 设置弹窗在当前页之上打开（原版行为：Settings 点开为居中弹窗，不离开当前页）
const { listTags } = useEntries()
const tags = ref<{ id?: number; title: string }[]>([])
onMounted(async () => { tags.value = await listTags() })
const settingsOpen = useState('jr.settingsOpen', () => false)

const nav = [
  { to: '/', label: '时间线', icon: mdiFormatListBulleted, exact: true },
  { to: '/calendar', label: '日历', icon: mdiCalendarMonth },
  { to: '/media', label: '媒体', icon: mdiImageMultipleOutline },
  { to: '/atlas', label: '地图', icon: mdiMapOutline },
  { to: '/pal', label: '日记伙伴', icon: mdiRobotOutline },
]
const utils = [
  { to: '/cloud', label: '云服务', icon: mdiCloudOutline, badge: '1' },
  { to: '/chat', label: '与日记聊天', icon: mdiChatProcessingOutline },
]
</script>

<template>
  <aside class="jr-sidebar" @click="(e) => { if ((e.target as HTMLElement).closest('a, button')) emit('navigate') }">
    <form class="jr-search" @submit.prevent="navigateTo(`/search?q=${encodeURIComponent(search)}`)">
      <JrIcon :path="mdiMagnify" :size="19" />
      <input v-model="search" type="text" placeholder="搜索" />
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
    <button type="button" class="jr-nav-item" aria-haspopup="dialog" :aria-expanded="settingsOpen" @click="settingsOpen = true">
      <JrIcon :path="mdiCogOutline" :size="21" />
      <span>设置</span>
    </button>
    <button type="button" class="jr-nav-item jr-addons" aria-haspopup="dialog" @click="membershipOpen = true">
      <JrIcon :path="mdiWalletGiftcard" :size="21" />
      <span>附加功能</span>
    </button>
    <button
      type="button"
      class="jr-nav-item jr-addons"
      :aria-pressed="petVisible"
      data-testid="pet-toggle-sidebar"
      @click="togglePet"
    >
      <JrIcon :path="petVisible ? mdiPawOffOutline : mdiPawOutline" :size="21" />
      <span>{{ petVisible ? '隐藏桌宠' : '显示桌宠' }}</span>
    </button>

    <button class="jr-section-label" style="border:0;background:none" @click="tagsOpen = !tagsOpen">
      <span>标签</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" :style="{ transform: tagsOpen ? 'rotate(180deg)' : '' }"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
    </button>
    <template v-if="tagsOpen">
      <NuxtLink to="/search/results?starred=1&favourite=true" class="jr-nav-item" :class="{ active: route.path === '/search/results' && route.query.starred === '1' }">
        <JrIcon :path="mdiStarOutline" :size="21" />
        <span>收藏</span>
      </NuxtLink>
      <p v-if="!tags.length" class="jr-muted" style="font-size:12px;padding:4px 14px">暂无标签</p>
      <NuxtLink v-for="t in tags" :key="t.id" :to="{ path: '/search/results', query: { tags: String(t.id) } }" class="jr-nav-item" :class="{ active: route.path === '/search/results' && String(route.query.tags || '').split(',').includes(String(t.id)) }">
        <JrIcon :path="mdiTagOutline" :size="19" />
        <span style="overflow:hidden;text-overflow:ellipsis">{{ t.title }}</span>
      </NuxtLink>
    </template>

    <div class="jr-sidebar-footer">
      <div class="jr-avatar guest">用</div>
      <div class="who">
        <div class="name">用户</div>
        <div class="tier">免费版</div>
      </div>
      <JrIcon :path="mdiLogout" :size="20" style="color: var(--jr-secondary)" />
    </div>
    <SettingsView v-if="settingsOpen" @close="settingsOpen = false" />
  </aside>
</template>

<style scoped>
.jr-addons { width: 100%; border: 0; background: transparent; text-align: left; }
.jr-addons:hover { background: color-mix(in srgb, var(--jr-primary) 7%, transparent); }
</style>
