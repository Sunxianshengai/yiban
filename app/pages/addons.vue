<script setup lang="ts">
const membershipOpen = useMembershipDialog()

onMounted(async () => {
  await navigateTo('/', { replace: true })
  membershipOpen.value = true
})
</script>

<template><div /></template>
