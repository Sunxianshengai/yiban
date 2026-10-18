import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

function run(source,extra={}) {
  const env={...process.env,NODE_ENV:'test',...extra};
  delete env.DATABASE_URL;
  const result=spawnSync(process.execPath,['--input-type=module','-e',source],{env,encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr||result.error?.message);
}

test('Vercel can import storage without credentials; requests fail clearly and can retry',()=>{
  run(`
    import assert from 'node:assert/strict';
    const store=await import('./lib/store.mjs');
    assert.equal(store.usesRemoteStorage,true);
    assert.equal(store.uploadDir,null);
    for(let attempt=0;attempt<2;attempt++)await assert.rejects(store.all('users'),/DATABASE_URL/);
  `,{VERCEL:'1'});
});

test('local storage initializes on first use and persists concurrent requests across restarts',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'yiban-store-test-'));
  const env={VERCEL:'',YIBAN_DATA_DIR:directory};
  try {
    run(`
      import assert from 'node:assert/strict';
      import {existsSync} from 'node:fs';
      import path from 'node:path';
      const store=await import('./lib/store.mjs');
      assert.equal(existsSync(path.join(process.env.YIBAN_DATA_DIR,'yiban.sqlite')),false);
      const [memories,settings]=await Promise.all([store.all('memories'),store.get('settings','family')]);
      assert.ok(memories.length>0);assert.ok(settings.familyName);
      await store.put('settings',{...settings,familyName:'Persistence check'});
      await store.saveMedia('test.png',Buffer.from('example'),'image/png');
      assert.equal((await store.readMedia('test.png')).data.toString(),'example');
    `,env);
    run(`
      import assert from 'node:assert/strict';
      const store=await import('./lib/store.mjs');
      assert.equal((await store.get('settings','family')).familyName,'Persistence check');
      assert.equal((await store.readMedia('test.png')).data.toString(),'example');
      await store.deleteMedia('test.png');
      await assert.rejects(store.readMedia('test.png'));
    `,env);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
