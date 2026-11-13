<script setup lang="ts">
// Day One 移动壳（W1 采集 40-mobile-main/41/56 证据 + ledger O14）：
// 顶栏=左日记本图标(开导航抽屉)+中视图胶囊+右搜索；无底部 tab；FAB 右下圆角方块。
// 安卓原生 APK 未采成（Cloudflare 拦，ledger U2），移动形态以 Day One web 移动视口 390x844 为准。
import { mdiBookOutline, mdiMagnify, mdiCogOutline, mdiCloudOutline, mdiRobotOutline, mdiMapMarkerOutline, mdiPawOutline, mdiPawOffOutline, mdiWalletGiftcard } from '@mdi/js'

const route = useRoute()
const drawerOpen = ref(false)
const membershipOpen = useMembershipDialog()
const { visible: petVisible, toggle: togglePet } = usePetWidget()
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

    <!-- 视图切换在顶栏，抽屉提供其他页面和设置。 -->
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
          <NuxtLink to="/pal" class="drow" :class="{ on: route.path.startsWith('/pal') }" @click="drawerOpen = false">
            <JrIcon :path="mdiRobotOutline" :size="20" /><span>日记伙伴</span>
          </NuxtLink>
          <NuxtLink to="/atlas" class="drow" :class="{ on: route.path.startsWith('/atlas') }" @click="drawerOpen = false">
            <JrIcon :path="mdiMapMarkerOutline" :size="20" /><span>位置历史记录</span>
          </NuxtLink>
          <div class="dsep" />
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
            <JrIcon :path="mdiWalletGiftcard" :size="20" /><span>会员</span>
          </button>
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
.dsep { height: 1px; background: var(--jr-outline-variant); margin: 10px 6px; }
</style>
