/**
 * Pal 房间的星星经济（诚实版代币）—— M-122 扩充。
 *
 * 原版走云端代币（/user/tokens/rewards/claim + rewards/gem.png，见 evidence/derived/pal-totems/README.md），
 * 复刻为纯本地：写一篇日记 +1⭐，当天第一篇再 +1⭐；目录里部分家具标价⭐，写日记攒够了才能摆。
 * 全部存 localStorage，不碰云同步。
 */
import type { PalTotemDef } from '~/utils/palTotemDefs'

const KEY_COUNT = 'jr.palStars'
const KEY_UNLOCKED = 'jr.palUnlocked'
const KEY_LAST_DAY = 'jr.palStarLastDay'

export function usePalStars() {
  const count = useState<number>('jr.palStarsCount', () => {
    try { return Number(localStorage.getItem(KEY_COUNT)) || 0 } catch { return 0 }
  })
  const unlocked = useState<string[]>('jr.palStarsUnlocked', () => {
    try { return JSON.parse(localStorage.getItem(KEY_UNLOCKED) || '[]') as string[] } catch { return [] }
  })

  function persist() {
    try {
      localStorage.setItem(KEY_COUNT, String(count.value))
      localStorage.setItem(KEY_UNLOCKED, JSON.stringify(unlocked.value))
    } catch { /* 隐私模式写不进去就忽略 */ }
  }

  /** 保存一篇日记的奖励：+1⭐，当天第一篇额外 +1⭐。返回本次到手的数量。 */
  function awardForSave(): number {
    let earned = 1
    const today = new Date().toISOString().slice(0, 10)
    let lastDay = ''
    try { lastDay = localStorage.getItem(KEY_LAST_DAY) || '' } catch { /* 忽略 */ }
    if (lastDay !== today) {
      earned = 2
      try { localStorage.setItem(KEY_LAST_DAY, today) } catch { /* 忽略 */ }
    }
    count.value += earned
    persist()
    return earned
  }

  const isLocked = (def: PalTotemDef) => !!def.cost && !unlocked.value.includes(def.id)

  /** 花⭐解锁一件家具；余额不够或已解锁返回 false */
  function unlock(def: PalTotemDef): boolean {
    if (!def.cost || unlocked.value.includes(def.id)) return false
    if (count.value < def.cost) return false
    count.value -= def.cost
    unlocked.value = [...unlocked.value, def.id]
    persist()
    return true
  }

  /** 距离解锁还差几颗（已解锁为 0） */
  function missingFor(def: PalTotemDef): number {
    if (!def.cost || unlocked.value.includes(def.id)) return 0
    return Math.max(0, def.cost - count.value)
  }

  return { count, unlocked, awardForSave, isLocked, unlock, missingFor }
}
