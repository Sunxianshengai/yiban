import { z } from 'zod'
import { findUser, startSession, verifyPassword } from '../../utils/auth'

const credentials = z.object({
  email: z.string().trim().min(3).max(200).email('邮箱格式不对'),
  password: z.string().min(8, '密码至少 8 位').max(200),
})

/** 登录。用户不存在与密码错误返回同一句，避免探测注册情况。 */
export default defineEventHandler(async (event) => {
  const body = credentials.parse(await readBody(event))
  const row = await findUser(body.email)
  if (!row || !(await verifyPassword(body.password, row.password_hash, row.password_salt))) {
    throw createError({ statusCode: 401, statusMessage: '邮箱或密码不对' })
  }
  await startSession(event, row.id)
  return { user: { id: row.id, email: row.email } }
})
