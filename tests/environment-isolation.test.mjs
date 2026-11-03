import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const moduleUrl=new URL('../lib/store.mjs',import.meta.url).href;
test('fresh isolated tests never migrate a real project database or its uploads',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'yiban-no-copy-')),project=path.join(directory,'project'),target=path.join(directory,'test');mkdirSync(path.join(project,'data','uploads'),{recursive:true});
  const source=new DatabaseSync(path.join(project,'data','yiban.sqlite'));source.exec('CREATE TABLE documents(collection TEXT,id TEXT,value TEXT,PRIMARY KEY(collection,id))');source.prepare('INSERT INTO documents VALUES(?,?,?)').run('users','private-user',JSON.stringify({id:'private-user',email:'private@example.invalid'}));source.close();writeFileSync(path.join(project,'data','uploads','private.wav'),'do not copy');
  try{const script=`import assert from 'node:assert/strict';const store=await import(${JSON.stringify(moduleUrl)});assert.equal(await store.get('users','private-user'),null);`;const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:project,env:{...process.env,VERCEL:'',DATABASE_URL:'',NODE_ENV:'test',YIBAN_DATA_DIR:target},encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(existsSync(path.join(target,'uploads','private.wav')),false);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('unwritable test paths cannot fall back to the normal app directory',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'yiban-no-fallback-')),file=path.join(directory,'is-a-file');writeFileSync(file,'fixture');
  try{const child=spawnSync(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';const store=await import(${JSON.stringify(moduleUrl)});await assert.rejects(store.all('users'),/禁止回退/);`],{env:{...process.env,VERCEL:'',DATABASE_URL:'',NODE_ENV:'test',YIBAN_DATA_DIR:file,LOCALAPPDATA:directory},encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(existsSync(path.join(directory,'Yiban','data')),false);}finally{rmSync(directory,{recursive:true,force:true});}
});
