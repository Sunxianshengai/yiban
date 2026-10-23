import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { del as deleteBlob, get as getBlob, put as putBlob } from '@vercel/blob';
import { seedMemories, seedAlbums } from './seed.mjs';

// Vercel must never fall back to its ephemeral filesystem.
const usesRemoteStorage=Boolean(process.env.DATABASE_URL||process.env.VERCEL);
let sql=null;
let initialization=null;

async function ensureInitialized() {
  if(!initialization)initialization=initialize().catch(error=>{initialization=null;throw error;});
  await initialization;
}

function canWriteDirectory(directory) {
  const probe=path.join(/*turbopackIgnore: true*/ directory,`.yiban-write-check-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(directory,{recursive:true});
    writeFileSync(probe,'ok',{flag:'wx'});
    rmSync(probe);
    return true;
  } catch {
    try {rmSync(probe,{force:true});} catch {}
    return false;
  }
}

let dataDir=null;
let uploadDir=null;
let db=null;
async function initialize() {
  if(usesRemoteStorage&&!process.env.DATABASE_URL)throw new Error('请在 Vercel 项目中配置 Neon 的 DATABASE_URL，然后重新部署。');
  if(usesRemoteStorage)sql=neon(process.env.DATABASE_URL);
  if(!usesRemoteStorage) {
    const { DatabaseSync }=await import('node:sqlite');
    const projectDataDir=path.join(process.cwd(),'data');
    const platformDataDir=process.platform==='win32'
      ? path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Yiban','data')
      : path.join(os.homedir(),'.local','share','yiban');
    const requestedDataDir=process.env.YIBAN_DATA_DIR||platformDataDir;
    dataDir=requestedDataDir;
    if(!canWriteDirectory(dataDir)) {
      if(path.resolve(/*turbopackIgnore: true*/ dataDir)===path.resolve(/*turbopackIgnore: true*/ projectDataDir)||!canWriteDirectory(platformDataDir))
        throw new Error(`忆伴数据目录不可写：${dataDir}。请检查文件夹权限，或设置 YIBAN_DATA_DIR 指向可写目录。`);
      dataDir=platformDataDir;
    }

    if(path.resolve(/*turbopackIgnore: true*/ dataDir)!==path.resolve(/*turbopackIgnore: true*/ projectDataDir)&&!existsSync(path.join(/*turbopackIgnore: true*/ dataDir,'yiban.sqlite'))&&existsSync(path.join(/*turbopackIgnore: true*/ projectDataDir,'yiban.sqlite'))) {
      const source=new DatabaseSync(path.join(projectDataDir,'yiban.sqlite'),{readOnly:true});
      try {
        const temporary=path.join(/*turbopackIgnore: true*/ dataDir,`.yiban-migrate-${process.pid}.sqlite`);
        writeFileSync(temporary,source.serialize());
        renameSync(temporary,path.join(/*turbopackIgnore: true*/ dataDir,'yiban.sqlite'));
        const sourceUploads=path.join(/*turbopackIgnore: true*/ projectDataDir,'uploads');
        const destinationUploads=path.join(/*turbopackIgnore: true*/ dataDir,'uploads');
        if(existsSync(sourceUploads)&&!existsSync(destinationUploads))cpSync(sourceUploads,destinationUploads,{recursive:true,errorOnExist:true});
      } finally {source.close();}
    }

    if(process.env.NODE_ENV!=='test')console.info(`[忆伴] 本地数据目录：${dataDir}`);
    mkdirSync(dataDir,{recursive:true});
    uploadDir=path.join(dataDir,'uploads');
    const globalKey='__yiban_database';
    const previousDatabase=globalThis[globalKey];
    const databases=previousDatabase instanceof Map?previousDatabase:new Map();
    if(previousDatabase instanceof DatabaseSync)databases.set(path.resolve(/*turbopackIgnore: true*/ dataDir),previousDatabase);
    db=databases.get(path.resolve(/*turbopackIgnore: true*/ dataDir))||new DatabaseSync(path.join(/*turbopackIgnore: true*/ dataDir,'yiban.sqlite'));
    databases.set(path.resolve(/*turbopackIgnore: true*/ dataDir),db);
    globalThis[globalKey]=databases;
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(collection,id));');
  } else {
    await sql`CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, value JSONB NOT NULL, PRIMARY KEY(collection,id))`;
  }

  if(!(await readDocument('system','initialized'))) {
    await Promise.all([
      ...seedMemories.map(memory=>writeDocument('memories',{...memory,status:'confirmed',assetType:'illustration',audio:null,video:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',isDemo:true})),
      ...seedAlbums.map(album=>writeDocument('albums',album)),
      writeDocument('settings',{id:'family',familyName:'林家的记忆小屋',fontSize:'large',highContrast:false,autoPlay:false,speechRate:0.85,demoNotice:true}),
      ...[{id:'member-1',name:'小雨',role:'管理员',relation:'女儿',color:'peach'},{id:'member-2',name:'陈叔叔',role:'家庭成员',relation:'丈夫',color:'sage'},{id:'member-3',name:'林阿姨',role:'老人',relation:'本人',color:'lavender'}].map(member=>writeDocument('members',{...member,voiceId:null,voiceStatus:null,voiceConsent:false})),
      writeDocument('anniversaries',{id:'anniversary-1',title:'林阿姨的生日',date:'03-18',memoryIds:['demo-child','demo-newyear']}),
    ]);
    await writeDocument('system',{id:'initialized',value:true});
  }
}

export { uploadDir, usesRemoteStorage };

async function readAll(collection) {
  if(usesRemoteStorage) {
    const rows=await sql`SELECT value FROM documents WHERE collection=${collection}`;
    return rows.map(row=>row.value);
  }
  return db.prepare('SELECT value FROM documents WHERE collection=?').all(collection).map(row=>JSON.parse(row.value));
}

async function readDocument(collection,id) {
  if(usesRemoteStorage) {
    const rows=await sql`SELECT value FROM documents WHERE collection=${collection} AND id=${id} LIMIT 1`;
    return rows[0]?.value??null;
  }
  const row=db.prepare('SELECT value FROM documents WHERE collection=? AND id=?').get(collection,id);
  return row?JSON.parse(row.value):null;
}

async function writeDocument(collection,document) {
  if(usesRemoteStorage) {
    await sql`INSERT INTO documents(collection,id,value) VALUES(${collection},${document.id},${JSON.stringify(document)}::jsonb) ON CONFLICT(collection,id) DO UPDATE SET value=EXCLUDED.value`;
  } else {
    db.prepare('INSERT INTO documents(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value').run(collection,document.id,JSON.stringify(document));
  }
  return document;
}

async function removeDocument(collection,id) {
  if(usesRemoteStorage)await sql`DELETE FROM documents WHERE collection=${collection} AND id=${id}`;
  else db.prepare('DELETE FROM documents WHERE collection=? AND id=?').run(collection,id);
}

export async function all(collection) {await ensureInitialized();return readAll(collection);}
export async function get(collection,id) {await ensureInitialized();return readDocument(collection,id);}
export async function put(collection,document) {await ensureInitialized();return writeDocument(collection,document);}
export async function remove(collection,id) {await ensureInitialized();return removeDocument(collection,id);}

function ensureBlobConfigured() {
  if(!process.env.BLOB_STORE_ID&&!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error('请为 Vercel 项目连接私有 Blob 存储，然后重新部署。');
}

export async function log(type,text,memoryId=null) {
  return put('activity',{id:randomUUID(),familyId:'family',type,text,memoryId,createdAt:new Date().toISOString()});
}

export async function saveMedia(name,data,contentType) {
  await ensureInitialized();
  if(usesRemoteStorage)ensureBlobConfigured();
  if(usesRemoteStorage) {
    const blob=await putBlob(`yiban/${name}`,data,{access:'private',addRandomSuffix:false,contentType});
    return {blobUrl:blob.url,blobPath:blob.pathname};
  }
  await mkdir(uploadDir,{recursive:true});
  await writeFile(path.join(/*turbopackIgnore: true*/ uploadDir,name),data);
  return {blobUrl:null,blobPath:null};
}

export async function readMedia(name,blobUrl=null) {
  await ensureInitialized();
  if(usesRemoteStorage)ensureBlobConfigured();
  if(usesRemoteStorage) {
    if(!blobUrl)return null;
    const blob=await getBlob(blobUrl,{access:'private'});
    if(!blob||blob.statusCode!==200)return null;
    return {data:Readable.fromWeb(blob.stream),contentType:blob.blob.contentType};
  }
  return {data:createReadStream(path.join(/*turbopackIgnore: true*/ uploadDir,name)),contentType:null};
}

// 一次性读成 Buffer 的版本：只给需要 base64/尺寸校验的调用方
// （AI 整理的 8MB 图、视频任务的 4MB 封面）。普通媒体请求走 readMedia 流式。
export async function readMediaBuffer(name,blobUrl=null) {
  await ensureInitialized();
  if(usesRemoteStorage)ensureBlobConfigured();
  if(usesRemoteStorage) {
    if(!blobUrl)return null;
    const blob=await getBlob(blobUrl,{access:'private'});
    if(!blob||blob.statusCode!==200)return null;
    return {data:Buffer.from(await new Response(blob.stream).arrayBuffer()),contentType:blob.blob.contentType};
  }
  return {data:await readFile(path.join(/*turbopackIgnore: true*/ uploadDir,name)),contentType:null};
}

export async function deleteMedia(name,blobUrl=null) {
  await ensureInitialized();
  if(usesRemoteStorage)ensureBlobConfigured();
  if(usesRemoteStorage) {
    if(blobUrl)await deleteBlob(blobUrl);
    return;
  }
  await unlink(path.join(/*turbopackIgnore: true*/ uploadDir,name)).catch(()=>{});
}

export async function snapshot() {
  const [memories,albums,members,anniversaries,activity,settings]=await Promise.all([
    all('memories'),all('albums'),all('members'),all('anniversaries'),all('activity'),get('settings','family'),
  ]);
  return {memories:memories.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),albums,members,anniversaries,activity:activity.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,300),settings,aiEnabled:Boolean(process.env.AI_API_URL&&process.env.AI_API_KEY&&process.env.AI_MODEL)};
}
