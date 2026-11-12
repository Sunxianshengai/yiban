<script setup lang="ts">
// Day One 移动壳（W1 采集 40-mobile-main/41/56 证据 + ledger O14）：
// 顶栏=左日记本图标(开导航抽屉)+中视图胶囊+右搜索；无底部 tab；FAB 右下圆角方块。
// 安卓原生 APK 未采成（Cloudflare 拦，ledger U2），移动形态以 Day One web 移动视口 390x844 为准。
import { mdiBookOutline, mdiMagnify, mdiCogOutline, mdiCloudOutline, mdiRobotOutline, mdiMapMarkerOutline, mdiWhiteBalanceSunny, mdiCalendarMonth, mdiImageMultipleOutline, mdiPawOutline, mdiPawOffOutline, mdiWalletGiftcard, mdiAccount, mdiLogout } from '@mdi/js'
import { db } from '~/utils/db'

const route = useRoute()
const drawerOpen = ref(false)
const membershipOpen = useMembershipDialog()
const { visible: petVisible, toggle: togglePet } = usePetWidget()
const entryCount = ref(0)
onMounted(async () => { entryCount.value = await db.entriesV2.filter((e) => !e.deleted).count() })
</script>

<template>
  <div class="jr-mshell">
    <header class="jr-mtopbar">
      <button type="button" class="mico-btn" aria-label="打开导航抽屉" @click="drawerOpen = true">
        <JrIcon :path="mdiBookOutline" :size="22" />
      </button>
      <ViewPills class="mtop-pills" />
      <NuxtLink to="/search" class="mico-btn" aria-label="搜索"><JrIcon :path="mdiMagnify" :size="22" /></NuxtLink>
    </header>

    <main class="jr-mbody" @click="drawerOpen = false">
      <slot />
    </main>

    <!-- 导航抽屉（Day One 左栏结构的移动化：今天/日记伙伴/日记组/位置历史/设置/云） -->
    <Teleport to="body">
      <div v-if="drawerOpen" class="jr-mdrawer-mask" @click="drawerOpen = false">
        <aside class="jr-mdrawer" aria-label="导航抽屉" @click.stop>
          <div class="dhead">
            <NuxtLink to="/settings" class="dico" aria-label="打开设置" @click="drawerOpen = false">
              <JrIcon :path="mdiCogOutline" :size="21" />
            </NuxtLink>
            <NuxtLink to="/cloud" class="dico" aria-label="云服务" @click="drawerOpen = false">
              <JrIcon :path="mdiCloudOutline" :size="21" />
            </NuxtLink>
          </div>
          <NuxtLink to="/" class="drow" :class="{ on: route.path === '/' }" @click="drawerOpen = false">
            <JrIcon :path="mdiWhiteBalanceSunny" :size="20" /><span>今天</span>
          </NuxtLink>
          <NuxtLink to="/pal" class="drow" :class="{ on: route.path.startsWith('/pal') }" @click="drawerOpen = false">
            <JrIcon :path="mdiRobotOutline" :size="20" /><span>日记伙伴</span>
          </NuxtLink>
          <div class="dsection"><span>日记</span></div>
          <NuxtLink to="/" class="drow jr-djournal" :class="{ on: route.path === '/' }" @click="drawerOpen = false">
            <span class="dchip" aria-hidden="true" /><span class="dname">Journal</span><span class="dcount">{{ entryCount }}</span>
          </NuxtLink>
          <NuxtLink to="/cloud" class="drow" @click="drawerOpen = false">
            <span class="dchip cloud" aria-hidden="true" /><span class="dname">云服务</span><JrIcon :path="mdiCloudOutline" :size="16" class="dend" />
          </NuxtLink>
          <NuxtLink to="/atlas" class="drow" :class="{ on: route.path.startsWith('/atlas') }" @click="drawerOpen = false">
            <JrIcon :path="mdiMapMarkerOutline" :size="20" /><span>位置历史记录</span>
          </NuxtLink>
          <div class="dsep" />
          <NuxtLink to="/calendar" class="drow" :class="{ on: route.path.startsWith('/calendar') }" @click="drawerOpen = false">
            <JrIcon :path="mdiCalendarMonth" :size="20" /><span>日历</span>
          </NuxtLink>
          <NuxtLink to="/media" class="drow" :class="{ on: route.path.startsWith('/media') }" @click="drawerOpen = false">
            <JrIcon :path="mdiImageMultipleOutline" :size="20" /><span>媒体</span>
          </NuxtLink>
          <button
            type="button"
            class="drow dplain"
            :aria-pressed="petVisible"
            data-testid="pet-toggle-mobile"
            @click="togglePet"
          >
            <JrIcon :path="petVisible ? mdiPawOffOutline : mdiPawOutline" :size="20" />
            <span>{{ petVisible ? '隐藏桌宠' : '显示桌宠' }}</span>
          </button>
          <button type="button" class="drow dplain" @click="drawerOpen = false; membershipOpen = true">
            <JrIcon :path="mdiWalletGiftcard" :size="20" /><span>附加功能</span>
          </button>
          <div class="dfooter">
            <span class="davatar">用</span>
            <span class="dwho">用户 · 免费版</span>
            <JrIcon :path="mdiLogout" :size="18" class="dend" />
          </div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.jr-mshell { height: 100%; display: flex; flex-direction: column; background: var(--jr-bg); }
/* Day One 移动顶栏：左图标 + 中胶囊 + 右搜索，无胶囊底板（40-mobile-main） */
.jr-mtopbar { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 12px 6px; position: relative; z-index: 40; }
.mico-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 0; background: none; border-radius: 10px; color: var(--jr-on-bg); text-decoration: none; }
.mico-btn:active { background: var(--jr-surface-variant); }
.mtop-pills { flex: none; }
.jr-mbody { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
/* 抽屉 */
.jr-mdrawer-mask { position: fixed; inset: 0; z-index: 90; background: rgba(0, 0, 0, 0.4); }
.jr-mdrawer {
  position: absolute; inset: 0 auto 0 0; width: 300px; max-width: 84vw;
  background: var(--jr-surface); border-right: 1px solid var(--jr-outline-variant);
  display: flex; flex-direction: column; overflow-y: auto; padding: 0 12px;
}
.dhead { display: flex; align-items: center; justify-content: space-between; padding: 14px 2px 10px; }
.dico { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; color: var(--jr-on-bg); text-decoration: none; }
.dico:active { background: var(--jr-surface-variant); }
.drow { display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; color: var(--jr-on-bg); text-decoration: none; font-size: 15px; width: 100%; background: none; border: 0; font-family: inherit; text-align: left; }
.drow.on { background: var(--jr-surface-variant); font-weight: 600; }
.drow:active { background: var(--jr-surface-variant); }
.dplain { cursor: pointer; }
.dsection { color: var(--jr-on-surface-variant); font-size: 12.5px; padding: 16px 12px 4px; }
.jr-djournal .dchip { flex: none; width: 16px; height: 16px; border-radius: 4px; background: var(--jr-tertiary); }
.dchip.cloud { background: var(--jr-secondary-container); }
.dname { flex: 1; }
.dcount { color: var(--jr-on-surface-variant); font-size: 12.5px; }
.dend { color: var(--jr-on-surface-variant); }
.dsep { height: 1px; background: var(--jr-outline-variant); margin: 10px 6px; }
.dfooter { margin-top: auto; display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--jr-outline-variant); padding: 14px 10px; color: var(--jr-on-surface-variant); font-size: 13px; }
.davatar { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: var(--jr-primary-container); color: var(--jr-on-primary-container); font-weight: 700; }
.dwho { flex: 1; color: var(--jr-on-bg); font-weight: 600; }
</style>
