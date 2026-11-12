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

/** Day One 换皮（M-2xx）：13 套彩色主题退役（Day One 实测仅浅/深/系统三态，见 journey-replica/docs/dayone-ui-ledger.md O12）。
 *  保留函数签名兼容旧调用点；任何历史 colorTheme 值一律清空回默认 token。 */
export function applyColorTheme(_idx: number, _dark: boolean) {
  const el = document.documentElement
  for (const [cssVar] of ROLE_MAP) el.style.removeProperty(cssVar)
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
