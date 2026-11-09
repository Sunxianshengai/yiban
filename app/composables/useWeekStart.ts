type WeekStart = 'default' | 'monday' | 'sunday'
type LocaleWeekInfo = { firstDay: number }

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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

    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => LocaleWeekInfo
      weekInfo?: LocaleWeekInfo
    }
    return (locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1) % 7
  })
  const orderedWeekdays = computed(() => [
    ...weekdays.slice(firstDay.value),
    ...weekdays.slice(0, firstDay.value),
  ])

  return { weekStart, firstDay, orderedWeekdays }
}
