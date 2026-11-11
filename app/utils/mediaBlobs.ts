import type { MediaFileV2 } from './db'
import { cloudApi } from './cloudApi'

/**
 * 把「只有云端记录、没有本地 blob」的附件取回成 Blob（导出 docx/epub、打印、Zip 下载要用真实字节）。
 *
 * 为什么不放 composable：导出流程在工具函数里跑，不在组件 setup 里，
 * 这里只依赖 cloudApi，不依赖 Nuxt 上下文。
 * 取回失败就保持无 blob —— 调用方会退化成文字占位，不会整篇导出失败。
 */
export async function hydrateMedia(rows: MediaFileV2[]): Promise<MediaFileV2[]> {
  const missing = rows.filter(row => !row.blob && row.remotePathname)
  if (!missing.length) return rows
  const pathnames = [...new Set(missing.map(row => row.remotePathname!))]
  let urls: Record<string, string> = {}
  try {
    urls = (await cloudApi.downloadUrls(pathnames)).urls
  } catch {
    return rows
  }
  const fetched = new Map<string, Blob>()
  await Promise.all(pathnames.map(async (pathname) => {
    const url = urls[pathname]
    if (!url) return
    try {
      const res = await fetch(url)
      if (res.ok) fetched.set(pathname, await res.blob())
    } catch { /* 单个失败不影响其它附件 */ }
  }))
  return rows.map((row) => {
    if (row.blob || !row.remotePathname) return row
    const blob = fetched.get(row.remotePathname)
    return blob ? { ...row, blob } : row
  })
}
