type Theme = 'System' | 'Light' | 'Dark'
type FontSize = 'Small' | 'Medium' | 'Large'

export function useAppearance() {
  const theme = useState<Theme>('appearance-theme', () => {
    const saved = localStorage.getItem('jr.theme')
    return saved === 'Light' || saved === 'Dark' ? saved : 'System'
  })
  const fontSize = useState<FontSize>('appearance-font-size', () => {
    const saved = localStorage.getItem('jr.fontSize')
    return saved === 'Small' || saved === 'Large' ? saved : 'Medium'
  })
  return { theme, fontSize }
}
