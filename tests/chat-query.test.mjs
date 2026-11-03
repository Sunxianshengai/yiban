import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {withUserScope} from '../lib/access-scope.mjs';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-chat-query-'));Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,DATABASE_URL:'',VERCEL:''});
const store=await import('../lib/store.mjs'),chat=await import('../lib/chat-workspace.mjs'),management=await import('../lib/chat-management.mjs');
const user={id:'query-owner',familyId:'family'},other={id:'query-other',familyId:'family'};
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
for(let i=0;i<65;i++){
  const threadId='thread-'+String(i).padStart(3,'0'),createdAt=new Date(1700000000000+i*1000).toISOString(),id=threadId+'-message';
  await store.put('chat_threads',{id:threadId,userId:user.id,title:'会话'+i,headId:id,updatedAt:createdAt,createdAt,archived:false,pinned:i===0});
  await store.put('chat_messages',{id,userId:user.id,threadId,role:'assistant',status:'completed',text:i===64?'字面搜索 %_ 内容':'消息'+i,createdAt,favorite:true,proactive:i===0?{jobId:'test'}:undefined});
}
for(let i=0;i<400;i++)await store.put('chat_messages',{id:'foreign-'+i,userId:other.id,threadId:'foreign',text:'字面搜索 %_ 内容',status:'completed',createdAt:'2029-01-01'});
test('thread pages keep pinned order, stable pagination and private search without full-collection reads',async()=>{
  const first=await withUserScope(user,()=>chat.listThreads(user));assert.equal(first.threads.length,50);assert.equal(first.hasMore,true);assert.equal(first.threads[0].id,'thread-000');assert.equal(first.threads[0].unreadCount,1);
  const second=await withUserScope(user,()=>chat.listThreads(user,{offset:50}));assert.equal(second.threads.length,15);assert.equal(second.hasMore,false);assert.ok(second.threads.every(thread=>!first.threads.some(prior=>prior.id===thread.id)));
  const search=await withUserScope(user,()=>chat.listThreads(user,{q:'%_'}));assert.equal(search.threads.length,1);assert.equal(search.threads[0].id,'thread-064');
});
test('message search and favorites paginate only the selected branch and preserve literal wildcard text',async()=>{
  let page=await withUserScope(user,()=>management.findChatMessages(user,{favorites:true}));assert.equal(page.messages.length,40);assert.equal(page.hasMore,true);
  const next=await withUserScope(user,()=>management.findChatMessages(user,{favorites:true,offset:40}));assert.equal(next.messages.length,25);assert.equal(next.hasMore,false);
  page=await withUserScope(user,()=>management.findChatMessages(user,{q:'%_'}));assert.equal(page.messages.length,1);assert.equal(page.messages[0].threadId,'thread-064');
  const thread=await store.get('chat_threads','thread-064');await store.put('chat_messages',{id:'hidden-branch',userId:user.id,threadId:thread.id,text:'隐藏分支',status:'completed',createdAt:'2030-01-01'});
  assert.equal((await management.findChatMessages(user,{q:'隐藏分支'})).messages.length,0);
});
test('corrupt parent references cannot cross owners and indexed per-thread lookup retains messages',async()=>{
  const thread=await store.get('chat_threads','thread-064'),message=await store.get('chat_messages',thread.headId);await store.put('chat_messages',{...message,parentId:'foreign-0'});
  const matches=await management.findChatMessages(user,{q:'%_'});assert.equal(matches.messages.length,1);
  assert.equal((await chat.threadMessages(user,thread.id)).length,2);
  await assert.rejects(withUserScope(user,()=>chat.listThreads(other)),/无权/);
  const {db}=await store.creditStorage();const plan=db.prepare("EXPLAIN QUERY PLAN SELECT value FROM documents WHERE collection=? AND json_extract(value,'$.userId')=? AND json_extract(value,'$.threadId')=? ORDER BY json_extract(value,'$.createdAt'),id").all('chat_messages',user.id,thread.id);assert.ok(plan.some(row=>String(row.detail).includes('documents_owner_thread_time')));
});
