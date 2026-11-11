<script setup lang="ts">
import { mdiClose, mdiLaptop, mdiPlusBoxOutline, mdiCogOutline, mdiSync, mdiCloudOutline, mdiLogout } from '@mdi/js'

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
  // 还在确认登录态：别急着说「先登录」，用户可能已经登录了
  if (checking.value && !user.value) {
    notice.value = '正在确认登录状态，请稍候。'
    return
  }
  if (!user.value) {
    authOpen.value = true
    notice.value = '先登录，再打开同步。'
    return
  }
  setEnabled(!enabled.value)
  notice.value = enabled.value ? '同步已打开：下次「全部同步」会上传本地日记。' : '同步已关闭：日记只留在本机。'
}
</script>

<template>
  <div class="jr-modal-mask" @click.self="$router.back()">
    <div class="jr-modal jr-cloud-modal">
      <button class="jr-modal-x" @click="$router.back()"><JrIcon :path="mdiClose" :size="16" /></button>

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
          <button class="jr-switch" :class="{ on: enabled }" role="switch" :aria-checked="enabled" @click="toggleSync">
            <span />
          </button>
        </div>
        <p class="jr-muted" style="margin:2px 0 0">
          {{ enabled ? '已打开：日记和附件会在同步时上传到你的账号。' : '关闭时日记只存在本机，离线也能写。' }}
        </p>
      </div>

      <button class="jr-cloud-row" @click="notice = '账号、数据与云服务的管理界面还在做，目前在这里登录和开关同步。'">
        <JrIcon :path="mdiCogOutline" :size="24" />
        <span>管理账号、数据与云服务</span>
      </button>

      <p v-if="notice" class="jr-import-msg" role="status">{{ notice }}</p>
      <p v-if="error" class="jr-import-msg" role="alert">{{ error }}</p>
      <p v-if="lastSyncAt" class="jr-cloud-lastsync">上次同步：{{ lastSyncAt }}</p>

      <button class="jr-btn jr-btn-primary" style="width:100%;justify-content:center;margin-top:14px" :disabled="busy" @click="onSyncAll">
        <JrIcon :path="mdiSync" :size="17" /> {{ busy ? '正在同步…' : '全部同步' }}
      </button>

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
</style>
