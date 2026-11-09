<script setup lang="ts">
import { mdiContentCopy, mdiCheck } from '@mdi/js'
import { createSyncClient, getStoredToken } from '~/utils/syncClient'
import { listAccounts, addSharedAccount } from '~/utils/accounts'
import type { LinkedAccountRow } from '~/utils/db'

/**
 * 共享日记（F-022）— 文案与流程逐字对照原版 i18n O 对象（invite/invitation/codeRefreshDesc/owner/member）。
 * 邀请：share/invite {syncDriveId} → {inviteCode, expiry}（原版 wFe）；
 * 加入：share/accept {inviteCode} → {syncDriveId}（原版 cBe）；移除：share/remove {syncDriveId,userId,fields}（原版 TFe）。
 * 未登录 → 诚实提示；已登录但服务端不可达 → 真实错误信息。
 */
const notice = ref('')
const inviteCode = ref('')
const inviteExpiry = ref('')
const generating = ref(false)
const joinCode = ref('')
const joining = ref(false)
const accounts = ref<LinkedAccountRow[]>([])

async function refresh() {
  accounts.value = await listAccounts()
}
onMounted(refresh)

const hasCloudDrive = computed(() => accounts.value.some((a) => a.src !== "local" && a.linkedAccountId))

async function generateInvite() {
  notice.value = ""
  const token = getStoredToken()
  if (!token) { notice.value = "生成邀请码需要先登录 Journey 账号。"; return }
  const drive = accounts.value.find((a) => a.src !== "local" && a.linkedAccountId)
  if (!drive?.linkedAccountId) { notice.value = "没有可共享的云日记本。先添加云服务。"; return }
  generating.value = true
  try {
    const r = await createSyncClient(token).shareInvite(drive.linkedAccountId)
    if (r.ok && r.data?.inviteCode) {
      inviteCode.value = r.data.inviteCode
      inviteExpiry.value = r.data.expiry ? String(r.data.expiry) : ""
    } else {
      notice.value = r.reason === "network" ? "无法连接 Journey 云同步服务。" : `邀请服务返回 ${r.status ?? "错误"}。`
    }
  } finally { generating.value = false }
}

async function copyCode() {
  if (!inviteCode.value) return
  await navigator.clipboard.writeText(inviteCode.value).catch(() => {})
  notice.value = "邀请码已复制！"
}

async function joinShared() {
  notice.value = ""
  const code = joinCode.value.trim()
  if (!code) return
  const token = getStoredToken()
  if (!token) { notice.value = "加入共享日记需要先登录 Journey 账号。"; return }
  joining.value = true
  try {
    const client = createSyncClient(token)
    const r = await client.shareAccept(code)
    if (!r.ok) {
      notice.value = r.reason === "network" ? "无法连接 Journey 云同步服务。" : r.status === 401 ? "邀请码无效。" : `加入失败（${r.status ?? "错误"}）。`
      return
    }
    const driveId = r.data?.syncDriveId
    if (driveId) {
      // 原版 cBe：accept 成功后刷新 linkedAccounts；此处把共享盘真实写入注册表
      await addSharedAccount(`共享日记 ${driveId.slice(0, 8)}`, driveId, 0)
      await refresh()
      notice.value = "已加入共享日记。"
      joinCode.value = ""
    } else {
      notice.value = "邀请码无效。"
    }
  } finally { joining.value = false }
}

async function removeMember(account: LinkedAccountRow) {
  notice.value = ""
  const token = getStoredToken()
  if (!token) { notice.value = "移除成员需要先登录 Journey 账号。"; return }
  const r = await createSyncClient(token).shareRemove({ syncDriveId: account.linkedAccountId || "", userId: String(account.id ?? ""), fields: [] })
  notice.value = r.ok ? "已移除成员。" : r.reason === "network" ? "无法连接 Journey 云同步服务。" : `移除失败（${r.status ?? "错误"}）。`
}
</script>

<template>
  <div class="jr-share">
    <div class="jr-set-label">共享日记</div>
    <p class="jr-share-msg">与家人朋友共享日记。</p>

    <!-- 邀请（原版 inviteTitle/inviteSubtitle/codeRefreshDesc） -->
    <div class="jr-share-block">
      <div class="jr-share-head">邀请加入共享日记</div>
      <p class="jr-share-desc">生成邀请码</p>
      <button class="jr-btn" :disabled="generating" @click="generateInvite">{{ generating ? '正在生成…' : '生成邀请码' }}</button>
      <div v-if="inviteCode" class="jr-share-code-row">
        <code class="jr-share-code">{{ inviteCode }}</code>
        <button class="jr-icon-btn" aria-label="复制邀请码" @click="copyCode"><JrIcon :path="mdiContentCopy" :size="16" /></button>
      </div>
      <p v-if="inviteCode" class="jr-share-desc">邀请码每 10 分钟刷新一次。</p>
    </div>

    <!-- 加入（原版 invitationTitle/invitationSubtitle/invitationError） -->
    <div class="jr-share-block">
      <div class="jr-share-head">添加邀请码</div>
      <p class="jr-share-desc">输入邀请码加入共享日记。</p>
      <div class="jr-pop-row" style="padding:0">
        <input v-model="joinCode" placeholder="邀请码" class="jr-pop-input" @keydown.enter.prevent="joinShared" />
        <button class="jr-btn jr-btn-primary" :disabled="joining || !joinCode.trim()" @click="joinShared">{{ joining ? '正在加入…' : '加入' }}</button>
      </div>
    </div>

    <!-- 成员/日记本列表（原版 owner/member/noAccounts） -->
    <div class="jr-share-block">
      <div class="jr-share-head">日记本与成员</div>
      <p v-if="!accounts.some(a => a.src !== 'local')" class="jr-share-desc">暂无账号</p>
      <div v-for="a in accounts" :key="a.id ?? a.displayName" class="jr-share-acct">
        <span style="font-weight:700">{{ a.displayName }}</span>
        <span v-if="a.src === 'shared'" class="jr-share-role" :class="{ owner: a.memberRole === 1 }">{{ a.memberRole === 1 ? '拥有者' : '成员' }}</span>
        <button
          v-if="a.src === 'shared' && a.memberRole === 1"
          class="jr-link-danger" style="margin-left:auto"
          @click="removeMember(a)"
        >移除</button>
      </div>
      <p v-if="hasCloudDrive" class="jr-share-desc" style="margin-top:6px">共享日记成员上限已满时会提示"Shared Journal is already full"。</p>
    </div>

    <p v-if="notice" class="jr-import-msg" role="status">{{ notice }}</p>
  </div>
</template>
