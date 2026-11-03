import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {authorizeReset,resetFingerprint} from '../lib/reset-plan.mjs';
test('production reset requires acceptance approval, exact target, maintenance and new setup credential',()=>{
  const base={apply:true,environment:'production',fingerprint:'target',confirmation:'target',maintenance:true,setupToken:'test-only',approval:{approved:true,fingerprint:'target',scope:'all-business-data',acceptanceConfirmed:true}};
  authorizeReset(base);authorizeReset({...base,apply:false});
  for(const change of [{confirmation:'other'},{maintenance:false},{setupToken:''},{approval:null},{approval:{...base.approval,acceptanceConfirmed:false}}])assert.throws(()=>authorizeReset({...base,...change}));
});
test('reset dry-run does not change data; explicit local execution resets accounts, messages and wallets together',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'yiban-reset-fixture-')),file=path.join(directory,'yiban.sqlite');
  try{
    const db=new DatabaseSync(file);db.exec("CREATE TABLE documents(collection TEXT,id TEXT,value TEXT,PRIMARY KEY(collection,id));CREATE TABLE credit_wallets(user_id TEXT,balance INTEGER);INSERT INTO credit_wallets VALUES('user',50)");
    for(const [collection,id,value] of [['system','environment_binding',{id:'environment_binding',environment:'test'}],['users','user',{id:'user'}],['chat_messages','m',{id:'m',text:'fixture'}]])db.prepare('INSERT INTO documents VALUES(?,?,?)').run(collection,id,JSON.stringify(value));db.close();
    const env={...process.env,DATABASE_URL:'',YIBAN_DATA_DIR:directory};
    const dry=spawnSync(process.execPath,['scripts/reset-business-data.mjs','--environment=test'],{env,encoding:'utf8'});assert.equal(dry.status,0,dry.stderr);
    let inspect=new DatabaseSync(file);assert.equal(inspect.prepare('SELECT count(*) AS n FROM documents').get().n,3);inspect.close();
    const noConfirm=spawnSync(process.execPath,['scripts/reset-business-data.mjs','--environment=test','--apply'],{env,encoding:'utf8'});assert.notEqual(noConfirm.status,0);
    const fingerprint=resetFingerprint(realpathSync(file)),apply=spawnSync(process.execPath,['scripts/reset-business-data.mjs','--environment=test','--apply','--confirm='+fingerprint],{env,encoding:'utf8'});assert.equal(apply.status,0,apply.stderr);
    inspect=new DatabaseSync(file);assert.equal(inspect.prepare('SELECT count(*) AS n FROM documents').get().n,1);assert.equal(inspect.prepare('SELECT count(*) AS n FROM credit_wallets').get().n,0);inspect.close();assert.ok(existsSync(file));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
