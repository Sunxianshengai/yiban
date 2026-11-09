type WeekStart = 'default' | 'monday' | 'sunday'
type LocaleWeekInfo = { firstDay: number }

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const storageKey = 'jr.firstDayOfWeek'

export function useWeekStart() {
  const preference = useState<WeekStart>('week-start', () => {
    const saved = localStorage.getItem(storageKey)
    return saved === 'monday' || saved === 'sunday' ? saved : 'default'
  })
  const weekStart = computed({
    get: () => preference.value,
    set: (value: WeekStart) => {
      localStorage.setItem(storageKey, value)
      preference.value = value
    },
  })
  const firstDay = computed(() => {
    if (weekStart.value === 'monday') return 1
    if (weekStart.value === 'sunday') return 0
    // 原版默认周日开始（2026-11-10 原版日历实测：Sun 起始列），不跟随 locale
    return 0
  })
  const orderedWeekdays = computed(() => [
    ...weekdays.slice(firstDay.value),
    ...weekdays.slice(0, firstDay.value),
  ])

  return { weekStart, firstDay, orderedWeekdays }
}
