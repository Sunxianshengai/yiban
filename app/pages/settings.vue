<script setup lang="ts">
const router = useRouter()
const route = useRoute()
</script>

<template>
  <SettingsView :open-family="route.query.section === 'family'" @close="router.back()" />
</template>
