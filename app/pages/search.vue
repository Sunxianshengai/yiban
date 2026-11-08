<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const q = computed(() => String(route.query.q || ''))
const { entries } = useEntries()
const results = computed(() =>
  q.value ? entries.value.filter((e) => e.previewText?.toLowerCase().includes(q.value.toLowerCase())) : [],
)
</script>

<template>
  <div class="jr-page">
    <h1>Search Results</h1>
    <p v-if="q" class="jr-muted">Query: "{{ q }}" — {{ results.length }} result(s)</p>
    <div v-for="e in results" :key="e.id" class="jr-entry" style="max-width:520px">
      <div class="preview">{{ e.previewText }}</div>
    </div>
  </div>
</template>
