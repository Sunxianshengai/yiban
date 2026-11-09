import { desktopBridge, readDesktopMedia } from './desktopBridge'
import { mdToHtml } from './importers'
import type { ImportedEntry } from './importers'
import { journalActivity, journalSentiment } from './journalOptions'
import { importJournalEntries } from './journalZip'

interface NativeImportEntry {
  mediaFilePaths: string[]
  entryContent: {
    entryDate: string | Date
    text?: string
    type?: string
    tags?: string[]
    favourite?: boolean
    timezone?: string
    address?: string
    location?: { lat: number; lng: number }
    music?: { artist?: string; title?: string }
    weather?: { id?: number; icon?: string; description?: string; degreeC?: number; place?: string }
    activity?: string | number
    sentiment?: string | number
    replicaMediaNames?: string[]
  }
}

export async function importFromDesktop() {
  const bridge = desktopBridge()
  if (!bridge) throw new Error('桌面导入暂不可用。')
  const linkedAccountId = 'replica-local'
  const picked = await bridge.invoke<{ status: boolean; errorCode?: string; importedFileDestinationPath?: string }>('pickFile', { linkedAccountId })
  if (!picked.status || !picked.importedFileDestinationPath) {
    if (picked.errorCode && !picked.errorCode.endsWith('ImportCancelled')) throw new Error('无法打开导入文件。')
    return null
  }
  const events: NativeImportEntry[] = []
  const off = bridge.on<NativeImportEntry>('importEntry', entry => events.push(entry))
  let failures: { errorCode?: string; passphrase?: boolean }[]
  try {
    failures = await bridge.invoke<typeof failures>('importFile', {
      linkedAccountId, importedFileDestinationPath: picked.importedFileDestinationPath, userIsPaid: false,
    })
  } finally { off() }
  if (!Array.isArray(failures)) throw new Error('无法读取导入压缩包。')
  if (failures.some(item => item.passphrase)) throw new Error('请先解密压缩包再导入。')
  if (!events.length) throw new Error('文件中没有可导入的日记。')

  const imported: ImportedEntry[] = []
  let skipped = failures.length
  for (const { entryContent: entry, mediaFilePaths } of events) {
    const date = new Date(entry.entryDate)
    if (!Number.isFinite(+date)) { skipped++; continue }
    const attachments: File[] = []
    for (const [index, path] of mediaFilePaths.entries()) {
      try { attachments.push(await readDesktopMedia(path, 'importer', entry.replicaMediaNames?.[index])) }
      catch { skipped++ }
    }
    const lat = entry.location?.lat
    const lng = entry.location?.lng
    const validLocation = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    const degree = entry.weather?.degreeC
    imported.push({
      date, attachments, favourite: entry.favourite, tags: Array.isArray(entry.tags) ? entry.tags : [],
      text: entry.type === 'html' ? entry.text || '' : mdToHtml(entry.text || ''),
      meta: {
        address: entry.address, timezone: entry.timezone, lat: validLocation ? lat : undefined, lng: validLocation ? lng : undefined,
        musicArtist: entry.music?.artist, musicTitle: entry.music?.title,
        weatherId: entry.weather?.id, weatherIcon: entry.weather?.icon, weatherPlace: entry.weather?.place,
        weatherDescription: entry.weather?.description, weatherDegreeC: degree === Number.MAX_VALUE ? undefined : degree,
        sentiment: journalSentiment(entry.sentiment)?.value, activity: journalActivity(entry.activity)?.value,
      },
    })
  }
  if (!imported.length) throw new Error('导入文件中没有日期有效的日记。')
  return { count: await importJournalEntries(imported), skipped }
}
