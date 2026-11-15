export interface E2eeMetadata {
  enabled: boolean
  fingerprint: string
  saltB64: string
  recoveryCodeHash: string
  createdAt: string
}

const STORAGE_KEY = 'jr.e2ee'

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function formatRecoveryKey(rawBytes: Uint8Array): string {
  const hex = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return hex.match(/.{1,4}/g)?.join('-') ?? hex
}

export async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function loadE2eeMetadata(): E2eeMetadata | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as E2eeMetadata : null
  } catch {
    return null
  }
}

export async function enableE2ee(passphrase: string): Promise<{ meta: E2eeMetadata; recoveryKey: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(16))
  const recoveryKey = formatRecoveryKey(recoveryBytes)
  const key = await deriveAesKey(passphrase, salt)
  const rawHash = await sha256Hex(`${passphrase}:${toB64(salt)}`)
  const meta: E2eeMetadata = {
    enabled: true,
    fingerprint: rawHash.slice(0, 12).toUpperCase(),
    saltB64: toB64(salt),
    recoveryCodeHash: await sha256Hex(recoveryKey),
    createdAt: new Date().toISOString(),
  }
  // Verify AES-GCM encryption works immediately
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('journey-e2ee-ok'))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  if (new TextDecoder().decode(plain) !== 'journey-e2ee-ok') throw new Error('E2EE verify failed')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  return { meta, recoveryKey }
}

export async function verifyE2eePassphrase(passphrase: string): Promise<boolean> {
  const meta = loadE2eeMetadata()
  if (!meta) return false
  const hash = await sha256Hex(`${passphrase}:${meta.saltB64}`)
  if (hash.slice(0, 12).toUpperCase() !== meta.fingerprint) return false
  const key = await deriveAesKey(passphrase, fromB64(meta.saltB64))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('ok'))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain) === 'ok'
}

export async function verifyRecoveryKey(recoveryKey: string): Promise<boolean> {
  const meta = loadE2eeMetadata()
  if (!meta) return false
  const normalized = recoveryKey.trim().toUpperCase()
  return (await sha256Hex(normalized)) === meta.recoveryCodeHash
}

export function disableE2ee() {
  if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
}
