import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * 企业微信（WeCom）官方回调加解密与 XML 消息解析工具（零外部依赖，基于 node:crypto）。
 */

export function wecomConfig() {
  return {
    token: (process.env.WECOM_TOKEN || '').trim(),
    encodingAesKey: (process.env.WECOM_ENCODING_AES_KEY || '').trim(),
    corpId: (process.env.WECOM_CORP_ID || '').trim(),
    corpSecret: (process.env.WECOM_CORP_SECRET || '').trim(),
  }
}

export function wecomSignature(token: string, timestamp: string, nonce: string, encrypted: string): string {
  const sorted = [token, timestamp, nonce, encrypted].sort().join('')
  return createHash('sha1').update(sorted).digest('hex')
}

export function verifyWecomSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypted: string,
  expectedSig: string,
): boolean {
  if (!token || !timestamp || !nonce || !encrypted || !expectedSig) return false
  return wecomSignature(token, timestamp, nonce, encrypted) === expectedSig
}

function pkcs7Unpad(buf: Buffer): Buffer {
  const pad = buf[buf.length - 1] ?? 0
  if (pad < 1 || pad > 32) return buf
  return buf.subarray(0, buf.length - pad)
}

function pkcs7Pad(buf: Buffer): Buffer {
  const blockSize = 32
  const amount = blockSize - (buf.length % blockSize)
  return Buffer.concat([buf, Buffer.alloc(amount, amount)])
}

export function decryptWecomPayload(encodingAesKey: string, encryptedB64: string, expectedCorpId: string): string {
  const aesKey = Buffer.from(`${encodingAesKey}=`, 'base64')
  const iv = aesKey.subarray(0, 16)
  const decipher = createDecipheriv('aes-256-cbc', aesKey, iv)
  decipher.setAutoPadding(false)
  const decrypted = pkcs7Unpad(Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64')), decipher.final()]))
  // 格式：16 bytes random + 4 bytes network-order msgLen + msg + receiveId (CorpID)
  const msgLen = decrypted.readUInt32BE(16)
  const content = decrypted.subarray(20, 20 + msgLen).toString('utf8')
  const receiveId = decrypted.subarray(20 + msgLen).toString('utf8')
  if (receiveId !== expectedCorpId) {
    throw new Error('WECOM_CORP_ID mismatch')
  }
  return content
}

export function encryptWecomReply(
  encodingAesKey: string,
  token: string,
  corpId: string,
  plainXml: string,
  timestamp: string,
  nonce: string,
): string {
  const aesKey = Buffer.from(`${encodingAesKey}=`, 'base64')
  const iv = aesKey.subarray(0, 16)
  const random16 = randomBytes(16)
  const msgBuf = Buffer.from(plainXml, 'utf8')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(msgBuf.length, 0)
  const corpBuf = Buffer.from(corpId, 'utf8')
  const raw = pkcs7Pad(Buffer.concat([random16, lenBuf, msgBuf, corpBuf]))
  const cipher = createCipheriv('aes-256-cbc', aesKey, iv)
  cipher.setAutoPadding(false)
  const encrypt = Buffer.concat([cipher.update(raw), cipher.final()]).toString('base64')
  const sig = wecomSignature(token, timestamp, nonce, encrypt)
  return [
    '<xml>',
    `<Encrypt><![CDATA[${encrypt}]]></Encrypt>`,
    `<MsgSignature><![CDATA[${sig}]]></MsgSignature>`,
    `<TimeStamp>${timestamp}</TimeStamp>`,
    `<Nonce><![CDATA[${nonce}]]></Nonce>`,
    '</xml>',
  ].join('')
}

export function xmlTag(xml: string, tag: string): string {
  const cdata = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
  if (cdata) return cdata[1] ?? ''
  const plain = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'))
  return plain?.[1]?.trim() ?? ''
}

export function buildWecomTextReplyXml(toUser: string, fromUser: string, content: string): string {
  const nowSec = Math.floor(Date.now() / 1000)
  return [
    '<xml>',
    `<ToUserName><![CDATA[${toUser}]]></ToUserName>`,
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>`,
    `<CreateTime>${nowSec}</CreateTime>`,
    '<MsgType><![CDATA[text]]></MsgType>',
    `<Content><![CDATA[${content}]]></Content>`,
    '</xml>',
  ].join('')
}

let cachedToken: { value: string; expiresAt: number } | null = null

export async function getWecomAccessToken(corpId: string, corpSecret: string): Promise<string | null> {
  if (!corpId || !corpSecret) return null
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value
  try {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`,
    )
    const data = await res.json() as { errcode?: number; access_token?: string; expires_in?: number }
    if (data.errcode === 0 && data.access_token) {
      cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + (Number(data.expires_in) || 7200) * 1000,
      }
      return data.access_token
    }
  } catch { /* ignore */ }
  return null
}

export async function downloadWecomMedia(
  corpId: string,
  corpSecret: string,
  mediaId: string,
  picUrl?: string,
): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string } | null> {
  if (picUrl) {
    try {
      const res = await fetch(picUrl)
      if (res.ok) {
        const mimeType = res.headers.get('content-type') || 'image/jpeg'
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (bytes.byteLength > 0) return { bytes, mimeType, fileName: `wecom-${Date.now()}.jpg` }
      }
    } catch { /* fallback to mediaId */ }
  }
  if (!mediaId || !corpId || !corpSecret) return null
  const token = await getWecomAccessToken(corpId, corpSecret)
  if (!token) return null
  try {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/media/get?access_token=${encodeURIComponent(token)}&media_id=${encodeURIComponent(mediaId)}`,
    )
    if (!res.ok) return null
    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    if (mimeType.includes('application/json')) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (!bytes.byteLength) return null
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    return { bytes, mimeType, fileName: `wecom-${Date.now()}.${ext}` }
  } catch {
    return null
  }
}
