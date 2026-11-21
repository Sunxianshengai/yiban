import { newClientId } from '../../utils/auth'
import { mediaPath, presignUpload } from '../../utils/blob'
import { hasDatabase, sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import {
  buildWecomTextReplyXml,
  decryptWecomPayload,
  downloadWecomMedia,
  encryptWecomReply,
  verifyWecomSignature,
  wecomConfig,
  xmlTag,
} from '../../utils/wecom'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toParagraphHtml(text: string): string {
  return text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('')
}

function extractHashTags(text: string): { cleanText: string; tags: string[] } {
  const tags: string[] = []
  const cleanText = text.replace(/#([\u4e00-\u9fa5\w-]{1,24})/g, (_m, tag: string) => {
    if (!tags.includes(tag)) tags.push(tag)
    return ''
  }).trim()
  return { cleanText: cleanText || text.trim(), tags }
}

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const cfg = wecomConfig()
  if (!cfg.token || !cfg.encodingAesKey || !cfg.corpId) {
    throw createError({ statusCode: 503, statusMessage: '服务端未配置企业微信回调密钥或企业 ID' })
  }

  const query = getQuery(event)
  const msgSig = String(query.msg_signature || '')
  const timestamp = String(query.timestamp || '')
  const nonce = String(query.nonce || '')
  const isUrlVerification = event.method === 'GET'
  const encrypted = isUrlVerification
    ? String(query.echostr || '')
    : xmlTag(await readRawBody(event, 'utf8') || '', 'Encrypt')

  if (!verifyWecomSignature(cfg.token, timestamp, nonce, encrypted, msgSig)) {
    if (isUrlVerification && (msgSig || encrypted)) {
      const reason = msgSig && timestamp && nonce && encrypted ? 'signature-mismatch' : 'missing-parameters'
      console.warn('[wecom] URL verification rejected:', reason)
    }
    throw createError({ statusCode: 403, statusMessage: '企业微信签名校验失败' })
  }

  let msgXml: string
  try {
    msgXml = decryptWecomPayload(cfg.encodingAesKey, encrypted, cfg.corpId)
  } catch (error) {
    if (isUrlVerification) {
      const reason = error instanceof Error && error.message === 'WECOM_CORP_ID mismatch'
        ? 'recipient-mismatch'
        : 'decryption-failed'
      console.warn('[wecom] URL verification rejected:', reason)
    }
    throw createError({ statusCode: 403, statusMessage: '企业微信回调解密失败' })
  }

  // 企业微信后台的 URL 验证要求直接返回解密后的原文。
  if (isUrlVerification) {
    console.info('[wecom] URL verification accepted')
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return msgXml
  }

  if (!hasDatabase()) {
    throw createError({ statusCode: 503, statusMessage: '数据库未配置' })
  }
  await ensureSchema()

  const fromUser = xmlTag(msgXml, 'FromUserName')
  const toUser = xmlTag(msgXml, 'ToUserName')
  const msgType = xmlTag(msgXml, 'MsgType') || 'text'
  const rawContent = xmlTag(msgXml, 'Content').trim()
  const picUrl = xmlTag(msgXml, 'PicUrl').trim()
  const mediaId = xmlTag(msgXml, 'MediaId').trim()
  const recognition = xmlTag(msgXml, 'Recognition').trim()
  const locX = Number(xmlTag(msgXml, 'Location_X'))
  const locY = Number(xmlTag(msgXml, 'Location_Y'))
  const locLabel = xmlTag(msgXml, 'Label').trim()

  const reply = (text: string) => {
    const plainReply = buildWecomTextReplyXml(fromUser, toUser || cfg.corpId, text)
    setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
    return encryptWecomReply(cfg.encodingAesKey, cfg.token, cfg.corpId, plainReply, timestamp, nonce)
  }

  if (!fromUser) return reply('未识别到发送者身份。')

  const q = sql()
  const bindMatch = rawContent.match(/^(?:绑定\s*)?(WX[0-9A-F]{4})$/i)
  if (msgType === 'text' && bindMatch) {
    const code = bindMatch[1]!.toUpperCase()
    const found = await q`
      select user_id from yiban_wecom_bindings where bind_code = ${code} limit 1
    `
    if (!found.length) {
      return reply(`未找到绑定码 ${code}，请在拾叙网页「云服务 → 企业微信同步」中确认最新绑定码。`)
    }
    const targetUserId = (found[0] as any).user_id as string
    // 确保一个企微账号同一时间只绑定一个日记账号
    await q`update yiban_wecom_bindings set wecom_user_id = null, bound_at = null where wecom_user_id = ${fromUser}`
    await q`
      update yiban_wecom_bindings
      set wecom_user_id = ${fromUser}, bound_at = now()
      where user_id = ${targetUserId}
    `
    return reply('🎉 绑定成功！现在起你在这里发送的文字、图片、定位或语音都会自动云同步到「拾叙」。\n• 加 #标签 可自动归类\n• 发送「撤回」可删除上一条')
  }

  const bindings = await q`
    select user_id, merge_window_sec, auto_family
    from yiban_wecom_bindings
    where wecom_user_id = ${fromUser}
    limit 1
  `
  if (!bindings.length) {
    return reply('你还没有绑定拾叙账号。请打开网页「云服务 → 企业微信同步」获取 6 位绑定码，然后回复「绑定 WXxxxx」。')
  }

  const binding = bindings[0] as { user_id: string; merge_window_sec: number; auto_family: boolean }
  const userId = binding.user_id

  if (msgType === 'text' && rawContent === '撤回') {
    const recent = await q`
      select client_id from yiban_entries
      where user_id = ${userId} and deleted_at is null and fields->>'source' = 'wecom'
      order by date_modified desc
      limit 1
    `
    if (!recent.length) return reply('没有可撤回的微信同步日记。')
    const cid = (recent[0] as any).client_id as string
    await q`
      update yiban_entries
      set deleted_at = now(), updated_at = now()
      where user_id = ${userId} and client_id = ${cid}
    `
    return reply('🗑️ 已将上一条微信日记移入回收站。')
  }

  // 解析内容、标签与定位
  let textToSave = ''
  let tags: string[] = []
  const extraFields: Record<string, any> = { source: 'wecom' }

  if (msgType === 'text') {
    const parsed = extractHashTags(rawContent)
    textToSave = parsed.cleanText
    tags = parsed.tags
  } else if (msgType === 'image') {
    textToSave = '📷 来自微信的图片记录'
  } else if (msgType === 'voice') {
    textToSave = recognition || '🎙️ 来自微信的语音记录'
  } else if (msgType === 'location') {
    textToSave = `📍 ${locLabel || '微信位置打卡'}`
    if (Number.isFinite(locX) && Number.isFinite(locY)) {
      extraFields.lat = locX
      extraFields.lng = locY
      extraFields.address = locLabel || `${locX.toFixed(4)}, ${locY.toFixed(4)}`
      extraFields.locationSource = 'wecom'
    }
  } else {
    textToSave = rawContent || `[${msgType}]`
  }

  if (binding.auto_family || tags.includes('家庭')) {
    extraFields.visibility = 'family'
  }

  const now = new Date()
  const mergeSec = Math.max(0, Number(binding.merge_window_sec ?? 120))
  let entryClientId = ''
  let merged = false

  if (mergeSec > 0) {
    const recentRows = await q`
      select client_id, text, preview_text, tags, fields, date_modified
      from yiban_entries
      where user_id = ${userId}
        and deleted_at is null
        and fields->>'source' = 'wecom'
        and date_modified >= ${new Date(now.getTime() - mergeSec * 1000).toISOString()}
      order by date_modified desc
      limit 1
    `
    if (recentRows.length) {
      const prev = recentRows[0] as any
      entryClientId = prev.client_id
      merged = true
      const appendHtml = msgType === 'image' ? '' : toParagraphHtml(textToSave)
      const nextHtml = `${prev.text || ''}${appendHtml}`
      const nextPreview = `${prev.preview_text || ''}${msgType === 'image' ? '' : ` ${textToSave}`}`.trim().slice(0, 200)
      const prevTags = Array.isArray(prev.tags) ? prev.tags : []
      const mergedTags = [...new Set([...prevTags, ...tags])].slice(0, 10)
      const mergedFields = { ...(prev.fields || {}), ...extraFields }
      await q`
        update yiban_entries
        set text = ${nextHtml},
            preview_text = ${nextPreview},
            tags = ${JSON.stringify(mergedTags)}::jsonb,
            fields = ${JSON.stringify(mergedFields)}::jsonb,
            date_modified = ${now.toISOString()},
            updated_at = now()
        where user_id = ${userId} and client_id = ${entryClientId}
      `
    }
  }

  if (!merged) {
    entryClientId = newClientId()
    const html = toParagraphHtml(textToSave)
    const preview = textToSave.replace(/\s+/g, ' ').trim().slice(0, 200)
    await q`
      insert into yiban_entries
        (user_id, client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at)
      values
        (${userId}, ${entryClientId}, ${html}, ${preview}, 'Asia/Shanghai', ${now.toISOString()},
         ${now.toISOString()}, ${JSON.stringify(extraFields)}::jsonb, ${JSON.stringify(tags.slice(0, 10))}::jsonb, null, now())
    `
  }

  let photoStatus = ''
  if (msgType === 'image') {
    const media = await downloadWecomMedia(cfg.corpId, cfg.corpSecret, mediaId, picUrl)
    if (media) {
      try {
        const ext = media.fileName.split('.').pop() || 'jpg'
        const pathname = mediaPath(userId, entryClientId, newClientId(), ext)
        const uploadUrl = await presignUpload(userId, {
          pathname,
          contentType: media.mimeType,
          maxBytes: Math.max(media.bytes.byteLength, 1),
        }, 5 * 60_000)
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': media.mimeType },
          body: media.bytes as unknown as BodyInit,
        })
        if (putRes.ok) {
          const countRows = await q`
            select count(*)::int as c from yiban_media
            where user_id = ${userId} and entry_client_id = ${entryClientId} and deleted_at is null
          `
          const pos = Number((countRows[0] as any)?.c ?? 0)
          await q`
            insert into yiban_media
              (user_id, client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position, deleted_at, updated_at)
            values
              (${userId}, ${newClientId()}, ${entryClientId}, ${pathname}, ${media.fileName}, ${media.mimeType},
               ${media.bytes.byteLength}, ${pos}, null, now())
          `
          photoStatus = '（图片已上传云相册）'
        }
      } catch {
        photoStatus = '（图片暂未转存，正文已保留）'
      }
    }
  }

  const tagNote = tags.length ? ` · 标签：${tags.map(t => `#${t}`).join(' ')}` : ''
  return reply(merged
    ? `✅ 已追加合并到刚刚的日记${photoStatus}${tagNote}`
    : `✅ 已云同步记入拾叙${photoStatus}${tagNote}`)
})
