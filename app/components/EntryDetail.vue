<script setup lang="ts">
import { mdiStarOutline, mdiStar, mdiBookOutline, mdiShareOutline, mdiPencil, mdiDotsHorizontal, mdiLinkVariant, mdiContentDuplicate, mdiLabelOutline, mdiTrashCanOutline, mdiCloudUploadOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const props = defineProps<{ entry: EntryV2 | null }>()
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'toggleFavourite'): void
  (e: 'duplicate'): void
  (e: 'saveAsTemplate'): void
  (e: 'trash'): void
}>()

const menuOpen = ref(false)

const day = computed(() => props.entry ? new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(props.entry.dateOfJournal) : '')
const d1 = computed(() => props.entry ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(props.entry.dateOfJournal) : '')
const d2 = computed(() => props.entry ? new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(props.entry.dateOfJournal) : '')

const menu = [
  { key: 'copy', label: 'Copy Uri', icon: mdiLinkVariant },
  { key: 'duplicate', label: 'Duplicate', icon: mdiContentDuplicate },
  { key: 'template', label: 'Save as a Template', icon: mdiLabelOutline },
  { key: 'trash', label: 'Move to Trash', icon: mdiTrashCanOutline },
] as const

function onMenu(key: typeof menu[number]['key']) {
  menuOpen.value = false
  if (key === 'duplicate') emit('duplicate')
  else if (key === 'template') emit('saveAsTemplate')
  else if (key === 'trash') emit('trash')
  else if (key === 'copy') {
    const u = new URL(location.href)
    u.hash = `#entry=${props.entry?.id}`
    navigator.clipboard?.writeText(u.toString()).catch(() => {})
  }
}
</script>

<template>
  <div v-if="entry" class="jr-detail-body">
    <div class="jr-detail-head">
      <div class="day">{{ day }}</div>
      <div class="when">
        <div class="d1">{{ d1 }}</div>
        <div class="d2">{{ d2 }}</div>
      </div>
      <div style="align-self:flex-start" title="Pending upload (local only)">
        <JrIcon :path="mdiCloudUploadOutline" :size="20" style="color:#e05a4e" />
      </div>
    </div>
    <div class="jr-detail-content" v-html="entry.text" />
  </div>
  <div v-else class="jr-empty" style="margin:auto">
    <div class="big"><JrIcon :path="mdiBookOutline" :size="52" /></div>
    No entries selected.
  </div>

  <div v-if="entry" class="jr-detail-bar">
    <button :class="{ on: !!entry.favourite }" title="Favourite" @click="emit('toggleFavourite')">
      <JrIcon :path="entry.favourite ? mdiStar : mdiStarOutline" :size="22" />
    </button>
    <button title="Templates"><JrIcon :path="mdiBookOutline" :size="22" /></button>
    <button title="Share / Export"><JrIcon :path="mdiShareOutline" :size="22" /></button>
    <button title="Edit" @click="emit('edit')"><JrIcon :path="mdiPencil" :size="22" /></button>
    <button title="More" @click="menuOpen = !menuOpen"><JrIcon :path="mdiDotsHorizontal" :size="22" /></button>
    <div v-if="menuOpen" class="jr-menu">
      <button v-for="m in menu" :key="m.key" @click="onMenu(m.key)">
        <JrIcon :path="m.icon" :size="18" />
        <span :style="m.key === 'trash' ? 'color:var(--jr-error)' : ''">{{ m.label }}</span>
      </button>
    </div>
  </div>
</template>
