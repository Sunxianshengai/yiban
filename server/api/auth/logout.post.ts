import { endSession, requireUser } from '../../utils/auth'

/** 退出：删库里的会话行 + 清 cookie。 */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  await endSession(event)
  return { ok: true }
})
