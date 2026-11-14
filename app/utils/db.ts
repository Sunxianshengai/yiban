import Dexie, { type Table } from 'dexie'

/**
 * Data layer mirrored from Journey Desktop 6.0.1 JourneyDB schema
 * (evidence/derived/dexie-schema.json). Local journal uses linkedAccountId ''.
 */

export interface EntryV2 {
  id?: number
  /**
   * 云端稳定标识（非索引扩展字段，Dexie 允许）。
   * 必须用它而不是 id 做同步主键：id 是每台设备各自的自增序号，
   * 两台机器的第一篇都是 1，同步时会互相覆盖。
   */
  cloudId?: string
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
  /**
   * 家庭组（附加功能）：'family' = 共享给家人——组内成员可在家庭空间看到这篇，
   * 并可评论/追加段落。缺省（或 'private'）= 仅自己，家庭接口永远拉不到。
   */
  visibility?: 'private' | 'family'
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
  /** 云端稳定标识，理由同 EntryV2.cloudId：id 是每台设备的自增序号。 */
  cloudId?: string
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
  /**
   * 云端附件路径（非索引扩展字段）。
   * 有值表示已上传到私有 Blob；渲染时拿它换一次性预签名地址。
   * 本地有 blob 就优先用本地 blob，省一次网络请求，断网也能看。
   */
  remotePathname?: string
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
    // v2：附件增加云端路径索引（同步后用 pathname 反查本地行）
    this.version(2).stores({
      mediaFilesV2: '++id,externalId,linkedAccountId,jId,fileMetadataDate,createdAt,fileName,mimeType,ext,position,alias,uploaded,remotePathname,[linkedAccountId+jId],[linkedAccountId+externalId],[linkedAccountId+alias],[linkedAccountId+externalId+uploaded],[linkedAccountId+jId+externalId+uploaded]',
    })
    // v3：给每篇日记/每个附件补一个跨设备稳定的 cloudId（旧代码拿自增 id 当同步主键，多设备会互相覆盖）
    this.version(3).stores({
      entriesV2: '++id,cloudId,externalId,linkedAccountId,text,previewText,timezone,dateOfJournal,dateModified,synced,version,address,musicArtist,musicTitle,lat,lng,weatherId,weatherDegreeC,weatherDescription,weatherIcon,weatherPlace,activity,sentiment,favourite,type,alias,*tagWordIds,yearToken,monthToken,dayToken,hourToken,minuteToken,[linkedAccountId+dateOfJournal],[linkedAccountId+lat+lng],[linkedAccountId+jId],[linkedAccountId+id],[linkedAccountId+externalId],[linkedAccountId+synced],[linkedAccountId+yearToken+monthToken+dayToken],[linkedAccountId+monthToken+dayToken]',
      mediaFilesV2: '++id,cloudId,externalId,linkedAccountId,jId,fileMetadataDate,createdAt,fileName,mimeType,ext,position,alias,uploaded,remotePathname,[linkedAccountId+jId],[linkedAccountId+externalId],[linkedAccountId+alias],[linkedAccountId+externalId+uploaded],[linkedAccountId+jId+externalId+uploaded]',
    }).upgrade(async (tx) => {
      const entries = await tx.table('entriesV2').toArray() as EntryV2[]
      for (const entry of entries) {
        if (!entry.cloudId && entry.id != null) await tx.table('entriesV2').update(entry.id, { cloudId: newCloudId() })
      }
      const media = await tx.table('mediaFilesV2').toArray() as MediaFileV2[]
      for (const file of media) {
        if (!file.cloudId && file.id != null) await tx.table('mediaFilesV2').update(file.id, { cloudId: newCloudId() })
      }
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

/**
 * 生成跨设备稳定标识。
 * 不能复用自增 id：每台设备的序号都从 1 开始，同步时会撞车（云端唯一键是 user_id + client_id）。
 */
export function newCloudId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

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

// ---- 家庭组（附加功能） ----

/** 家庭 feed 里的一条附件元数据（家人条目没有本地 blob，靠 pathname 换家庭预签名地址） */
export interface FamilyFeedMedia {
  clientId: string
  pathname: string
  fileName: string
  mimeType: string
  position: number
}

/** 家庭互动记录：comment = 评论；contribution = 追加段落（都是追加式，原文不可改） */
export interface FamilyFeedSocial {
  id: string
  entryOwnerUserId: string
  entryClientId: string
  authorUserId: string
  authorNickname: string
  kind: 'comment' | 'contribution'
  content: string
  createdAt: string
}

export interface FamilyAuthorMeta {
  ownerUserId: string
  ownerNickname: string
}

/**
 * 时间线混排用：家人 feed 条目合成的只读行。
 * id 是合成稳定负数（不落 Dexie、不上云）；familyAuthor 把它和本地行区分开。
 */
export interface FamilyTimelineEntry extends EntryV2 {
  familyAuthor?: FamilyAuthorMeta
  familyMedia?: FamilyFeedMedia[]
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
