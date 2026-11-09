import { db, type LinkedAccountRow } from "./db"

/**
 * 多日记本注册表 — linkedAccounts 表即原版日记本模型（Local + 各云盘/共享盘）。
 * Local 行是唯一真实可写的日记本；云盘行在接受共享或登录后产生。
 */
export async function ensureLocalAccount(): Promise<void> {
  const local = await db.linkedAccounts.get(0)
  if (!local) {
    // 原版 schema 主键为普通 id（非自增），必须显式给 id
    await db.linkedAccounts.add({ id: 0, displayName: "本机", src: "local" })
  }
}

export async function listAccounts(): Promise<LinkedAccountRow[]> {
  await ensureLocalAccount()
  const all = await db.linkedAccounts.toArray()
  return all.sort((a, b) => (a.src === "local" ? -1 : 1) - (b.src === "local" ? -1 : 1))
}

/** share/accept 成功后把共享盘写入本地注册表（真实 Dexie 写入） */
export async function addSharedAccount(displayName: string, linkedAccountId: string, memberRole: 0 | 1 = 0): Promise<void> {
  const id = await db.linkedAccounts.orderBy("id").last().then((r) => (r?.id ?? -1) + 1)
  await db.linkedAccounts.add({ id, displayName, linkedAccountId, src: "shared", memberRole })
}
