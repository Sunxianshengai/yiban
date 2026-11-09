<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <main class="jr-empty" style="min-height:100dvh">
    <h1>{{ error.statusCode === 404 ? '找不到该页面' : '暂时无法打开页面' }}</h1>
    <button class="jr-btn jr-btn-primary" type="button" @click="clearError({ redirect: '/' })">返回首页</button>
  </main>
</template>
