<script setup lang="ts">
import { mdiStarOutline, mdiFilterVariant, mdiImageOutline, mdiBookOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entries } = useEntries()
const starred = computed(() => entries.value.filter((e) => !!e.favourite))
const selected = ref<EntryV2 | null>(null)
function open(e: EntryV2) {
  selected.value = e
}
function rowDate(e: EntryV2) {
  const d = new Date(e.dateOfJournal)
  return `${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)} · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(d)}`
}
</script>

<template>
  <div class="jr-content">
    <div class="jr-list-col">
      <div style="display:flex;align-items:center;gap:10px;margin:22px 0 0">
        <button class="jr-search" style="margin:0;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.4px">
          <JrIcon :path="mdiFilterVariant" :size="15" /> 筛选
        </button>
        <div class="jr-search" style="margin:0"><input type="text" placeholder="搜索" /></div>
      </div>
      <h1 style="font-size:19px;margin:22px 0 10px">搜索结果</h1>
      <div v-if="!starred.length" class="jr-empty">
        <div class="big"><JrIcon :path="mdiStarOutline" :size="46" /></div>
        暂无日记。
      </div>
      <div v-for="e in starred" :key="e.id" class="jr-entry" :class="{ selected: selected?.id === e.id }" @click="open(e)">
        <div class="date">{{ rowDate(e) }}</div>
        <div class="preview">{{ e.previewText }}</div>
      </div>
      <p class="jr-muted" style="font-size:12px">这里只显示已收藏的日记。</p>
    </div>
    <div class="jr-detail-col" style="display:flex;flex-direction:column;position:relative">
      <div v-if="selected" class="jr-detail-body">
        <div class="jr-detail-head">
          <div class="day">{{ new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
          <div class="when">
            <div class="d1">{{ new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(selected.dateOfJournal) }}</div>
            <div class="d2">{{ new Intl.DateTimeFormat('zh-CN', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(selected.dateOfJournal) }}</div>
          </div>
        </div>
        <JournalBody :entry="selected" />
        <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">在时间线中打开</NuxtLink>
      </div>
      <div v-else class="jr-empty" style="margin:auto">
        <div class="big"><JrIcon :path="mdiBookOutline" :size="46" /></div>
        请选择一篇日记。
      </div>
    </div>
  </div>
</template>
