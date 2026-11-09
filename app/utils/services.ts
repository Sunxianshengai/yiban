/**
 * Free public service adapters for the replica (no API keys, CORS-enabled).
 * The original app talks to Journey's own endpoints (sync.journey.cloud etc. —
 * recorded in evidence/derived/contracts.json); those servers are not cloned.
 * These adapters fill the same UX roles with the replica's own services.
 */

export interface WeatherNow {
  icon: string
  degreeC: number
  description: string
}

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

export function weatherLabel(description?: string) {
  if (!description) return ''
  if (description === 'Unknown') return '未知天气'
  return legacyWeatherLabels.get(description) ?? description
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherNow | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
    if (!r.ok) return null
    const d = await r.json()
    const code = d?.current_weather?.weathercode
    const [icon, , description] = WMO[code] || ['cloud', 'Unknown', '未知天气']
    return { icon, degreeC: Math.round(d.current_weather.temperature), description }
  } catch {
    return null
  }
}

export interface PlaceHit {
  address: string
  lat: number
  lng: number
}

export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=zh-CN,zh&q=${encodeURIComponent(q)}`)
    if (!r.ok) return []
    const d = await r.json()
    return (d as any[]).map((h) => ({
      address: h.display_name as string,
      lat: Number(h.lat),
      lng: Number(h.lon),
    }))
  } catch {
    return []
  }
}

export const WEATHER_EMOJI: Record<string, string> = {
  sun: '☀️', partly: '🌤', cloud: '☁️', fog: '🌫', rain: '🌧', snow: '🌨', storm: '⛈',
}
