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

const WMO: Record<number, [string, string]> = {
  0: ['sun', 'Clear sky'],
  1: ['partly', 'Mainly clear'],
  2: ['partly', 'Partly cloudy'],
  3: ['cloud', 'Overcast'],
  45: ['fog', 'Fog'],
  48: ['fog', 'Rime fog'],
  51: ['rain', 'Light drizzle'],
  53: ['rain', 'Drizzle'],
  55: ['rain', 'Dense drizzle'],
  61: ['rain', 'Light rain'],
  63: ['rain', 'Rain'],
  65: ['rain', 'Heavy rain'],
  71: ['snow', 'Light snow'],
  73: ['snow', 'Snow'],
  75: ['snow', 'Heavy snow'],
  80: ['rain', 'Rain showers'],
  81: ['rain', 'Showers'],
  82: ['rain', 'Violent showers'],
  95: ['storm', 'Thunderstorm'],
  96: ['storm', 'Thunderstorm + hail'],
  99: ['storm', 'Severe thunderstorm'],
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherNow | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
    if (!r.ok) return null
    const d = await r.json()
    const code = d?.current_weather?.weathercode
    const [icon, description] = WMO[code] || ['cloud', 'Unknown']
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
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`)
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
