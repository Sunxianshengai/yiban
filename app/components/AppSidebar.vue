<script setup lang="ts">
import { mdiCogOutline, mdiCloudOutline, mdiRobotOutline, mdiMapMarkerOutline, mdiPlus, mdiWhiteBalanceSunny, mdiCalendarMonth, mdiImageMultipleOutline, mdiStarOutline, mdiTagOutline, mdiLogout, mdiPawOutline, mdiPawOffOutline, mdiWalletGiftcard, mdiMagnify } from '@mdi/js'
import { db } from '~/utils/db'

const emit = defineEmits<{ (e: 'navigate'): void }>()
// 主界面右下角小羊的显隐，和移动顶栏 / 设置里的开关是同一份状态
const { visible: petVisible, toggle: togglePet } = usePetWidget()
const route = useRoute()
const search = ref('')
const tagsOpen = ref(false)
const membershipOpen = useMembershipDialog()
const { listTags } = useEntries()
const tags = ref<{ id?: number; title: string }[]>([])
// Day One 左栏（ia-map O5）：日记本行带条目计数
const entryCount = ref(0)
onMounted(async () => {
  tags.value = await listTags()
  entryCount.value = await db.entriesV2.filter((e) => !e.deleted).count()
})
const settingsOpen = useState('jr.settingsOpen', () => false)

const nav = [
  { to: '/', label: '今天', icon: mdiWhiteBalanceSunny, exact: true },
  { to: '/pal', label: '日记伙伴', icon: mdiRobotOutline },
]
// Day One 左栏没有独立的日历/媒体入口（在中列视图胶囊里）；
// 复刻过渡期保留「视图」分组，B2 中列胶囊接管后撤除。
const views = [
  { to: '/calendar', label: '日历', icon: mdiCalendarMonth },
  { to: '/media', label: '媒体', icon: mdiImageMultipleOutline },
]
</script>

<template>
  <aside class="jr-sidebar" @click="(e) => { if ((e.target as HTMLElement).closest('a, button')) emit('navigate') }">
    <!-- 顶行：设置 + 云（Day One O5：左栏顶部为齿轮与云同步图标） -->
    <div class="jr-side-top">
      <button type="button" class="jr-icon-btn" aria-label="打开设置" :aria-expanded="settingsOpen" @click="settingsOpen = true">
        <JrIcon :path="mdiCogOutline" :size="21" />
      </button>
      <NuxtLink to="/cloud" class="jr-icon-btn" aria-label="云服务">
        <JrIcon :path="mdiCloudOutline" :size="21" />
      </NuxtLink>
    </div>

    <!-- 搜索（Day One 在中列顶部放大镜；B2 胶囊接管前的过渡入口） -->
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

    <!-- 「日记」分组：日记本行 + 计数（Day One：分组头 + 添加） -->
    <div class="jr-side-section">
      <span>日记</span>
      <button type="button" class="jr-side-add" aria-label="添加日记或集合" @click="navigateTo('/cloud')">
        <JrIcon :path="mdiPlus" :size="16" />
      </button>
    </div>
    <NuxtLink to="/" class="jr-journal-row" :class="{ on: route.path === '/' }">
      <span class="jr-journal-chip" aria-hidden="true" />
      <span class="jr-journal-name">Journal</span>
      <span class="jr-journal-count">{{ entryCount }}</span>
    </NuxtLink>
    <NuxtLink to="/atlas" class="jr-nav-item" :class="{ active: route.path.startsWith('/atlas') }">
      <JrIcon :path="mdiMapMarkerOutline" :size="21" />
      <span>位置历史记录</span>
    </NuxtLink>

    <div class="jr-nav-sep" />

    <!-- 过渡期视图入口（B2 中列胶囊接管后撤） -->
    <NuxtLink v-for="n in views" :key="n.to" :to="n.to" class="jr-nav-item" :class="{ active: route.path.startsWith(n.to) }">
      <JrIcon :path="n.icon" :size="21" />
      <span>{{ n.label }}</span>
    </NuxtLink>

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

    <button type="button" class="jr-nav-item jr-plain" aria-haspopup="dialog" @click="membershipOpen = true">
      <JrIcon :path="mdiWalletGiftcard" :size="21" />
      <span>附加功能</span>
    </button>
    <button
      type="button"
      class="jr-nav-item jr-plain"
      :aria-pressed="petVisible"
      data-testid="pet-toggle-sidebar"
      @click="togglePet"
    >
      <JrIcon :path="petVisible ? mdiPawOffOutline : mdiPawOutline" :size="21" />
      <span>{{ petVisible ? '隐藏桌宠' : '显示桌宠' }}</span>
    </button>

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
.jr-plain { width: 100%; border: 0; background: transparent; text-align: left; }
.jr-plain:hover { background: var(--jr-hover); }
/* Day One 左栏：顶部行（设置+云）、日记分组头+添加、日记本行（色块+名+计数） */
.jr-side-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 2px 10px; }
.jr-side-section { display: flex; align-items: center; justify-content: space-between; padding: 16px 6px 4px; font-size: 13px; color: var(--jr-on-surface-variant); }
.jr-side-add { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; border-radius: 50%; background: var(--jr-primary); color: var(--jr-on-primary); }
.jr-journal-row { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 10px; color: var(--jr-on-bg); text-decoration: none; font-size: 14.5px; }
.jr-journal-row:hover { background: var(--jr-hover); }
.jr-journal-row.on { background: var(--jr-surface-variant); font-weight: 600; }
.jr-journal-chip { flex: none; width: 16px; height: 16px; border-radius: 4px; background: var(--jr-tertiary); }
.jr-journal-count { margin-left: auto; color: var(--jr-on-surface-variant); font-size: 12.5px; }
</style>
