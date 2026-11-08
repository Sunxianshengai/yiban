<script setup lang="ts">
import { mdiClose, mdiDownload, mdiUpload, mdiDeleteRestore, mdiCogOutline, mdiAccountOutline, mdiShieldKeyOutline, mdiDatabaseOutline, mdiHelpCircleOutline, mdiPalette, mdiRuler, mdiMapMarkerOutline, mdiTranslate, mdiSpellcheck, mdiPuzzleOutline, mdiLockOutline, mdiChevronRight } from '@mdi/js'

const tab = ref<'general' | 'account' | 'security' | 'data' | 'help'>('general')
const gen = ref<'appearance' | 'unit' | 'location' | 'locale' | 'spellcheck' | 'plugins'>('appearance')
const tabs = [
  { key: 'general', label: 'General', icon: mdiCogOutline },
  { key: 'account', label: 'Account', icon: mdiAccountOutline },
  { key: 'security', label: 'Security', icon: mdiShieldKeyOutline },
  { key: 'data', label: 'Data', icon: mdiDatabaseOutline },
  { key: 'help', label: 'Help', icon: mdiHelpCircleOutline },
] as const
const genItems = [
  { key: 'appearance', label: 'Appearance', icon: mdiPalette },
  { key: 'unit', label: 'Unit system', icon: mdiRuler },
  { key: 'location', label: 'Location', icon: mdiMapMarkerOutline, disabled: true },
  { key: 'locale', label: 'Locale', icon: mdiTranslate },
  { key: 'spellcheck', label: 'Spell Check', icon: mdiSpellcheck },
  { key: 'plugins', label: 'Plugins', icon: mdiPuzzleOutline },
] as const

// Appearance — faithful to page-settings.png: circles (1st free teal, rest locked) + Theme/Font/Size dropdowns + lorem preview
const fontSize = ref(localStorage.getItem('jr.fontSize') || 'Medium')
const fontFamily = ref(localStorage.getItem('jr.fontFamily') || 'Gotham Rounded')
const theme = ref(localStorage.getItem('jr.theme') || 'System')
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
watchEffect(() => {
  localStorage.setItem('jr.fontSize', fontSize.value)
  localStorage.setItem('jr.fontFamily', fontFamily.value)
  localStorage.setItem('jr.theme', theme.value)
  localStorage.setItem('jr.spellcheck', spellcheck.value ? '1' : '0')
  document.documentElement.style.setProperty('--jr-content-size', { Small: '14px', Medium: '16px', Large: '18px' }[fontSize.value] || '16px')
})
const circles = ['#00687B', '#f3c4cd', '#e9c562', '#e2a387', '#d98d76', '#93c993', '#79b77f']
const circleLocked = (i: number) => i > 0 // evidence: only the first (teal) circle is unlocked on Free
const circleNote = ref('')

// Security — PIN lock (real, local)
const pinHash = localStorage.getItem('jr.pinHash') || ''
const pinInput = ref('')
const pinMsg = ref('')
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function setPin() {
  if (!/^\d{4,8}$/.test(pinInput.value)) { pinMsg.value = 'PIN must be 4-8 digits.'; return }
  localStorage.setItem('jr.pinHash', await sha256(pinInput.value))
  pinInput.value = ''
  pinMsg.value = 'PIN set. The journal will ask for it in a new session.'
}
async function removePin() {
  if (await sha256(pinInput.value) !== pinHash) { pinMsg.value = 'Wrong PIN.'; return }
  localStorage.removeItem('jr.pinHash')
  pinInput.value = ''
  pinMsg.value = 'PIN removed.'
}

// Data — export / import / trash
const trash = ref<import('~/utils/db').TrashRow[]>([])
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

/** ZIP backup: entries/*.html + media/* + manifest.json (replica format; original ZIP
 *  layout pending extraction from renderer->main:exportToZip* contracts). */
async function exportZip() {
  const { zipSync, strToU8 } = await import('fflate')
  const { entries, allMedia } = useEntries()
  const list = entries.value
  const files: Record<string, Uint8Array | [Uint8Array, { level: number }]> = {}
  const manifest: any = { format: 'journey-replica-zip', version: 1, exportedAt: new Date().toISOString(), entries: [] }
  for (const e of list) {
    const id = e.id!
    files[`entries/${id}.html`] = strToU8(e.text || '')
    manifest.entries.push({
      id,
      dateOfJournal: new Date(e.dateOfJournal).toISOString(),
      dateModified: new Date(e.dateModified).toISOString(),
      previewText: e.previewText,
      timezone: e.timezone,
      favourite: e.favourite,
      type: e.type,
      address: e.address, lat: e.lat, lng: e.lng,
      weatherIcon: e.weatherIcon, weatherDegreeC: e.weatherDegreeC, weatherPlace: e.weatherPlace,
      sentiment: e.sentiment, activity: e.activity,
      media: [] as string[],
    })
  }
  for (const m of await allMedia()) {
    if (!m.blob) continue
    const p = `media/${m.id}-${m.fileName.replace(/[^\w.-]/g, '_')}`
    files[p] = new Uint8Array(await m.blob.arrayBuffer())
    manifest.entries.find((x: any) => x.id === m.jId)?.media.push(p)
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files as any)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zipped as any], { type: 'application/zip' }))
  a.download = `journey-backup-${new Date().toISOString().slice(0, 10)}.zip`
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

async function restore(t: import('~/utils/db').TrashRow) {
  await useEntries().restoreFromTrash(t.id!)
  await loadTrash()
}

/** Importer: own JSON, Day One JSON, generic entries[] (Journey v1/v2 export shape). */
function importAny() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    busy.value = 'importing'
    try {
      const data = JSON.parse(await file.text())
      const { parseImport } = await import('~/utils/importers')
      const { kind, entries } = parseImport(data)
      const dbi = (await import('~/utils/db')).db
      let n = 0
      for (const r of entries) {
        const now = new Date()
        await dbi.entriesV2.add({
          linkedAccountId: '',
          text: r.text,
          previewText: htmlToPreview(r.text),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          dateOfJournal: r.date,
          dateModified: now,
          synced: 0,
          type: 'journal',
          favourite: r.favourite ? 1 : 0,
          ...computeTokens(r.date),
        })
        n++
      }
      importMsg.value = `Imported ${n} entr${n === 1 ? 'y' : 'ies'} (${kind}). Day One photo attachments and Evernote/Daylio/Apple Journal: pending (matrix).`
      await useEntries().refresh()
    } catch (err) {
      importMsg.value = `Import failed: ${(err as Error).message}`
    }
    busy.value = ''
  }
  input.click()
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

      <!-- General: left sub-nav + content, faithful to page-settings.png -->
      <div v-if="tab === 'general'" class="jr-gen-wrap">
        <div class="jr-gen-nav">
          <button
            v-for="g in genItems" :key="g.key"
            class="jr-gen-item" :class="{ on: gen === g.key, disabled: g.disabled }"
            :disabled="g.disabled"
            @click="!g.disabled && (gen = g.key)"
          >
            <JrIcon :path="g.icon" :size="19" />
            <span>{{ g.label }}</span>
            <JrIcon v-if="gen === g.key" :path="mdiChevronRight" :size="0" />
          </button>
        </div>
        <div class="jr-gen-body">
          <template v-if="gen === 'appearance'">
            <div class="jr-lorem">
              <h3>Septem autem illi non suo</h3>
              <p>Lorem ipsum dolor sit amet, <b>consectetur adipiscing</b> elit. <i>Quo tandem modo?</i> Non laboro, inquit, de nomine. Duo Reges: constructio interrete. Sed ego in hoc resisto.</p>
              <blockquote>Vos autem cum <i>perspiciatis</i> dubia debeatis illustrare, dubiis perspicua conamini tollere.</blockquote>
            </div>
            <div class="jr-circles">
              <button
                v-for="(c, i) in circles" :key="c"
                class="jr-circle" :style="{ background: c }"
                :title="circleLocked(i) ? 'Membership theme' : 'System (free)'"
                @click="circleLocked(i) ? (circleNote = 'Colored themes are a Membership feature in the original (13 themes). Only System is free.') : (circleNote = '')"
              >
                <JrIcon v-if="i === 0" :path="mdiCheck" :size="18" />
                <svg v-else-if="circleLocked(i)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.55"><path d="M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6 3H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5 5 5 0 0 1 5 5v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2m-6-17a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3z" /></svg>
              </button>
              <button class="jr-circle jr-circle-more"><JrIcon :path="mdiChevronRight" :size="18" /></button>
            </div>
            <p v-if="circleNote" class="jr-import-msg">{{ circleNote }}</p>
            <div class="jr-set-row"><span class="jr-set-cap">Theme</span>
              <select v-model="theme" class="jr-set-select"><option>System</option><option>Light</option></select>
            </div>
            <div class="jr-set-row"><span class="jr-set-cap">Font Family</span>
              <select v-model="fontFamily" class="jr-set-select">
                <option>Gotham Rounded</option><option>Verlag</option><option>Lexend</option><option>OpenDyslexic</option>
              </select>
            </div>
            <div class="jr-set-row"><span class="jr-set-cap">Font Size</span>
              <select v-model="fontSize" class="jr-set-select"><option>Small</option><option>Medium</option><option>Large</option></select>
            </div>
            <p class="jr-muted" style="font-size:11.5px">Original bundles commercial Gotham Rounded/Verlag fonts — the replica renders with an open stack (licensing), names preserved here.</p>
          </template>

          <template v-else-if="gen === 'unit'">
            <div class="jr-set-row"><span class="jr-set-cap">Unit system</span>
              <select class="jr-set-select"><option>Metric</option><option>Imperial</option></select>
            </div>
          </template>

          <template v-else-if="gen === 'locale'">
            <div class="jr-set-row"><span class="jr-set-cap">Locale</span>
              <select class="jr-set-select"><option>English</option></select>
            </div>
            <p class="jr-muted" style="font-size:12px">More locales pending (F-025).</p>
          </template>

          <template v-else-if="gen === 'spellcheck'">
            <label class="jr-set-check">
              <input v-model="spellcheck" type="checkbox" /> Spell check while writing
            </label>
          </template>

          <template v-else-if="gen === 'plugins'">
            <p class="jr-muted" style="font-size:13px">Original shows plugin/add-on management here. Registry format not yet extracted (F-034).</p>
          </template>
        </div>
      </div>

      <div v-else-if="tab === 'account'" class="jr-modal-body">
        <div class="jr-avatar guest" style="margin-bottom:12px">U</div>
        <p><b>Local journal</b> — not signed in.</p>
        <p class="jr-muted" style="font-size:13px">Journey account sign-in, Google Drive and Journey Cloud Sync require server adapters (F-021/F-022). The original's account model is recorded in evidence/derived/contracts.json.</p>
      </div>

      <div v-else-if="tab === 'security'" class="jr-modal-body">
        <p><JrIcon :path="mdiLockOutline" :size="18" /> <b>Passcode lock</b></p>
        <div class="jr-pop-row" style="max-width:320px">
          <input v-model="pinInput" type="password" inputmode="numeric" maxlength="8" placeholder="4-8 digit PIN" class="jr-pop-input" />
        </div>
        <div class="jr-data-row" style="margin-top:8px">
          <button v-if="!pinHash" class="jr-btn" @click="setPin">Set PIN</button>
          <button v-else class="jr-btn" @click="removePin">Remove PIN</button>
        </div>
        <p v-if="pinMsg" class="jr-import-msg">{{ pinMsg }}</p>
        <p class="jr-muted" style="font-size:12.5px;margin-top:10px">Locks the journal in a new browser session (sessionStorage unlock). Original supports Windows Hello / E2EE — pending (F-025).</p>
      </div>

      <div v-else-if="tab === 'data'" class="jr-modal-body">
        <div class="jr-data-row">
          <button class="jr-btn" @click="exportZip"><JrIcon :path="mdiDownload" :size="17" /> Export backup (ZIP)</button>
          <button class="jr-btn" @click="exportJson"><JrIcon :path="mdiDownload" :size="17" /> JSON</button>
          <button class="jr-btn" :disabled="busy === 'importing'" @click="importAny"><JrIcon :path="mdiUpload" :size="17" /> {{ busy === 'importing' ? 'Importing…' : 'Import (own/Day One/Journey JSON)' }}</button>
        </div>
        <p v-if="importMsg" class="jr-import-msg">{{ importMsg }}</p>
        <div class="jr-set-label" style="margin-top:18px">Trash</div>
        <div v-if="!trash.length" class="jr-muted" style="font-size:13px">Trash is empty.</div>
        <div v-for="t in trash" :key="t.id" class="jr-trash-row">
          <span class="jr-muted">{{ t.snapshot?.previewText?.slice(0, 48) || '(entry, pre-snapshot)' }}</span>
          <button class="jr-btn jr-btn-sm" :disabled="!t.snapshot" @click="restore(t)"><JrIcon :path="mdiDeleteRestore" :size="15" /> Restore</button>
        </div>
        <div class="jr-set-label" style="margin-top:18px">Danger zone</div>
        <button class="jr-btn jr-danger" @click="wipeAll">Delete all local entries</button>
      </div>

      <div v-else class="jr-modal-body">
        <p class="jr-muted" style="font-size:13.5px; line-height:1.8">
          This is an independent replica for study. Original help: support.journey.cloud<br />
          Evidence and feature matrix: C:/Users/25641/Desktop/journey-replica/docs/
        </p>
      </div>
    </div>
  </div>
</template>
