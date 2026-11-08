import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';

const directory=mkdtempSync(path.join(tmpdir(),'yiban-cottage-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory});delete process.env.DATABASE_URL;delete process.env.VERCEL;
const auth=await import('../lib/auth.mjs'),store=await import('../lib/store.mjs'),scope=await import('../lib/access-scope.mjs'),cottage=await import('../lib/cottage-store.mjs'),credits=await import('../lib/credits.mjs');
const user=await auth.createUser({name:'记录者',email:'cottage-a@test.invalid',password:'Password123'},'viewer');
const other=await auth.createUser({name:'家人',email:'cottage-b@test.invalid',password:'Password123'},'admin');
const route=await loadRoute(new URL('../app/api/cottage/[...path]/route.js',import.meta.url));
const cookie=`yiban_session=${await auth.createSession(user.id)}`,otherCookie=`yiban_session=${await auth.createSession(other.id)}`;
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
const call=(method,endpoint='entries',body,{as=cookie,origin='http://localhost',key='save'}={})=>route[method](new Request(`http://localhost/api/cottage/${endpoint}`,{method,headers:{cookie:as,origin,'content-type':'application/json','idempotency-key':key},...(body===undefined?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('?')[0].split('/')})});

test('private cottage text persists once, survives reload, and never changes family memories or credits',async()=>{
  const memories=await store.all('memories'),wallet=await credits.balance(user.id);
  const body={text:'今天和妈妈一起做了红烧肉。'};
  const created=await call('POST','entries',body,{key:'text-first'});assert.equal(created.status,201);const {item}=await created.json();
  assert.equal(item.title,body.text);assert.equal(item.kind,'text');assert.equal(item.book,'生活随记');assert.equal(item.userId,user.id);
  const replay=await call('POST','entries',body,{key:'text-first'});assert.equal(replay.status,200);assert.equal((await replay.json()).item.id,item.id);
  assert.equal((await call('POST','entries',{text:'不同的内容'},{key:'text-first'})).status,409);
  const listed=await(await call('GET')).json();assert.equal(listed.items.filter(entry=>entry.id===item.id).length,1);assert.equal(listed.hasMore,false);
  assert.equal((await call('GET',`entries/${item.id}`,undefined,{as:otherCookie})).status,404);
  assert.deepEqual((await(await call('GET','entries',undefined,{as:otherCookie})).json()).items,[]);
  assert.equal((await call('DELETE',`entries/${item.id}`,undefined,{as:otherCookie})).status,404);
  assert.deepEqual(await store.all('memories'),memories);
  assert.deepEqual(await credits.balance(user.id),wallet);
});

test('only caller-owned original image and audio uploads may be archived',async()=>{
  await store.put('uploads',{id:'my-photo.jpg',userId:user.id,contentType:'image/jpeg'});
  await store.put('uploads',{id:'my-voice.webm',userId:user.id,contentType:'audio/webm'});
  await store.put('uploads',{id:'family-photo.jpg',userId:other.id,shared:true,contentType:'image/jpeg'});
  const media=[{url:'/api/media/my-photo.jpg',name:'合照.jpg',contentType:'image/jpeg'},{url:'/api/media/my-voice.webm',name:'讲述.webm',contentType:'audio/webm'}];
  const result=await call('POST','entries',{title:'做菜的故事',text:'保留原声',media},{key:'mixed-media'});assert.equal(result.status,201);
  const {item}=await result.json();assert.equal(item.kind,'audio');assert.deepEqual(item.media,media);
  assert.equal((await call('POST','entries',{media:[{url:'https://example.com/photo.jpg'}]})).status,400);
  assert.equal((await call('POST','entries',{media:[{url:'/api/media/../secret.jpg'}]})).status,400);
  assert.equal((await call('POST','entries',{media:[{url:'/api/media/family-photo.jpg'}]})).status,404);
  assert.equal((await call('POST','entries',{media:[{url:'/api/media/my-photo.jpg',contentType:'audio/webm'}]})).status,400);
  assert.equal((await call('POST','entries',{media:Array(9).fill(media[0])})).status,400);
  const photos=await cottage.createCottageEntry(user,{media:[media[0]]},'photo-alone');assert.equal(photos.item.kind,'photo');
});

test('edits enforce ownership, deletion scrubs content, and old retries cannot resurrect it',async()=>{
  const {item}=await cottage.createCottageEntry(user,{text:'写给以后的自己'},'edit-and-delete');
  await assert.rejects(cottage.changeCottageEntry(other,item.id,{text:'替别人改'}),error=>error.status===404);
  const changed=await cottage.changeCottageEntry(user,item.id,{title:'一封信',book:'时光信匣',expectedUpdatedAt:item.updatedAt});assert.equal(changed.item.title,'一封信');
  await assert.rejects(cottage.changeCottageEntry(user,item.id,{text:'过期的修改',expectedUpdatedAt:'2000-01-01T00:00:00.000Z'}),error=>error.status===409);
  await cottage.deleteCottageEntry(user,item.id);await assert.rejects(cottage.readCottageEntry(user,item.id),error=>error.status===404);
  const deleted=await store.get('cottage_entries',item.id);assert.ok(deleted.deletedAt);assert.equal(deleted.text,undefined);assert.equal(deleted.media,undefined);
  await assert.rejects(cottage.createCottageEntry(user,{text:'写给以后的自己'},'edit-and-delete'),error=>error.status===409);
  assert.ok(await store.get('uploads','my-photo.jpg'));
});

test('HTTP boundaries reject anonymous, cross-origin, empty and forged-scope requests',async()=>{
  assert.equal((await call('GET','entries',undefined,{as:''})).status,401);
  assert.equal((await call('POST','entries',{text:'不应写入'},{origin:'https://attacker.invalid'})).status,403);
  assert.equal((await call('POST','entries',{})).status,400);
  assert.equal((await call('POST','entries',{text:'记录'},{key:''})).status,400);
  assert.equal((await call('GET','entries?limit=999')).status,400);
  await assert.rejects(scope.withUserScope(other,()=>cottage.listCottageEntries(user)),error=>error.status===404);
});
