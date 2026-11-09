export interface DesktopBridge {
  emit(channel: 'appReady'): void
  invoke<T>(channel: string, payload?: unknown): Promise<T>
  on<T>(channel: string, listener: (value: T) => void): () => void
  pickDroppedFiles(files: File[], options: Record<string, unknown>): Promise<DesktopMediaReply>
}

export function desktopBridge() {
  return (window as Window & { journey?: DesktopBridge }).journey
}

export interface DesktopMediaReply {
  status: boolean
  errorCode?: string | null
  filePaths: string[]
  fileNames?: string[]
  metadata?: { date?: string | Date; timezone?: string; location?: { lat: number; lng: number } } | null
}

const mediaTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', webp: 'image/webp', avif: 'image/avif',
}

export async function readDesktopMedia(path: string, kind: 'editor' | 'importer', name?: string) {
  const url = new URL(path)
  if (url.protocol !== 'journey-files:' || url.hostname !== kind) throw new Error('Invalid desktop attachment reference.')
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not read the staged attachment.')
  const blob = await response.blob()
  const filename = name || decodeURIComponent(url.pathname.split('/').pop() || '')
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return new File([blob], filename, { type: mediaTypes[extension] || blob.type })
}

export async function readEditorMedia(bridge: DesktopBridge, paths: string[], names: string[] = []) {
  const files: File[] = []
  try {
    for (const [index, path] of paths.entries()) files.push(await readDesktopMedia(path, 'editor', names[index]))
  } finally {
    await Promise.allSettled(paths.map(filePath => bridge.invoke('removePickedFile', { filePath })))
  }
  return files
}

export async function stageDesktopRecording(file: File) {
  const bridge = desktopBridge()
  if (!bridge) return file
  const path = await bridge.invoke<string>('saveRecordedFile', { arrayBuffer: await file.arrayBuffer(), type: file.type })
  if (!path) throw new Error('Could not stage the audio note.')
  const [recording] = await readEditorMedia(bridge, [path], [file.name])
  if (!recording) throw new Error('Could not read the audio note.')
  return recording
}

export async function saveDesktopDocument(blob: Blob, name: string) {
  const bridge = desktopBridge()
  if (!bridge) return null
  const ext = name.split('.').pop() || ''
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '')
    reader.onerror = () => reject(new Error('Could not read the export.'))
    reader.readAsDataURL(blob)
  })
  return bridge.invoke<boolean>('exportBase64', {
    base64, title: 'Export journal', saveBtnLabel: 'Save', filterNameExt: ext.toUpperCase(), ext, name,
  })
}
