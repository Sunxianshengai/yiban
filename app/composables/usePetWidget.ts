/**
 * 主界面里那只「瞌睡小羊」的显隐开关。
 *
 * 侧栏 / 移动顶栏 / 设置三处入口共用同一份 useState，避免各按各的；
 * 状态写进 localStorage，刷新后还记得用户是开着还是关着。
 * 独立 /pet 页和 Electron 透明覆盖层不走这里（它们由托盘控制）。
 */
const KEY = 'jr.petVisible'

export function usePetWidget() {
  const visible = useState<boolean>('jr.petVisible', () => {
    try { return localStorage.getItem(KEY) !== '0' } catch { return true }
  })
  function setVisible(v: boolean) {
    visible.value = v
    try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* 隐私模式写不进去就忽略 */ }
  }
  function toggle() { setVisible(!visible.value) }
  return { visible, setVisible, toggle }
}
