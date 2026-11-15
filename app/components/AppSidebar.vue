<script setup lang="ts">
import {
  mdiCogOutline,
  mdiCloudOutline,
  mdiFeather,
  mdiMapMarkerOutline,
  mdiCalendarBlankOutline,
  mdiCalendarMonth,
  mdiStarOutline,
  mdiTagOutline,
  mdiPawOutline,
  mdiMagnify,
  mdiCompassOutline,
  mdiImageMultipleOutline,
  mdiAccountGroupOutline,
  mdiAccountMultipleOutline,
  mdiTrashCanOutline,
  mdiInformationOutline,
} from '@mdi/js'
import { db } from '~/utils/db'
import { familyAvatarColor, familyAvatarChar } from '~/utils/familyUi'

const emit = defineEmits<{ (e: 'navigate'): void }>()
const { visible: petVisible, toggle: togglePet } = usePetWidget()
const { t } = useLocale()
const route = useRoute()
const search = ref('')
const tagsOpen = ref(false)
const { entries, refresh: refreshEntries, listTags, trashCount, refreshTrashCount } = useEntries()
const tags = ref<{ id?: number; title: string }[]>([])

const totalCount = computed(() => entries.value.length)
const travelSearch = computed(() => (route.query.query ?? route.query.q) === '旅行')
const starredCount = computed(() => entries.value.filter(e => !!e.favourite).length)

// ---- 家庭组（M-209 门面卡）：成员头像行 + 最新家人动态 + 聚合红点 ----
const { state: familyState, feed: familyFeed, hasAnyFamilyUnseen } = useFamilySync()
const familyGroup = computed(() => familyState.value.group)
const familyMembers = computed(() => (familyState.value.members || []).slice(0, 6))
const familyExtra = computed(() => Math.max(0, (familyState.value.members || []).length - 6))
const familyUnread = computed(() => hasAnyFamilyUnseen())
const latestFamilyLine = computed(() => {
  const mine = familyState.value.me?.userId
  const e = familyFeed.value.entries.find(x => x.ownerUserId !== mine)
  if (!e) return ''
  const text = (e.previewText || e.text || '').replace(/<[^>]*>/g, '').trim()
  return `${e.ownerNickname}：${text.slice(0, 26) || '写了一篇新日记'}`
})
// ---- 本月统计卡：本月篇数 / 照片数 / 连续天数（Streak 语义同 JournalOverview）----
const photoCount = ref(0)
const monthCount = computed(() => {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return entries.value.filter(e => e.yearToken === y && e.monthToken === m).length
})
const streakCount = computed(() => {
  const dates = new Set(entries.value.map(e => new Date(e.dateOfJournal).toDateString()))
  const d = new Date()
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  let n = 0
  while (dates.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1) }
  return n
})

async function refreshSidebarStats() {
  tags.value = await listTags()
  photoCount.value = await db.mediaFilesV2.count()
  await refreshTrashCount()
}

onMounted(async () => {
  await refreshSidebarStats()
  if (!entries.value.length) {
    await refreshEntries()
  }
})

watch(
  () => entries.value.map((e) => `${e.id}:${e.updatedAt?.valueOf?.() ?? ''}`).join('|'),
  () => { refreshSidebarStats() },
)
const settingsOpen = useState('jr.settingsOpen', () => false)
</script>

<template>
  <aside class="jr-sidebar" @click="(e) => { if ((e.target as HTMLElement).closest('a, button')) emit('navigate') }">
    <!-- 顶部 Brand 与操作按钮 -->
    <div class="jr-side-top-bar">
      <div class="jr-brand">
        <span class="jr-logo-badge">J</span>
        <span class="jr-brand-name">{{ t('brand') }}</span>
      </div>
      <div class="jr-side-actions">
        <NuxtLink to="/cloud" class="jr-side-icon-btn" :title="t('cloud')" :aria-label="t('cloud')">
          <JrIcon :path="mdiCloudOutline" :size="19" />
        </NuxtLink>
        <button type="button" class="jr-side-icon-btn" :aria-label="t('settings')" :aria-expanded="settingsOpen" @click="settingsOpen = true">
          <JrIcon :path="mdiCogOutline" :size="19" />
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <form class="jr-search" @submit.prevent="navigateTo(`/search?q=${encodeURIComponent(search)}`)">
      <JrIcon :path="mdiMagnify" :size="17" />
      <input v-model="search" type="text" :placeholder="t('searchPlaceholder')" />
    </form>

    <!-- 导航：核心视图入口（时间线/相册/日历此前只能从时间线中列的胶囊切换进，现在左侧直达） -->
    <NuxtLink to="/" class="jr-nav-item" :class="{ active: route.path === '/' }">
      <JrIcon :path="mdiCalendarBlankOutline" :size="20" />
      <span class="jr-nav-text">{{ t('timeline') }}</span>
      <span class="jr-badge">{{ totalCount }}</span>
    </NuxtLink>

    <NuxtLink to="/media" class="jr-nav-item" :class="{ active: route.path.startsWith('/media') }">
      <JrIcon :path="mdiImageMultipleOutline" :size="20" />
      <span class="jr-nav-text">{{ t('media') }}</span>
    </NuxtLink>

    <NuxtLink to="/calendar" class="jr-nav-item" :class="{ active: route.path.startsWith('/calendar') }">
      <JrIcon :path="mdiCalendarMonth" :size="20" />
      <span class="jr-nav-text">{{ t('calendar') }}</span>
    </NuxtLink>

    <NuxtLink to="/pal" class="jr-nav-item" :class="{ active: route.path.startsWith('/pal') }">
      <JrIcon :path="mdiFeather" :size="20" />
      <span class="jr-nav-text">{{ t('pal') }}</span>
      <span class="jr-sublabel">灵感</span>
    </NuxtLink>

    <div class="jr-side-section">{{ t('quickFilters') }}</div>
    <NuxtLink to="/search/results?q=%E6%97%85%E8%A1%8C" class="jr-nav-item jr-journal-item" :class="{ active: route.path.startsWith('/search') && travelSearch }">
      <JrIcon :path="mdiCompassOutline" :size="18" style="color:#10B981" />
      <span class="jr-nav-text">搜索「旅行」</span>
    </NuxtLink>

    <NuxtLink to="/search/results?starred=1&favourite=true" class="jr-nav-item jr-journal-item" :class="{ active: route.path.startsWith('/search') && ('favourite' in route.query || route.query.starred === '1') }">
      <JrIcon :path="mdiStarOutline" :size="18" style="color:#A855F7" />
      <span class="jr-nav-text">{{ t('starred') }}</span>
      <span class="jr-badge-sub">{{ starredCount }}</span>
    </NuxtLink>

    <NuxtLink to="/atlas" class="jr-nav-item" :class="{ active: route.path.startsWith('/atlas') }">
      <JrIcon :path="mdiMapMarkerOutline" :size="19" />
      <span class="jr-nav-text">{{ t('atlas') }}</span>
    </NuxtLink>

    <NuxtLink to="/trash" class="jr-nav-item" :class="{ active: route.path.startsWith('/trash') }">
      <JrIcon :path="mdiTrashCanOutline" :size="19" />
      <span class="jr-nav-text">回收站</span>
      <span class="jr-badge-sub">{{ trashCount }}</span>
    </NuxtLink>

    <NuxtLink to="/welcome" class="jr-nav-item" :class="{ active: route.path.startsWith('/welcome') }">
      <JrIcon :path="mdiInformationOutline" :size="19" />
      <span class="jr-nav-text">介绍</span>
    </NuxtLink>

    <NuxtLink to="/family" class="jr-side-family-card" aria-label="我们的小家">
      <span class="jr-fam-head">
        <JrIcon :path="familyGroup ? mdiAccountGroupOutline : mdiAccountMultipleOutline" :size="16" style="color:var(--jr-primary)" />
        <span class="jr-fam-title">我们的小家</span>
        <i v-if="familyUnread" class="jr-family-dot" title="家人有新动态" />
      </span>
      <span v-if="familyGroup" class="jr-fam-avatars">
        <span
          v-for="m in familyMembers" :key="m.userId"
          class="jr-family-avatar" :style="{ background: familyAvatarColor(m.userId) }"
        >{{ familyAvatarChar(m.nickname) }}</span>
        <span v-if="familyExtra" class="jr-fam-extra">+{{ familyExtra }}</span>
      </span>
      <span v-if="familyGroup" class="jr-fam-line" :class="{ on: familyUnread }">
        {{ familyUnread ? '有新互动' : (latestFamilyLine || familyGroup.name) }}
      </span>
      <span v-else class="jr-fam-line">邀请家人，共写一本家庭日记</span>
    </NuxtLink>

    <!-- 本月统计卡：本月篇数 / 照片数 / 连续天数（Streak 语义同概览页） -->
    <div class="jr-side-stats" aria-label="本月统计">
      <span class="st"><b>{{ monthCount }}</b>本月</span>
      <span class="st"><b>{{ photoCount }}</b>照片</span>
      <span class="st"><b>{{ streakCount }}</b>连续天</span>
    </div>

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
/* 小家入口与最近动态 */
.jr-side-family-card {
  text-decoration: none;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--jr-outline-variant);
  background: var(--jr-surface-variant);
  display: flex;
  flex-direction: column;
  gap: 7px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  font-family: inherit;
}
.jr-side-family-card:hover, .jr-side-family-card.router-link-active {
  border-color: var(--jr-primary);
  background: var(--jr-hover);
}
.jr-fam-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.jr-fam-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--jr-on-bg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jr-fam-avatars {
  display: flex;
  align-items: center;
}
.jr-fam-avatars .jr-family-avatar {
  width: 22px;
  height: 22px;
  font-size: 10.5px;
  border: 2px solid var(--jr-surface-variant);
  margin-left: -6px;
}
.jr-fam-avatars .jr-family-avatar:first-child { margin-left: 0; }
.jr-fam-extra {
  font-size: 10.5px;
  color: var(--jr-outline);
  margin-left: 4px;
}
.jr-fam-line {
  font-size: 11.5px;
  color: var(--jr-on-surface-variant);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jr-fam-line.on {
  color: var(--jr-primary);
  font-weight: 600;
}
/* 本月统计卡：一行三格 */
.jr-side-stats {
  margin-top: 8px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid var(--jr-outline-variant);
  background: var(--jr-surface-variant);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
.jr-side-stats .st {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-size: 10.5px;
  color: var(--jr-outline);
}
.jr-side-stats .st b {
  font-size: 15px;
  font-weight: 700;
  color: var(--jr-on-bg);
  line-height: 1.1;
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
