<script setup lang="ts">
import { mdiClose, mdiDownload, mdiUpload, mdiDeleteRestore, mdiCogOutline, mdiAccountOutline, mdiShieldKeyOutline, mdiDatabaseOutline, mdiHelpCircleOutline } from '@mdi/js'
import type { TrashRow } from '~/utils/db'

const tab = ref<'general' | 'account' | 'security' | 'data' | 'help'>('general')
const tabs = [
  { key: 'general', label: 'General', icon: mdiCogOutline },
  { key: 'account', label: 'Account', icon: mdiAccountOutline },
  { key: 'security', label: 'Security', icon: mdiShieldKeyOutline },
  { key: 'data', label: 'Data', icon: mdiDatabaseOutline },
  { key: 'help', label: 'Help', icon: mdiHelpCircleOutline },
] as const

// General (persisted locally; original themes/fonts/units — free-tier observed values as defaults)
const fontSize = ref(localStorage.getItem('jr.fontSize') || 'Medium')
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
watchEffect(() => {
  localStorage.setItem('jr.fontSize', fontSize.value)
  localStorage.setItem('jr.spellcheck', spellcheck.value ? '1' : '0')
  document.documentElement.style.setProperty('--jr-content-size', { Small: '14px', Medium: '16px', Large: '18px' }[fontSize.value] || '16px')
})

// Data: export / import / trash
const trash = ref<TrashRow[]>([])
const busy = ref('')
onMounted(loadTrash)
async function loadTrash() { trash.value = await useEntries().listTrash() }

function exportJson() {
  const { entries } = useEntries()
  const payload = { format: 'journey-replica-json', version: 1, exportedAt: new Date().toISOString(), entries: entries.value }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `journey-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
}

const importMsg = ref('')
function importJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    busy.value = 'importing'
    try {
      const data = JSON.parse(await file.text())
      if (data.format !== 'journey-replica-json' || !Array.isArray(data.entries)) throw new Error('unsupported format')
      let n = 0
      for (const e of data.entries) {
        await (await import('~/utils/db')).db.entriesV2.add({
          ...e,
          id: undefined,
          linkedAccountId: e.linkedAccountId || '',
          dateOfJournal: new Date(e.dateOfJournal),
          dateModified: new Date(),
          synced: 0,
        })
        n++
      }
      importMsg.value = `Imported ${n} entr${n === 1 ? 'y' : 'ies'}. Original Journey v1/v2, Day One, Evernote, Daylio, Apple Journal importers: pending (see feature matrix).`
      await useEntries().refresh()
    } catch (err) {
      importMsg.value = `Import failed: ${(err as Error).message}`
    }
    busy.value = ''
  }
  input.click()
}

async function restore(t: TrashRow) {
  await useEntries().restoreFromTrash(t.id!)
  await loadTrash()
}

async function wipeAll() {
  if (!confirm('Delete ALL local entries? This cannot be undone.')) return
  await (await import('~/utils/db')).db.entriesV2.clear()
  await useEntries().refresh()
}
</script>

<template>
  <div class="jr-modal-mask" @click.self="$router.back()">
    <div class="jr-modal">
      <button class="jr-modal-x" @click="$router.back()"><JrIcon :path="mdiClose" :size="16" /></button>
      <div class="jr-modal-tabs">
        <button v-for="t in tabs" :key="t.key" class="jr-modal-tab" :class="{ on: tab === t.key }" @click="tab = t.key">
          <JrIcon :path="t.icon" :size="20" />
          <span>{{ t.label }}</span>
        </button>
      </div>

      <div class="jr-modal-body">
        <template v-if="tab === 'general'">
          <div class="jr-set-label">Font Size</div>
          <select v-model="fontSize" class="jr-set-select">
            <option>Small</option><option>Medium</option><option>Large</option>
          </select>
          <label class="jr-set-check">
            <input v-model="spellcheck" type="checkbox" /> Spell check while writing
          </label>
          <p class="jr-muted" style="font-size:12.5px">Theme: System (light) — 13 colored themes are a Membership feature in the original; dark mode pending (feature matrix F-025).</p>
        </template>

        <template v-else-if="tab === 'account'">
          <div class="jr-avatar guest" style="margin-bottom:12px">U</div>
          <p><b>Local journal</b> — not signed in.</p>
          <p class="jr-muted" style="font-size:13px">Journey account sign-in, Google Drive and Journey Cloud Sync require server adapters (feature matrix F-021/F-022). The original's account model is recorded in evidence/derived/contracts.json.</p>
        </template>

        <template v-else-if="tab === 'security'">
          <p><b>Passcode lock</b> — pending (F-025).</p>
          <p class="jr-muted" style="font-size:13px">Original supports PIN and E2EE key management for cloud accounts. Local entries are stored only in this browser's IndexedDB.</p>
        </template>

        <template v-else-if="tab === 'data'">
          <div class="jr-data-row">
            <button class="jr-btn" @click="exportJson"><JrIcon :path="mdiDownload" :size="17" /> Export backup (JSON)</button>
            <button class="jr-btn" :disabled="busy === 'importing'" @click="importJson"><JrIcon :path="mdiUpload" :size="17" /> {{ busy === 'importing' ? 'Importing…' : 'Import' }}</button>
          </div>
          <p v-if="importMsg" class="jr-import-msg">{{ importMsg }}</p>
          <div class="jr-set-label" style="margin-top:18px">Trash</div>
          <div v-if="!trash.length" class="jr-muted" style="font-size:13px">Trash is empty.</div>
          <div v-for="t in trash" :key="t.id" class="jr-trash-row">
            <span class="jr-muted">{{ t.snapshot?.previewText?.slice(0, 48) || '(entry)' }}</span>
            <button class="jr-btn jr-btn-sm" @click="restore(t)"><JrIcon :path="mdiDeleteRestore" :size="15" /> Restore</button>
          </div>
          <div class="jr-set-label" style="margin-top:18px">Danger zone</div>
          <button class="jr-btn jr-danger" @click="wipeAll">Delete all local entries</button>
        </template>

        <template v-else-if="tab === 'help'">
          <p class="jr-muted" style="font-size:13.5px; line-height:1.8">
            This is an independent replica for study. Original help: support.journey.cloud<br />
            Evidence and feature matrix: C:/Users/25641/Desktop/journey-replica/docs/
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
