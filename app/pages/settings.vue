<script setup lang="ts">
import { desktopBridge } from '~/utils/desktopBridge'
import { errorText } from '~/utils/uiText'
import { JR_THEMES, THEME_IDS } from '~/utils/themesRegistry'
import { mdiClose, mdiDownload, mdiUpload, mdiDeleteRestore, mdiCogOutline, mdiAccountOutline, mdiShieldKeyOutline, mdiDatabaseOutline, mdiHelpCircleOutline, mdiPalette, mdiRuler, mdiMapMarkerOutline, mdiTranslate, mdiSpellcheck, mdiPuzzleOutline, mdiLockOutline, mdiChevronRight } from '@mdi/js'

const tab = ref<'general' | 'account' | 'security' | 'data' | 'help'>('general')
const gen = ref<'appearance' | 'unit' | 'location' | 'locale' | 'spellcheck' | 'plugins'>('appearance')
const { weekStart } = useWeekStart()
const tabs = [
  { key: 'general', label: '通用', icon: mdiCogOutline },
  { key: 'account', label: '账号', icon: mdiAccountOutline },
  { key: 'security', label: '安全', icon: mdiShieldKeyOutline },
  { key: 'data', label: '数据', icon: mdiDatabaseOutline },
  { key: 'help', label: '帮助', icon: mdiHelpCircleOutline },
] as const
const genItems = [
  { key: 'appearance', label: '外观', icon: mdiPalette },
  { key: 'unit', label: '计量单位', icon: mdiRuler },
  { key: 'location', label: '地点', icon: mdiMapMarkerOutline, disabled: true },
  { key: 'locale', label: '语言与地区', icon: mdiTranslate },
  { key: 'spellcheck', label: '拼写检查', icon: mdiSpellcheck },
  { key: 'plugins', label: '插件', icon: mdiPuzzleOutline },
] as const

// Appearance — faithful to page-settings.png: circles (1st free teal, rest locked) + Theme/Font/Size dropdowns + lorem preview
const { theme, fontSize, colorTheme } = useAppearance()
const fontFamily = ref(localStorage.getItem('jr.fontFamily') || 'Gotham Rounded')
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
const mapTilerKey = ref(localStorage.getItem('jr.mapTilerKey') || '')
watchEffect(() => {
  localStorage.setItem('jr.fontFamily', fontFamily.value)
  localStorage.setItem('jr.spellcheck', spellcheck.value ? '1' : '0')
  localStorage.setItem('jr.mapTilerKey', mapTilerKey.value)
})
// 14 个圆点 = light0-13 的 primary，逐字来自原版主题注册表（themesRegistry.ts）
const circles = THEME_IDS.map((id) => JR_THEMES[id].colors.primary)
const circleLocked = (i: number) => i > 0 // evidence: only the first (teal) circle is unlocked on Free
const circleNote = ref('')
function pickCircle(i: number) {
  if (circleLocked(i)) { circleNote.value = '彩色主题属于会员权益。免费版可使用系统主题。'; return }
  colorTheme.value = 0
  circleNote.value = ''
}

// Security — PIN lock (real, local)
const pinHash = localStorage.getItem('jr.pinHash') || ''
const pinInput = ref('')
const pinMsg = ref('')
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function setPin() {
  if (!/^\d{4,8}$/.test(pinInput.value)) { pinMsg.value = '密码必须是 4 至 8 位数字。'; return }
  localStorage.setItem('jr.pinHash', await sha256(pinInput.value))
  pinInput.value = ''
  pinMsg.value = '密码已设置。下次打开新会话时需要解锁。'
}
async function removePin() {
  if (await sha256(pinInput.value) !== pinHash) { pinMsg.value = '密码不正确。'; return }
  localStorage.removeItem('jr.pinHash')
  pinInput.value = ''
  pinMsg.value = '密码已移除。'
}

// Data — export / import / trash
const { listTrash, restoreFromTrash } = useEntries()
const trash = ref<import('~/utils/db').TrashRow[]>([])
const busy = ref('')
const importMsg = ref('')
const desktop = desktopBridge()
onMounted(loadTrash)
async function loadTrash() { trash.value = await listTrash() }

async function exportJson() {
  const { db } = await import('~/utils/db')
  const { downloadJournalFile } = await import('~/utils/journalZip')
  const entries = await db.entriesV2.toArray()
  const payload = { format: 'journey-replica-json', version: 1, exportedAt: new Date().toISOString(), entries }
  await downloadJournalFile(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'journey-backup-' + new Date().toISOString().slice(0, 10) + '.json')
}

async function exportZip() {
  if (busy.value) return
  busy.value = 'exporting'
  importMsg.value = ''
  try {
    const { exportJournalZip } = await import('~/utils/journalZip')
    await exportJournalZip()
  } catch (error) {
    importMsg.value = errorText(error, '导出失败，请重试。')
  } finally {
    busy.value = ''
  }
}

async function restore(t: import('~/utils/db').TrashRow) {
  await restoreFromTrash(t.id!)
  await loadTrash()
}

async function importAny(useDesktop = true) {
  if (desktop && useDesktop) {
    if (busy.value) return
    busy.value = 'importing'
    importMsg.value = ''
    try {
      const { importFromDesktop } = await import('~/utils/desktopImport')
      const result = await importFromDesktop()
      if (result) importMsg.value = `已导入 ${result.count} 篇日记。${result.skipped ? ` 有 ${result.skipped} 条导入提示。` : ''}`
    } catch (error) { importMsg.value = errorText(error, '导入失败，请检查文件后重试。') }
    finally { busy.value = '' }
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = desktop ? '.json,.doentry' : '.json,.zip,.csv,.enex,.doentry'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file || busy.value) return
    busy.value = 'importing'
    importMsg.value = ''
    try {
      const { parseImportFile } = await import('~/utils/importers')
      const { importJournalZip, importJournalEntries } = await import('~/utils/journalZip')
      const parsed = await parseImportFile(file)
      const n = parsed ? await importJournalEntries(parsed.entries) : await importJournalZip(file)
      const notice = parsed?.warnings?.length ? ` 有 ${parsed.warnings.length} 条导入提示。${parsed.warnings[0]}` : ''
      importMsg.value = `已导入 ${n} 篇日记。${notice}`
    } catch (error) {
      importMsg.value = errorText(error, '导入失败，请检查文件后重试。')
    } finally {
      busy.value = ''
    }
  }
  input.click()
}

async function wipeAll() {
  if (!confirm('确定删除所有本机日记吗？此操作无法撤销。')) return
  const { db } = await import('~/utils/db')
  await db.transaction('rw', db.entriesV2, db.mediaFilesV2, async () => {
    const ids = await db.entriesV2.toCollection().primaryKeys()
    await db.mediaFilesV2.where('jId').anyOf(ids).delete()
    await db.entriesV2.clear()
  })
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
              <h3>一段值得记下的时光</h3>
              <p>午后的阳光落在书页上。我写下<b>今天的小事</b>，也记下了一句<i>想留给未来的话</i>。</p>
              <blockquote>日常的一句话、一张照片，都可以成为日后想起今天的线索。</blockquote>
            </div>
            <div class="jr-circles">
              <button
                v-for="(c, i) in circles" :key="c"
                class="jr-circle" :class="{ 'jr-circle-on': i === 0 && colorTheme === 0 }" :style="{ background: c }"
                :title="circleLocked(i) ? '会员主题' : '系统主题（免费）'"
                @click="pickCircle(i)"
              >
                <JrIcon v-if="i === 0 && colorTheme === 0" :path="mdiCheck" :size="18" />
                <svg v-else-if="circleLocked(i)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.55"><path d="M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6 3H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5 5 5 0 0 1 5 5v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2m-6-17a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3z" /></svg>
              </button>
              <button class="jr-circle jr-circle-more"><JrIcon :path="mdiChevronRight" :size="18" /></button>
            </div>
            <p v-if="circleNote" class="jr-import-msg">{{ circleNote }}</p>
            <div class="jr-set-row"><span class="jr-set-cap">主题</span>
              <select v-model="theme" class="jr-set-select" aria-label="主题"><option value="System">跟随系统</option><option value="Light">浅色</option><option value="Dark">深色</option></select>
            </div>
            <div class="jr-set-row"><span class="jr-set-cap">字体</span>
              <select v-model="fontFamily" class="jr-set-select">
                <option value="Gotham Rounded">圆体</option><option value="Verlag">无衬线体</option><option value="Lexend">易读字体</option><option value="OpenDyslexic">阅读辅助字体</option>
              </select>
            </div>
            <div class="jr-set-row"><span class="jr-set-cap">字号</span>
              <select v-model="fontSize" class="jr-set-select"><option value="Small">小</option><option value="Medium">中</option><option value="Large">大</option></select>
            </div>
            <p class="jr-muted" style="font-size:11.5px">界面使用系统字体呈现中文。</p>
          </template>

          <template v-else-if="gen === 'unit'">
            <div class="jr-set-row"><span class="jr-set-cap">计量单位</span>
              <select class="jr-set-select"><option>公制</option><option>英制</option></select>
            </div>
          </template>

          <template v-else-if="gen === 'locale'">
            <div class="jr-set-row"><span class="jr-set-cap">语言与地区</span>
              <select class="jr-set-select"><option>简体中文</option></select>
            </div>
            <label class="jr-set-row">
              <span class="jr-set-cap">每周起始日</span>
              <select v-model="weekStart" class="jr-set-select">
                <option value="default">默认</option>
                <option value="monday">星期一</option>
                <option value="sunday">星期日</option>
              </select>
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">MapTiler 密钥（地图底图）</span>
              <input v-model="mapTilerKey" class="jr-pop-input" style="width:240px;margin-top:6px" placeholder="粘贴你自己的 MapTiler API 密钥" />
            </label>
            <p class="jr-muted" style="font-size:12px">原版把密钥存在桌面端 secretKeys 中；填写后地图使用与原版相同的 MapTiler 自定义样式，留空则使用无密钥回退底图。</p>
            <p class="jr-muted" style="font-size:12px">日期和时间按简体中文格式显示。</p>
          </template>

          <template v-else-if="gen === 'spellcheck'">
            <label class="jr-set-check">
              <input v-model="spellcheck" type="checkbox" /> 写作时检查拼写
            </label>
          </template>

          <template v-else-if="gen === 'plugins'">
            <p class="jr-muted" style="font-size:13px">插件管理暂不可用。</p>
          </template>
        </div>
      </div>

      <div v-else-if="tab === 'account'" class="jr-modal-body">
        <div class="jr-avatar guest" style="margin-bottom:12px">用</div>
        <p><b>本机日记</b> · 未登录</p>
        <p class="jr-muted" style="font-size:13px">账号登录和云同步暂未接入。目前可使用本机日记。</p>
      </div>

      <div v-else-if="tab === 'security'" class="jr-modal-body">
        <p><JrIcon :path="mdiLockOutline" :size="18" /> <b>密码锁</b></p>
        <div class="jr-pop-row" style="max-width:320px">
          <input v-model="pinInput" type="password" inputmode="numeric" maxlength="8" placeholder="输入 4 至 8 位数字密码" class="jr-pop-input" />
        </div>
        <div class="jr-data-row" style="margin-top:8px">
          <button v-if="!pinHash" class="jr-btn" @click="setPin">设置密码</button>
          <button v-else class="jr-btn" @click="removePin">移除密码</button>
        </div>
        <p v-if="pinMsg" class="jr-import-msg">{{ pinMsg }}</p>
        <p class="jr-muted" style="font-size:12.5px;margin-top:10px">下次打开新会话时，需要输入密码解锁日记。</p>
      </div>

      <div v-else-if="tab === 'data'" class="jr-modal-body">
        <div class="jr-data-row">
          <button class="jr-btn" :disabled="!!busy" @click="exportZip"><JrIcon :path="mdiDownload" :size="17" /> 导出 ZIP 备份</button>
          <button class="jr-btn" @click="exportJson"><JrIcon :path="mdiDownload" :size="17" /> 导出 JSON</button>
          <button class="jr-btn" :disabled="!!busy" @click="importAny()"><JrIcon :path="mdiUpload" :size="17" /> {{ busy === 'importing' ? '正在导入…' : '导入日记文件' }}</button>
          <button v-if="desktop" class="jr-btn" :disabled="!!busy" @click="importAny(false)">导入 JSON 或经典版日记</button>
        </div>
        <p v-if="importMsg" class="jr-import-msg">{{ importMsg }}</p>
        <div class="jr-set-label" style="margin-top:18px">回收站</div>
        <div v-if="!trash.length" class="jr-muted" style="font-size:13px">回收站为空。</div>
        <div v-for="t in trash" :key="t.id" class="jr-trash-row">
          <span class="jr-muted">{{ t.snapshot?.previewText?.slice(0, 48) || '(entry, pre-snapshot)' }}</span>
          <button class="jr-btn jr-btn-sm" :disabled="!t.snapshot" @click="restore(t)"><JrIcon :path="mdiDeleteRestore" :size="15" /> 恢复</button>
        </div>
        <div class="jr-set-label" style="margin-top:18px">危险操作</div>
        <button class="jr-btn jr-danger" @click="wipeAll">删除所有本机日记</button>
      </div>

      <div v-else class="jr-modal-body">
        <p class="jr-muted" style="font-size:13.5px; line-height:1.8">
          这是用于研究的独立复刻版。原版帮助见旅程帮助中心。<br />
          功能验收结果记录在项目的功能矩阵中。
        </p>
      </div>
    </div>
  </div>
</template>
