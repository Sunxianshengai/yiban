/** 计量单位设置（原版 General → Units：公制/英制）；温度展示按单位换算，存储保持摄氏。 */
export function useUnits() {
  const unit = useState<'metric' | 'imperial'>('jr-unit', () => localStorage.getItem('jr.unit') === 'imperial' ? 'imperial' : 'metric')
  watch(unit, (value) => localStorage.setItem('jr.unit', value))
  function formatTemp(celsius?: number | null) {
    if (celsius == null) return ''
    return unit.value === 'imperial' ? `${Math.round(celsius * 9 / 5 + 32)}°F` : `${Math.round(celsius)}°C`
  }
  return { unit, formatTemp }
}
