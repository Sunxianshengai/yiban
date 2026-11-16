<script setup lang="ts">
import { mdiClose, mdiLaptop, mdiPlusBoxOutline, mdiSync, mdiCloudOutline, mdiLogout, mdiWechat, mdiRefresh, mdiContentCopy } from '@mdi/js'

/**
 * 云服务弹窗：本机日记本 + 在线账号（日记 API）+ 同步开关。
 * 本地始终可用；登录并打开开关后才把日记传到云端（Neon Postgres + 私有 Blob）。
 */
const { user, enabled, lastSyncAt, busy, error, checking, register, login, logout, setEnabled, syncAll } = useCloudSync()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const notice = ref('')
const authBusy = ref(false)
const authOpen = ref(false)

async function submit() {
  if (authBusy.value) return
  authBusy.value = true
  notice.value = ''
  try {
    const ok = mode.value === 'login' ? await login(email.value, password.value) : await register(email.value, password.value)
    if (ok) {
      notice.value = mode.value === 'login' ? '已登录，可以打开同步了。' : '账号已创建，可以打开同步了。'
      password.value = ''
      authOpen.value = false
    }
  } finally {
    authBusy.value = false
  }
}

async function onSyncAll() {
  notice.value = ''
  const r = await syncAll()
  notice.value = r.message
}

async function onLogout() {
  await logout()
  notice.value = '已退出登录，日记仍在本地。'
}

function toggleSync() {
  if (!user.value || checking.value || busy.value) return
  setEnabled(!enabled.value)
  notice.value = enabled.value ? '同步已打开：下次「全部同步」会上传本地日记。' : '同步已关闭：日记只留在本机。'
}

// ---- 企业微信聊天云同步绑定 ----
interface WecomBinding {
  bindCode: string
  wecomUserId: string | null
  mergeWindowSec: number
  autoFamily: boolean
  boundAt: string | null
}
const wecomLoading = ref(false)
const wecomBinding = ref<WecomBinding | null>(null)
const wecomMsg = ref('')
const wecomGuideOpen = ref(false)
const webhookUrl = computed(() => import.meta.client ? `${window.location.origin}/api/wecom/webhook` : '/api/wecom/webhook')

async function loadWecomBinding() {
  if (!user.value) { wecomBinding.value = null; return }
  wecomLoading.value = true
  try {
    const res = await $fetch<{ configured: boolean; binding: WecomBinding | null }>('/api/wecom/binding')
    wecomBinding.value = res.binding
  } catch {
    wecomBinding.value = null
  } finally {
    wecomLoading.value = false
  }
}

watch(user, () => { void loadWecomBinding() }, { immediate: true })

async function updateWecom(payload: { action?: 'refreshCode' | 'unbind' | 'update'; mergeWindowSec?: number; autoFamily?: boolean }, msg?: string) {
  wecomLoading.value = true
  wecomMsg.value = ''
  try {
    const res = await $fetch<{ binding: WecomBinding | null }>('/api/wecom/binding', {
      method: 'POST',
      body: payload,
    })
    wecomBinding.value = res.binding
    if (msg) wecomMsg.value = msg
  } catch {
    wecomMsg.value = '操作失败，请检查云端数据库连接。'
  } finally {
    wecomLoading.value = false
  }
}

async function copyText(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text)
    wecomMsg.value = msg
  } catch {
    wecomMsg.value = text
  }
}
</script>

<template>
  <div class="jr-modal-mask" @click.self="$router.back()">
    <div class="jr-modal jr-cloud-modal">
      <button class="jr-modal-x" aria-label="关闭云服务" @click="$router.back()"><JrIcon :path="mdiClose" :size="16" /></button>

      <div class="jr-set-label" style="padding-left:4px">默认账号</div>
      <div class="jr-cloud-row on">
        <JrIcon :path="mdiLaptop" :size="24" />
        <span style="font-weight:700">本机</span>
      </div>

      <div class="jr-set-label" style="padding-left:4px;margin-top:14px">其他账号</div>

      <div v-if="user" class="jr-cloud-row on">
        <JrIcon :path="mdiCloudOutline" :size="24" />
        <span style="font-weight:700;flex:1">{{ user.email }}</span>
        <button class="jr-icon-btn" title="退出登录" @click="onLogout"><JrIcon :path="mdiLogout" :size="16" /></button>
      </div>
      <div v-else-if="checking" class="jr-cloud-row">
        <JrIcon :path="mdiCloudOutline" :size="24" />
        <span class="jr-muted">正在确认登录状态…</span>
      </div>
      <button v-else class="jr-cloud-row" @click="authOpen = !authOpen">
        <JrIcon :path="mdiPlusBoxOutline" :size="24" />
        <span>登录或创建账号</span>
      </button>

      <form v-if="!user && authOpen" class="jr-cloud-auth" @submit.prevent="submit">
        <input v-model="email" class="jr-pop-input" type="email" autocomplete="email" placeholder="邮箱" required>
        <input v-model="password" class="jr-pop-input" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="密码（至少 8 位）" required>
        <button class="jr-btn jr-btn-primary" type="submit" :disabled="authBusy">
          {{ authBusy ? '处理中…' : mode === 'login' ? '登录' : '创建账号' }}
        </button>
        <button class="jr-link-btn" type="button" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? '还没有账号？创建一个' : '已有账号？去登录' }}
        </button>
      </form>

      <div class="jr-cloud-sync">
        <div class="jr-cloud-sync-row">
          <span>云端同步</span>
          <button class="jr-switch" :class="{ on: enabled }" role="switch" aria-label="云端同步" :aria-checked="enabled" :disabled="!user || checking || busy" @click="toggleSync">
            <span />
          </button>
        </div>
        <p class="jr-muted" style="margin:2px 0 0">
          {{ !user ? '登录账号后可开启云端同步。' : enabled ? '日记和附件会在同步时上传到你的账号。' : '开启云端同步后可同步日记和附件。' }}
        </p>
      </div>

      <p v-if="notice" class="jr-import-msg" role="status">{{ notice }}</p>
      <p v-if="error" class="jr-import-msg" role="alert">{{ error }}</p>
      <p v-if="lastSyncAt" class="jr-cloud-lastsync">上次同步：{{ lastSyncAt }}</p>

      <button v-if="user" class="jr-btn jr-btn-primary" style="width:100%;justify-content:center;margin-top:14px" :disabled="busy || !enabled" @click="onSyncAll">
        <JrIcon :path="mdiSync" :size="17" /> {{ busy ? '正在同步…' : '全部同步' }}
      </button>

      <div v-if="user" class="jr-wecom-box">
        <div class="jr-wecom-head">
          <span class="jr-wecom-title"><JrIcon :path="mdiWechat" :size="19" style="color:#07c160" /> 企业微信聊天云同步</span>
          <span class="jr-wecom-badge" :class="{ on: wecomBinding?.wecomUserId }">
            {{ wecomBinding?.wecomUserId ? '已绑定' : '未绑定' }}
          </span>
        </div>

        <template v-if="wecomBinding">
          <div class="jr-wecom-code-row">
            <div>
              <div class="jr-muted" style="font-size:12px">在企业微信聊天里发送：<b>绑定 {{ wecomBinding.bindCode }}</b></div>
              <div class="jr-wecom-code">{{ wecomBinding.bindCode }}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button type="button" class="jr-icon-btn" title="复制绑定指令" @click="copyText(`绑定 ${wecomBinding.bindCode}`, '已复制绑定指令')">
                <JrIcon :path="mdiContentCopy" :size="15" />
              </button>
              <button type="button" class="jr-icon-btn" title="刷新绑定码" :disabled="wecomLoading" @click="updateWecom({ action: 'refreshCode' }, '已生成新绑定码')">
                <JrIcon :path="mdiRefresh" :size="15" />
              </button>
            </div>
          </div>

          <div class="jr-cloud-sync-row" style="margin-top:8px;font-weight:500;font-size:13px">
            <span>2 分钟内连发消息合并为一篇</span>
            <button
              type="button"
              class="jr-switch"
              :class="{ on: wecomBinding.mergeWindowSec > 0 }"
              role="switch"
              :aria-checked="wecomBinding.mergeWindowSec > 0"
              @click="updateWecom({ mergeWindowSec: wecomBinding.mergeWindowSec > 0 ? 0 : 120 })"
            >
              <span />
            </button>
          </div>
          <div class="jr-cloud-sync-row" style="margin-top:8px;font-weight:500;font-size:13px">
            <span>微信消息同步到「我们的小家」</span>
            <button
              type="button"
              class="jr-switch"
              :class="{ on: wecomBinding.autoFamily }"
              role="switch"
              :aria-checked="wecomBinding.autoFamily"
              @click="updateWecom({ autoFamily: !wecomBinding.autoFamily })"
            >
              <span />
            </button>
          </div>
          <div v-if="wecomBinding.wecomUserId" class="jr-wecom-bound-row">
            <span class="jr-muted" style="font-size:11.5px">企微 ID：{{ wecomBinding.wecomUserId }}</span>
            <button type="button" class="jr-link-btn" @click="updateWecom({ action: 'unbind' }, '已解除绑定')">解绑</button>
          </div>
        </template>
        <p v-else class="jr-muted" style="font-size:12px;margin:4px 0">
          {{ wecomLoading ? '正在读取绑定状态…' : '当前环境未连接云端数据库，部署后可生成微信绑定码。' }}
        </p>

        <button type="button" class="jr-link-btn" style="margin-top:6px" @click="wecomGuideOpen = !wecomGuideOpen">
          {{ wecomGuideOpen ? '收起企业微信接入配置指引 ▲' : '查看企业微信后台配置指引 ▼' }}
        </button>
        <div v-if="wecomGuideOpen" class="jr-wecom-guide">
          <p>1. 注册企业微信后，在「应用管理 → 自建应用 → 接收消息 → 设置 API 接收」填入回调 URL：</p>
          <div class="jr-wecom-url-row">
            <code>{{ webhookUrl }}</code>
            <button type="button" class="jr-icon-btn" @click="copyText(webhookUrl, '已复制回调 URL')"><JrIcon :path="mdiContentCopy" :size="14" /></button>
          </div>
          <p>2. 在部署环境变量中填入：<code>WECOM_TOKEN</code>、<code>WECOM_ENCODING_AES_KEY</code>、<code>WECOM_CORP_ID</code>（以及用于拉取图片的 <code>WECOM_CORP_SECRET</code>）。</p>
          <p>3. 用个人微信扫码关注该企业微信 / 微信客服，发送上方绑定码即可边聊边写日记（支持 #标签、定位、图片与「撤回」）。</p>
        </div>
        <p v-if="wecomMsg" class="jr-import-msg" role="status">{{ wecomMsg }}</p>
      </div>

      <div style="margin-top:20px;border-top:1px solid #edf3f5;padding-top:6px">
        <SharedJournal />
      </div>
    </div>
  </div>
</template>

<style scoped>
.jr-cloud-auth { display: flex; flex-direction: column; gap: 8px; margin: 10px 4px 4px; }
.jr-cloud-sync { margin: 14px 4px 6px; }
.jr-cloud-sync-row { display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 13.5px; }
.jr-switch {
  width: 40px; height: 22px; border-radius: 999px; border: 1px solid var(--jr-outline-variant);
  background: rgba(0, 0, 0, 0.08); padding: 2px; display: flex; align-items: center; transition: background 0.15s;
}
.jr-switch span { width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); transition: transform 0.15s; }
.jr-switch.on { background: var(--jr-primary); border-color: var(--jr-primary); }
.jr-switch.on span { transform: translateX(18px); }
.jr-link-btn { border: 0; background: none; color: var(--jr-primary); font-size: 12.5px; cursor: pointer; padding: 2px 0; }
.jr-wecom-box { margin-top: 16px; padding: 12px; border-radius: 12px; border: 1px solid var(--jr-outline-variant); background: color-mix(in srgb, var(--jr-surface-variant) 32%, var(--jr-surface)); }
.jr-wecom-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.jr-wecom-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13.5px; }
.jr-wecom-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--jr-surface-variant); color: var(--jr-on-surface-variant); }
.jr-wecom-badge.on { background: #dcfce7; color: #166534; font-weight: 600; }
.jr-wecom-code-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 9px; background: var(--jr-surface); border: 1px dashed var(--jr-outline-variant); }
.jr-wecom-code { font-size: 18px; font-weight: 800; letter-spacing: 3px; color: var(--jr-primary); margin-top: 2px; }
.jr-wecom-bound-row { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.jr-wecom-guide { margin-top: 8px; font-size: 12px; line-height: 1.6; color: var(--jr-on-surface-variant); }
.jr-wecom-guide p { margin: 4px 0; }
.jr-wecom-url-row { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--jr-surface); border: 1px solid var(--jr-outline-variant); }
.jr-wecom-url-row code { flex: 1; font-size: 11px; word-break: break-all; }
</style>
