// Default is read-only. Do not run --apply until the user confirms acceptance.
import {existsSync,readFileSync,realpathSync,readdirSync,statSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {neon} from '@neondatabase/serverless';
import {del} from '@vercel/blob';
import {RESET_TABLES,resetFingerprint,authorizeReset} from '../lib/reset-plan.mjs';
const arg=name=>process.argv.find(item=>item.startsWith('--'+name+'='))?.slice(name.length+3),environment=arg('environment')||'test',apply=process.argv.includes('--apply');
if(!['production','test','development','preview'].includes(environment))throw Error('环境无效');
const remote=Boolean(process.env.DATABASE_URL);let sql,db,identity;
if(remote){const url=new URL(process.env.DATABASE_URL);identity=url.hostname+url.pathname;sql=neon(process.env.DATABASE_URL);}
else{if(!process.env.YIBAN_DATA_DIR)throw Error('必须明确设置独立数据目录');const root=realpathSync(process.env.YIBAN_DATA_DIR),file=path.join(root,'yiban.sqlite');if(!existsSync(file))throw Error('指定数据库不存在，不创建新库');identity=realpathSync(file);const {DatabaseSync}=await import('node:sqlite');db=new DatabaseSync(file,{readOnly:!apply});}
const fingerprint=resetFingerprint(identity),tables=remote?(await sql`SELECT tablename AS name FROM pg_tables WHERE schemaname='public'`).map(row=>row.name):db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
const read=async text=>remote?sql.query(text):db.prepare(text).all();
const documents=tables.includes('documents'),binding=documents?(await read("SELECT value FROM documents WHERE collection='system' AND id='environment_binding'"))[0]?.value:null;
const parsedBinding=typeof binding==='string'?JSON.parse(binding):binding;if(parsedBinding&&parsedBinding.environment!==environment)throw Error('目标数据库环境与声明不符');
const counts={};for(const table of RESET_TABLES.filter(name=>tables.includes(name)))counts[table]=Number((await read(`SELECT count(*) AS n FROM ${table}`))[0].n);
const uploads=documents?(await read("SELECT value FROM documents WHERE collection='uploads'")).map(row=>typeof row.value==='string'?JSON.parse(row.value):row.value):[];
const urls=uploads.map(upload=>upload.blobUrl).filter(Boolean);
const cleanup=documents?(await read("SELECT value FROM documents WHERE collection='system' AND id='reset_cleanup'"))[0]?.value:null,oldCleanup=typeof cleanup==='string'?JSON.parse(cleanup):cleanup;
const pending=[...new Set([...urls,...(oldCleanup?.urls||[])])];
console.log(JSON.stringify({mode:apply?'apply':'read-only',environment,fingerprint,counts,privateBlobsToDelete:pending.length,productionUntouched:!apply,scope:'all-business-data',configurationPreserved:true},null,2));
if(!apply){db?.close();process.exit(0);}
const approval=arg('approval-file')?JSON.parse(readFileSync(arg('approval-file'),'utf8')):null;
authorizeReset({apply,environment,fingerprint,confirmation:arg('confirm'),maintenance:process.env.YIBAN_MAINTENANCE_MODE==='1',setupToken:process.env.YIBAN_SETUP_TOKEN,approval});
if(environment==='production'){
  if(!remote)throw Error('正式重置只支持已核对的云数据库');
  if(process.env.QWEN_COMPANION_VOICES_JSON?.trim())throw Error('请先清除正式环境中的旧账号音色登记配置');
  const origin=process.env.YIBAN_PRODUCTION_URL;if(!origin||new URL(origin).protocol!=='https:')throw Error('必须指定待核对的正式站 HTTPS 地址');
  const status=await fetch(new URL('/api/auth/status',origin),{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}}),body=await status.json();
  const gate=await fetch(new URL('/api/state',origin),{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  if(!body.maintenance||body.resetTarget!==fingerprint||gate.status!==503||(await gate.json()).maintenance!==true)throw Error('正式站尚未进入对应数据库的维护模式，数据库未清空');
}
if(pending.length&&!process.env.BLOB_READ_WRITE_TOKEN)throw Error('有私有云文件待清理，缺少专用 Blob 凭据；数据库尚未清空');
const writeCleanup={id:'reset_cleanup',urls:pending,startedAt:new Date().toISOString()};
const statements=RESET_TABLES.filter(name=>tables.includes(name)).map(name=>name==='documents'?"DELETE FROM documents WHERE NOT(collection='system' AND id='environment_binding')":`DELETE FROM ${name}`);
if(remote){const commands=statements.map(statement=>sql.query(statement));if(pending.length)commands.push(sql.query("INSERT INTO documents(collection,id,value) VALUES('system','reset_cleanup',$1::jsonb)",[JSON.stringify(writeCleanup)]));await sql.transaction(commands);}
else{db.exec('BEGIN IMMEDIATE');try{for(const statement of statements)db.exec(statement);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
// Storage cannot share a SQL transaction. Persist a cleanup queue and keep
// maintenance enabled if deletion fails, so the operator can resume safely.
if(pending.length){await del(pending,{token:process.env.BLOB_READ_WRITE_TOKEN});if(remote)await sql`DELETE FROM documents WHERE collection='system' AND id='reset_cleanup'`;}
if(!remote){const root=realpathSync(process.env.YIBAN_DATA_DIR),folder=path.join(root,'uploads');if(existsSync(folder)){const resolved=realpathSync(folder);if(!resolved.startsWith(root+path.sep))throw Error('素材目录超出指定数据目录');for(const name of readdirSync(resolved)){const file=realpathSync(path.join(resolved,name));if(!file.startsWith(resolved+path.sep)||!statSync(file).isFile())throw Error('素材目录含非普通文件，须人工核对');unlinkSync(file);}}db.close();}
console.log('Business data reset complete. Platform credentials and deployment settings were not changed. Existing provider-side voice resources are not destroyed by this database reset.');
