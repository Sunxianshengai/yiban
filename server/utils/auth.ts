import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sql } from './db'
import { ensureSchema } from './schema'

/**
 * 账号与会话。
 * 密码用 scrypt 加随机盐；会话是随机 token，只把 SHA-256 存库（库泄露也拿不到可用的 cookie）。
 * 网页版和 Windows 版走同一个 API，登录后拿到的是同一枚 HttpOnly cookie。
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export interface SessionUser {
  id: string
  email: string
}

const COOKIE = 'yiban_session'
const SESSION_DAYS = 30

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)
  return { hash: key.toString('hex'), salt: salt.toString('hex') }
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string) {
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const key = await scrypt(password, salt, expected.length || 64)
  return key.length === expected.length && timingSafeEqual(key, expected)
}

export async function createUser(email: string, password: string): Promise<SessionUser> {
  await ensureSchema()
  const { hash, salt } = await hashPassword(password)
  const rows = await sql()`
    insert into yiban_users (email, email_lower, password_hash, password_salt)
    values (${email}, ${normalizeEmail(email)}, ${hash}, ${salt})
    returning id, email
  `
  return rows[0] as SessionUser
}

export async function findUser(email: string) {
  await ensureSchema()
  const rows = await sql()`
    select id, email, password_hash, password_salt from yiban_users where email_lower = ${normalizeEmail(email)} limit 1
  `
  return rows[0] as (SessionUser & { password_hash: string; password_salt: string }) | undefined
}

export async function startSession(event: Parameters<typeof setCookie>[0], userId: string) {
  const token = randomBytes(32).toString('base64url')
  const hash = await tokenHash(token)
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5)
  await sql()`insert into yiban_sessions (token_hash, user_id, expires_at) values (${hash}, ${userId}, ${expires})`
  setCookie(event, COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // 按实际请求协议判断，而不是 NODE_ENV：本地用 http 跑生产构建时，
    // 一旦带上 Secure，浏览器就不会回传 cookie，表现为「登录成功后仍是 401」。
    secure: isHttps(event),
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
  return expires
}

function isHttps(event: Parameters<typeof getHeader>[0]) {
  const proto = String(getHeader(event, 'x-forwarded-proto') || '').split(',')[0].trim()
  if (proto) return proto === 'https'
  try {
    return getRequestURL(event).protocol === 'https:'
  } catch {
    return false
  }
}

export async function endSession(event: Parameters<typeof setCookie>[0]) {
  const token = getCookie(event, COOKIE)
  if (token) await sql()`delete from yiban_sessions where token_hash = ${await tokenHash(token)}`
  deleteCookie(event, COOKIE, { path: '/' })
}

async function tokenHash(token: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Buffer.from(buf).toString('hex')
}

/** 读当前登录用户；未登录返回 null（不抛错，调用方决定 401）。 */
export async function currentUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser | null> {
  const token = getCookie(event, COOKIE)
  if (!token) return null
  await ensureSchema()
  const rows = await sql()`
    select u.id, u.email
    from yiban_sessions s
    join yiban_users u on u.id = s.user_id
    where s.token_hash = ${await tokenHash(token)} and s.expires_at > now()
    limit 1
  `
  return (rows[0] as SessionUser | undefined) ?? null
}

/** 强制登录：没有会话就 401。 */
export async function requireUser(event: Parameters<typeof getCookie>[0]): Promise<SessionUser> {
  const user = await currentUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: '请先登录' })
  return user
}

export function newClientId() {
  return randomUUID()
}
