<script setup lang="ts">
// 审计 #10：收藏 = 统一搜索结果页的一种筛选状态（原版行为），不再单独造页
await navigateTo({ path: '/search/results', query: { starred: '1', favourite: 'true' } }, { replace: true })
</script>

<template>
  <div />
</template>
