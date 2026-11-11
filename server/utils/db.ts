import { neon } from '@neondatabase/serverless'

/**
 * Neon Postgres 连接（HTTP 驱动，适合 Vercel Serverless）。
 * 连接串来自 Vercel Marketplace 的 Neon 集成（DATABASE_URL），本地放 .env，绝不进仓库。
 */
type SqlClient = ReturnType<typeof neon>

let cached: SqlClient | null = null

export function sql(): SqlClient {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED
  if (!url) throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL 未配置：请在 Vercel 项目里连接 Neon 数据库' })
  if (!cached) cached = neon(url)
  return cached
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
}
