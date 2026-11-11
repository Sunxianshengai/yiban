import { z } from 'zod'
import { createUser, findUser, startSession } from '../../utils/auth'

const credentials = z.object({
  email: z.string().trim().min(3).max(200).email('邮箱格式不对'),
  password: z.string().min(8, '密码至少 8 位').max(200),
})

/** 注册并直接建立会话。 */
export default defineEventHandler(async (event) => {
  const body = credentials.parse(await readBody(event))
  if (await findUser(body.email)) throw createError({ statusCode: 409, statusMessage: '这个邮箱已经注册过了' })
  const user = await createUser(body.email, body.password)
  await startSession(event, user.id)
  return { user }
})
