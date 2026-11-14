import { randomBytes } from 'node:crypto'
import { sql } from './db'
import { ensureSchema } from './schema'
import { requireUser, type SessionUser } from './auth'

/**
 * 家庭组（附加功能）。
 * 建在既有账号体系上：每位家人有自己的账号，凭邀请码加入同一个组。
 * 私有日记永远不出现在家庭接口里 —— 家庭侧只读 fields->>'visibility'='family' 的条目。
 */

export interface FamilyGroup {
  id: string
  name: string
  inviteCode: string
  ownerUserId: string
}

export interface FamilyMember {
  userId: string
  nickname: string
  role: string
  joinedAt: string
}

/** 加入家庭组后才有的请求上下文：组信息 + 我在组里的身份。 */
export interface FamilyContext {
  user: SessionUser
  group: FamilyGroup
  me: FamilyMember
}

/** 邀请码去掉易混字符（I/L/O/0/1），6 位，比对时忽略大小写。 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newInviteCode(): string {
  const bytes = randomBytes(6)
  let code = ''
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase()
}

/** 强制登录 + 已加入家庭组；返回请求上下文。未加入抛 403（调用方不用再判断）。 */
export async function requireFamilyMember(event: Parameters<typeof requireUser>[0]): Promise<FamilyContext> {
  const user = await requireUser(event)
  await ensureSchema()
  const rows = await sql()`
    select g.id, g.name, g.invite_code, g.owner_user_id,
           m.user_id, m.nickname, m.role, m.joined_at
    from yiban_family_members m
    join yiban_family_groups g on g.id = m.group_id
    where m.user_id = ${user.id}
    limit 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) throw createError({ statusCode: 403, statusMessage: '还没有加入家庭组，先在设置里创建或加入' })
  return {
    user,
    group: { id: row.id, name: row.name, inviteCode: row.invite_code, ownerUserId: row.owner_user_id } as FamilyGroup,
    me: { userId: row.user_id, nickname: row.nickname, role: row.role, joinedAt: iso(row.joined_at) } as FamilyMember,
  }
}

/** 列出组内全部成员（按加入时间）。 */
export async function listMembers(groupId: string): Promise<FamilyMember[]> {
  const rows = await sql()`
    select user_id, nickname, role, joined_at
    from yiban_family_members
    where group_id = ${groupId}
    order by joined_at asc
  `
  return rows.map(row => ({
    userId: row.user_id,
    nickname: row.nickname,
    role: row.role,
    joinedAt: iso(row.joined_at),
  }))
}

function iso(value: unknown) {
  if (value == null) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}
