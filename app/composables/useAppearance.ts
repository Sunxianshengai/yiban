type Theme = 'System' | 'Light' | 'Dark'
type FontSize = 'Small' | 'Medium' | 'Large'

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

/** 应用第 idx 个彩色主题（0=默认，1-13=会员），dark 决定取 lightN/darkN 组 */
export function applyColorTheme(idx: number, dark: boolean) {
  const el = document.documentElement
  if (idx <= 0) {
    for (const [cssVar] of ROLE_MAP) el.style.removeProperty(cssVar)
    return
  }
  const t = JR_THEMES[`${dark ? 'dark' : 'light'}${idx}`]
  if (!t) return
  for (const [cssVar, role] of ROLE_MAP) {
    const v = t.colors[role]
    if (v) el.style.setProperty(cssVar, v)
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
  return { theme, fontSize, colorTheme }
}
