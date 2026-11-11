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
  /**
   * 坐标来源（非索引扩展字段，Dexie 允许）。
   * gps = WGS-84（浏览器定位/照片 EXIF），显示到高德前必须转 GCJ-02；
   * amap = 高德搜索/逆地理编码直接返回的 GCJ-02，原样使用；
   * 未知/缺省 = 旧记录来源不明，先按原值显示，允许用户重新选点。
   */
  locationSource?: 'gps' | 'amap'
  /** 行政区编码（高德 adcode），天气等按区域查询用 */
  adcode?: string
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

/** 未保存草稿（新条目 key='new'，已有条目 key='entry:<id>'）；照片 blob 随草稿入库，刷新可完整恢复 */
export interface DraftRow {
  key: string
  text: string
  date: number
  meta: Partial<EntryV2>
  staged: { name: string; type: string; blob: Blob }[]
  removed: number[]
  updatedAt: Date
}

export interface MediaFileV2 {
  id?: number
  externalId?: string
  linkedAccountId: string
  jId?: number
  fileMetadataDate?: Date
  createdAt: Date
  fileName: string
  mimeType: string
  ext: string
  position: number
  alias?: string
  uploaded: number
  /** Non-indexed payload (declared schema lists indexes only; Dexie permits extra fields). */
  blob?: Blob
}

export interface TrashRow extends TrashV2 {
  /** Non-indexed full entry snapshot so restore can re-add the entry (deviation noted in feature matrix). */
  snapshot?: EntryV2
}

export interface PlaceRow {
  id?: number
  address: string
  lat: number
  lng: number
}

/** linkedAccounts 行（原版 schema：多日记本=多账号；local 账号 id 为空字符串语义见 useEntries LOCAL） */
export interface LinkedAccountRow {
  id?: number
  displayName: string
  emailLower?: string
  linkedAccountId?: string
  src?: string // 'local' | 'journeyCloud' | 'shared' | 'selfHosted'
  lastSyncStatus?: string
  lastSyncDate?: string
  /** 共享日记成员角色（1=Owner 0=Member），仅共享盘使用 */
  memberRole?: 0 | 1
  inviterName?: string
}

class JourneyReplicaDB extends Dexie {
  linkedAccounts!: Table<LinkedAccountRow, number>
  entriesV2!: Table<EntryV2, number>
  trashesV2!: Table<TrashRow, number>
  tagWordsV2!: Table<TagWordV2, number>
  mediaFilesV2!: Table<MediaFileV2, number>
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

/** Misc DB (places/templates/drafts), per original. */
class MiscDB extends Dexie {
  templates!: Table<TemplateRow, number>
  places!: Table<PlaceRow, number>
  drafts!: Table<DraftRow, string>
  constructor() {
    super('Misc')
    this.version(1).stores({
      places: '++id,address,lat,lng',
      templates: '++id,name,content,contentType,updatedAt',
    })
    this.version(2).stores({
      drafts: 'key',
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
  const template = document.createElement('template')
  template.innerHTML = html
  const fragment = template.content
  // preserve block boundaries as spaces so words don't concatenate
  fragment.querySelectorAll('p, div, br, li, h1, h2, h3, blockquote').forEach((el) => {
    el.after(document.createTextNode(' '))
  })
  const t = (fragment.textContent || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) : t
}
