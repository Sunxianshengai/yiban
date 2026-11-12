<script setup lang="ts">
// Day One 右主区「日记本概览」（journey-replica/evidence/dayone/dayone-derived/ia-map.json journalOverview）：
// 封面 + 名称 + 年份 + 统计行（N 日记条目 N 媒体 N 天 N Streak）。Streak 语义按 O3/I3：当日有条目即计 1 天，
// 今天没写从昨天回数。entries 可选：index/calendar 传入共享 state；media 等自治页不传时组件自行读库。
import type { EntryV2 } from '~/utils/db'
import { db } from '~/utils/db'

const props = defineProps<{ entries?: EntryV2[] }>()
const mediaCount = ref(0)
const localEntries = ref<EntryV2[]>([])
onMounted(async () => {
  mediaCount.value = await db.mediaFilesV2.count()
  localEntries.value = props.entries?.length ? props.entries : await db.entriesV2.filter((e) => !e.deleted).toArray()
})

const live = computed(() => localEntries.value)
const dayCount = computed(() => new Set(live.value.map((e) => new Date(e.dateOfJournal).toDateString())).size)
const streak = computed(() => {
  const dates = new Set(live.value.map((e) => new Date(e.dateOfJournal).toDateString()))
  const d = new Date()
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1)
  let n = 0
  while (dates.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1) }
  return n
})
const year = new Date().getFullYear()
</script>

<template>
  <div class="jr-overview">
    <div class="jr-ov-head">
      <span class="jr-ov-cover" aria-hidden="true" />
      <div>
        <div class="jr-ov-name">Journal</div>
        <div class="jr-ov-year">{{ year }}</div>
      </div>
    </div>
    <div class="jr-ov-stats">
      <span class="st"><b>{{ live.length }}</b> 日记条目</span>
      <span class="st"><b>{{ mediaCount }}</b> 媒体</span>
      <span class="st"><b>{{ dayCount }}</b> 天</span>
      <span class="st"><b>{{ streak }}</b> Streak</span>
    </div>
    <p class="jr-ov-hint">从左侧选择一篇日记，或点右上角 + 新建。</p>
  </div>
</template>

<style scoped>
.jr-overview { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 44px 40px 90px; gap: 6px; }
.jr-ov-head { display: flex; align-items: center; gap: 18px; margin-bottom: 14px; }
.jr-ov-cover { width: 64px; height: 88px; border-radius: 6px 10px 10px 6px; background: linear-gradient(160deg, var(--jr-primary-fixed-dim), var(--jr-tertiary)); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); }
.jr-ov-name { font-size: 22px; font-weight: 700; }
.jr-ov-year { color: var(--jr-on-surface-variant); font-size: 13.5px; margin-top: 2px; }
.jr-ov-stats { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; font-size: 13.5px; color: var(--jr-on-surface-variant); }
.jr-ov-stats .st b { color: var(--jr-on-bg); font-weight: 700; margin-right: 3px; }
.jr-ov-hint { color: var(--jr-outline); font-size: 13px; margin-top: 18px; }
</style>
