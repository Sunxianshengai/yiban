/**
 * 天气/地点的展示层工具（原版契约的复刻部分）。
 *
 * 数据来源已迁到高德 Web 服务（见 `~/utils/amap`）：
 * - 地点搜索 → `searchAmapPlaces`
 * - 逆地理编码 → `reverseGeocodeAmap`
 * - 实况天气 → `fetchAmapWeather`（按行政区编码查）
 * - 坐标转换 → `wgs84ToGcj02`
 *
 * 这里只保留纯展示用的映射：原版把天气存成英文描述（`weatherDescription`），
 * 详情页/时间线用 `weatherLabel()` 转中文、`WEATHER_EMOJI` 取图标。
 * 历史条目里可能还是旧的 WMO 英文描述，映射表同时覆盖高德中文天气词。
 */

export interface WeatherNow {
  icon: string
  degreeC: number
  description: string
}

/** 原版 WMO 英文描述 → [图标键, 英文, 中文]（旧条目兼容，勿删） */
const WMO: Record<number, [string, string, string]> = {
  0: ['sun', 'Clear sky', '晴'],
  1: ['partly', 'Mainly clear', '大部晴朗'],
  2: ['partly', 'Partly cloudy', '晴间多云'],
  3: ['cloud', 'Overcast', '阴'],
  45: ['fog', 'Fog', '雾'],
  48: ['fog', 'Rime fog', '冻雾'],
  51: ['rain', 'Light drizzle', '小毛毛雨'],
  53: ['rain', 'Drizzle', '毛毛雨'],
  55: ['rain', 'Dense drizzle', '较强毛毛雨'],
  61: ['rain', 'Light rain', '小雨'],
  63: ['rain', 'Rain', '中雨'],
  65: ['rain', 'Heavy rain', '大雨'],
  71: ['snow', 'Light snow', '小雪'],
  73: ['snow', 'Snow', '中雪'],
  75: ['snow', 'Heavy snow', '大雪'],
  80: ['rain', 'Rain showers', '小阵雨'],
  81: ['rain', 'Showers', '阵雨'],
  82: ['rain', 'Violent showers', '强阵雨'],
  95: ['storm', 'Thunderstorm', '雷雨'],
  96: ['storm', 'Thunderstorm + hail', '雷雨伴冰雹'],
  99: ['storm', 'Severe thunderstorm', '强雷雨'],
}

const legacyWeatherLabels = new Map(Object.values(WMO).map(([, original, label]) => [original, label]))

/** 高德天气词 → 中文（高德返回的就是中文，个别组合做规整） */
const AMAP_WEATHER_LABELS: Record<string, string> = {
  晴: '晴',
  少云: '少云',
  晴间多云: '晴间多云',
  多云: '多云',
  阴: '阴',
  阵雨: '阵雨',
  雷阵雨: '雷阵雨',
  雷阵雨伴有冰雹: '雷阵雨伴冰雹',
  小雨: '小雨',
  中雨: '中雨',
  大雨: '大雨',
  暴雨: '暴雨',
  大暴雨: '大暴雨',
  特大暴雨: '特大暴雨',
  冻雨: '冻雨',
  雨夹雪: '雨夹雪',
  小雪: '小雪',
  中雪: '中雪',
  大雪: '大雪',
  暴雪: '暴雪',
  雾: '雾',
  霾: '霾',
  浮尘: '浮尘',
  扬沙: '扬沙',
  沙尘暴: '沙尘暴',
  强沙尘暴: '强沙尘暴',
  未知: '未知天气',
}

/**
 * 把条目里的天气描述转成中文显示。
 * 依次尝试：高德中文词 → 原版 WMO 英文描述 → 原样返回。
 */
export function weatherLabel(description?: string) {
  if (!description) return ''
  if (description === 'Unknown') return '未知天气'
  return AMAP_WEATHER_LABELS[description] ?? legacyWeatherLabels.get(description) ?? description
}

export const WEATHER_EMOJI: Record<string, string> = {
  sun: '☀️', partly: '🌤', cloud: '☁️', fog: '🌫', rain: '🌧', snow: '🌨', storm: '⛈',
}

/** 天气图标键的中文名（无障碍标签/提示用） */
export const WEATHER_ICON_LABELS: Record<string, string> = {
  sun: '晴', partly: '多云', cloud: '阴', fog: '雾', rain: '雨', snow: '雪', storm: '雷雨',
}
