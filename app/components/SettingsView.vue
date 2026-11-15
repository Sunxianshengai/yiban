<script setup lang="ts">
defineEmits<{ (e: 'close'): void }>()
const props = defineProps<{ openFamily?: boolean }>()
import { desktopBridge } from '~/utils/desktopBridge'
import { errorText } from '~/utils/uiText'
import { getAmapJsKey, getAmapSecurity, getAmapWebKey, resetAmapLoader, setAmapCredentials } from '~/utils/amap'
import { getPalConfig, setPalConfig } from '~/utils/palClient'
import { cloudApi } from '~/utils/cloudApi'
import { familyAvatarColor, familyAvatarChar } from '~/utils/familyUi'
import { mdiClose, mdiDownload, mdiUpload, mdiDeleteRestore, mdiCogOutline, mdiShieldKeyOutline, mdiDatabaseOutline, mdiHelpCircleOutline, mdiPalette, mdiRuler, mdiMapMarkerOutline, mdiTranslate, mdiSpellcheck, mdiLockOutline, mdiChevronRight, mdiRobotOutline, mdiAccountMultipleOutline, mdiBellOutline, mdiKeyVariant } from '@mdi/js'
import { getColorThemeSwatches } from '~/composables/useAppearance'
import { disableE2ee, enableE2ee, loadE2eeMetadata, verifyE2eePassphrase, verifyRecoveryKey, type E2eeMetadata } from '~/utils/e2ee'

const tab = ref<'general' | 'security' | 'data' | 'help'>('general')
const isMobile = useIsMobile()
// 主界面右下角桌宠的显隐，与侧栏 / 移动顶栏共用同一份状态（usePetWidget 已负责持久化）
const { visible: petVisible, setVisible: setPetVisible } = usePetWidget()
const openSection = ref<'general' | 'security' | 'help' | null>(null)
const mSections = [
  { key: 'general', label: '通用', color: '#f8b26a', icon: mdiCogOutline },
  { key: 'security', label: '安全性', color: '#6ee8dc', icon: mdiLockOutline },
  { key: 'help', label: '帮助', color: '#c46ae8', icon: mdiHelpCircleOutline },
] as const
function toggleSection(key: typeof mSections[number]['key']) {
  openSection.value = openSection.value === key ? null : key
}
const gen = useState<'appearance' | 'unit' | 'location' | 'pal' | 'family' | 'locale' | 'reminder' | 'spellcheck'>('jr.settingsGen', () => 'appearance')
const mobileFamily = ref<HTMLElement[]>()
if (props.openFamily) {
  gen.value = 'family'
  openSection.value = 'general'
  onMounted(() => mobileFamily.value?.[0]?.scrollIntoView({ block: 'start' }))
}
const { weekStart } = useWeekStart()
// bug06 修复：计量单位绑定并持久化（原 select 未绑 v-model，选择即丢）
const { unit } = useUnits()
const { locale, t } = useLocale()
const { config: reminder, permission: reminderPerm, requestPermission: requestReminderPerm, testReminder } = useReminder()
const reminderMsg = ref('')
async function onToggleReminder(enabled: boolean) {
  reminder.value.enabled = enabled
  if (enabled && reminderPerm.value === 'default') {
    const res = await requestReminderPerm()
    reminderMsg.value = res === 'granted' ? '已开启每日写作提醒。' : '未授予浏览器通知权限，请点击测试或检查站点权限。'
  } else {
    reminderMsg.value = enabled ? `已开启，将在每天 ${reminder.value.time} 提醒。` : '已关闭每日提醒。'
  }
}
async function onTestReminder() {
  const sent = await testReminder()
  reminderMsg.value = sent ? '测试通知已发送，请查看系统通知栏。' : '当前浏览器未授予通知权限，无法弹出系统通知。'
}

const tabs = computed(() => [
  { key: 'general', label: t('general'), icon: mdiCogOutline },
  { key: 'security', label: t('security'), icon: mdiShieldKeyOutline },
  { key: 'data', label: t('data'), icon: mdiDatabaseOutline },
  { key: 'help', label: t('help'), icon: mdiHelpCircleOutline },
] as const)
const genItems = computed(() => [
  { key: 'appearance', label: t('appearance'), icon: mdiPalette },
  { key: 'unit', label: '计量单位', icon: mdiRuler },
  { key: 'location', label: '地点', icon: mdiMapMarkerOutline },
  { key: 'pal', label: '日记伙伴', icon: mdiRobotOutline },
  { key: 'family', label: t('family'), icon: mdiAccountMultipleOutline },
  { key: 'locale', label: t('locale'), icon: mdiTranslate },
  { key: 'reminder', label: t('reminder'), icon: mdiBellOutline },
  { key: 'spellcheck', label: t('spellcheck'), icon: mdiSpellcheck },
] as const)

// Appearance — Day One / Moleskine 双主题风格 + 13 套主题配色 + 深浅模式
const { theme, fontSize, colorTheme, themeStyle } = useAppearance()
const isDarkTheme = computed(() =>
  theme.value === 'Dark'
  || (theme.value === 'System' && import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches),
)
const colorSwatches = computed(() => getColorThemeSwatches(isDarkTheme.value))
const spellcheck = ref(localStorage.getItem('jr.spellcheck') !== '0')
// 高德 Key：服务平台按 Key 单选绑定，所以「Web服务」和「Web端(JS API)」要分开填两个 Key
// （本仓库没有后端，密钥存在本机 localStorage；换密钥后强制重新加载 JS API）
const amapWebKey = ref(getAmapWebKey())
const amapJsKey = ref(getAmapJsKey())
const amapSecurity = ref(getAmapSecurity())
const amapSaved = ref(false)
function saveAmapCredentials() {
  setAmapCredentials(amapWebKey.value, amapJsKey.value, amapSecurity.value)
  resetAmapLoader()
  amapSaved.value = true
  setTimeout(() => { amapSaved.value = false }, 2400)
}
// 日记伙伴 AI 服务：从 /pal 页面挪进设置（用户要求页面直接是对话界面，别让配置表单占门面）
const pal = ref(getPalConfig())
const palSaved = ref(false)
function savePal() {
  setPalConfig(pal.value)
  palSaved.value = true
  setTimeout(() => { palSaved.value = false }, 2400)
}
watchEffect(() => {
  localStorage.setItem('jr.spellcheck', spellcheck.value ? '1' : '0')
})

// 家庭组（附加功能）：创建/加入/成员管理。家人内容是在线特性，由 useFamilySync 负责拉取。
const { state: familyState, refreshFamily } = useFamilySync()
const famName = ref('我的家庭')
const famNickname = ref('')
const famCode = ref('')
const famNickDraft = ref('')
const famBusy = ref(false)
const famMsg = ref('')
watch(() => familyState.value.me?.nickname, (n) => { famNickDraft.value = n || '' }, { immediate: true })

async function familyCreate() {
  if (famBusy.value) return
  famBusy.value = true
  famMsg.value = ''
  try {
    await cloudApi.familyCreateGroup({ name: famName.value.trim() || '我的家庭', nickname: famNickname.value.trim() })
    await refreshFamily()
    famMsg.value = '家庭组已创建，把邀请码发给家人即可加入。'
  } catch (error) {
    famMsg.value = errorText(error, '创建失败，请重试。')
  } finally { famBusy.value = false }
}

async function familyJoin() {
  if (famBusy.value) return
  famBusy.value = true
  famMsg.value = ''
  try {
    await cloudApi.familyJoin({ code: famCode.value.trim().toUpperCase(), nickname: famNickname.value.trim() })
    await refreshFamily()
    famMsg.value = '已加入家庭组！'
  } catch (error) {
    famMsg.value = errorText(error, '加入失败，请核对邀请码。')
  } finally { famBusy.value = false }
}

async function familyRename() {
  const nickname = famNickDraft.value.trim()
  if (!nickname) return
  try {
    await cloudApi.familySetNickname(nickname)
    await refreshFamily()
    famMsg.value = '昵称已更新。'
  } catch (error) { famMsg.value = errorText(error, '更新失败，请重试。') }
}

async function familyLeave() {
  if (!window.confirm('退出家庭组后，家人将看不到你共享的日记（日记本身保留）。确定退出？')) return
  try {
    await cloudApi.familyLeave()
    await refreshFamily()
    famMsg.value = '已退出家庭组。'
  } catch (error) { famMsg.value = errorText(error, '退出失败，请重试。') }
}

async function copyInvite() {
  const code = familyState.value.group?.inviteCode || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    famMsg.value = '邀请码已复制。'
  } catch { famMsg.value = code }
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

// Security — E2EE 密钥管理（Web Crypto PBKDF2 + AES-GCM 256）
const e2eeMeta = ref<E2eeMetadata | null>(loadE2eeMetadata())
const e2eePassphrase = ref('')
const e2eeRecovery = ref('')
const e2eeVerifyInput = ref('')
const e2eeMsg = ref('')
async function onEnableE2ee() {
  if (e2eePassphrase.value.trim().length < 6) {
    e2eeMsg.value = '加密口令至少需要 6 位字符。'
    return
  }
  try {
    const { meta, recoveryKey } = await enableE2ee(e2eePassphrase.value.trim())
    e2eeMeta.value = meta
    e2eeRecovery.value = recoveryKey
    e2eePassphrase.value = ''
    e2eeMsg.value = `已生成 256 位 E2EE 密钥（指纹 ${meta.fingerprint}），请妥善保存下方恢复密钥。`
  } catch {
    e2eeMsg.value = '密钥生成失败，请重试。'
  }
}
async function onVerifyE2ee() {
  const input = e2eeVerifyInput.value.trim()
  if (!input) return
  const ok = (await verifyE2eePassphrase(input)) || (await verifyRecoveryKey(input))
  e2eeMsg.value = ok ? '验证通过：密钥有效，AES-GCM 加解密自检正常。' : '口令或恢复密钥不匹配。'
}
async function copyRecoveryKey() {
  if (!e2eeRecovery.value) return
  try {
    await navigator.clipboard.writeText(e2eeRecovery.value)
    e2eeMsg.value = '恢复密钥已复制到剪贴板。'
  } catch {
    e2eeMsg.value = e2eeRecovery.value
  }
}
function onDisableE2ee() {
  if (!window.confirm('确定清除本机 E2EE 密钥配置吗？')) return
  disableE2ee()
  e2eeMeta.value = null
  e2eeRecovery.value = ''
  e2eeMsg.value = '已清除 E2EE 密钥配置。'
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
  <!-- 移动设置中枢（证据 s05-s12：彩色图标行手风琴） -->
  <div v-if="isMobile" class="jr-mset">
    <button class="mx" aria-label="关闭设置" @click="$emit('close')"><JrIcon :path="mdiClose" :size="24" /></button>
    <h1 class="mtitle">设置</h1>
    <template v-for="s in mSections" :key="s.key">
      <button type="button" class="mrow-i" :aria-expanded="openSection === s.key" @click="toggleSection(s.key)">
        <span class="mico" :style="{ background: s.color }"><JrIcon :path="s.icon" :size="22" /></span>
        <span class="mlabel">{{ s.label }}</span>
        <JrIcon :path="mdiChevronRight" :size="20" class="mchev" :class="{ open: openSection === s.key }" />
      </button>


      <div v-if="s.key === 'general' && openSection === 'general'" class="mexpand">
        <div class="mset-row">
          <span>界面风格</span>
          <select v-model="themeStyle" class="mselect">
            <option value="dayone">Day One 现代极简</option>
            <option value="moleskine">Moleskine 温暖手账</option>
          </select>
        </div>
        <div class="mset-row"><span>显示模式</span><select v-model="theme" class="mselect"><option value="System">跟随系统</option><option value="Light">浅色</option><option value="Dark">深色</option></select></div>
        <div class="mset-row col">
          <span>主题配色（默认 + 13 套）</span>
          <div class="jr-swatch-grid">
            <button
              v-for="sw in colorSwatches"
              :key="sw.index"
              type="button"
              class="jr-swatch-btn"
              :class="{ on: colorTheme === sw.index }"
              :title="sw.name"
              @click="colorTheme = sw.index"
            >
              <span class="jr-swatch-dot" :style="{ background: sw.primary, boxShadow: `inset 0 0 0 3px ${sw.container}` }" />
              <span class="jr-swatch-name">{{ sw.name }}</span>
            </button>
          </div>
        </div>
        <div class="mset-row"><span>语言</span><select v-model="locale" class="mselect" aria-label="语言"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select></div>
        <div class="mset-row"><span>每日写作提醒</span><input type="checkbox" :checked="reminder.enabled" @change="onToggleReminder(($event.target as HTMLInputElement).checked)" /></div>
        <div v-if="reminder.enabled" class="mset-row"><span>提醒时间</span><input v-model="reminder.time" type="time" class="mselect" /></div>
        <p v-if="reminderMsg" class="mnote" role="status">{{ reminderMsg }}</p>
        <div class="mset-row"><span>字号</span><select v-model="fontSize" class="mselect"><option value="Small">小</option><option value="Medium">中</option><option value="Large">大</option></select></div>
        <div class="mset-row"><span>计量单位</span><select v-model="unit" class="mselect" aria-label="计量单位"><option value="metric">公制</option><option value="imperial">英制</option></select></div>
        <div class="mset-row"><span>每周起始日</span><select v-model="weekStart" class="mselect"><option value="default">默认</option><option value="monday">星期一</option><option value="sunday">星期日</option></select></div>
        <label class="mset-row col"><span>Web 服务 Key</span><input v-model="amapWebKey" class="minput" placeholder="服务平台选「Web服务」的 Key" spellcheck="false" /></label>
        <label class="mset-row col"><span>Web端(JS API) Key</span><input v-model="amapJsKey" class="minput" placeholder="服务平台选「Web端(JS API)」的 Key" spellcheck="false" /></label>
        <label class="mset-row col"><span>安全密钥</span><input v-model="amapSecurity" class="minput" placeholder="securityJsCode（JS API Key 用）" spellcheck="false" /></label>
        <p class="mnote">高德一个 Key 只能选一种服务平台：搜索/天气要「Web服务」，底图要「Web端(JS API)」，两个都填才能全用。</p>
        <div class="mset-row" style="justify-content:flex-end;gap:8px">
          <span v-if="amapSaved" class="mnote" role="status">已保存</span>
          <button class="mbtn" @click="saveAmapCredentials">保存密钥</button>
        </div>
        <p class="mnote" style="margin-top:10px">日记伙伴 AI 服务（兼容 OpenAI 接口，密钥仅保存在本机）</p>
        <label class="mset-row col"><span>服务地址</span><input v-model="pal.endpoint" class="minput" placeholder="https://api.openai.com/v1" spellcheck="false" /></label>
        <label class="mset-row col"><span>接口密钥</span><input v-model="pal.apiKey" type="password" class="minput" placeholder="仅保存在本机" spellcheck="false" /></label>
        <label class="mset-row col"><span>对话模型</span><input v-model="pal.model" class="minput" placeholder="gpt-4o-mini" spellcheck="false" /></label>
        <label class="mset-row col"><span>语音转写模型</span><input v-model="pal.sttModel" class="minput" placeholder="whisper-1" spellcheck="false" /></label>
        <div class="mset-row" style="justify-content:flex-end;gap:8px">
          <span v-if="palSaved" class="mnote" role="status">已保存</span>
          <button class="mbtn" @click="savePal">保存日记伙伴服务</button>
        </div>
        <p ref="mobileFamily" class="mnote" style="margin-top:14px"><JrIcon :path="mdiAccountMultipleOutline" :size="14" style="vertical-align:-2px" /> 家庭组：把日记共享给家人，一起评论</p>
        <template v-if="familyState.group">
          <div class="mset-row"><span>家庭组</span><span class="mv">{{ familyState.group.name }}</span></div>
          <div class="mset-row">
            <span>邀请码</span>
            <span class="mv" style="display:flex;gap:8px;align-items:center">
              <b style="letter-spacing:3px">{{ familyState.group.inviteCode }}</b>
              <button class="mbtn" style="flex:none;padding:6px 14px" @click="copyInvite">复制</button>
            </span>
          </div>
          <div v-for="m in (familyState.members || [])" :key="m.userId" class="mset-row">
            <span style="display:flex;align-items:center;gap:8px">
              <span class="jr-family-avatar" :style="{ background: familyAvatarColor(m.userId) }">{{ familyAvatarChar(m.nickname) }}</span>
              {{ m.nickname }}<span v-if="m.role === 'owner'" class="mv">（组主）</span><span v-else-if="m.userId === familyState.me?.userId" class="mv">（我）</span>
            </span>
          </div>
          <label class="mset-row col"><span>我的昵称</span><input v-model="famNickDraft" class="minput" maxlength="12" spellcheck="false" /></label>
          <div class="mbtns">
            <button class="mbtn" @click="familyRename">保存昵称</button>
            <button class="mbtn" style="background:var(--jr-error,#e05a4e)" @click="familyLeave">退出家庭组</button>
          </div>
        </template>
        <template v-else>
          <label class="mset-row col"><span>创建家庭组 · 名称</span><input v-model="famName" class="minput" maxlength="30" spellcheck="false" /></label>
          <label class="mset-row col"><span>或用邀请码加入</span><input v-model="famCode" class="minput" placeholder="6 位邀请码" maxlength="10" spellcheck="false" style="text-transform:uppercase" /></label>
          <label class="mset-row col"><span>我的昵称</span><input v-model="famNickname" class="minput" maxlength="12" spellcheck="false" /></label>
          <div class="mbtns">
            <button class="mbtn" :disabled="famBusy" @click="familyCreate">创建</button>
            <button class="mbtn" :disabled="famBusy" @click="familyJoin">加入</button>
          </div>
        </template>
        <p v-if="famMsg" class="mnote" role="status">{{ famMsg }}</p>
        <label class="mset-row"><span>写作时检查拼写</span><input v-model="spellcheck" type="checkbox" /></label>
        <label class="mset-row">
          <span>在网页里显示桌宠</span>
          <input
            :checked="petVisible"
            type="checkbox"
            data-testid="pet-toggle-settings"
            @change="setPetVisible(($event.target as HTMLInputElement).checked)"
          />
        </label>
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
        <div class="mset-row" style="margin-top:8px"><span>端到端加密 (E2EE)</span><span class="mv">{{ e2eeMeta?.enabled ? `已启用 (${e2eeMeta.fingerprint})` : '未启用' }}</span></div>
        <template v-if="!e2eeMeta?.enabled">
          <label class="mset-row col"><span>设置加密口令（至少 6 位）</span><input v-model="e2eePassphrase" type="password" class="minput" placeholder="用于派生 AES-256 密钥" /></label>
          <div class="mbtns"><button class="mbtn" @click="onEnableE2ee">生成 E2EE 密钥</button></div>
        </template>
        <template v-else>
          <div v-if="e2eeRecovery" class="jr-e2ee-recovery">{{ e2eeRecovery }}</div>
          <label class="mset-row col"><span>验证口令或恢复密钥</span><input v-model="e2eeVerifyInput" class="minput" placeholder="输入口令或恢复密钥验证" /></label>
          <div class="mbtns">
            <button class="mbtn" @click="onVerifyE2ee">验证密钥</button>
            <button v-if="e2eeRecovery" class="mbtn" @click="copyRecoveryKey">复制恢复密钥</button>
            <button class="mbtn" style="background:var(--jr-error,#e05a4e)" @click="onDisableE2ee">清除密钥</button>
          </div>
        </template>
        <p v-if="e2eeMsg" class="mnote" role="status">{{ e2eeMsg }}</p>
      </div>

      <div v-if="s.key === 'help' && openSection === 'help'" class="mexpand">
        <div class="mset-row"><span>版本</span><span class="mv">旅程复刻 Web（本地）</span></div>
        <p class="mnote">可在导航抽屉中打开云服务，登录并开启日记同步。</p>
      </div>
    </template>
    <div style="height:32px" />
  </div>

  <div v-else class="jr-modal-mask" @click.self="$emit('close')">
    <div class="jr-modal">
      <button class="jr-modal-x" aria-label="关闭设置" @click="$emit('close')"><JrIcon :path="mdiClose" :size="16" /></button>
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
            class="jr-gen-item" :class="{ on: gen === g.key }"
            @click="gen = g.key"
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

            <div class="jr-set-section-title">界面视觉风格</div>
            <div class="jr-theme-style-cards">
              <button
                type="button"
                class="jr-theme-card"
                :class="{ on: themeStyle === 'dayone' }"
                @click="themeStyle = 'dayone'"
              >
                <div class="jr-theme-preview dayone">
                  <div class="bar"></div>
                  <div class="content"><span class="dot"></span><span class="line"></span></div>
                </div>
                <div class="jr-theme-meta">
                  <div class="name">Day One 现代极简</div>
                  <div class="desc">清爽天蓝 · 极简单线 · 现代通透</div>
                </div>
              </button>

              <button
                type="button"
                class="jr-theme-card"
                :class="{ on: themeStyle === 'moleskine' }"
                @click="themeStyle = 'moleskine'"
              >
                <div class="jr-theme-preview moleskine">
                  <div class="bar"></div>
                  <div class="content"><span class="dot"></span><span class="line"></span></div>
                </div>
                <div class="jr-theme-meta">
                  <div class="name">Moleskine 温暖手账</div>
                  <div class="desc">暖白纸本 · 琥珀金色 · 拍立得相框质感</div>
                </div>
              </button>
            </div>

            <div class="jr-set-row" style="margin-top:14px">
              <span class="jr-set-cap">显示模式</span>
              <select v-model="theme" class="jr-set-select" aria-label="主题">
                <option value="System">跟随系统</option>
                <option value="Light">浅色模式</option>
                <option value="Dark">深色 / 暗黑模式</option>
              </select>
            </div>
            <div class="jr-set-section-title" style="margin-top:14px">主题配色（默认 + 13 套经典主题）</div>
            <div class="jr-swatch-grid">
              <button
                v-for="sw in colorSwatches"
                :key="sw.index"
                type="button"
                class="jr-swatch-btn"
                :class="{ on: colorTheme === sw.index }"
                :title="sw.name"
                @click="colorTheme = sw.index"
              >
                <span class="jr-swatch-dot" :style="{ background: sw.primary, boxShadow: `inset 0 0 0 3px ${sw.container}` }" />
                <span class="jr-swatch-name">{{ sw.name }}</span>
              </button>
            </div>
            <div class="jr-set-row" style="margin-top:12px">
              <span class="jr-set-cap">正文字号</span>
              <select v-model="fontSize" class="jr-set-select">
                <option value="Small">小</option>
                <option value="Medium">中</option>
                <option value="Large">大</option>
              </select>
            </div>
            <p class="jr-muted" style="font-size:11.5px">风格切换即时生效，设置自动保存在本机。</p>
          </template>

          <template v-else-if="gen === 'unit'">
            <div class="jr-set-row"><span class="jr-set-cap">计量单位</span>
              <select v-model="unit" class="jr-set-select" aria-label="计量单位"><option value="metric">公制</option><option value="imperial">英制</option></select>
            </div>
            <p class="jr-muted" style="font-size:11.5px">天气温度将按所选单位显示（数据仍以摄氏保存）。</p>
          </template>

          <template v-else-if="gen === 'location'">
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">Web 服务 Key（搜索 / 地址解析 / 天气）</span>
              <input v-model="amapWebKey" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="创建 Key 时服务平台选「Web服务」" spellcheck="false" />
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">Web端(JS API) Key（地图底图 / 点聚合）</span>
              <input v-model="amapJsKey" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="创建 Key 时服务平台选「Web端(JS API)」" spellcheck="false" />
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">安全密钥（securityJsCode）</span>
              <input v-model="amapSecurity" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="2021-12-02 之后申请的 JS API Key 需要填写" spellcheck="false" />
            </label>
            <div class="jr-set-row" style="gap:10px">
              <button class="jr-btn" style="width:auto" @click="saveAmapCredentials">保存</button>
              <span v-if="amapSaved" class="jr-muted" role="status">已保存，重新打开地图册即可生效。</span>
            </div>
            <p class="jr-muted" style="font-size:12px;line-height:1.6">
              高德的「服务平台」是按 Key 单选绑定的：一个 Key 只能是「Web服务」或「Web端(JS API)」之一。
              搜索地点、逆地理编码、天气查询走 Web服务；地图册的底图与点聚合走 Web端(JS API)。
              想两边都能用，就在控制台各建一个 Key 分别填进来（同一套账号，配额分开算）。
            </p>
            <p class="jr-muted" style="font-size:12px;line-height:1.6">
              密钥只保存在本机浏览器里（原版存在桌面端 secretKeys，网页版没有后端可代管）。
              只填 Web服务 Key 时，地图册会显示已保存的地点列表；只填 JS API Key 时，地点搜索会提示先配置。
            </p>
            <p class="jr-muted" style="font-size:12px">IP 白名单留空即可（浏览器直连的出口 IP 不固定）。首版以中国大陆为主；海外日记仍可在地点列表里打开。</p>
          </template>

          <template v-else-if="gen === 'pal'">
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">服务地址（兼容 OpenAI 接口）</span>
              <input v-model="pal.endpoint" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="https://api.openai.com/v1" spellcheck="false" />
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">接口密钥</span>
              <input v-model="pal.apiKey" type="password" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="仅保存在本机" spellcheck="false" />
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">对话模型</span>
              <input v-model="pal.model" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="gpt-4o-mini" spellcheck="false" />
            </label>
            <label class="jr-set-row" style="display:block">
              <span class="jr-set-cap">语音转写模型（随手记语音用）</span>
              <input v-model="pal.sttModel" class="jr-pop-input" style="width:320px;margin-top:6px" placeholder="whisper-1" spellcheck="false" />
            </label>
            <div class="jr-set-row" style="gap:10px">
              <button class="jr-btn" style="width:auto" @click="savePal">保存</button>
              <span v-if="palSaved" class="jr-muted" role="status">已保存，回到日记伙伴页即可开聊。</span>
            </div>
            <p class="jr-muted" style="font-size:12px;line-height:1.6">
              密钥只保存在本机浏览器，AI 请求由浏览器直连你填的服务地址，不经过任何中间服务器。
              没有自己的服务时，日记伙伴仍可浏览，发送消息会提示先配置。
            </p>
          </template>

          <template v-else-if="gen === 'family'">
            <template v-if="familyState.group">
              <div class="jr-set-row"><span class="jr-set-cap">家庭组</span><b>{{ familyState.group.name }}</b></div>
              <div class="jr-set-row"><span class="jr-set-cap">邀请码（发给家人）</span>
                <span style="display:flex;gap:8px;align-items:center">
                  <b style="letter-spacing:3px;font-size:16px">{{ familyState.group.inviteCode }}</b>
                  <button class="jr-btn jr-btn-sm" @click="copyInvite">复制</button>
                </span>
              </div>
              <div class="jr-set-label" style="margin-top:14px">成员（{{ (familyState.members || []).length }}）</div>
              <div v-for="m in (familyState.members || [])" :key="m.userId" class="jr-set-row">
                <span class="jr-set-cap" style="display:flex;align-items:center;gap:8px">
                  <span class="jr-family-avatar" :style="{ background: familyAvatarColor(m.userId) }">{{ familyAvatarChar(m.nickname) }}</span>
                  <span>{{ m.nickname }}</span>
                  <span v-if="m.role === 'owner'" class="jr-muted">（组主）</span>
                  <span v-else-if="m.userId === familyState.me?.userId" class="jr-muted">（我）</span>
                </span>
              </div>
              <label class="jr-set-row" style="display:block;margin-top:6px">
                <span class="jr-set-cap">我的昵称（家人看到的名字）</span>
                <span style="display:flex;gap:8px;margin-top:6px">
                  <input v-model="famNickDraft" class="jr-pop-input" style="width:200px" maxlength="12" spellcheck="false" />
                  <button class="jr-btn" style="width:auto" @click="familyRename">保存</button>
                </span>
              </label>
              <div class="jr-set-row" style="margin-top:10px">
                <button class="jr-btn jr-danger" @click="familyLeave">退出家庭组</button>
              </div>
              <p class="jr-muted" style="font-size:12px;line-height:1.6;margin-top:8px">
                在「我们的小家」可以发日记、看家人分享的照片，也能评论或追加段落。你可以随时撤回自己分享的日记。
              </p>
            </template>
            <template v-else>
              <p class="jr-muted" style="font-size:12.5px;line-height:1.7">
                创建家庭组后，可以在「我们的小家」分享日记和照片。每位家人用自己的账号登录后凭邀请码加入。
              </p>
              <div class="jr-set-row" style="display:block;margin-top:10px">
                <span class="jr-set-cap">创建家庭组</span>
                <span style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                  <input v-model="famName" class="jr-pop-input" style="width:180px" placeholder="家庭组名称" maxlength="30" spellcheck="false" />
                  <input v-model="famNickname" class="jr-pop-input" style="width:130px" placeholder="我的昵称" maxlength="12" spellcheck="false" />
                  <button class="jr-btn" style="width:auto" :disabled="famBusy" @click="familyCreate">创建</button>
                </span>
              </div>
              <div class="jr-set-row" style="display:block;margin-top:12px">
                <span class="jr-set-cap">用邀请码加入</span>
                <span style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                  <input v-model="famCode" class="jr-pop-input" style="width:160px;text-transform:uppercase" placeholder="6 位邀请码" maxlength="10" spellcheck="false" />
                  <input v-model="famNickname" class="jr-pop-input" style="width:130px" placeholder="我的昵称" maxlength="12" spellcheck="false" />
                  <button class="jr-btn" style="width:auto" :disabled="famBusy" @click="familyJoin">加入</button>
                </span>
              </div>
            </template>
            <p v-if="famMsg" class="jr-import-msg" role="status">{{ famMsg }}</p>
          </template>

          <template v-else-if="gen === 'locale'">
            <div class="jr-set-row"><span class="jr-set-cap">语言与地区</span>
              <select v-model="locale" class="jr-set-select" aria-label="语言">
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <label class="jr-set-row">
              <span class="jr-set-cap">每周起始日</span>
              <select v-model="weekStart" class="jr-set-select">
                <option value="default">默认</option>
                <option value="monday">星期一</option>
                <option value="sunday">星期日</option>
              </select>
            </label>
            <p class="jr-muted" style="font-size:12px">切换语言后，导航栏与设置界面即时生效并保存至本机。</p>
          </template>

          <template v-else-if="gen === 'reminder'">
            <label class="jr-set-check">
              <input :checked="reminder.enabled" type="checkbox" @change="onToggleReminder(($event.target as HTMLInputElement).checked)" />
              开启每日写日记本地定时提醒
            </label>
            <div class="jr-set-row" style="margin-top:10px">
              <span class="jr-set-cap">提醒时间</span>
              <input v-model="reminder.time" type="time" class="jr-set-select" aria-label="提醒时间" />
            </div>
            <div class="jr-set-row" style="gap:10px">
              <button type="button" class="jr-btn" style="width:auto" @click="onTestReminder">发送测试通知</button>
              <span class="jr-muted" style="font-size:12px">通知权限：{{ reminderPerm === 'granted' ? '已允许' : reminderPerm === 'denied' ? '已拒绝' : reminderPerm === 'unsupported' ? '浏览器不支持' : '未请求' }}</span>
            </div>
            <p v-if="reminderMsg" class="jr-import-msg" role="status">{{ reminderMsg }}</p>
            <p class="jr-muted" style="font-size:12px;margin-top:8px">保持页面打开或后台挂起时，会在每天设定的时间弹出系统写作提醒。</p>
          </template>

          <template v-else-if="gen === 'spellcheck'">
            <label class="jr-set-check">
              <input v-model="spellcheck" type="checkbox" /> 写作时检查拼写
            </label>
            <label class="jr-set-check">
              <input
                :checked="petVisible"
                type="checkbox"
                data-testid="pet-toggle-settings"
                @change="setPetVisible(($event.target as HTMLInputElement).checked)"
              />
              在网页里显示桌宠（小羊会待在右下角，可以拖着走）
            </label>
          </template>

        </div>
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

        <hr style="border:0;border-top:1px solid var(--jr-outline-variant);margin:18px 0" />
        <p><JrIcon :path="mdiKeyVariant" :size="18" /> <b>端到端加密 (E2EE) 密钥管理</b></p>
        <p class="jr-muted" style="font-size:12.5px;margin-bottom:10px">
          状态：<b>{{ e2eeMeta?.enabled ? `已启用（指纹 ${e2eeMeta.fingerprint}）` : '未启用' }}</b> · 算法：PBKDF2-SHA256 + AES-GCM-256
        </p>
        <template v-if="!e2eeMeta?.enabled">
          <div class="jr-pop-row" style="max-width:340px">
            <input v-model="e2eePassphrase" type="password" placeholder="输入主加密口令（至少 6 位）" class="jr-pop-input" />
          </div>
          <div class="jr-data-row" style="margin-top:8px">
            <button type="button" class="jr-btn" @click="onEnableE2ee">生成密钥与恢复码</button>
          </div>
        </template>
        <template v-else>
          <div v-if="e2eeRecovery" class="jr-e2ee-recovery">
            <span>恢复密钥（请离线保存）：</span>
            <code>{{ e2eeRecovery }}</code>
          </div>
          <div class="jr-pop-row" style="max-width:360px;margin-top:8px">
            <input v-model="e2eeVerifyInput" placeholder="输入加密口令或恢复密钥以自检" class="jr-pop-input" />
          </div>
          <div class="jr-data-row" style="margin-top:8px">
            <button type="button" class="jr-btn" @click="onVerifyE2ee">自检加解密</button>
            <button v-if="e2eeRecovery" type="button" class="jr-btn" @click="copyRecoveryKey">复制恢复密钥</button>
            <button type="button" class="jr-btn jr-danger" @click="onDisableE2ee">清除密钥</button>
          </div>
        </template>
        <p v-if="e2eeMsg" class="jr-import-msg" role="status">{{ e2eeMsg }}</p>
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
/* 移动设置中枢（证据 s05：彩色图标行） */
.jr-mset { position: fixed; inset: 0; z-index: 250; background: var(--jr-bg); overflow-y: auto; padding: 0 20px 24px; }
.jr-mset .mx { margin: 14px 0 0 -8px; background: none; border: 0; color: var(--jr-on-bg); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.jr-mset .mtitle { font-size: 34px; font-weight: 800; margin: 18px 0 20px; }
.mrow-i { display: flex; align-items: center; gap: 16px; width: 100%; padding: 14px 0; background: none; border: 0; color: var(--jr-on-bg); font-family: inherit; font-size: 16px; font-weight: 600; text-decoration: none; text-align: left; cursor: pointer; }
.mico { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #263238; flex-shrink: 0; }
.mlabel { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mchev { color: var(--jr-outline); transition: transform .2s ease; }
.mchev.open { transform: rotate(90deg); }
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
.mcircles { display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 0; }
.mcircle { width: 32px; height: 32px; border-radius: 50%; border: 0; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; }
.mcircle.on { outline: 3px solid var(--jr-primary); outline-offset: 2px; }
/* 深色主题 */
[data-theme="dark"] .mselect { background: #2b3236; color: var(--jr-on-bg); }
[data-theme="dark"] .minput { background: #2b3236; color: var(--jr-on-bg); border-color: var(--jr-outline-variant); }
[data-theme="dark"] .mset-row { border-bottom-color: #394247; }

/* 界面风格选择卡片 */
.jr-set-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--jr-on-bg);
  margin: 18px 0 10px;
}
.jr-theme-style-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.jr-theme-card {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border-radius: 12px;
  border: 2px solid var(--jr-outline-variant);
  background: var(--jr-surface);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}
.jr-theme-card:hover {
  border-color: var(--jr-outline);
}
.jr-theme-card.on {
  border-color: var(--jr-primary);
  background: var(--jr-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.jr-theme-preview {
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.jr-theme-preview.dayone {
  background: #FFFFFF;
}
.jr-theme-preview.dayone .bar {
  height: 12px;
  background: #E4F6FF;
  border-bottom: 2px solid #44C0FF;
}
.jr-theme-preview.dayone .content {
  flex: 1;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.jr-theme-preview.dayone .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #44C0FF;
}
.jr-theme-preview.dayone .line {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: #E8ECEF;
}

.jr-theme-preview.moleskine {
  background: #FAF7F2;
}
.jr-theme-preview.moleskine .bar {
  height: 12px;
  background: #FEF3C7;
  border-bottom: 2px solid #D97706;
}
.jr-theme-preview.moleskine .content {
  flex: 1;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.jr-theme-preview.moleskine .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D97706;
}
.jr-theme-preview.moleskine .line {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: #E8E1D5;
}

.jr-theme-meta .name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--jr-on-bg);
}
.jr-theme-meta .desc {
  font-size: 11px;
  color: var(--jr-on-surface-variant);
  margin-top: 2px;
  line-height: 1.4;
}
[data-theme="dark"] .jr-theme-preview.dayone {
  background: #111314;
}
[data-theme="dark"] .jr-theme-preview.dayone .bar {
  background: #202324;
  border-bottom-color: #44C0FF;
}
[data-theme="dark"] .jr-theme-preview.dayone .line {
  background: #313435;
}
[data-theme="dark"] .jr-theme-preview.moleskine {
  background: #1A1715;
}
[data-theme="dark"] .jr-theme-preview.moleskine .bar {
  background: #2D2723;
  border-bottom-color: #F59E0B;
}
[data-theme="dark"] .jr-theme-preview.moleskine .line {
  background: #38302A;
}
.jr-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.jr-swatch-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 9px;
  border: 1.5px solid var(--jr-outline-variant);
  background: var(--jr-surface);
  color: var(--jr-on-bg);
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
}
.jr-swatch-btn.on {
  border-color: var(--jr-primary);
  background: color-mix(in srgb, var(--jr-primary-container) 35%, var(--jr-surface));
  font-weight: 600;
}
.jr-swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}
.jr-swatch-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jr-e2ee-recovery {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--jr-surface-variant);
  font-size: 12.5px;
  word-break: break-all;
}
.jr-e2ee-recovery code {
  display: block;
  margin-top: 4px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
</style>
