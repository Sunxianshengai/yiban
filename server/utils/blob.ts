import { presignUrl, issueSignedToken } from '@vercel/blob'
import type { H3Event } from 'h3'

/**
 * 私有 Vercel Blob。
 * 客户端不拿长期 token：服务端用 OIDC（Vercel 自动注入 VERCEL_OIDC_TOKEN + BLOB_STORE_ID）
 * 签发短期凭证，再换成「一个路径、一个用途」的预签名 URL。
 * 读也必须走预签名 GET —— 私有 blob 的 URL 直接打开是 403。
 */
const STORE_ID = process.env.BLOB_STORE_ID || ''
const OIDC = process.env.VERCEL_OIDC_TOKEN || ''

export function blobConfigured() {
  return Boolean(STORE_ID && OIDC)
}

/** 用户专属目录前缀，保证不同账号的路径不可能撞上。 */
export function userPrefix(userId: string) {
  return `u/${userId}`
}

interface BlobTarget {
  pathname: string
  contentType?: string
  maxBytes?: number
}

async function signedToken(pathname: string, operations: Array<'put' | 'get'>, validUntil: number) {
  if (!blobConfigured()) {
    throw createError({ statusCode: 503, statusMessage: '附件存储未配置：请在 Vercel 项目里连接私有 Blob' })
  }
  // BLOB_STORE_ID / VERCEL_OIDC_TOKEN 是 Vercel 运行期注入；本地开发可用 vercel env pull
  const token = await issueSignedToken({ oidcToken: OIDC, storeId: STORE_ID, pathname, operations, validUntil })
  return token
}

/** 上传：返回可直接 PUT 的地址（支持大文件 multipart，客户端直传不经过函数）。 */
export async function presignUpload(userId: string, target: BlobTarget, ttlMs = 15 * 60_000) {
  const validUntil = Date.now() + ttlMs
  const token = await signedToken(target.pathname, ['put'], validUntil)
  const { presignedUrl } = await presignUrl(token, {
    operation: 'put',
    pathname: target.pathname,
    access: 'private',
    validUntil,
    allowedContentTypes: target.contentType ? [target.contentType] : undefined,
    maximumSizeInBytes: target.maxBytes,
  })
  return presignedUrl
}

/** 下载：私有 blob 必须先换预签名 GET，前端再 fetch 成 Blob 渲染。 */
export async function presignDownload(pathname: string, ttlMs = 10 * 60_000) {
  const validUntil = Date.now() + ttlMs
  const token = await signedToken(pathname, ['get'], validUntil)
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil })
  return presignedUrl
}

/** 附件路径：u/<userId>/<entryClientId>/<mediaClientId>.<ext>，越权路径一眼可辨。 */
export function mediaPath(userId: string, entryClientId: string, mediaClientId: string, ext: string) {
  const safeExt = (ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  return `${userPrefix(userId)}/${encodeURIComponent(entryClientId)}/${encodeURIComponent(mediaClientId)}.${safeExt}`
}

export function assertOwnPath(userId: string, pathname: string) {
  if (!pathname.startsWith(`${userPrefix(userId)}/`)) {
    throw createError({ statusCode: 403, statusMessage: '不是你的附件' })
  }
}

export function eventForBlob(_event: H3Event) {
  // 保留签名一致性的占位；OIDC 由 Vercel 注入，无需按请求区分
  return undefined
}
