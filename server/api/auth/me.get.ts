import { currentUser } from '../../utils/auth'

/** 当前登录状态；未登录返回 user:null（前端据此决定是否显示登录入口）。 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event)
  return { user }
})
