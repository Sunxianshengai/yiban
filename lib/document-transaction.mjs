import {randomUUID} from 'node:crypto';
import {creditStorage,insertIfAbsent,remove,get,prepareTransactionAccess} from './store.mjs';
// Compare all existing guards and commit all documents in one database operation.
// The shared account guard serializes outreach, presence and message submission.
export async function commitDocuments(checks,writes){
  if(!checks.length||!writes.length)throw new Error('Missing transaction guards');
  writes=await prepareTransactionAccess(checks,writes);
  const {sql,db}=await creditStorage();
  if(sql){
    const rows=await sql`WITH locked AS MATERIALIZED (
      SELECT d.collection,d.id FROM documents d
      JOIN jsonb_to_recordset(${JSON.stringify(checks)}::jsonb) AS c(collection text,id text,value jsonb)
      ON d.collection=c.collection AND d.id=c.id AND d.value=c.value
      ORDER BY d.collection,d.id FOR UPDATE OF d
    ), allowed AS (SELECT count(*) AS n FROM locked)
    INSERT INTO documents(collection,id,value)
    SELECT w.collection,w.id,w.value FROM jsonb_to_recordset(${JSON.stringify(writes)}::jsonb) AS w(collection text,id text,value jsonb),allowed
    WHERE allowed.n=${checks.length}
    ON CONFLICT(collection,id) DO UPDATE SET value=EXCLUDED.value RETURNING id`;
    return rows.length===writes.length;
  }
  db.exec('BEGIN IMMEDIATE');
  try{
    for(const c of checks){const row=db.prepare('SELECT value FROM documents WHERE collection=? AND id=?').get(c.collection,c.id);if(!row||row.value!==JSON.stringify(c.value)){db.exec('ROLLBACK');return false;}}
    for(const w of writes)db.prepare('INSERT INTO documents(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value').run(w.collection,w.id,JSON.stringify(w.value));
    db.exec('COMMIT');return true;
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export const documentGuard=(collection,value)=>({collection,id:value.id,value});
// Authenticated operational probe: private scratch rows only, no user data.
export async function probeDocuments(){
 const collection='proactive_atomic_probe',id=randomUUID(),initial={id,count:0};
 await insertIfAbsent(collection,initial);
 try{const results=await Promise.all([1,2].map(count=>commitDocuments([documentGuard(collection,initial)],[documentGuard(collection,{id,count})])));const saved=await get(collection,id);if(results.filter(Boolean).length!==1||![1,2].includes(saved?.count))throw Error('Atomic storage check failed');return {ok:true,winners:1};}
 finally{await remove(collection,id);}
}
