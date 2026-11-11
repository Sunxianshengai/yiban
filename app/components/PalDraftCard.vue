<script setup lang="ts">
import { mdiClose, mdiContentSave, mdiMicrophone, mdiImageMultipleOutline } from '@mdi/js'

/**
 * 伙伴整理出来的日记草稿卡：正文可改、时间可改、照片/语音可删，
 * 用户确认后才真正写进日记本（saveEntry）——AI 只起草，落库必须过人。
 */
export interface PalDraft {
  text: string
  date: string
  photos: File[]
  audio?: File
  source?: string
}

const props = defineProps<{ draft: PalDraft; saving: boolean }>()
const emit = defineEmits<{ (e: 'save', draft: PalDraft): void; (e: 'discard'): void }>()

const text = ref(props.draft.text)
const date = ref(props.draft.date)
watch(() => props.draft, (d) => { text.value = d.text; date.value = d.date })

function removePhoto(index: number) {
  props.draft.photos.splice(index, 1)
}

function submit() {
  if (!text.value.trim()) return
  emit('save', { ...props.draft, text: text.value, date: date.value, photos: [...props.draft.photos] })
}
</script>

<template>
  <div class="jr-pal-draft">
    <div class="draft-head">
      <span class="draft-title">日记草稿</span>
      <span v-if="draft.source" class="draft-source">整理自「{{ draft.source }}」</span>
    </div>
    <textarea v-model="text" class="draft-text" rows="6" aria-label="草稿正文" placeholder="伙伴整理的内容会出现在这里，你可以随意修改。" />
    <input v-model="date" class="draft-date" type="datetime-local" aria-label="日记时间">
    <div v-if="draft.photos.length" class="draft-photos">
      <span v-for="(photo, i) in draft.photos" :key="i" class="draft-chip">
        <JrIcon :path="mdiImageMultipleOutline" :size="14" /> {{ photo.name.slice(0, 14) }}
        <button class="chip-x" :aria-label="`移除照片 ${photo.name}`" @click="removePhoto(i)"><JrIcon :path="mdiClose" :size="11" /></button>
      </span>
    </div>
    <div v-if="draft.audio" class="draft-photos">
      <span class="draft-chip"><JrIcon :path="mdiMicrophone" :size="14" /> {{ draft.audio.name }}（作为附件保存）</span>
    </div>
    <div class="draft-actions">
      <button class="jr-link-btn" :disabled="saving" @click="emit('discard')">放弃</button>
      <button class="jr-btn jr-btn-primary" :disabled="saving || !text.trim()" @click="submit">
        <JrIcon :path="mdiContentSave" :size="16" /> {{ saving ? '正在保存…' : '存成日记' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.jr-pal-draft {
  border: 1px solid var(--jr-outline-variant);
  border-radius: var(--jr-radius);
  background: var(--jr-bg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 560px;
}
.draft-head { display: flex; align-items: center; gap: 8px; }
.draft-title { font-weight: 800; font-size: 13.5px; }
.draft-source { font-size: 12px; color: var(--jr-on-surface-variant); background: var(--jr-surface-variant); border-radius: 999px; padding: 2px 10px; }
.draft-text { resize: vertical; min-height: 96px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 14px; line-height: 1.7; background: #fff; color: var(--jr-on-bg); }
[data-theme="dark"] .draft-text { background: #1d2427; }
.draft-date { border: 1px solid var(--jr-outline-variant); border-radius: 10px; padding: 7px 10px; font-family: inherit; font-size: 13px; background: #fff; color: var(--jr-on-bg); width: fit-content; }
[data-theme="dark"] .draft-date { background: #1d2427; }
.draft-photos { display: flex; flex-wrap: wrap; gap: 6px; }
.draft-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; background: var(--jr-surface-variant); border-radius: 999px; padding: 4px 10px; }
.chip-x { border: 0; background: none; cursor: pointer; padding: 0 0 0 2px; display: inline-flex; color: var(--jr-on-surface-variant); }
.draft-actions { display: flex; justify-content: flex-end; align-items: center; gap: 14px; }
.jr-link-btn { border: 0; background: none; color: var(--jr-on-surface-variant); font-size: 12.5px; cursor: pointer; padding: 4px; }
.jr-link-btn:disabled { opacity: 0.5; cursor: default; }
</style>
