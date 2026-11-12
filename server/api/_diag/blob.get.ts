import { getHeader } from 'h3'

/** 临时诊断端点：确认 Vercel 运行时是否注入了 Blob 所需的 OIDC 与 store id。诊断完即删。 */
export default defineEventHandler((event) => {
  const token = process.env.INGEST_TOKEN || ''
  if (!token || getHeader(event, 'authorization') !== `Bearer ${token}`) {
    throw createError({ statusCode: 401, statusMessage: 'diag token 无效' })
  }
  const oidc = process.env.VERCEL_OIDC_TOKEN || ''
  const store = process.env.BLOB_STORE_ID || ''
  const rw = process.env.BLOB_READ_WRITE_TOKEN || ''
  return {
    hasStoreId: Boolean(store),
    storeIdTail: store.slice(-6),
    hasOidc: Boolean(oidc),
    oidcLength: oidc.length,
    oidcPrefix: oidc.slice(0, 6),
    hasReadWriteToken: Boolean(rw),
    vercelEnv: process.env.VERCEL_ENV || '',
    region: process.env.VERCEL_REGION || '',
    nodeEnv: process.env.NODE_ENV || '',
  }
})
