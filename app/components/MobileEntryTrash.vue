<script setup lang="ts">
import { mdiTrashCanOutline } from '@mdi/js'

const entryId = defineModel<number | null>({ required: true })
const emit = defineEmits<{ trashed: [id: number]; restored: [] }>()
const { moveToTrash, restoreFromTrash } = useEntries()
const dialog = ref<HTMLDialogElement>()
const trashId = ref<number>()
const busy = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

watch(entryId, (id) => {
  if (id == null) dialog.value?.close()
  else {
    error.value = ''
    dialog.value?.showModal()
  }
})
onBeforeUnmount(() => clearTimeout(timer))

async function remove() {
  const id = entryId.value
  if (id == null || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const removed = await moveToTrash(id)
    entryId.value = null
    if (removed == null) return
    trashId.value = removed
    emit('trashed', id)
    clearTimeout(timer)
    timer = setTimeout(() => { trashId.value = undefined }, 6000)
  } catch {
    error.value = '无法移到回收站，请重试。'
  } finally {
    busy.value = false
  }
}

async function undo() {
  const id = trashId.value
  if (id == null || busy.value) return
  busy.value = true
  clearTimeout(timer)
  try {
    await restoreFromTrash(id)
    trashId.value = undefined
    emit('restored')
  } catch {
    error.value = '无法恢复日记，请重试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <dialog ref="dialog" class="mdlg" aria-label="删除日记" @cancel.prevent="!busy && (entryId = null)">
    <JrIcon :path="mdiTrashCanOutline" :size="26" />
    <div class="dlg-t">删除</div>
    <p>您想要删除这个日记条目吗？</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="dlg-btns">
      <button type="button" autofocus :disabled="busy" @click="entryId = null">取消</button>
      <button type="button" class="danger" :disabled="busy" @click="remove">删除</button>
    </div>
  </dialog>
  <div v-if="trashId != null" class="msnack">
    <span role="status">{{ entryId == null && error ? error : '已移到回收站' }}</span>
    <button type="button" :disabled="busy" @click="undo">撤销</button>
  </div>
</template>

<style scoped>
.mdlg { width: min(320px, 84vw); border: 1px solid var(--jr-outline-variant); background: var(--jr-surface); color: var(--jr-on-bg); border-radius: 22px; padding: 22px 18px 14px; text-align: center; }
.mdlg::backdrop { background: rgba(90, 100, 104, 0.55); }
.dlg-t { font-size: 20px; font-weight: 800; margin: 8px 0 6px; }
.mdlg p { font-size: 13.5px; color: var(--jr-on-surface-variant); margin: 0 0 16px; }
.dlg-btns { display: flex; justify-content: center; gap: 26px; }
.dlg-btns button { background: transparent; border: 0; color: var(--jr-primary); font-size: 15px; font-weight: 700; padding: 8px 6px; }
.dlg-btns .danger { color: var(--jr-error); }
.msnack {
  position: fixed; left: 14px; right: 14px; bottom: calc(78px + env(safe-area-inset-bottom)); z-index: 380;
  display: flex; align-items: center; gap: 12px;
  background: #303638; color: #fff; border-radius: 10px; padding: 12px 16px;
  font-size: 13.5px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}
.msnack button { margin-left: auto; background: transparent; border: 0; color: #85d1e8; font-weight: 700; font-size: 13.5px; }
</style>
