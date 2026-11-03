import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
const environment=process.argv.find(arg=>arg.startsWith('--environment='))?.split('=')[1];
if(!['test','preview','development'].includes(environment))throw Error('仅支持 --environment=test|preview|development；此工具不能改正式库');
const url=process.env.DATABASE_URL;if(!url)throw Error('请通过安全环境变量设置独立数据库的 DATABASE_URL');
const parsed=new URL(url),fingerprint=createHash('sha256').update(parsed.hostname+parsed.pathname).digest('hex').slice(0,16),sql=neon(url);
const tables=await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
const exists=tables.some(table=>table.tablename==='documents');
const binding=exists?(await sql`SELECT value FROM documents WHERE collection='system' AND id='environment_binding'`)[0]?.value:null;
console.log(JSON.stringify({environment,fingerprint,binding:binding?.environment||null,tableCount:tables.length,mode:process.argv.includes('--apply')?'provision':'read-only'}));
if(binding){if(binding.environment!==environment)throw Error('数据库已属于其他环境，禁止重新绑定。请使用独立的空数据库。');console.log('Environment binding matches.');}
else if(process.argv.includes('--apply')){
  if(process.argv.find(arg=>arg.startsWith('--confirm-new-database='))?.split('=')[1]!==fingerprint)throw Error('请先核对只读预检，再用 --confirm-new-database=<fingerprint> 确认目标');
  if(tables.length)throw Error('仅允许初始化全新的空数据库，禁止对含业务数据的库重绑环境');
  await sql`CREATE TABLE documents(collection TEXT NOT NULL,id TEXT NOT NULL,value JSONB NOT NULL,PRIMARY KEY(collection,id))`;
  await sql`INSERT INTO documents(collection,id,value) VALUES('system','environment_binding',${JSON.stringify({id:'environment_binding',environment,createdAt:new Date().toISOString()})}::jsonb)`;
  console.log('Isolated database binding created; no production data copied.');
}else console.log('Dry run only. No database schema or data changed.');
