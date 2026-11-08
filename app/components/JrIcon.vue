<script setup lang="ts">
defineProps<{ path: string; size?: number }>()
</script>

<template>
  <svg
    :width="size || 22"
    :height="size || 22"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>
