<script setup lang="ts">
const onboarded = ref(true)
const locked = ref(false)
onMounted(() => {
  onboarded.value = localStorage.getItem('jr.onboarded') === '1'
  locked.value = !!localStorage.getItem('jr.pinHash') && sessionStorage.getItem('jr.unlocked') !== '1'
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
    </template>
  </div>
</template>
