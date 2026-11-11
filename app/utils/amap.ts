/**
 * 高德地图（AMap）适配层。
 *
 * 两套能力：
 * 1) JS API 2.0 —— 地图册渲染（loader.js 在线加载，官方要求不得本地转存/打包）。
 * 2) Web 服务 —— 地点搜索 / 逆地理编码 / 天气 / 坐标转换，走 JSONP
 *    （restapi.amap.com 不返回 CORS 头，JSONP 是官方支持的浏览器直连方式）。
 *
 * 高德的「服务平台」是按 Key 单选绑定的，一个 Key 只能属于一种平台：
 *   - 服务平台=Web服务        → 才能调 restapi.amap.com（搜索/逆地理/天气/坐标转换）
 *   - 服务平台=Web端(JS API)  → 才能被 loader.js 加载出地图与点聚合
 * 所以这里要存两个 Key。用同一个 Key 填两处，必有一半功能报 USERKEY_PLAT_NOMATCH。
 *
 * 密钥存 localStorage（本仓库无后端可托管 securityJsCode）：
 *   jr.amapWebKey   —— 服务平台=Web服务 的 Key
 *   jr.amapJsKey    —— 服务平台=Web端(JS API) 的 Key
 *   jr.amapSecurity —— 2021-12-02 之后申请的 JS API Key 需要的「安全密钥」（只对 JS API 有效）
 *   jr.amapKey      —— 旧版单密钥存储位，仅作迁移回退，写新值后会被清掉
 * 读取顺序：localStorage（用户自己填的）→ runtimeConfig.public（本机 .env / 部署环境变量）→ 旧版单密钥。
 * 无密钥时所有函数返回空/失败，调用方回退到已保存的地点列表或手动填写。
 */

/** 服务平台=Web服务 的 Key（搜索 / 逆地理 / 天气 / 坐标转换） */
export const AMAP_WEB_KEY_STORAGE = 'jr.amapWebKey'
/** 服务平台=Web端(JS API) 的 Key（底图 / 点聚合） */
export const AMAP_JS_KEY_STORAGE = 'jr.amapJsKey'
export const AMAP_SECURITY_STORAGE = 'jr.amapSecurity'
/** 旧版单密钥存储位：仅用于迁移，不再写入 */
export const AMAP_KEY_STORAGE = 'jr.amapKey'

const REST_BASE = 'https://restapi.amap.com'
const LOADER_SRC = 'https://webapi.amap.com/loader.js'

function readStorage(key: string): string {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

/**
 * 构建期配置的默认 Key（`NUXT_PUBLIC_AMAP_*` → runtimeConfig.public）。
 * 优先级低于 localStorage：用户在「设置 → 地点」里填过就以本地为准。
 * 先读 Nuxt 注入到页面的运行时配置（任何调用上下文都能用），再退回 useRuntimeConfig。
 */
function readBaked(name: 'amapWebKey' | 'amapJsKey' | 'amapSecurity'): string {
  try {
    const injected = (window as any).__NUXT__?.config?.public
    const value = injected?.[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  } catch { /* 非浏览器环境或未注入，忽略 */ }
  try {
    const value = (useRuntimeConfig().public as Record<string, unknown>)[name]
    return typeof value === 'string' ? value.trim() : ''
  } catch { return '' }
}

/** 服务平台=Web服务 的 Key；未单独配置时回退到构建期默认值、旧版单密钥，老用户的配置不会丢。 */
export function getAmapWebKey(): string {
  return readStorage(AMAP_WEB_KEY_STORAGE) || readBaked('amapWebKey') || readStorage(AMAP_KEY_STORAGE)
}

/** 服务平台=Web端(JS API) 的 Key；同上回退。 */
export function getAmapJsKey(): string {
  return readStorage(AMAP_JS_KEY_STORAGE) || readBaked('amapJsKey') || readStorage(AMAP_KEY_STORAGE)
}

/** @deprecated 语义含糊（分不清服务平台），请用 getAmapWebKey / getAmapJsKey。 */
export function getAmapKey(): string {
  return getAmapWebKey()
}

export function getAmapSecurity(): string {
  return readStorage(AMAP_SECURITY_STORAGE) || readBaked('amapSecurity')
}

export function setAmapCredentials(webKey: string, jsKey: string, security: string) {
  try {
    const web = webKey.trim()
    const js = jsKey.trim()
    localStorage.setItem(AMAP_WEB_KEY_STORAGE, web)
    localStorage.setItem(AMAP_JS_KEY_STORAGE, js)
    localStorage.setItem(AMAP_SECURITY_STORAGE, security.trim())
    // 两个新值都填了才清旧值，否则留着旧值兜住没填的那一半
    if (web && js) localStorage.removeItem(AMAP_KEY_STORAGE)
  } catch { /* 隐私模式下 localStorage 不可写，忽略 */ }
}

/* ------------------------------------------------------------------ *
 * JSONP
 * ------------------------------------------------------------------ */

let jsonpSeq = 0

type JsonpParams = Record<string, string | number | boolean | undefined | null>

/** 失败原因分类，用于给用户可行动的提示，而不是把所有失败都说成「没找到」。 */
export type AmapErrorKind = 'no-key' | 'unsupported' | 'network' | 'service'

export interface AmapResult<T> {
  data: T | null
  error: AmapErrorKind | null
  /** 高德返回的 info 原文（如 INVALID_USER_KEY），仅便于排查 */
  info?: string
}

/** 把高德的 info 码翻成中文提示；未知码原样返回。 */
const AMAP_INFO_HINTS: Record<string, string> = {
  INVALID_USER_KEY: 'Key 无效或已删除',
  USERKEY_PLAT_NOMATCH: 'Key 的「服务平台」类型不匹配（搜索/天气要 Web服务，地图要 Web端(JS API)）',
  INVALID_USER_SCODE: '安全密钥不正确',
  INVALID_USER_SIGNATURE: '数字签名校验失败',
  DAILY_QUERY_OVER_LIMIT: '今日调用量已超限',
  OVER_QUOTA: '调用量已超限',
  SERVICE_NOT_AVAILABLE: '该服务未开通或暂不可用',
}

export function amapInfoHint(info?: string): string {
  if (!info) return '未知错误'
  return AMAP_INFO_HINTS[info] || info
}

/**
 * 以 JSONP 调用高德 Web 服务，保留失败原因。
 * 永不抛错：无密钥/不支持/网络失败/服务返回 status!=='1' 都通过 error 字段表达。
 */
export function amapJsonpResult<T = any>(path: string, params: JsonpParams, timeoutMs = 8000): Promise<AmapResult<T>> {
  const key = getAmapWebKey()
  if (!key) return Promise.resolve({ data: null, error: 'no-key' })
  if (typeof document === 'undefined') return Promise.resolve({ data: null, error: 'unsupported' })

  const cbName = `__jrAmapCb${Date.now().toString(36)}${(jsonpSeq++).toString(36)}`
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue
    query.set(k, String(v))
  }
  query.set('key', key)
  query.set('output', 'JSON')
  query.set('callback', cbName)

  return new Promise<AmapResult<T>>((resolve) => {
    const script = document.createElement('script')
    let settled = false
    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      script.remove()
      try { delete (window as any)[cbName] } catch { /* noop */ }
    }
    const finish = (result: AmapResult<T>) => { cleanup(); resolve(result) }

    const timer = setTimeout(() => finish({ data: null, error: 'network' }), timeoutMs)
    ;(window as any)[cbName] = (payload: any) => {
      // 高德约定：status '1' 成功，'0' 失败（INVALID_USER_KEY / OVER_QUOTA 等）
      if (payload && String(payload.status) === '1') finish({ data: payload as T, error: null })
      else finish({ data: null, error: 'service', info: typeof payload?.info === 'string' ? payload.info : undefined })
    }
    script.onerror = () => finish({ data: null, error: 'network' })
    script.src = `${REST_BASE}${path}?${query.toString()}`
    document.head.appendChild(script)
  })
}

/** 只要数据、不关心失败原因时的简写；失败一律 null。 */
export async function amapJsonp<T = any>(path: string, params: JsonpParams, timeoutMs = 8000): Promise<T | null> {
  return (await amapJsonpResult<T>(path, params, timeoutMs)).data
}

/* ------------------------------------------------------------------ *
 * Web 服务：地点搜索（POI）
 * ------------------------------------------------------------------ */

export interface AmapPlaceHit {
  /** 名称（如「西湖」） */
  name: string
  /** 区域，如「浙江省杭州市西湖区」 */
  area: string
  /** 详细地址，如「龙井路1号」 */
  address: string
  /** 拼好的展示文案：区域 + 详细地址（区分同名地点） */
  detail: string
  /** GCJ-02 坐标 */
  lat: number
  lng: number
  /** 行政区编码（天气查询用它） */
  adcode?: string
}

function poiLocation(location: unknown): { lat: number; lng: number } | null {
  if (typeof location !== 'string') return null
  const [lngRaw, latRaw] = location.split(',')
  const lng = Number(lngRaw)
  const lat = Number(latRaw)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export interface AmapPlaceSearch {
  hits: AmapPlaceHit[]
  error: AmapErrorKind | null
  info?: string
}

/**
 * 关键词搜索。支持「城市＋地点名」：city 传城市名 / citycode / adcode。
 * extensions=all 才有 pname/cityname/adname/adcode（base 不返回），用于展示区域。
 * 保留失败原因：这样「Key 无效」不会被说成「没找到地点」。
 */
export async function searchAmapPlacesResult(keywords: string, city?: string, limit = 8): Promise<AmapPlaceSearch> {
  const q = keywords.trim()
  if (!q) return { hits: [], error: null }
  const { data: payload, error, info } = await amapJsonpResult<any>('/v3/place/text', {
    keywords: q,
    city: city?.trim() || undefined,
    citylimit: city?.trim() ? true : undefined,
    offset: Math.min(Math.max(limit, 1), 25),
    page: 1,
    extensions: 'all',
  })
  if (error) return { hits: [], error, info }
  const pois = Array.isArray(payload?.pois) ? payload.pois : []
  const hits: AmapPlaceHit[] = []
  for (const poi of pois) {
    const loc = poiLocation(poi?.location)
    if (!loc) continue
    const area = [poi?.pname, poi?.cityname, poi?.adname].filter((s: unknown) => typeof s === 'string' && s && s !== '[]').join('')
    const address = typeof poi?.address === 'string' && poi.address !== '[]' ? poi.address : ''
    const name = typeof poi?.name === 'string' ? poi.name : ''
    const detail = [area, address].filter(Boolean).join(' · ') || name
    hits.push({
      name,
      area,
      address,
      detail,
      lat: loc.lat,
      lng: loc.lng,
      adcode: typeof poi?.adcode === 'string' && poi.adcode !== '[]' ? poi.adcode : undefined,
    })
  }
  return { hits, error: null }
}

/** 只要结果列表时的简写（失败即空数组）。 */
export async function searchAmapPlaces(keywords: string, city?: string, limit = 8): Promise<AmapPlaceHit[]> {
  return (await searchAmapPlacesResult(keywords, city, limit)).hits
}

/* ------------------------------------------------------------------ *
 * Web 服务：逆地理编码
 * ------------------------------------------------------------------ */

export interface AmapRegeo {
  /** 格式化地址 */
  address: string
  adcode?: string
  city?: string
  district?: string
}

/**
 * 逆地理编码。
 * @param source 坐标来源：'gps' 表示 WGS-84（浏览器定位/照片 EXIF），会先转 GCJ-02 再查询；
 *               缺省/'amap' 视作已是 GCJ-02。
 */
export async function reverseGeocodeAmap(lng: number, lat: number, source?: 'gps' | 'amap' | string): Promise<AmapRegeo | null> {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  const [x, y] = toAmapLngLat(lat, lng, source)
  const payload = await amapJsonp<any>('/v3/geocode/regeo', {
    location: `${x.toFixed(6)},${y.toFixed(6)}`,
    extensions: 'base',
    radius: 200,
  })
  const regeo = payload?.regeocode
  if (!regeo) return null
  const comp = regeo.addressComponent || {}
  const address = typeof regeo.formatted_address === 'string' && regeo.formatted_address !== '[]' ? regeo.formatted_address : ''
  return {
    address,
    adcode: typeof comp.adcode === 'string' ? comp.adcode : undefined,
    city: typeof comp.city === 'string' && comp.city ? comp.city : undefined,
    district: typeof comp.district === 'string' ? comp.district : undefined,
  }
}

/* ------------------------------------------------------------------ *
 * Web 服务：天气（按行政区编码查实况）
 * ------------------------------------------------------------------ */

export interface AmapWeather {
  /** 高德天气现象文本，如「晴」「多云」 */
  weather: string
  /** 摄氏温度（已取整） */
  degreeC: number
  adcode?: string
}

export async function fetchAmapWeather(adcode: string): Promise<AmapWeather | null> {
  const city = (adcode || '').trim()
  if (!/^\d{6}$/.test(city)) return null
  const payload = await amapJsonp<any>('/v3/weather/weatherInfo', { city, extensions: 'base' })
  const live = Array.isArray(payload?.lives) ? payload.lives[0] : null
  if (!live) return null
  const degree = Number(live.temperature)
  if (!Number.isFinite(degree)) return null
  return {
    weather: typeof live.weather === 'string' ? live.weather : '',
    degreeC: Math.round(degree),
    adcode: city,
  }
}

/** 高德天气文本 → 原版天气图标键（sun/partly/cloud/fog/rain/snow/storm） */
export function amapWeatherIcon(weather: string): string {
  const w = weather || ''
  if (/雷/.test(w)) return 'storm'
  if (/雪|冰雹|霰/.test(w)) return 'snow'
  if (/雨/.test(w)) return 'rain'
  if (/雾|霾|沙|尘/.test(w)) return 'fog'
  if (/阴/.test(w)) return 'cloud'
  if (/多云/.test(w)) return 'partly'
  return 'sun'
}

/* ------------------------------------------------------------------ *
 * 坐标：WGS-84 → GCJ-02
 * ------------------------------------------------------------------ */

const GCJ_A = 6378245.0
const GCJ_EE = 0.00669342162296594323

function outOfChina(lat: number, lng: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
  return ret
}

function transformLng(x: number, y: number) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
  return ret
}

/**
 * WGS-84（GPS / EXIF）→ GCJ-02（高德火星坐标）。
 * 只在中国大陆范围内偏移；境外原样返回（首版海外不启用高德底图）。
 */
export function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat, lng }
  if (outOfChina(lat, lng)) return { lat, lng }
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI)
  return { lat: lat + dLat, lng: lng + dLng }
}

/** 条目坐标 → 高德显示坐标（仅 GPS 来源需要转换；来源不明的旧记录按原值显示） */
export function toAmapLngLat(lat: number, lng: number, source?: string): [number, number] {
  if (source === 'gps') {
    const p = wgs84ToGcj02(lat, lng)
    return [p.lng, p.lat]
  }
  return [lng, lat]
}

/* ------------------------------------------------------------------ *
 * JS API 2.0 loader
 * ------------------------------------------------------------------ */

let loaderPromise: Promise<any | null> | null = null

function injectLoaderScript(): Promise<void> {
  if ((window as any).AMapLoader) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-jr-amap-loader]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('loader failed')))
      return
    }
    const script = document.createElement('script')
    script.src = LOADER_SRC
    script.async = true
    script.dataset.jrAmapLoader = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('loader failed'))
    document.head.appendChild(script)
  })
}

/**
 * 加载 AMap JS API 2.0。返回 AMap 命名空间；无密钥或网络失败返回 null。
 * 官方要求：必须在线加载 loader.js，且安全密钥要在 load 之前写入全局。
 */
export async function loadAmap(plugins: string[] = []): Promise<any | null> {
  const key = getAmapJsKey()
  if (!key) return null
  if (loaderPromise) return loaderPromise

  loaderPromise = (async () => {
    const security = getAmapSecurity()
    if (security) (window as any)._AMapSecurityConfig = { securityJsCode: security }
    try {
      await injectLoaderScript()
    } catch {
      loaderPromise = null
      return null
    }
    const loader = (window as any).AMapLoader
    if (!loader || typeof loader.load !== 'function') return null
    try {
      return await loader.load({ key, version: '2.0', plugins })
    } catch {
      // 密钥错误 / 配额 / 网络失败：允许用户改密钥后重试
      loaderPromise = null
      return null
    }
  })()

  return loaderPromise
}

/** 密钥变更后强制下次重新加载 */
export function resetAmapLoader() {
  loaderPromise = null
}
