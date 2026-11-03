import {creditStorage,queryDocuments} from './store.mjs';
import {currentScope,accessDenied} from './access-scope.mjs';

function requireOwner(userId){if(currentScope()&&currentScope().userId!==userId)throw accessDenied();}
async function engine(userId){requireOwner(userId);const {sql,db}=await creditStorage(),pg=Boolean(sql),values=[];
  const bind=value=>{values.push(value);return pg?'$'+values.length:'?';};
  const field=(alias,key)=>pg?`${alias}.value->>'${key}'`:`json_extract(${alias}.value,'$.${key}')`;
  const contains=(column,value)=>pg?`strpos(lower(COALESCE(${column},'')),lower(${bind(value)}))>0`:`instr(lower(COALESCE(${column},'')),lower(${bind(value)}))>0`;
  const truth=column=>`${column}=${pg?"'true'":'1'}`;
  const read=async text=>{const rows=pg?await sql.query(text,values):db.prepare(text).all(...values);return rows;};
  const decode=value=>pg?value:JSON.parse(value);
  return {pg,bind,field,contains,truth,read,decode};
}
export async function threadPage(userId,{needle='',archived=false,offset=0}={}){
  const e=await engine(userId),{bind:b,field:f,contains,truth}=e;
  const clauses=["t.collection='chat_threads'",`${f('t','userId')}=${b(userId)}`,`${f('t','deletedAt')} IS NULL`,archived?truth(f('t','archived')):`COALESCE(${f('t','archived')},${e.pg?"'false'":'0'})<>${e.pg?"'true'":'1'}`];
  if(needle)clauses.push(`(${contains(f('t','title'),needle)} OR EXISTS(SELECT 1 FROM documents m WHERE m.collection='chat_messages' AND ${f('m','userId')}=${b(userId)} AND ${f('m','threadId')}=t.id AND ${contains(f('m','text'),needle)}))`);
  const rows=await e.read(`SELECT t.value FROM documents t WHERE ${clauses.join(' AND ')} ORDER BY CASE WHEN ${truth(f('t','pinned'))} THEN 1 ELSE 0 END DESC,${f('t','updatedAt')} DESC,t.id DESC LIMIT ${b(51)} OFFSET ${b(Math.max(0,Math.floor(Number(offset)||0)))}`);
  return rows.map(row=>e.decode(row.value));
}
export function messagesForThread(userId,threadId){requireOwner(userId);return queryDocuments('chat_messages',{filters:[{field:'userId',value:userId},{field:'threadId',value:threadId}],order:[{field:'createdAt'},{field:'id'}]});}

function visibleBranch(e,userId,heads=null){const {bind:b,field:f}=e;
  // UNION terminates corrupt parent cycles. Every edge checks owner and thread,
  // so a malformed parent pointer cannot import another user's message.
  return `WITH RECURSIVE branch(id,thread_id,parent_id) AS (
    SELECT m.id,${f('m','threadId')},${f('m','parentId')} FROM documents m JOIN documents t ON t.id=${f('m','threadId')} AND t.collection='chat_threads'
    WHERE m.collection='chat_messages' AND ${f('m','userId')}=${b(userId)} AND ${f('t','userId')}=${b(userId)} AND ${f('t','deletedAt')} IS NULL AND m.id=${f('t','headId')}${heads?` AND m.id IN (${heads.map(b).join(',')})`:''}
    UNION
    SELECT p.id,${f('p','threadId')},${f('p','parentId')} FROM documents p JOIN branch a ON p.id=a.parent_id AND ${f('p','threadId')}=a.thread_id
    WHERE p.collection='chat_messages' AND ${f('p','userId')}=${b(userId)}
  ) `;
}
export async function summariesForThreads(userId,threads){
  const heads=threads.map(thread=>thread.headId).filter(Boolean);if(!heads.length)return {heads:new Map(),unread:new Map()};
  const headMessages=await queryDocuments('chat_messages',{filters:[{field:'userId',value:userId},{field:'id',op:'in',value:heads}]});
  const e=await engine(userId),{field:f}=e;
  const sql=visibleBranch(e,userId,heads)+`SELECT ${f('m','threadId')} AS thread_id,${f('m','createdAt')} AS created_at FROM branch a JOIN documents m ON m.id=a.id AND m.collection='chat_messages' WHERE ${f('m','status')}<>'deleted' AND ${e.pg?"m.value->'proactive' IS NOT NULL":"json_extract(m.value,'$.proactive') IS NOT NULL"}`;
  const rows=await e.read(sql),unread=new Map(),byId=new Map(threads.map(thread=>[thread.id,thread]));
  for(const row of rows){const thread=byId.get(row.thread_id);if(thread&&(!thread.readAt||row.created_at>thread.readAt))unread.set(thread.id,(unread.get(thread.id)||0)+1);}
  return {heads:new Map(headMessages.map(message=>[message.id,message])),unread};
}
export async function visibleMessagePage(userId,{needle='',favorites=false,offset=0}={}){
  const e=await engine(userId),{bind:b,field:f,contains,truth}=e;
  const cte=visibleBranch(e,userId),where=[`${f('m','status')}='completed'`];if(favorites)where.push(truth(f('m','favorite')));
  if(needle){const nested=(first,last)=>e.pg?`m.value->'${first}'->>'${last}'`:`json_extract(m.value,'$.${first}.${last}')`;where.push('('+[f('m','text'),nested('audio','transcript'),nested('vision','description')].map(column=>contains(column,needle)).join(' OR ')+')');}
  const rows=await e.read(cte+`SELECT m.value,${f('t','title')} AS title,${f('t','archived')} AS archived FROM branch a JOIN documents m ON m.id=a.id AND m.collection='chat_messages' JOIN documents t ON t.id=a.thread_id AND t.collection='chat_threads' WHERE ${where.join(' AND ')} ORDER BY ${f('m','createdAt')} DESC,m.id DESC LIMIT ${b(41)} OFFSET ${b(Math.max(0,Math.floor(Number(offset)||0)))}`);
  return rows.map(row=>({message:e.decode(row.value),title:row.title,archived:row.archived===true||row.archived==='true'||row.archived===1}));
}
