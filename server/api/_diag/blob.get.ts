import { getHeader } from 'h3'

/** 临时诊断端点：确认 Vercel 运行时是否注入了 Blob 所需的 OIDC 与 store id。诊断完即删。 */
export default defineEventHandler(async (event) => {
  const token = process.env.INGEST_TOKEN || ''
  if (!token || getHeader(event, 'authorization') !== `Bearer ${token}`) {
    throw createError({ statusCode: 401, statusMessage: 'diag token 无效' })
  }
  const oidc = process.env.VERCEL_OIDC_TOKEN || ''
  const store = process.env.BLOB_STORE_ID || ''
  const rw = process.env.BLOB_READ_WRITE_TOKEN || ''
  const out: Record<string, unknown> = {
    hasStoreId: Boolean(store),
    storeIdTail: store.slice(-6),
    hasOidc: Boolean(oidc),
    oidcLength: oidc.length,
    hasReadWriteToken: Boolean(rw),
    vercelEnv: process.env.VERCEL_ENV || '',
    region: process.env.VERCEL_REGION || '',
    nodeEnv: process.env.NODE_ENV || '',
  }
  try {
    const mod: any = await import('@vercel/oidc')
    const sync = mod.getVercelOidcTokenSync || mod.default?.getVercelOidcTokenSync
    out.sdkHasSync = typeof sync === 'function'
    if (typeof sync === 'function') {
      const t = sync()
      out.sdkSyncLength = String(t || '').length
      if (t) {
        const payload = JSON.parse(Buffer.from(String(t).split('.')[1], 'base64url').toString())
        out.sdkSub = String(payload.sub || '')
      }
    }
    const asyncFn = mod.getVercelOidcToken || mod.default?.getVercelOidcToken
    out.sdkHasAsync = typeof asyncFn === 'function'
    if (typeof asyncFn === 'function') {
      const t2 = await asyncFn()
      out.sdkAsyncLength = String(t2 || '').length
    }
  } catch (e) {
    out.sdkError = `${(e as Error).name}: ${(e as Error).message}`
  }
  return out
})
