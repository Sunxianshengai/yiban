import type { MediaFileV2 } from '~/utils/db'
import { cloudApi } from '~/utils/cloudApi'

/**
 * 附件的显示地址。
 *
 * 规则：本地有 blob 就用 blob（快、离线可用）；没有 blob（别的设备同步下来的）
 * 才向服务端换一次性预签名地址 —— 私有 Blob 的 URL 直接打开是 403。
 * 预签名地址有有效期，所以按需取、不长期缓存。
 */
export function useMediaResolver() {
  /** pathname → 预签名地址 */
  const signed = new Map<string, string>()
  /** 本地 blob → objectURL，卸载时统一释放 */
  const objects = new Map<Blob, string>()

  function objectUrl(blob: Blob) {
    const hit = objects.get(blob)
    if (hit) return hit
    const url = URL.createObjectURL(blob)
    objects.set(blob, url)
    return url
  }

  /** 同步取地址：本地 blob 优先，其次用已经 prefetch 过的预签名地址。 */
  function urlForSync(row: MediaFileV2): string | undefined {
    if (row.blob) return objectUrl(row.blob)
    return row.remotePathname ? signed.get(row.remotePathname) : undefined
  }

  /**
   * 批量换成预签名地址（只处理缺 blob 的行）。
   * 渲染是同步的，所以调用方先 await 这一步，再用 urlForSync 取。
   */
  async function prefetch(rows: MediaFileV2[]) {
    const need = [...new Set(rows.flatMap(row => (!row.blob && row.remotePathname ? [row.remotePathname] : [])))]
      .filter(pathname => !signed.has(pathname))
    if (!need.length) return
    // 服务端一次最多签 50 个，分批避免超限
    for (let i = 0; i < need.length; i += 50) {
      try {
        const { urls } = await cloudApi.downloadUrls(need.slice(i, i + 50))
        for (const [pathname, url] of Object.entries(urls)) signed.set(pathname, url)
      } catch {
        // 未登录或网络异常：这些附件就渲染成占位，不影响正文
        return
      }
    }
  }

  /** 需要真实字节时（导出 docx/epub、打印）先用这个取回 blob。 */
  async function fetchBlob(row: MediaFileV2): Promise<Blob | undefined> {
    if (row.blob) return row.blob
    const url = urlForSync(row)
    if (!url) return undefined
    try {
      const res = await fetch(url)
      return res.ok ? await res.blob() : undefined
    } catch {
      return undefined
    }
  }

  function dispose() {
    for (const url of objects.values()) URL.revokeObjectURL(url)
    objects.clear()
    signed.clear()
  }

  return { urlForSync, prefetch, fetchBlob, dispose }
}
