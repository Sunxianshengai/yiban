/**
 * 家庭组 UI 小工具。
 * 成员头像 = 昵称首字 + 按 userId 哈希取色：不存任何素材，同一人在时间线、详情、设置里颜色一致。
 */
const AVATAR_COLORS = ['#4CAF50', '#3F51B5', '#F59E0B', '#E91E63', '#00BCD4', '#8D6E63', '#7C4DFF', '#26A69A']

export function familyAvatarColor(userId: string): string {
  let h = 0
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function familyAvatarChar(nickname: string): string {
  return (nickname || '家').trim().slice(0, 1).toUpperCase() || '家'
}
