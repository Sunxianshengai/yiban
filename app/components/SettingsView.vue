<script setup lang="ts">
defineEmits<{ (e: 'close'): void }>()
import { desktopBridge } from '~/utils/desktopBridge'
import { errorText } from '~/utils/uiText'
import { JR_THEMES, THEME_IDS } from '~/utils/themesRegistry'
import { mdiClose, mdiDownload, mdiUpload, mdiDeleteRestore, mdiCogOutline, mdiAccountOutline, mdiShieldKeyOutline, mdiDatabaseOutline, mdiHelpCircleOutline, mdiPalette, mdiRuler, mdiMapMarkerOutline, mdiTranslate, mdiSpellcheck, mdiPuzzleOutline, mdiLockOutline, mdiChevronRight, mdiChevronLeft, mdiAlertOutline, mdiCloudOutline, mdiApps, mdiBookmarkOutline, mdiBellOutline } from '@mdi/js'

const tab = ref<'general' | 'account' | 'security' | 'data' | 'help'>('general')
const isMobile = useIsMobile()
// 移动设置中枢(证据 s05-s12):彩色图标行手风琴;怀旧开关是真实功能(控制首页怀旧卡)
const openSection = ref<'general' | 'security' | 'help' | null>(null)
const throwback = ref(localStorage.getItem('jr.throwback') !== '0')
watch(throwback, (v) => localStorage.setItem('jr.throwback', v ? '1' : '0'))
const mSections = [
  { key: 'general', label: '通用', color: '#f8b26a', expandable: true },
  { key: 'cloud', label: '帐户、数据与云端服务', color: '#f2e04c', expandable: false, to: '/cloud' },
  { key: 'stories', label: '故事', color: '#d6e356', expandable: false, toggle: true },
  { key: 'publish', label: '发布', color: '#7fe07f', expandable: false, locked: true },
  { key: 'notifications', label: '通知&提醒', color: '#7fc4e8', expandable: false, locked: true },
  { key: 'security', label: '安全性', color: '#6ee8dc', expandable: true },
  { key: 'help', label: '帮助', color: '#c46ae8', expandable: true },
] as const
function toggleSection(key: typeof mSections[number]['key']) {
  if (key !== 'general' && key !== 'security' && key !== 'help') return
  openSection.value = openSection.value === key ? null : key
}
const mIcons = { general: mdiCogOutline, cloud: mdiCloudOutline, stories: mdiApps, publish: mdiBookmarkOutline, notifications: mdiBellOutline, security: mdiLockOutline, help: mdiHelpCircleOutline } as const
const lockedNote = ref('')
const gen = ref<'appearance' | 'unit' | 'location' | 'locale' | 'spellcheck' | 'plugins'>('appearance')
const { weekStart } = useWeekStart()
// bug06 修复：计量单位绑定并持久化（原 select 未绑 v-model，选择即丢）
const { unit } = useUnits()
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
const circles = THEME_IDS.map((id) => JR_THEMES[id].colors.primaryContainer || JR_THEMES[id].colors.primary) // 原版色环显示浅容器色（page-settings.png 实测）
const circleLocked = (i: number) => i > 0 // evidence: only the first (teal) circle is unlocked on Free
// 原版色环分页：每页 7 圆 + 翻页箭头（page-settings.png 实测），13 主题分 2 页
const circlePageIndex = ref(0)
const CIRCLE_PAGE_SIZE = 7
const circlePageBase = computed(() => circlePageIndex.value * CIRCLE_PAGE_SIZE)
const circlePage = computed(() => circles.slice(circlePageBase.value, circlePageBase.value + CIRCLE_PAGE_SIZE))
const circleNote = ref('')
function pickCircle(i: number) {
  if (circleLocked(i)) { circleNote.value = '彩色主题属于会员权益。免费版可使用系统主题。'; return }
  colorTheme.value = 0
  circleNote.value = ''
}

// Security — PIN lock (real, local)
const pinHash = ref(localStorage.getItem('jr.pinHash') || '')
const pinInput = ref('')
const pinMsg = ref('')
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function setPin() {
  if (!/^\d{4,8}$/.test(pinInput.value)) { pinMsg.value = '密码必须是 4 至 8 位数字。'; return }
  pinHash.value = await sha256(pinInput.value)
  localStorage.setItem('jr.pinHash', pinHash.value)
  pinInput.value = ''
  pinMsg.value = '密码已设置。下次打开新会话时需要解锁。'
}
async function removePin() {
  if (await sha256(pinInput.value) !== pinHash.value) { pinMsg.value = '密码不正确。'; return }
  localStorage.removeItem('jr.pinHash')
  pinHash.value = ''
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
  <!-- 移动设置中枢（证据 s05-s12：✕+大标题+登录卡+彩色图标行手风琴） -->
  <div v-if="isMobile" class="jr-mset">
    <button class="mx" aria-label="关闭设置" @click="$emit('close')"><JrIcon :path="mdiClose" :size="24" /></button>
    <h1 class="mtitle">设置</h1>
    <NuxtLink to="/cloud" class="mlogin">
      <JrIcon :path="mdiAlertOutline" :size="24" class="mlogin-ico" />
      <span class="mlogin-txt"><b>本地模式</b>所有日记保存在此设备。链接云端服务请查看云服务页。</span>
    </NuxtLink>

    <template v-for="s in mSections" :key="s.key">
      <NuxtLink v-if="s.to" :to="s.to" class="mrow-i">
        <span class="mico" :style="{ background: s.color }"><JrIcon :path="mIcons[s.key]" :size="22" /></span>
        <span class="mlabel">{{ s.label }}</span>
        <JrIcon :path="mdiChevronRight" :size="20" class="mchev" />
      </NuxtLink>

      <div v-else-if="s.toggle" class="mrow-i" role="switch" :aria-checked="throwback" tabindex="0" @click="throwback = !throwback" @keydown.enter="throwback = !throwback">
        <span class="mico" :style="{ background: s.color }"><JrIcon :path="mIcons[s.key]" :size="22" /></span>
        <span class="mlabel">故事<small>怀旧</small></span>
        <span class="mtoggle" :class="{ on: throwback }" />
      </div>

      <div v-else-if="s.locked" class="mrow-i locked" role="button" tabindex="0" @click="lockedNote = lockedNote === s.key ? '' : s.key" @keydown.enter="lockedNote = lockedNote === s.key ? '' : s.key">
        <span class="mico" :style="{ background: s.color }"><JrIcon :path="mIcons[s.key]" :size="22" /></span>
        <span class="mlabel">{{ s.label }}<small>{{ s.key === 'publish' ? '需要 Journey 云端账户' : '网页复刻暂未实现提醒' }}</small></span>
        <JrIcon :path="mdiLockOutline" :size="18" class="mchev" />
      </div>

      <button v-else class="mrow-i" :aria-expanded="openSection === s.key" @click="toggleSection(s.key)">
        <span class="mico" :style="{ background: s.color }"><JrIcon :path="mIcons[s.key]" :size="22" /></span>
        <span class="mlabel">{{ s.label }}</span>
        <JrIcon :path="mdiChevronRight" :size="20" class="mchev" :class="{ open: openSection === s.key }" />
      </button>

      <p v-if="s.locked && lockedNote === s.key" class="mnote" role="status">原版此项为 Journey 云端账户功能；复刻以本地模式运行，此功能不提供（诚实边界）。</p>

      <div v-if="s.key === 'general' && openSection === 'general'" class="mexpand">
        <div class="mset-row"><span>主题</span><select v-model="theme" class="mselect"><option value="System">跟随系统</option><option value="Light">浅色</option><option value="Dark">深色</option></select></div>
        <div class="mset-row"><span>字体</span><select v-model="fontFamily" class="mselect"><option value="Gotham Rounded">圆体</option><option value="Verlag">无衬线体</option><option value="Lexend">易读字体</option><option value="OpenDyslexic">阅读辅助字体</option></select></div>
        <div class="mset-row"><span>字号</span><select v-model="fontSize" class="mselect"><option value="Small">小</option><option value="Medium">中</option><option value="Large">大</option></select></div>
        <div class="mset-row"><span>计量单位</span><select v-model="unit" class="mselect" aria-label="计量单位"><option value="metric">公制</option><option value="imperial">英制</option></select></div>
        <div class="mset-row"><span>每周起始日</span><select v-model="weekStart" class="mselect"><option value="default">默认</option><option value="monday">星期一</option><option value="sunday">星期日</option></select></div>
        <label class="mset-row col"><span>MapTiler 密钥（地图底图）</span><input v-model="mapTilerKey" class="minput" placeholder="粘贴你自己的 MapTiler API 密钥" /></label>
        <label class="mset-row"><span>写作时检查拼写</span><input v-model="spellcheck" type="checkbox" /></label>
      </div>

      <div v-if="s.key === 'security' && openSection === 'security'" class="mexpand">
        <div class="mset-row"><span>密码</span><span class="mv">{{ pinHash ? '已设置' : '未设置' }}</span></div>
        <label class="mset-row col"><span>4–8 位数字密码</span><input v-model="pinInput" class="minput" inputmode="numeric" placeholder="仅保存在本机" /></label>
        <div class="mbtns">
          <button class="mbtn" @click="setPin">设置密码</button>
          <button class="mbtn" :disabled="!pinHash" @click="removePin">删除密码</button>
        </div>
        <p v-if="pinMsg" class="mnote" role="status">{{ pinMsg }}</p>
        <div class="mset-row"><span>超时</span><span class="mv">30s</span></div>
      </div>

      <div v-if="s.key === 'help' && openSection === 'help'" class="mexpand">
        <div class="mset-row"><span>版本</span><span class="mv">旅程复刻 Web（本地）</span></div>
        <p class="mnote">数据全部保存在本机浏览器（IndexedDB）。导出备份见云服务页；原版功能对照见 journey-replica 功能矩阵。</p>
      </div>
    </template>
    <div style="height:32px" />
  </div>

  <div v-else class="jr-modal-mask" @click.self="$emit('close')">
    <div class="jr-modal">
      <button class="jr-modal-x" @click="$emit('close')"><JrIcon :path="mdiClose" :size="16" /></button>
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
                v-for="(c, i) in circlePage" :key="c + circlePageBase"
                class="jr-circle" :class="{ 'jr-circle-on': circlePageBase + i === 0 && colorTheme === 0 }" :style="{ background: c }"
                :title="circleLocked(circlePageBase + i) ? '会员主题' : '系统主题（免费）'"
                @click="pickCircle(circlePageBase + i)"
              >
                <JrIcon v-if="circlePageBase + i === 0 && colorTheme === 0" :path="mdiCheck" :size="18" />
                <svg v-else-if="circleLocked(circlePageBase + i)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.55"><path d="M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6 3H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5 5 5 0 0 1 5 5v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2m-6-17a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3z" /></svg>
              </button>
              <button class="jr-circle jr-circle-more" :title="circlePageIndex === 0 ? '更多主题' : '上一页'" @click="circlePageIndex = circlePageIndex === 0 ? 1 : 0">
                <JrIcon :path="circlePageIndex === 0 ? mdiChevronRight : mdiChevronLeft" :size="18" />
              </button>
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
              <select v-model="unit" class="jr-set-select" aria-label="计量单位"><option value="metric">公制</option><option value="imperial">英制</option></select>
            </div>
            <p class="jr-muted" style="font-size:11.5px">天气温度将按所选单位显示（数据仍以摄氏保存）。</p>
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

<style scoped>
/* 移动设置中枢（证据 s05：✕+大标题+登录卡+彩色图标行） */
.jr-mset { position: fixed; inset: 0; z-index: 250; background: var(--jr-bg); overflow-y: auto; padding: 0 20px 24px; }
.jr-mset .mx { margin: 14px 0 0 -8px; background: none; border: 0; color: var(--jr-on-bg); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.jr-mset .mtitle { font-size: 34px; font-weight: 800; margin: 18px 0 20px; }
.mlogin { display: flex; gap: 14px; align-items: flex-start; background: #cfe6ef; border-radius: 14px; padding: 16px; text-decoration: none; color: var(--jr-on-bg); margin-bottom: 14px; }
.mlogin-ico { color: var(--jr-on-surface-variant); flex-shrink: 0; margin-top: 2px; }
.mlogin-txt { font-size: 13.5px; line-height: 1.5; }
.mlogin-txt b { display: block; font-size: 15px; margin-bottom: 2px; }
.mrow-i { display: flex; align-items: center; gap: 16px; width: 100%; padding: 14px 0; background: none; border: 0; color: var(--jr-on-bg); font-family: inherit; font-size: 16px; font-weight: 600; text-decoration: none; text-align: left; cursor: pointer; }
.mrow-i.locked { opacity: 0.75; }
.mico { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #263238; flex-shrink: 0; }
.mlabel { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mlabel small { font-size: 12px; font-weight: 400; color: var(--jr-outline); }
.mchev { color: var(--jr-outline); transition: transform .2s ease; }
.mchev.open { transform: rotate(90deg); }
.mtoggle { width: 52px; height: 30px; border-radius: 999px; background: var(--jr-surface-variant); position: relative; flex-shrink: 0; transition: background .2s ease; }
.mtoggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: left .2s ease; }
.mtoggle.on { background: var(--jr-primary); }
.mtoggle.on::after { left: 25px; }
.mexpand { padding: 4px 0 14px 8px; }
.mset-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; font-size: 14.5px; border-bottom: 1px solid var(--jr-outline-variant); }
.mset-row.col { flex-direction: column; align-items: stretch; border-bottom: 0; }
.mselect { background: var(--jr-surface-variant); border: 0; border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 14px; color: var(--jr-on-bg); }
.minput { border: 1px solid var(--jr-outline-variant); border-radius: 8px; padding: 9px 12px; font-family: inherit; font-size: 14px; background: #fff; color: var(--jr-on-bg); }
.mv { color: var(--jr-on-surface-variant); }
.mbtns { display: flex; gap: 10px; margin: 10px 0; }
.mbtn { flex: 1; background: var(--jr-primary); color: var(--jr-on-primary); border: 0; border-radius: 10px; padding: 11px; font-size: 14px; font-weight: 700; font-family: inherit; }
.mbtn:disabled { opacity: 0.4; }
.mnote { font-size: 12.5px; color: var(--jr-on-surface-variant); margin: 6px 0 0; }
</style>
