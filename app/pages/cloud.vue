<script setup lang="ts">
import { mdiClose, mdiLaptop, mdiPlusBoxOutline, mdiCogOutline, mdiSync } from '@mdi/js'
import { syncAll } from '~/utils/syncClient'

/** Journal picker, faithful to the captured Cloud Services dialog (page-cloud-services.png).
 *  Local is real; Sync All 走真实 syncClient（契约=evidence/derived/contracts.json），未登录诚实提示。 */
const notice = ref('')
const syncing = ref(false)
const lastSync = ref(localStorage.getItem('jr.lastSyncAll') || '')

async function onSyncAll() {
  if (syncing.value) return
  syncing.value = true
  notice.value = ''
  try {
    const r = await syncAll()
    notice.value = r.message
    if (r.ok) {
      lastSync.value = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date())
      localStorage.setItem('jr.lastSyncAll', lastSync.value)
    }
  } finally {
    syncing.value = false
  }
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
      <button class="jr-cloud-row" @click="notice = '云服务和谷歌云端硬盘需要登录 Journey 账号后添加。'">
        <JrIcon :path="mdiPlusBoxOutline" :size="24" />
        <span>添加云服务</span>
      </button>
      <button class="jr-cloud-row" @click="notice = '在线账号与云服务管理需要登录 Journey 账号。'">
        <JrIcon :path="mdiCogOutline" :size="24" />
        <span>管理账号、数据与云服务</span>
      </button>
      <p v-if="notice" class="jr-import-msg" role="status">{{ notice }}</p>
      <p v-if="lastSync" class="jr-cloud-lastsync">上次同步：{{ lastSync }}</p>
      <button class="jr-btn jr-btn-primary" style="width:100%;justify-content:center;margin-top:14px" :disabled="syncing" @click="onSyncAll">
        <JrIcon :path="mdiSync" :size="17" /> {{ syncing ? '正在同步…' : '全部同步' }}
      </button>
      <div style="margin-top:20px;border-top:1px solid #edf3f5;padding-top:6px">
        <SharedJournal />
      </div>
    </div>
  </div>
</template>
