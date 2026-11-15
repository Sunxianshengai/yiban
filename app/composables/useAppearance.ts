import { JR_THEMES } from '~/utils/themesRegistry'

export type Theme = 'System' | 'Light' | 'Dark'
export type FontSize = 'Small' | 'Medium' | 'Large'
export type ThemeStyle = 'dayone' | 'moleskine'

// --jr-* 变量与原版 M3 角色的映射（themesRegistry.ts 逐字来自原版 bundle）
const ROLE_MAP: Array<[cssVar: string, role: string]> = [
  ['--jr-primary', 'primary'],
  ['--jr-on-primary', 'onPrimary'],
  ['--jr-primary-container', 'primaryContainer'],
  ['--jr-on-primary-container', 'onPrimaryContainer'],
  ['--jr-primary-fixed-dim', 'primaryFixedDim'],
  ['--jr-secondary', 'secondary'],
  ['--jr-secondary-container', 'secondaryContainer'],
  ['--jr-on-secondary-container', 'onSecondaryContainer'],
  ['--jr-tertiary', 'tertiary'],
  ['--jr-error', 'error'],
  ['--jr-error-container', 'errorContainer'],
  ['--jr-bg', 'background'],
  ['--jr-on-bg', 'onBackground'],
  ['--jr-surface', 'surface'],
  ['--jr-surface-variant', 'surfaceVariant'],
  ['--jr-on-surface-variant', 'onSurfaceVariant'],
  ['--jr-outline', 'outline'],
  ['--jr-outline-variant', 'outlineVariant'],
]

export const COLOR_THEME_NAMES = [
  '默认天青',
  '玫瑰绯红',
  '樱花粉黛',
  '晨曦珊瑚',
  '琥珀暖阳',
  '麦穗金秋',
  '苔原青柠',
  '森系翡翠',
  '薄荷海盐',
  '晴空湛蓝',
  '深海靛青',
  '薰衣草紫',
  '暮色梅子',
  '极简石墨',
] as const

export function getColorThemeSwatches(dark: boolean) {
  return COLOR_THEME_NAMES.map((name, index) => {
    const key = `${dark ? 'dark' : 'light'}${index}`
    const colors = JR_THEMES[key]?.colors
    return {
      index,
      name,
      primary: colors?.primary ?? '#00687B',
      container: colors?.primaryContainer ?? '#AFECFF',
      surface: colors?.surface ?? '#F5FAFC',
    }
  })
}

export function applyColorTheme(idx: number, dark: boolean) {
  const el = document.documentElement
  if (!Number.isInteger(idx) || idx <= 0 || idx > 13) {
    for (const [cssVar] of ROLE_MAP) el.style.removeProperty(cssVar)
    return
  }
  const palette = JR_THEMES[`${dark ? 'dark' : 'light'}${idx}`]?.colors
  if (!palette) {
    for (const [cssVar] of ROLE_MAP) el.style.removeProperty(cssVar)
    return
  }
  for (const [cssVar, role] of ROLE_MAP) {
    const value = palette[role]
    if (value) el.style.setProperty(cssVar, value)
    else el.style.removeProperty(cssVar)
  }
}

export function useAppearance() {
  const theme = useState<Theme>('appearance-theme', () => {
    const saved = localStorage.getItem('jr.theme')
    return saved === 'Light' || saved === 'Dark' ? saved : 'System'
  })
  const fontSize = useState<FontSize>('appearance-font-size', () => {
    const saved = localStorage.getItem('jr.fontSize')
    return saved === 'Small' || saved === 'Large' ? saved : 'Medium'
  })
  const colorTheme = useState<number>('appearance-color-theme', () => {
    const saved = Number(localStorage.getItem('jr.colorTheme'))
    return Number.isInteger(saved) && saved >= 0 && saved <= 13 ? saved : 0
  })
  const themeStyle = useState<ThemeStyle>('appearance-theme-style', () => {
    const saved = localStorage.getItem('jr.themeStyle')
    return saved === 'moleskine' ? 'moleskine' : 'dayone'
  })
  return { theme, fontSize, colorTheme, themeStyle }
}
