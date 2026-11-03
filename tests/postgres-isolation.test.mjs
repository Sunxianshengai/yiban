import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {neonConfig} from '@neondatabase/serverless';
import {withUserScope} from '../lib/access-scope.mjs';
const pg=new PGlite();
await pg.exec("CREATE TABLE documents(collection TEXT NOT NULL,id TEXT NOT NULL,value JSONB NOT NULL,PRIMARY KEY(collection,id));INSERT INTO documents VALUES('system','environment_binding','{\"id\":\"environment_binding\",\"environment\":\"test\"}')");
// Exercise the production Neon adapter against a local WASM PostgreSQL engine.
// No socket, cloud account, connection credentials or production data is used.
neonConfig.fetchFunction=async(_url,options)=>{
  const body=JSON.parse(options.body);
  async function execute(client,item){const result=await client.query(item.query,item.params||[]);const fields=result.fields||[];return {fields,rows:result.rows.map(row=>fields.map(field=>{const value=row[field.name];if(value===null||value===undefined)return null;if([114,3802].includes(field.dataTypeID))return JSON.stringify(value);if(typeof value==='boolean')return value?'t':'f';return String(value);})),rowCount:result.rowCount??result.affectedRows??result.rows.length,command:result.command||'SELECT',rowAsArray:true};}
  try{const result=body.queries?{results:await pg.transaction(async client=>{const results=[];for(const item of body.queries)results.push(await execute(client,item));return results;})}:await execute(pg,body);return Response.json(result);}
  catch(error){return Response.json({message:error.message,code:error.code||'TEST_SQL_ERROR',severity:'ERROR'},{status:400});}
};
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@isolated.invalid/test',YIBAN_DATABASE_ENVIRONMENT:'test',VERCEL:''});
const store=await import('../lib/store.mjs'),repo=await import('../lib/chat-repository.mjs'),transaction=await import('../lib/document-transaction.mjs');
after(async()=>{neonConfig.fetchFunction=undefined;await pg.close();});
const a={id:'postgres-a',familyId:'family-a'},b={id:'postgres-b',familyId:'family-b'};
test('PostgreSQL JSONB scopes, expression indexes and atomic documents enforce actual tenant boundaries',async()=>{
  await withUserScope(a,()=>store.put('memories',{id:'pg-memory',title:'A家庭'}));
  assert.equal(await withUserScope(b,()=>store.get('memories','pg-memory')),null);
  await assert.rejects(withUserScope(b,()=>store.put('memories',{id:'pg-memory',title:'不能覆盖'})),/无权/);
  await withUserScope(a,()=>store.put('settings',{id:'family',familyName:'A'}));await withUserScope(b,()=>store.put('settings',{id:'family',familyName:'B'}));
  assert.equal((await withUserScope(a,()=>store.get('settings','family'))).familyName,'A');assert.equal((await withUserScope(b,()=>store.get('settings','family'))).familyName,'B');
  await store.put('chat_threads',{id:'pg-thread',userId:a.id,title:'Postgres对话',headId:'pg-message',archived:false,createdAt:'2026-01-01',updatedAt:'2026-01-02'});
  await store.put('chat_messages',{id:'pg-message',userId:a.id,threadId:'pg-thread',status:'completed',text:'关键字 %_ 你好',favorite:true,proactive:{jobId:'test'},createdAt:'2026-01-02'});
  const thread=await store.get('chat_threads','pg-thread');assert.equal(await withUserScope(a,()=>transaction.commitDocuments([transaction.documentGuard('chat_threads',thread)],[transaction.documentGuard('chat_threads',{...thread,pinned:true})])),true);
  assert.ok((await pg.query("SELECT indexname FROM pg_indexes WHERE tablename='documents'")).rows.some(row=>row.indexname==='documents_owner_thread_time'));
  await store.put('users',{id:a.id,familyId:'another-active-family',name:'A'});await store.put('family_memberships',{id:'member-a',familyId:a.familyId,userId:a.id,role:'admin'});
  assert.equal((await withUserScope(a,()=>store.get('users',a.id))).name,'A');assert.equal(await withUserScope(b,()=>store.get('users',a.id)),null);
});
test('PostgreSQL pagination, recursive visible branches, search and unread counts match SQLite behavior',async()=>{
  const threads=await withUserScope(a,()=>repo.threadPage(a.id,{needle:'%_'}));assert.equal(threads.length,1);assert.equal(threads[0].id,'pg-thread');
  assert.equal((await withUserScope(b,()=>repo.threadPage(b.id))).length,0);
  const summary=await withUserScope(a,()=>repo.summariesForThreads(a.id,threads));assert.equal(summary.unread.get('pg-thread'),1);assert.equal(summary.heads.get('pg-message').text,'关键字 %_ 你好');
  const messages=await withUserScope(a,()=>repo.visibleMessagePage(a.id,{needle:'%_',favorites:true}));assert.equal(messages.length,1);assert.equal(messages[0].message.id,'pg-message');
  assert.equal((await withUserScope(a,()=>repo.messagesForThread(a.id,'pg-thread'))).length,1);
});
