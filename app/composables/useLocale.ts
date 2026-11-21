export type AppLocale = 'zh-CN' | 'zh-TW' | 'en'

const MESSAGES: Record<AppLocale, Record<string, string>> = {
  'zh-CN': {
    brand: '拾叙',
    timeline: '时间线',
    media: '相册',
    calendar: '日历',
    pal: '写作伙伴 (Pal)',
    odyssey: '日记问答',
    atlas: '位置历史记录',
    trash: '回收站',
    family: '我们的小家',
    settings: '设置',
    general: '通用',
    security: '安全',
    data: '数据',
    help: '帮助',
    appearance: '外观',
    colorTheme: '主题配色（13 套）',
    reminder: '定时提醒',
    locale: '语言与地区',
    spellcheck: '拼写检查',
    quickFilters: '快捷筛选',
    starred: '收藏',
    searchPlaceholder: '搜索日记、回忆、标签...',
    cloud: '云服务',
  },
  'zh-TW': {
    brand: '拾叙',
    timeline: '時間線',
    media: '相簿',
    calendar: '日曆',
    pal: '寫作夥伴 (Pal)',
    odyssey: '日記問答',
    atlas: '位置歷史記錄',
    trash: '回收桶',
    family: '我們的小家',
    settings: '設定',
    general: '一般',
    security: '安全性',
    data: '資料',
    help: '說明',
    appearance: '外觀',
    colorTheme: '主題配色（13 套）',
    reminder: '定時提醒',
    locale: '語言與地區',
    spellcheck: '拼字檢查',
    quickFilters: '快速篩選',
    starred: '收藏',
    searchPlaceholder: '搜尋日記、回憶、標籤...',
    cloud: '雲端服務',
  },
  en: {
    brand: '拾叙',
    timeline: 'Timeline',
    media: 'Media',
    calendar: 'Calendar',
    pal: 'Writing Pal',
    odyssey: 'Odyssey AI',
    atlas: 'Atlas',
    trash: 'Trash',
    family: 'Family Home',
    settings: 'Settings',
    general: 'General',
    security: 'Security',
    data: 'Data',
    help: 'Help',
    appearance: 'Appearance',
    colorTheme: 'Color Themes (13)',
    reminder: 'Daily Reminder',
    locale: 'Language & Region',
    spellcheck: 'Spellcheck',
    quickFilters: 'Quick Filters',
    starred: 'Starred',
    searchPlaceholder: 'Search entries, memories, tags...',
    cloud: 'Cloud Sync',
  },
}

export function useLocale() {
  const locale = useState<AppLocale>('jr.locale', () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('jr.locale')
      if (saved === 'zh-TW' || saved === 'en') return saved
    }
    return 'zh-CN'
  })

  if (import.meta.client) {
    watch(
      locale,
      (val) => {
        localStorage.setItem('jr.locale', val)
        document.documentElement.lang = val === 'en' ? 'en' : val === 'zh-TW' ? 'zh-Hant' : 'zh-Hans'
      },
      { immediate: true },
    )
  }

  function t(key: string) {
    return MESSAGES[locale.value]?.[key] ?? MESSAGES['zh-CN'][key] ?? key
  }

  return { locale, t }
}
