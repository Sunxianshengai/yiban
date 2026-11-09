/**
 * Journey Cloud Sync API 客户端 — 端点/信封逐字对照 evidence/derived/contracts.json
 * （sync.journey.cloud 三代 base 共存：/v1 同步、/api2/v1 functions2、/odyssey/*）。
 * 认证：axios setHeader("Authorization", `Bearer ${token}`)（原版 syncWorker 实测）。
 * E2EE：原版字段加密信封 { encrypted: true, value }，publicKeyHash 附加（attachment-export-v1）。
 * 密钥管理未实现前，客户端按原样透传字段；加密字段只在调用方显式提供时出现 —— 诚实缺口，不伪造密钥。
 */

export const SYNC_BASES = {
  billingV2BaseUrl: "https://purchase2.journey.cloud",
  functionsBaseUrl: "https://journey.cloud/api/v1",
  functions2BaseUrl: "https://sync.journey.cloud/api2/v1",
  coachBaseUrl: "https://coach.journey.cloud",
  syncBaseUrl: "https://sync.journey.cloud/v1",
  odysseyBaseUrl: "https://sync.journey.cloud/odyssey/v1",
} as const

/** 原版加密字段信封 */
export interface EncryptedField {
  encrypted: true
  value: string
}
export type SyncField = unknown | EncryptedField

export interface SyncUpdatesRequest {
  syncDriveId?: string
  timestamp?: string
  /** 其余信封字段按原版调用点透传 */
  [k: string]: unknown
}

export interface SyncEntryPayload {
  alias?: string
  fields: Record<string, SyncField>
  publicKeyHash?: string
}

export interface SyncResult<T = unknown> {
  ok: boolean
  status?: number
  data?: T
  reason?: "no-account" | "network" | "server"
}

export const TOKEN_KEY = "jr.journeyToken"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Bearer 客户端；transport 可注入（测试用），默认 fetch */
export function createSyncClient(token: string, transport: typeof fetch = fetch) {
  const post = async <T = unknown>(base: string, path: string, body: unknown): Promise<SyncResult<T>> => {
    try {
      const res = await transport(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text()
      return { ok: res.ok, status: res.status, data: data as T }
    } catch {
      return { ok: false, reason: "network" }
    }
  }
  return {
    /** POST ${syncBaseUrl}/accounts/list */
    accountsList: () => post(SYNC_BASES.syncBaseUrl, "/accounts/list", {}),
    /** POST ${syncBaseUrl}/accounts/get */
    accountsGet: (payload: Record<string, unknown>) => post(SYNC_BASES.syncBaseUrl, "/accounts/get", payload),
    /** POST ${syncBaseUrl}/entries/create — { alias?, fields, publicKeyHash? } */
    entriesCreate: (payload: SyncEntryPayload) => post(SYNC_BASES.syncBaseUrl, "/entries/create", payload),
    /** POST ${syncBaseUrl}/entries/get */
    entriesGet: (payload: Record<string, unknown>) => post(SYNC_BASES.syncBaseUrl, "/entries/get", payload),
    /** POST ${syncBaseUrl}/entries/update */
    entriesUpdate: (payload: Record<string, unknown>) => post(SYNC_BASES.syncBaseUrl, "/entries/update", payload),
    /** POST ${syncBaseUrl}/entries/delete */
    entriesDelete: (payload: Record<string, unknown>) => post(SYNC_BASES.syncBaseUrl, "/entries/delete", payload),
    /** POST ${syncBaseUrl}/sync/updates — { syncDriveId, timestamp? }（原版 fetchUpdates 信封） */
    syncUpdates: (payload: SyncUpdatesRequest) => post(SYNC_BASES.syncBaseUrl, "/sync/updates", payload),
    /** POST ${syncBaseUrl}/tags/list */
    tagsList: (payload: Record<string, unknown> = {}) => post(SYNC_BASES.syncBaseUrl, "/tags/list", payload),
    /** POST ${syncBaseUrl}/files/get */
    filesGet: (payload: Record<string, unknown>) => post(SYNC_BASES.syncBaseUrl, "/files/get", payload),
    /** POST ${syncBaseUrl}/share/invite — { syncDriveId } → { inviteCode, expiry }（原版 wFe 实测） */
    shareInvite: (syncDriveId: string) => post<{ inviteCode?: string; expiry?: string }>(SYNC_BASES.syncBaseUrl, "/share/invite", { syncDriveId }),
    /** POST ${syncBaseUrl}/share/accept — { inviteCode } → { syncDriveId }，成功后原版刷新 linkedAccounts（原版 cBe 实测） */
    shareAccept: (inviteCode: string) => post<{ syncDriveId?: string }>(SYNC_BASES.syncBaseUrl, "/share/accept", { inviteCode }),
    /** POST ${syncBaseUrl}/share/remove — { syncDriveId, userId, fields }（原版 TFe 实测） */
    shareRemove: (payload: { syncDriveId: string; userId: string; fields?: string[] }) => post(SYNC_BASES.syncBaseUrl, "/share/remove", payload),
    /** POST ${functionsBaseUrl}/oauth/all/linkedAccounts — 接受共享后刷新日记本列表（原版 cBe 实测） */
    linkedAccountsAll: () => post(SYNC_BASES.functionsBaseUrl, "/oauth/all/linkedAccounts", {}),
    /** POST ${syncBaseUrl}/accounts/rename — { syncDriveId, displayName }（原版 CFe 实测） */
    accountsRename: (payload: { syncDriveId: string; displayName: string }) => post(SYNC_BASES.syncBaseUrl, "/accounts/rename", payload),
  }
}

export type SyncClient = ReturnType<typeof createSyncClient>

export interface SyncAllOutcome {
  ok: boolean
  message: string
}

/** 全部同步：按原版语义拉取各云盘 updates。未登录 → 诚实失败，不伪造同步状态。 */
export async function syncAll(): Promise<SyncAllOutcome> {
  const token = getStoredToken()
  if (!token) {
    return { ok: false, message: "尚未登录 Journey 账号，云同步不可用。登录后可同步日记与媒体。" }
  }
  const client = createSyncClient(token)
  const accounts = await client.accountsList()
  if (!accounts.ok) {
    return { ok: false, message: accounts.reason === "network" ? "无法连接 Journey 云同步服务。" : `账号服务返回 ${accounts.status ?? "错误"}。` }
  }
  const drives = (accounts.data as { accounts?: { syncDriveId?: string }[] })?.accounts ?? []
  if (!drives.length) {
    return { ok: true, message: "账号下暂无云日记本。" }
  }
  let failures = 0
  for (const drive of drives) {
    const r = await client.syncUpdates({ syncDriveId: drive.syncDriveId })
    if (!r.ok) failures++
  }
  return failures
    ? { ok: false, message: `${drives.length} 个云日记本中 ${failures} 个同步失败。` }
    : { ok: true, message: "全部云日记本已同步。" }
}
