import { cpSync, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { del as deleteBlob, get as getBlob, put as putBlob } from '@vercel/blob';
import { seedMemories } from './seed.mjs';
import {aiReady} from './ai.mjs';
import {currentScope,FAMILY_COLLECTIONS,USER_COLLECTIONS,INTERNAL_COLLECTIONS,stampScope,scopedId,accessDenied} from './access-scope.mjs';
import {assertStorageEnvironment,verifyEnvironmentBinding} from './data-environment.mjs';

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
  const environment=assertStorageEnvironment();
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
      if(environment!=='development')throw new Error('隔离数据目录不可写，禁止回退到真实用户数据目录');
      if(path.resolve(/*turbopackIgnore: true*/ dataDir)===path.resolve(/*turbopackIgnore: true*/ projectDataDir)||!canWriteDirectory(platformDataDir))
        throw new Error(`忆伴数据目录不可写：${dataDir}。请检查文件夹权限，或设置 YIBAN_DATA_DIR 指向可写目录。`);
      dataDir=platformDataDir;
    }

    if(environment==='development'&&path.resolve(/*turbopackIgnore: true*/ dataDir)===path.resolve(/*turbopackIgnore: true*/ platformDataDir)&&path.resolve(/*turbopackIgnore: true*/ dataDir)!==path.resolve(/*turbopackIgnore: true*/ projectDataDir)&&!existsSync(path.join(/*turbopackIgnore: true*/ dataDir,'yiban.sqlite'))&&existsSync(path.join(/*turbopackIgnore: true*/ projectDataDir,'yiban.sqlite'))) {
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

  const binding=await readDocument('system','environment_binding');
  verifyEnvironmentBinding(binding,environment,{remote:usesRemoteStorage});
  if(!binding)await writeDocument('system',{id:'environment_binding',environment,createdAt:new Date().toISOString()});
  const indexes=usesRemoteStorage?[
    "CREATE INDEX IF NOT EXISTS documents_owner_thread_time ON documents(collection,(value->>'userId'),(value->>'threadId'),(value->>'createdAt'),id)",
    "CREATE INDEX IF NOT EXISTS documents_owner_updated ON documents(collection,(value->>'userId'),(value->>'updatedAt') DESC,id)",
    "CREATE INDEX IF NOT EXISTS documents_family ON documents(collection,(COALESCE(value->>'familyId','family')))",
  ]:[
    "CREATE INDEX IF NOT EXISTS documents_owner_thread_time ON documents(collection,json_extract(value,'$.userId'),json_extract(value,'$.threadId'),json_extract(value,'$.createdAt'),id)",
    "CREATE INDEX IF NOT EXISTS documents_owner_updated ON documents(collection,json_extract(value,'$.userId'),json_extract(value,'$.updatedAt') DESC,id)",
    "CREATE INDEX IF NOT EXISTS documents_family ON documents(collection,COALESCE(json_extract(value,'$.familyId'),'family'))",
  ];
  if(sql)for(const statement of indexes)await sql.query(statement);else db.exec(indexes.join(';'));

  if(!(await readDocument('system','initialized'))) {
    await Promise.all([
      ...seedMemories.map(memory=>writeDocument('memories',{...memory,status:'confirmed',assetType:'illustration',audio:null,video:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',isDemo:true})),
      writeDocument('settings',{id:'family',familyName:'林家的记忆小屋',fontSize:'large',highContrast:false,autoPlay:false,speechRate:0.85,demoNotice:true}),
      ...[{id:'member-1',name:'小雨',role:'管理员',relation:'女儿',color:'peach'},{id:'member-2',name:'陈叔叔',role:'家庭成员',relation:'丈夫',color:'sage'},{id:'member-3',name:'林阿姨',role:'老人',relation:'本人',color:'lavender'}].map(member=>writeDocument('members',{...member,voiceId:null,voiceStatus:null,voiceConsent:false})),
      writeDocument('anniversaries',{id:'anniversary-1',title:'林阿姨的生日',date:'03-18',memoryIds:['demo-child','demo-newyear']}),
    ]);
    await writeDocument('system',{id:'initialized',value:true});
  }
}

export { uploadDir, usesRemoteStorage };

async function readAll(collection) {
  return queryRows(collection);
}

const queryFields=new Set(['id','userId','familyId','threadId','createdAt','updatedAt','deletedAt','archived','pinned','role','status','text','favorite','legacyImported']);
function expression(field){if(!queryFields.has(field))throw Error('不支持的查询字段');return field==='id'?'id':usesRemoteStorage?`value->>'${field}'`:`json_extract(value,'$.${field}')`;}
function scopePredicate(collection,bind){
  const scope=currentScope();if(!scope)return null;
  const family=()=>`COALESCE(${expression('familyId')},'family')=${bind(scope.familyId)}`;
  if(FAMILY_COLLECTIONS.has(collection))return family();
  if(collection==='users'){
    const familyId=bind(scope.familyId),ownerId=bind(scope.userId);
    const memberFamily=usesRemoteStorage?"fm.value->>'familyId'":"json_extract(fm.value,'$.familyId')",memberUser=usesRemoteStorage?"fm.value->>'userId'":"json_extract(fm.value,'$.userId')",revoked=usesRemoteStorage?"fm.value->>'revokedAt'":"json_extract(fm.value,'$.revokedAt')";
    return `(EXISTS(SELECT 1 FROM documents fm WHERE fm.collection='family_memberships' AND ${memberUser}=documents.id AND ${memberFamily}=${familyId} AND ${revoked} IS NULL) OR documents.id=${ownerId} OR (${family()} AND NOT EXISTS(SELECT 1 FROM documents fm WHERE fm.collection='family_memberships' AND ${memberUser}=documents.id)))`;
  }
  if(USER_COLLECTIONS.has(collection)||collection==='family_memberships')return `${expression('userId')}=${bind(scope.userId)}`;
  if(collection==='uploads')return `(${expression('userId')}=${bind(scope.userId)} OR ${family()})`;
  if(INTERNAL_COLLECTIONS.has(collection))return null;
  throw accessDenied();
}
async function queryRows(collection,{filters=[],order=[],offset=0,limit=null}={}){
  const values=[],bind=value=>{values.push(value);return usesRemoteStorage?'$'+values.length:'?';};
  const clauses=['collection='+bind(collection)],scope=scopePredicate(collection,bind);if(scope)clauses.push(scope);
  for(const {field,op='eq',value} of filters){const column=expression(field),normalized=typeof value==='boolean'?(usesRemoteStorage?String(value):Number(value)):value;
    if(op==='eq')clauses.push(`${column}=${bind(normalized)}`);
    else if(op==='null')clauses.push(`${column} IS NULL`);
    else if(op==='notTrue')clauses.push(`COALESCE(${column},${usesRemoteStorage?"'false'":'0'})<>${bind(usesRemoteStorage?'true':1)}`);
    else if(op==='contains')clauses.push(usesRemoteStorage?`strpos(lower(COALESCE(${column},'')),lower(${bind(String(value))}))>0`:`instr(lower(COALESCE(${column},'')),lower(${bind(String(value))}))>0`);
    else if(op==='in'){if(!Array.isArray(value)||!value.length)clauses.push('1=0');else clauses.push(`${column} IN (${value.map(bind).join(',')})`);}
    else throw Error('不支持的查询条件');
  }
  const sort=order.map(item=>`${expression(item.field)} ${item.desc?'DESC':'ASC'}`).join(',');
  let text='SELECT value FROM documents WHERE '+clauses.join(' AND ')+(sort?' ORDER BY '+sort:'');
  if(limit!==null){text+=' LIMIT '+bind(Math.max(1,Math.min(10000,Math.floor(limit))))+' OFFSET '+bind(Math.max(0,Math.floor(offset)||0));}
  const rows=usesRemoteStorage?await sql.query(text,values):db.prepare(text).all(...values);
  return rows.map(row=>usesRemoteStorage?row.value:JSON.parse(row.value));
}
export async function queryDocuments(collection,options){await ensureInitialized();return queryRows(collection,options);}
export async function prepareTransactionAccess(checks,writes){await ensureInitialized();
  for(const check of checks)if(currentScope()&&!await visibleDocument(check.collection,check.id))throw accessDenied();
  const normalized=[];for(const write of writes){const value=await writableDocument(write.collection,write.value);normalized.push({...write,id:value.id,value});}return normalized;
}

async function visibleDocument(collection,id){
  const rows=await queryRows(collection,{filters:[{field:'id',value:scopedId(collection,id)}],limit:1});return rows[0]||null;
}
async function writableDocument(collection,document){
  const clean=stampScope(collection,document),existing=await readDocument(collection,clean.id);
  if(existing&&currentScope()&&!await visibleDocument(collection,clean.id))throw accessDenied();
  return clean;
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
export async function get(collection,id) {await ensureInitialized();return visibleDocument(collection,id);}
export async function put(collection,document) {await ensureInitialized();return writeDocument(collection,await writableDocument(collection,document));}
export async function insertIfAbsent(collection,document) {
  await ensureInitialized();
  document=await writableDocument(collection,document);
  if(usesRemoteStorage){const rows=await sql`INSERT INTO documents(collection,id,value) VALUES(${collection},${document.id},${JSON.stringify(document)}::jsonb) ON CONFLICT(collection,id) DO NOTHING RETURNING id`;return rows.length===1;}
  return db.prepare('INSERT INTO documents(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO NOTHING').run(collection,document.id,JSON.stringify(document)).changes===1;
}
export async function remove(collection,id) {await ensureInitialized();if(!await visibleDocument(collection,id))return;return removeDocument(collection,scopedId(collection,id));}

// The credit repository owns its transactional tables; never update balances via documents.
export async function creditStorage() {await ensureInitialized();return {sql,db};}

// A terminal video state can be published only by the request that still sees
// its original pending record. Later poll responses must not overwrite it.
export async function compareAndPut(collection,previous,next) {
  await ensureInitialized();
  if(currentScope()&&!await visibleDocument(collection,previous.id))throw accessDenied();
  next=stampScope(collection,next);
  if(usesRemoteStorage) {
    const rows=await sql`UPDATE documents SET value=${JSON.stringify(next)}::jsonb
      WHERE collection=${collection} AND id=${previous.id} AND value=${JSON.stringify(previous)}::jsonb RETURNING id`;
    return rows.length===1;
  }
  return db.prepare('UPDATE documents SET value=? WHERE collection=? AND id=? AND value=?')
    .run(JSON.stringify(next),collection,previous.id,JSON.stringify(previous)).changes===1;
}

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
    return {data:Readable.fromWeb(blob.stream),contentType:blob.blob.contentType,size:blob.blob.size};
  }
  // 先 stat 再建流：流和 stat 混在一个对象字面量里时，stat 抛错会留下
  // 一个没人监听的孤儿流，ENOENT 直接把进程打挂。
  let size=null;try{size=statSync(path.join(/*turbopackIgnore: true*/ uploadDir,name)).size;}catch{}
  return {data:createReadStream(path.join(/*turbopackIgnore: true*/ uploadDir,name)),contentType:null,size};
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
  const [memories,members,anniversaries,activity,settings]=await Promise.all([
    all('memories'),all('members'),all('anniversaries'),all('activity'),get('settings','family'),
  ]);
  return {memories:memories.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),members,anniversaries,activity:activity.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,300),settings,aiEnabled:aiReady()};
}
