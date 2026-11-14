<script setup lang="ts">
import { mdiTrashCanOutline, mdiDeleteRestore } from '@mdi/js'
import type { TrashRow } from '~/utils/db'
import { db } from '~/utils/db'

/**
 * 回收站（M-209 收尾新增的独立页）：列表 = 恢复 / 彻底删除 / 清空。
 * 移入回收站时云端已按墓碑软删，所以「彻底删除」只清本地快照，不碰云端。
 */
const { listTrash, restoreFromTrash, refresh, refreshTrashCount } = useEntries()
const rows = ref<TrashRow[]>([])
const busy = ref(false)
const note = ref('')

async function load() {
  rows.value = (await listTrash()).slice().reverse()
  await refreshTrashCount()
}
onMounted(load)

async function restore(t: TrashRow) {
  if (busy.value || t.id == null) return
  busy.value = true
  note.value = ''
  try {
    await restoreFromTrash(t.id)
    await load()
    note.value = '已恢复到时间线。'
  } catch {
    note.value = '无法恢复，请重试。'
  } finally {
    busy.value = false
  }
}

async function purge(t: TrashRow) {
  if (busy.value || t.id == null) return
  if (!window.confirm('彻底删除这篇日记？本地快照将不可恢复（云端已同步删除）。')) return
  busy.value = true
  note.value = ''
  try {
    await db.trashesV2.delete(t.id)
    await load()
  } finally {
    busy.value = false
  }
}

async function emptyAll() {
  if (busy.value || !rows.value.length) return
  if (!window.confirm(`清空回收站的 ${rows.value.length} 篇日记？此操作不可撤销。`)) return
  busy.value = true
  note.value = ''
  try {
    await db.trashesV2.clear()
    await load()
  } finally {
    busy.value = false
  }
}

function fmt(t: TrashRow) {
  const d = t.snapshot?.dateOfJournal
  return d ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)) : ''
}
function preview(t: TrashRow) {
  return t.snapshot?.previewText?.slice(0, 80) || '（无快照内容）'
}
</script>

<template>
  <div class="jr-trash-page">
    <header class="jr-trash-head">
      <h1 class="jr-trash-title">
        <JrIcon :path="mdiTrashCanOutline" :size="22" />
        回收站
      </h1>
      <span class="jr-muted">{{ rows.length }} 篇</span>
      <button class="jr-btn jr-danger jr-trash-empty" :disabled="!rows.length || busy" @click="emptyAll">清空回收站</button>
    </header>

    <p v-if="note" class="jr-trash-note" role="status">{{ note }}</p>

    <div v-if="!rows.length" class="jr-empty">
      <div class="big"><JrIcon :path="mdiTrashCanOutline" :size="46" /></div>
      回收站为空。
    </div>

    <div v-else class="jr-trash-list">
      <div v-for="t in rows" :key="t.id" class="jr-trash-row">
        <span class="jr-trash-meta">
          <b>{{ fmt(t) }}</b>
          <span class="jr-muted">移入回收站的日记快照</span>
        </span>
        <span class="jr-trash-preview">{{ preview(t) }}</span>
        <span class="jr-trash-actions">
          <button class="jr-btn jr-btn-sm" :disabled="busy" @click="restore(t)">
            <JrIcon :path="mdiDeleteRestore" :size="15" /> 恢复
          </button>
          <button class="jr-link-danger" :disabled="busy" @click="purge(t)">彻底删除</button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jr-trash-page { max-width: 760px; margin: 0 auto; padding: 26px 22px 60px; }
.jr-trash-head { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.jr-trash-title { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 800; color: var(--jr-on-bg); margin: 0; }
.jr-trash-empty { margin-left: auto; }
.jr-trash-note { font-size: 12.5px; color: var(--jr-primary); margin: 0 0 10px; }
.jr-trash-list { display: flex; flex-direction: column; gap: 10px; }
.jr-trash-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--jr-outline-variant);
  background: var(--jr-surface-variant);
}
.jr-trash-meta { display: flex; align-items: baseline; gap: 10px; }
.jr-trash-meta b { font-size: 13px; color: var(--jr-on-bg); }
.jr-trash-meta .jr-muted { font-size: 11.5px; }
.jr-trash-preview { font-size: 13.5px; line-height: 1.55; color: var(--jr-on-surface-variant); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.jr-trash-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; }
@media (min-width: 601px) {
  .jr-trash-row { flex-direction: row; align-items: center; gap: 12px; }
  .jr-trash-meta { flex-shrink: 0; width: 150px; flex-direction: column; align-items: flex-start; gap: 0; }
  .jr-trash-preview { flex: 1; min-width: 0; }
  .jr-trash-actions { flex-shrink: 0; }
}
</style>
