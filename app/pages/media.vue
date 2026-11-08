<script setup lang="ts">
import { mdiImageMultipleOutline } from '@mdi/js'
import type { MediaFileV2 } from '~/utils/db'

const { allMedia, deleteMedia } = useEntries()
const items = ref<(MediaFileV2 & { url?: string })[]>([])
const filter = ref<'all' | 'image' | 'video' | 'audio'>('all')

async function load() {
  const rows = await allMedia()
  items.value = rows.map((r) => ({ ...r, url: r.blob ? URL.createObjectURL(r.blob) : undefined }))
}
onMounted(load)

const shown = computed(() => items.value.filter((i) => filter.value === 'all' || i.mimeType.startsWith(filter.value)))
function fmt(d?: Date) {
  return d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d) : ''
}
</script>

<template>
  <div class="jr-page">
    <div class="jr-media-filters">
      <button v-for="f in ['all', 'image', 'video', 'audio']" :key="f" class="jr-chip" :class="{ on: filter === f }" @click="filter = f as any">{{ f }}</button>
    </div>
    <div v-if="!shown.length" class="jr-empty">
      <div class="big"><JrIcon :path="mdiImageMultipleOutline" :size="46" /></div>
      No media to display.
    </div>
    <div class="jr-media-grid">
      <div v-for="m in shown" :key="m.id" class="jr-media-card">
        <img v-if="m.mimeType.startsWith('image/')" :src="m.url" class="jr-media-thumb" />
        <video v-else-if="m.mimeType.startsWith('video/')" :src="m.url" class="jr-media-thumb" controls />
        <audio v-else-if="m.mimeType.startsWith('audio/')" :src="m.url" controls style="width:100%" />
        <div v-else class="jr-media-thumb jr-center">{{ m.ext.toUpperCase() }}</div>
        <div class="jr-media-meta">
          <span class="jr-media-name">{{ m.fileName }}</span>
          <span class="jr-muted">{{ fmt(m.createdAt) }}</span>
          <button class="jr-link-danger" @click="deleteMedia(m.id!); load()">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>
