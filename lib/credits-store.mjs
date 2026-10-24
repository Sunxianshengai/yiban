import {randomUUID} from 'node:crypto';
import {creditStorage} from './store.mjs';

let initialization;
const schema=[
  `CREATE TABLE IF NOT EXISTS credit_wallets (
    user_id TEXT PRIMARY KEY, balance BIGINT NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance<=2000000000),
    held BIGINT NOT NULL DEFAULT 0 CHECK(held>=0))`,
  `CREATE TABLE IF NOT EXISTS credit_operations (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
    feature TEXT NOT NULL, amount BIGINT NOT NULL, state TEXT NOT NULL,
    actor_id TEXT, note TEXT NOT NULL, metadata TEXT NOT NULL, resource_key TEXT, result TEXT,
    transition_id TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
    UNIQUE(user_id,request_key))`,
  `CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, user_id TEXT NOT NULL,
    kind TEXT NOT NULL, amount BIGINT NOT NULL, note TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS credit_ledger_user ON credit_ledger(user_id,created_at)',
  'CREATE INDEX IF NOT EXISTS credit_operations_pending ON credit_operations(user_id,state)',
];
const resourceIndex="CREATE UNIQUE INDEX IF NOT EXISTS credit_active_resource ON credit_operations(resource_key) WHERE state='reserved' AND resource_key IS NOT NULL";
const grantIndex="CREATE UNIQUE INDEX IF NOT EXISTS credit_grant_request ON credit_operations(actor_id,request_key) WHERE feature='admin_grant'";

async function storage() {
  const connection=await creditStorage();
  if(!initialization) initialization=(async()=>{
    if(connection.sql) await connection.sql.transaction([...schema,
      'ALTER TABLE credit_operations ADD COLUMN IF NOT EXISTS resource_key TEXT',resourceIndex,grantIndex].map(text=>connection.sql.query(text)));
    else {
      connection.db.exec('PRAGMA busy_timeout=10000');connection.db.exec(schema.join(';'));
      if(!connection.db.prepare('PRAGMA table_info(credit_operations)').all().some(column=>column.name==='resource_key'))
        connection.db.exec('ALTER TABLE credit_operations ADD COLUMN resource_key TEXT');
      connection.db.exec(resourceIndex);
      connection.db.exec(grantIndex);
    }
  })().catch(error=>{initialization=null;throw error;});
  await initialization;
  return connection;
}

// Both adapters execute the same statements. PostgreSQL locks the account row;
// SQLite uses BEGIN IMMEDIATE. No process-local mutex protects a balance.
async function transaction(userId,statements) {
  const {sql,db}=await storage();
  const queries=[['INSERT INTO credit_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[userId]],...statements];
  if(sql) {
    queries.splice(1,0,['SELECT user_id FROM credit_wallets WHERE user_id=$1 FOR UPDATE',[userId]]);
    const result=await sql.transaction(queries.map(([text,values])=>sql.query(text,values)));
    return result.at(-1);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    let result;
    for(const [text,values] of queries) {
      const args=[];
      const sqlite=text.replace(/\$(\d+)/g,(_,index)=>{args.push(values[Number(index)-1]);return '?';});
      result=db.prepare(sqlite).all(...args);
    }
    db.exec('COMMIT');
    return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
}

async function query(text,values) {
  const {sql,db}=await storage();
  if(sql)return sql.query(text,values);
  const args=[];
  const sqlite=text.replace(/\$(\d+)/g,(_,index)=>{args.push(values[Number(index)-1]);return '?';});
  return db.prepare(sqlite).all(...args);
}

function operation(row) {
  return row?{id:row.id,userId:row.user_id,requestKey:row.request_key,requestHash:row.request_hash,
    feature:row.feature,amount:Number(row.amount),state:row.state,actorId:row.actor_id,note:row.note,
    metadata:JSON.parse(row.metadata),result:row.result?JSON.parse(row.result):null,
    createdAt:Number(row.created_at),updatedAt:Number(row.updated_at)}:null;
}

export async function createOperation({userId,requestKey,requestHash,feature,amount,actorId=null,note='',metadata={},grant=false}) {
  const id=randomUUID(),now=Date.now(),state=grant?'completed':'reserved';
  let rows;
  try {rows=await transaction(userId,[
    [`INSERT INTO credit_operations(id,user_id,request_key,request_hash,feature,amount,state,actor_id,note,metadata,resource_key,transition_id,created_at,updated_at)
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$13,$1,$11,$11 FROM credit_wallets
      WHERE user_id=$2 AND ($12=1 OR balance>=$6)
      ON CONFLICT(user_id,request_key) DO NOTHING`,
    [id,userId,requestKey,requestHash,feature,amount,state,actorId,note,JSON.stringify(metadata),now,grant?1:0,metadata.resourceKey||null]],
    [`UPDATE credit_wallets SET balance=balance+$1,held=held+$2 WHERE user_id=$3
      AND EXISTS(SELECT 1 FROM credit_operations WHERE id=$4)`,[grant?amount:-amount,grant?0:amount,userId,id]],
    [`INSERT INTO credit_ledger(id,operation_id,user_id,kind,amount,note,created_at)
      SELECT $1,$1,$2,$3,$4,$5,$6 WHERE EXISTS(SELECT 1 FROM credit_operations WHERE id=$1)`,
    [id,userId,grant?'grant':'reserve',grant?amount:-amount,note,now]],
    ['SELECT * FROM credit_operations WHERE user_id=$1 AND request_key=$2',[userId,requestKey]],
  ]);}catch(error) {
    if(error.constraint==='credit_grant_request'||/credit_grant_request|credit_operations\.actor_id, credit_operations\.request_key/.test(error.message)) {
      const conflict=new Error('同一发放请求不能更换收款账号或重复入账');conflict.status=409;throw conflict;
    }
    if(error.constraint==='credit_active_resource'||/credit_active_resource|credit_operations\.resource_key/.test(error.message)) {
      const conflict=new Error('相同内容的视频正在创建，请稍后重试；本次未扣积分');
      conflict.status=409;conflict.code='CREDIT_PENDING';throw conflict;
    }
    throw error;
  }
  const found=operation(rows[0]);
  return {operation:found,created:found?.id===id};
}

export async function readAccount(userId,{offset=0,limit=50}={}) {
  const [wallets,entries,counts,pending]=await Promise.all([
    query('SELECT balance,held FROM credit_wallets WHERE user_id=$1',[userId]),
    query(`SELECT l.*,o.feature,o.state,o.actor_id FROM credit_ledger l
      JOIN credit_operations o ON o.id=l.operation_id WHERE l.user_id=$1
      ORDER BY l.created_at DESC,l.id DESC LIMIT $2 OFFSET $3`,[userId,limit,offset]),
    query('SELECT COUNT(*) AS total FROM credit_ledger WHERE user_id=$1',[userId]),
    query("SELECT * FROM credit_operations WHERE user_id=$1 AND state='reserved' ORDER BY created_at DESC",[userId]),
  ]);
  return {balance:Number(wallets[0]?.balance||0),held:Number(wallets[0]?.held||0),
    total:Number(counts[0]?.total||0),offset,limit,
    entries:entries.map(row=>({id:row.id,operationId:row.operation_id,kind:row.kind,amount:Number(row.amount),
      note:row.note,feature:row.feature,state:row.state,actorId:row.actor_id,createdAt:Number(row.created_at)})),
    pending:pending.map(operation)};
}

export async function transitionOperation(userId,id,state,{result=null,note=''}={}) {
  const stamp=randomUUID(),now=Date.now();
  const rows=await transaction(userId,[
    [`UPDATE credit_operations SET state=$1,result=$2,updated_at=$3,transition_id=$4
      WHERE id=$5 AND user_id=$6 AND state='reserved'`,[state,JSON.stringify(result),now,stamp,id,userId]],
    [`UPDATE credit_wallets SET balance=balance+(SELECT CASE WHEN state='refunded' THEN amount ELSE 0 END FROM credit_operations WHERE id=$1),
      held=held-(SELECT amount FROM credit_operations WHERE id=$1)
      WHERE user_id=$2 AND EXISTS(SELECT 1 FROM credit_operations WHERE id=$1 AND transition_id=$3)`,[id,userId,stamp]],
    [`INSERT INTO credit_ledger(id,operation_id,user_id,kind,amount,note,created_at)
      SELECT $1,id,user_id,$2,CASE WHEN state='refunded' THEN amount ELSE 0 END,$3,$4 FROM credit_operations
      WHERE id=$5 AND transition_id=$1`,[stamp,state==='refunded'?'refund':'settle',note,now,id]],
    ['SELECT * FROM credit_operations WHERE id=$1 AND user_id=$2',[id,userId]],
  ]);
  return operation(rows[0]);
}

export async function savePendingResult(userId,id,result) {
  await query("UPDATE credit_operations SET result=$1,updated_at=$2 WHERE id=$3 AND user_id=$4 AND state='reserved'",
    [JSON.stringify(result),Date.now(),id,userId]);
}

export async function readOperation(userId,id) {
  return operation((await query('SELECT * FROM credit_operations WHERE id=$1 AND user_id=$2',[id,userId]))[0]);
}

export async function readRequest(userId,requestKey) {
  return operation((await query('SELECT * FROM credit_operations WHERE user_id=$1 AND request_key=$2',[userId,requestKey]))[0]);
}

export async function readBalance(userId) {
  const row=(await query('SELECT balance,held FROM credit_wallets WHERE user_id=$1',[userId]))[0];
  return {balance:Number(row?.balance||0),held:Number(row?.held||0)};
}
