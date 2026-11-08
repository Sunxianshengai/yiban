<script setup lang="ts">
const onboarded = ref(true)
onMounted(() => {
  onboarded.value = localStorage.getItem('jr.onboarded') === '1'
})
</script>

<template>
  <div class="jr-shell">
    <AppSidebar />
    <main class="jr-main" style="position:relative">
      <NuxtPage />
    </main>
    <OnboardingModal v-if="!onboarded" @finish="onboarded = true" />
  </div>
</template>
