import Dexie, { type Table } from 'dexie'

/**
 * Data layer mirrored from Journey Desktop 6.0.1 JourneyDB schema
 * (evidence/derived/dexie-schema.json). Local journal uses linkedAccountId ''.
 */

export interface EntryV2 {
  id?: number
  externalId?: string
  linkedAccountId: string
  text: string
  previewText: string
  timezone: string
  dateOfJournal: Date
  dateModified: Date
  synced: number
  version?: number
  address?: string
  musicArtist?: string
  musicTitle?: string
  lat?: number
  lng?: number
  weatherId?: number
  weatherDegreeC?: number
  weatherDescription?: string
  weatherIcon?: string
  weatherPlace?: string
  activity?: string
  sentiment?: string
  favourite?: number
  type?: string
  alias?: string
  tagWordIds?: number[]
  yearToken?: string
  monthToken?: string
  dayToken?: string
  hourToken?: string
  minuteToken?: string
}

export interface TrashV2 {
  id?: number
  jId?: string
  linkedAccountId: string
  externalId?: string
  type?: string
}

export interface TagWordV2 {
  id?: number
  linkedAccountId: string
  externalId?: string
  title: string
}

export interface TemplateRow {
  id?: number
  name: string
  content: string
  contentType: string
  updatedAt: Date
}

class JourneyReplicaDB extends Dexie {
  entriesV2!: Table<EntryV2, number>
  trashesV2!: Table<TrashV2, number>
  tagWordsV2!: Table<TagWordV2, number>
  templates!: Table<TemplateRow, number>

  constructor() {
    super('JourneyDB')
    this.version(1).stores({
      linkedAccounts: 'id,displayName,emailLower,lastSyncStatus,lastSyncDate,linkedAccountId,pageToken,pageToken2,pageToken3,pageToken4,src,toBeDownloaded,updatedAt,publicKey,encryptedPrivateKey,passphrase,firstTimeSynced,pauseSync',
      entriesV1: 'jId,address,dateOfJournal,dateModified,synced,googleFId,version,favourite,label,lat,lon,mood,musicArtist,musicTitle,weatherId,weatherDegreeC,weatherDesc,weatherIcon,weatherPlace,folder,sentiment,timezone,type,text,previewText,linkedAccountId,*tagWordIds,yearToken,monthToken,dayToken,hourToken,minuteToken,[linkedAccountId+dateOfJournal],[linkedAccountId+jId],[linkedAccountId+googleFId],[linkedAccountId+lat+lon],[linkedAccountId+synced],[linkedAccountId+yearToken+monthToken+dayToken],[linkedAccountId+monthToken+dayToken]',
      mediaFilesV1: 'mId,name,synced,jId,googleFId,uploadDate,compressed,mimeType,ext,linkedAccountId,[linkedAccountId+jId],[linkedAccountId+googleFId],[linkedAccountId+mId],[linkedAccountId+googleFId+synced]',
      trashesV1: '++id,jId,linkedAccountId,googleFId,[linkedAccountId+googleFId]',
      tagWordsV1: '++id,linkedAccountId,titleLower,[linkedAccountId+id],[linkedAccountId+titleLower]',
      filesToDownloadV1: '++id,linkedAccountId,googleFId,name,mimeType,hasThumbnail,version,[linkedAccountId+googleFId]',
      entriesV2: '++id,externalId,linkedAccountId,text,previewText,timezone,dateOfJournal,dateModified,synced,version,address,musicArtist,musicTitle,lat,lng,weatherId,weatherDegreeC,weatherDescription,weatherIcon,weatherPlace,activity,sentiment,favourite,type,alias,*tagWordIds,yearToken,monthToken,dayToken,hourToken,minuteToken,[linkedAccountId+dateOfJournal],[linkedAccountId+lat+lng],[linkedAccountId+jId],[linkedAccountId+id],[linkedAccountId+externalId],[linkedAccountId+synced],[linkedAccountId+yearToken+monthToken+dayToken],[linkedAccountId+monthToken+dayToken]',
      mediaFilesV2: '++id,externalId,linkedAccountId,jId,fileMetadataDate,createdAt,fileName,mimeType,ext,position,alias,uploaded,[linkedAccountId+jId],[linkedAccountId+externalId],[linkedAccountId+alias],[linkedAccountId+externalId+uploaded],[linkedAccountId+jId+externalId+uploaded]',
      trashesV2: '++id,jId,linkedAccountId,externalId,type,[linkedAccountId+externalId],[linkedAccountId+type],[linkedAccountId+jId+type]',
      tagWordsV2: '++id,linkedAccountId,externalId,title,[linkedAccountId+externalId],[linkedAccountId+title],[linkedAccountId+id]',
    })
  }
}

export const db = new JourneyReplicaDB()

/** Misc DB (places/templates), per original. */
class MiscDB extends Dexie {
  templates!: Table<TemplateRow, number>
  constructor() {
    super('Misc')
    this.version(1).stores({
      places: '++id,address,lat,lng',
      templates: '++id,name,content,contentType,updatedAt',
    })
  }
}
export const miscDb = new MiscDB()

export function computeTokens(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    yearToken: String(d.getFullYear()),
    monthToken: p(d.getMonth() + 1),
    dayToken: p(d.getDate()),
    hourToken: p(d.getHours()),
    minuteToken: p(d.getMinutes()),
  }
}

export function htmlToPreview(html: string, max = 240): string {
  const div = document.createElement('div')
  div.innerHTML = html
  // preserve block boundaries as spaces so words don't concatenate
  div.querySelectorAll('p, div, br, li, h1, h2, h3, blockquote').forEach((el) => {
    el.after(document.createTextNode(' '))
  })
  const t = (div.textContent || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}
