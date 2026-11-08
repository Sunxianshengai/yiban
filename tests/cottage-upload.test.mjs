import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadRoute} from './route-harness.mjs';

const directory=mkdtempSync(path.join(tmpdir(),'yiban-cottage-upload-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory,VERCEL:'',DATABASE_URL:'',YIBAN_MAINTENANCE_MODE:''});
const store=await import('../lib/store.mjs'),auth=await import('../lib/auth.mjs');
const viewer=await auth.createUser({name:'小屋记录者',email:'upload-viewer@test.invalid',password:'Password123'},'viewer');
const sibling=await auth.createUser({name:'同家查看者',email:'upload-sibling@test.invalid',password:'Password123'},'viewer');
const admin=await auth.createUser({name:'同家管理员',email:'upload-admin@test.invalid',password:'Password123'},'admin');
const cookies={viewer:`yiban_session=${await auth.createSession(viewer.id)}`,sibling:`yiban_session=${await auth.createSession(sibling.id)}`,admin:`yiban_session=${await auth.createSession(admin.id)}`};
const main=await loadRoute(),cottage=await loadRoute(new URL('../app/api/cottage/[...path]/route.js',import.meta.url));
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});

function call(route,method,endpoint,{as='viewer',body,origin='http://localhost',key='upload-archive'}={}){
  const headers={cookie:cookies[as]||'',origin,'idempotency-key':key};
  if(body!==undefined&&!(body instanceof FormData))headers['content-type']='application/json';
  return route[method](new Request(`http://localhost/api/${endpoint}`,{method,headers,...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),{params:Promise.resolve({path:endpoint.split('/')})});
}
const form=(type='image/png')=>{const body=new FormData();body.append('file',new File([Buffer.from('original-private-media')],'private.png',{type}));return body;};

test('viewer upload is private: owner can read and archive, same-family viewer and admin cannot read or reference it',async()=>{
  const response=await call(main,'POST','upload',{body:form()});assert.equal(response.status,200);const uploaded=await response.json(),name=uploaded.url.split('/').at(-1);
  const saved=await store.get('uploads',name);assert.equal(saved.userId,viewer.id);assert.notEqual(saved.shared,true);assert.equal(saved.familyId,viewer.familyId);assert.equal(saved.contentType,'image/png');
  const own=await call(main,'GET',`media/${name}`);assert.equal(own.status,200);assert.equal(await own.text(),'original-private-media');assert.equal(own.headers.get('Cache-Control'),'private, no-store');assert.match(own.headers.get('Vary'),/Cookie/);
  for(const as of ['sibling','admin']){
    assert.equal((await call(main,'GET',`media/${name}`,{as})).status,404);
    assert.equal((await call(cottage,'POST','entries',{as,body:{media:[{url:uploaded.url,contentType:'image/png'}]}})).status,404);
  }
  assert.equal((await call(main,'GET',`media/${name}`,{as:'anonymous'})).status,401);
  assert.equal((await call(main,'POST','memories',{as:'admin',body:{title:'禁止引用私人照片',story:'不能通过家庭记忆洗出私人素材',cover:uploaded.url}})).status,404);
  const archived=await call(cottage,'POST','entries',{body:{media:[{url:uploaded.url,contentType:'image/png'}]}});assert.equal(archived.status,201);assert.equal((await archived.json()).item.kind,'photo');
});

test('new upload permission preserves origin, authentication, MIME and family editor restrictions',async()=>{
  assert.equal((await call(main,'POST','upload',{as:'anonymous',body:form()})).status,401);
  assert.equal((await call(main,'POST','upload',{origin:'https://attacker.invalid',body:form()})).status,403);
  assert.equal((await call(main,'POST','upload',{body:form('image/svg+xml')})).status,400);
  const before=await store.snapshot(),memory=before.memories[0];
  for(const endpoint of ['memories','members','organize'])assert.equal((await call(main,'POST',endpoint,{body:{title:'禁止家庭写入',story:'只能保存私人小屋',name:'禁止新建'}})).status,403);
  assert.equal((await call(main,'PATCH',`memories/${memory.id}`,{body:{title:'禁止改写'}})).status,403);
  assert.equal((await call(main,'DELETE',`memories/${memory.id}`)).status,403);
  assert.equal((await call(main,'PATCH','settings',{body:{familyName:'禁止改写'}})).status,403);
  const after=await store.snapshot();assert.deepEqual(after.memories,before.memories);assert.deepEqual(after.members,before.members);assert.deepEqual(after.settings,before.settings);
});

// Exercise the actual remote route authorization with real local scoped storage.
// Only Blob's network transport and the remote-mode flag are replaced: no real
// Blob credentials, signatures, Neon connections, or external uploads are used.
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const blobClient=dataURL(`export async function handleUploadPresigned({body,getSignedToken}){if(body.type!=='blob.generate-presigned-url')throw Error('Unexpected mock event');return getSignedToken(body.payload.pathname);}`);
const blobServer=dataURL(`export async function issueSignedToken(options){return 'test-only-signed-token';}export async function head(pathname){return {url:'https://blob.test.invalid/'+pathname,contentType:'image/png'};}`);
async function remoteRoute(){
  const file=new URL('../app/api/[...path]/route.js',import.meta.url);
  const source=readFileSync(file,'utf8').replace('usesRemoteStorage,','usesRemoteStorage as usesLocalStorage,').replace(/from (['"])([^'"]+)\1/g,(_,quote,spec)=>`from ${quote}${spec==='@vercel/blob/client'?blobClient:spec==='@vercel/blob'?blobServer:spec.startsWith('.')?new URL(spec,file).href:import.meta.resolve(spec==='next/server'?'next/server.js':spec)}${quote}`)+'\nconst usesRemoteStorage=true;';
  return import(dataURL(source));
}
const remote=await remoteRoute();
const remotePath='yiban/1820c01c-a230-42fc-89ed-001a9ffbee11.png';
const token=pathname=>({type:'blob.generate-presigned-url',payload:{pathname}});

test('viewer remote token and completion are owner-only and never grant family write permissions',async()=>{
  assert.equal((await call(remote,'POST','upload/token',{as:'anonymous',body:token(remotePath)})).status,401);
  assert.equal((await call(remote,'POST','upload/token',{origin:'https://attacker.invalid',body:token(remotePath)})).status,403);
  const issued=await call(remote,'POST','upload/token',{body:token(remotePath)});assert.equal(issued.status,200);
  const options=(await issued.json()).urlOptions;assert.equal(options.allowOverwrite,false);assert.equal(options.maximumSizeInBytes,50*1024*1024);assert.equal(JSON.parse(options.tokenPayload).userId,viewer.id);
  const pending=await store.get('uploads',path.basename(remotePath));assert.equal(pending.userId,viewer.id);assert.notEqual(pending.shared,true);
  for(const as of ['sibling','admin'])assert.equal((await call(remote,'POST','upload/complete',{as,body:{pathname:remotePath}})).status,403);
  assert.equal((await call(remote,'POST','upload/complete',{body:{pathname:remotePath}})).status,200);
  const completed=await store.get('uploads',path.basename(remotePath));assert.equal(completed.userId,viewer.id);assert.equal(completed.contentType,'image/png');assert.notEqual(completed.shared,true);
  assert.equal((await call(remote,'POST','upload/token',{body:token('yiban/../unsafe.png')})).status,400);
});

test('remote token cannot claim an existing same-family private upload pathname',async()=>{
  const before=await store.get('uploads',path.basename(remotePath));assert.equal(before.userId,viewer.id);
  const attempt=await call(remote,'POST','upload/token',{as:'sibling',body:token(remotePath)});
  assert.ok(attempt.status>=400,'another family member must not receive a token for an existing private upload');
  const after=await store.get('uploads',path.basename(remotePath));assert.equal(after.userId,viewer.id);assert.deepEqual(after,before);
});
