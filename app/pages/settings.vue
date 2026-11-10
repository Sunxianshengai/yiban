<script setup lang="ts">
const router = useRouter()
</script>

<template>
  <SettingsView @close="router.back()" />
</template>
