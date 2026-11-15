export interface ReminderConfig {
  enabled: boolean
  time: string
  lastFiredDate: string
}

const STORAGE_KEY = 'jr.reminder'
let tickerTimer: number | null = null

export function useReminder() {
  const config = useState<ReminderConfig>('jr.reminder', () => {
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          return {
            enabled: Boolean(parsed.enabled),
            time: /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : '21:00',
            lastFiredDate: typeof parsed.lastFiredDate === 'string' ? parsed.lastFiredDate : '',
          }
        }
      } catch { /* ignore */ }
    }
    return { enabled: false, time: '21:00', lastFiredDate: '' }
  })

  const permission = useState<NotificationPermission | 'unsupported'>('jr.reminderPerm', () => {
    if (import.meta.client && 'Notification' in window) return Notification.permission
    return 'unsupported'
  })

  if (import.meta.client) {
    watch(
      config,
      (val) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      },
      { deep: true },
    )
  }

  async function requestPermission() {
    if (!import.meta.client || !('Notification' in window)) {
      permission.value = 'unsupported'
      return 'unsupported' as const
    }
    const res = await Notification.requestPermission()
    permission.value = res
    return res
  }

  function fireNotification(title: string, body: string) {
    if (import.meta.client && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
      return true
    }
    return false
  }

  async function testReminder() {
    if (permission.value === 'default') await requestPermission()
    const sent = fireNotification('旅程日记 · 写作提醒', '今天发生了什么值得记下的小事？花一分钟写一篇日记吧。')
    return sent
  }

  function checkDue() {
    if (!config.value.enabled) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)
    if (hhmm === config.value.time && config.value.lastFiredDate !== today) {
      config.value.lastFiredDate = today
      fireNotification('旅程日记 · 每日写作提醒', `已经到 ${config.value.time} 了，记录一下今天的感受吧。`)
    }
  }

  function startReminderTicker() {
    if (!import.meta.client || tickerTimer !== null) return
    checkDue()
    tickerTimer = window.setInterval(checkDue, 30_000)
  }

  return { config, permission, requestPermission, testReminder, startReminderTicker }
}
