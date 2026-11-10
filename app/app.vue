<script setup lang="ts">
import { desktopBridge } from '~/utils/desktopBridge'
import { mdiMenu } from '@mdi/js'

const onboarded = ref(true)
const locked = ref(false)
const sidebarOpen = ref(false)
const membershipOpen = useMembershipDialog()
const isMobile = useIsMobile()
const { theme, fontSize, colorTheme } = useAppearance()
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const systemPrefersDark = ref(systemDark.matches)
function onSystemTheme(event: MediaQueryListEvent) { systemPrefersDark.value = event.matches }
onMounted(() => systemDark.addEventListener('change', onSystemTheme))
onBeforeUnmount(() => systemDark.removeEventListener('change', onSystemTheme))
watchEffect(() => {
  const dark = theme.value === 'Dark' || (theme.value === 'System' && systemPrefersDark.value)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  applyColorTheme(colorTheme.value, dark)
  document.documentElement.style.setProperty('--jr-content-size', { Small: '14px', Medium: '16px', Large: '18px' }[fontSize.value])
  // 审计 #21：字体选择真正应用到正文
  document.documentElement.style.setProperty('--jr-font', { 'Gotham Rounded': "'Nunito', 'Varela Round', 'Microsoft YaHei UI', 'PingFang SC'", 'Verlag': "'Segoe UI', system-ui, sans-serif", 'Lexend': "'Lexend', 'Segoe UI', sans-serif", 'OpenDyslexic': "'OpenDyslexic', 'Comic Sans MS', sans-serif" }[localStorage.getItem('jr.fontFamily') || 'Gotham Rounded'] ?? "")
  localStorage.setItem('jr.theme', theme.value)
  localStorage.setItem('jr.fontSize', fontSize.value)
  localStorage.setItem('jr.colorTheme', String(colorTheme.value))
})
onMounted(async () => {
  onboarded.value = localStorage.getItem('jr.onboarded') === '1'
  locked.value = !!localStorage.getItem('jr.pinHash') && sessionStorage.getItem('jr.unlocked') !== '1'
  await nextTick()
  desktopBridge()?.emit('appReady')
})
</script>

<template>
  <div class="jr-shell" :class="{ 'sidebar-open': sidebarOpen }">
    <LockOverlay v-if="locked" @unlocked="locked = false" />
    <template v-else>
      <button v-if="!isMobile" class="jr-sidebar-toggle" type="button" aria-label="打开侧栏" @click="sidebarOpen = !sidebarOpen">
        <JrIcon :path="mdiMenu" :size="20" />
      </button>
      <template v-if="isMobile">
        <MobileShell>
          <NuxtPage />
        </MobileShell>
      </template>
      <template v-else>
        <AppSidebar @navigate="sidebarOpen = false" />
        <main class="jr-main" style="position:relative" @click="sidebarOpen = false">
          <NuxtPage />
        </main>
      </template>
      <OnboardingModal v-if="!onboarded" @finish="onboarded = true" />
      <MembershipDialog v-if="membershipOpen" @close="membershipOpen = false" />
    </template>
  </div>
</template>
