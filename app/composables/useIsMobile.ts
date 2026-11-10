/** ≤600px 视口视为手机（安卓壳断点）；桌面布局不受影响。 */
export function useIsMobile() {
  const isMobile = useState('jr-is-mobile', () => window.matchMedia('(max-width: 600px)').matches)
  onMounted(() => {
    const mq = window.matchMedia('(max-width: 600px)')
    const apply = () => { isMobile.value = mq.matches }
    apply()
    mq.addEventListener('change', apply)
    onBeforeUnmount(() => mq.removeEventListener('change', apply))
  })
  return isMobile
}
