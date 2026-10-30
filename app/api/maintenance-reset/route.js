// One-time maintenance deployment only. Removed before the final release.
import {timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {list,del} from '@vercel/blob';
import {RESET_TABLES,resetFingerprint,authorizeReset} from '../../../lib/reset-plan.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
function allowed(request){
 const expected=process.env.YIBAN_RESET_TOKEN,provided=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 return process.env.VERCEL_ENV==='production'&&process.env.YIBAN_MAINTENANCE_MODE==='1'&&expected?.length>=32&&provided?.length===expected.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(provided));
}
async function snapshot(){
 const uri=new URL(process.env.DATABASE_URL),fingerprint=resetFingerprint(uri.hostname+uri.pathname),sql=neon(process.env.DATABASE_URL);
 const tables=(await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`).map(item=>item.tablename),counts={};
 for(const table of RESET_TABLES.filter(item=>tables.includes(item)))counts[table]=Number((await sql.query(`SELECT count(*) AS n FROM ${table}`))[0].n);
 const groups=tables.includes('documents')?await sql`SELECT collection,count(*)::int AS n FROM documents GROUP BY collection ORDER BY collection`:[];
 const blobs=[];let cursor;do{const page=await list({cursor,limit:1000});blobs.push(...page.blobs.map(item=>item.url));cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 return {sql,tables,fingerprint,counts,groups,blobs};
}
export async function GET(request){if(!allowed(request))return reply({error:'Not found'},404);try{const value=await snapshot();return reply({fingerprint:value.fingerprint,counts:value.counts,collections:value.groups,privateBlobCount:value.blobs.length,maintenance:true});}catch{return reply({error:'Preflight failed; no data changed'},503);}}
export async function POST(request){
 if(!allowed(request))return reply({error:'Not found'},404);
 try{
  const body=await request.json(),current=await snapshot();
  authorizeReset({apply:true,environment:'production',fingerprint:current.fingerprint,confirmation:body.confirm,maintenance:true,setupToken:process.env.YIBAN_SETUP_TOKEN,approval:body.approval});
  if(process.env.QWEN_COMPANION_VOICES_JSON?.trim())throw Error('Old voice registrations must be removed');
  const binding=(await current.sql`SELECT value FROM documents WHERE collection='system' AND id='environment_binding'`)[0]?.value;
  if(binding?.environment!=='production')throw Error('Production binding required');
  // Maintenance blocks application writers. Delete all private objects first;
  // failure leaves the DB intact and maintenance enabled, allowing safe retry.
  if(current.blobs.length)await del(current.blobs);
  const remaining=await list({limit:1});if(remaining.blobs.length)throw Error('Private store is not empty');
  await current.sql.transaction(RESET_TABLES.filter(name=>current.tables.includes(name)).map(name=>current.sql.query(name==='documents'?"DELETE FROM documents WHERE NOT(collection='system' AND id='environment_binding')":`DELETE FROM ${name}`)));
  const after=await snapshot();return reply({resetComplete:true,fingerprint:after.fingerprint,counts:after.counts,collections:after.groups,privateBlobCount:after.blobs.length});
 }catch{return reply({error:'Reset incomplete; maintenance remains enabled. Check preflight before retry.'},503);}
}
