import {createHash} from 'node:crypto';
import {get,queryDocuments,insertIfAbsent,compareAndPut} from './store.mjs';
import {currentScope} from './access-scope.mjs';

const COLLECTION='cottage_entries';
const TYPES=new Set(['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/webm']);
const MEDIA_URL=/^\/api\/media\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,239})$/;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class CottageError extends Error {constructor(message,status=400){super(message);this.status=status;}}

function owner(user){
  if(!user?.id)throw new CottageError('请先登录忆伴',401);
  if(currentScope()&&currentScope().userId!==user.id)throw new CottageError('这段记忆不存在',404);
}
function object(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new CottageError('记忆内容无效');}
function text(value,label,max,{fallback='',required=false}={}){
  if(value===undefined)value=fallback;
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new CottageError(`${label}${required?'不能为空，且':''}最多 ${max} 字`);
  return value.trim();
}
function view(entry){
  const {requestHash,deletedAt,...item}=entry;
  return item;
}
async function mediaFor(user,raw=[]){
  if(!Array.isArray(raw)||raw.length>8)throw new CottageError('一次最多保存 8 份照片或录音');
  const urls=new Set(),media=[];
  for(const value of raw){
    object(value);
    const match=typeof value.url==='string'&&value.url.match(MEDIA_URL);
    if(!match||urls.has(value.url))throw new CottageError('素材地址无效或重复');
    const upload=await get('uploads',match[1]);
    if(!upload||upload.userId!==user.id||upload.shared===true)throw new CottageError('素材不存在或不属于你，请重新上传',404);
    const contentType=String(upload.contentType||'').toLowerCase().split(';')[0].trim();
    if(!TYPES.has(contentType))throw new CottageError('小屋支持 JPG、PNG、WebP 照片和常用音频文件');
    if(value.contentType!==undefined&&(typeof value.contentType!=='string'||value.contentType.toLowerCase().split(';')[0].trim()!==contentType))throw new CottageError('素材类型与上传文件不一致');
    media.push({url:value.url,name:text(value.name,'文件名',200,{fallback:match[1]})||match[1],contentType});urls.add(value.url);
  }
  return media;
}
async function clean(user,input){
  object(input);
  const body=text(input.text,'文字内容',12000),media=await mediaFor(user,input.media);
  if(!body&&!media.length)throw new CottageError('先留下一句话、照片或录音');
  const kind=media.some(item=>item.contentType.startsWith('audio/'))?'audio':media.length?'photo':'text';
  const suggested=body.split(/\r?\n/)[0].slice(0,30)||(kind==='audio'?'一段原声':'一段照片记忆');
  return {title:text(input.title,'标题',100,{fallback:suggested})||suggested,text:body,book:text(input.book,'记忆书名称',60,{fallback:'生活随记',required:true}),kind,media};
}

export async function listCottageEntries(user,{offset=0,limit=100}={}){
  owner(user);
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new CottageError('分页参数无效');
  const entries=await queryDocuments(COLLECTION,{filters:[{field:'userId',value:user.id},{field:'deletedAt',op:'null'}],order:[{field:'updatedAt',desc:true},{field:'id',desc:true}],offset,limit:limit+1});
  return {items:entries.slice(0,limit).map(view),hasMore:entries.length>limit,offset};
}
async function owned(user,id,{includeDeleted=false}={}){
  owner(user);
  if(typeof id!=='string'||!/^cottage-[a-f0-9]{64}$/.test(id))throw new CottageError('这段记忆不存在',404);
  const entry=await get(COLLECTION,id);
  if(!entry||entry.userId!==user.id||(!includeDeleted&&entry.deletedAt))throw new CottageError('这段记忆不存在',404);
  return entry;
}
export async function readCottageEntry(user,id){return view(await owned(user,id));}
export async function createCottageEntry(user,input,key){
  owner(user);
  if(typeof key!=='string'||!key.trim()||key.length>120)throw new CottageError('缺少有效的保存标识');
  const values=await clean(user,input),id='cottage-'+hash({userId:user.id,key}),requestHash=hash(values);
  const previous=await get(COLLECTION,id);
  if(previous){
    if(previous.userId!==user.id)throw new CottageError('这段记忆不存在',404);
    if(previous.deletedAt)throw new CottageError('这段记忆已删除，请重新发起记录',409);
    if(previous.requestHash!==requestHash)throw new CottageError('同一保存标识不能用于不同记忆',409);
    return {item:view(previous),replay:true};
  }
  const stamp=new Date().toISOString(),entry={id,userId:user.id,...values,createdAt:stamp,updatedAt:stamp,revision:1,requestHash};
  if(!await insertIfAbsent(COLLECTION,entry))return createCottageEntry(user,input,key);
  return {item:view(entry),replay:false};
}
export async function changeCottageEntry(user,id,input){
  object(input);const old=await owned(user,id);
  if(input.expectedUpdatedAt!==undefined&&input.expectedUpdatedAt!==old.updatedAt)throw new CottageError('记忆已在其他页面更新，请重新打开',409);
  if(Object.keys(input).some(key=>!['title','text','book','expectedUpdatedAt'].includes(key)))throw new CottageError('只能修改标题、文字和记忆书名称');
  const values={title:text(input.title,'标题',100,{fallback:old.title,required:true}),text:text(input.text,'文字内容',12000,{fallback:old.text}),book:text(input.book,'记忆书名称',60,{fallback:old.book,required:true})};
  if(!values.text&&!old.media.length)throw new CottageError('文字记忆不能为空');
  const next={...old,...values,revision:old.revision+1,updatedAt:new Date().toISOString()};
  if(!await compareAndPut(COLLECTION,old,next))throw new CottageError('记忆已更新，请重新打开后再保存',409);
  return {item:view(next)};
}
export async function deleteCottageEntry(user,id){
  const old=await owned(user,id),stamp=new Date().toISOString();
  // Keep only a tombstone so retrying an old creation cannot resurrect content.
  // Uploaded originals may be referenced by another entry and are not deleted.
  const next={id:old.id,userId:user.id,requestHash:old.requestHash,createdAt:old.createdAt,updatedAt:stamp,revision:old.revision+1,deletedAt:stamp};
  if(!await compareAndPut(COLLECTION,old,next))throw new CottageError('记忆已更新，请重新打开后再删除',409);
  return {ok:true};
}
