<script setup lang="ts">
import { desktopBridge } from '~/utils/desktopBridge'

const onboarded = ref(true)
const locked = ref(false)
const membershipOpen = useMembershipDialog()
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
  <div class="jr-shell">
    <LockOverlay v-if="locked" @unlocked="locked = false" />
    <template v-else>
      <AppSidebar />
      <main class="jr-main" style="position:relative">
        <NuxtPage />
      </main>
      <OnboardingModal v-if="!onboarded" @finish="onboarded = true" />
      <MembershipDialog v-if="membershipOpen" @close="membershipOpen = false" />
    </template>
  </div>
</template>
