import {createHash} from 'node:crypto';
import {all,get,put,insertIfAbsent,compareAndPut} from './store.mjs';
import {FAMILY_ROLES,RELATIONSHIPS,QUALITIES} from './familia.mjs';
export class FamiliaError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function sanitize(input,previous={}){
  const value={...previous,...input};
  if(!FAMILY_ROLES.some(r=>r.id===value.role))throw new FamiliaError('请选择一位家人');
  const name=String(value.name||FAMILY_ROLES.find(r=>r.id===value.role).label).trim();if(!name||name.length>30)throw new FamiliaError('称呼应为 1–30 字');
  if(!Number.isSafeInteger(value.age)||value.age<18||value.age>100)throw new FamiliaError('AI 家人年龄应为 18–100 岁');
  if(value.relation&&!RELATIONSHIPS.some(r=>r.id===value.relation))throw new FamiliaError('关系选项无效');
  if(value.rating!=null&&(!Number.isSafeInteger(value.rating)||value.rating<1||value.rating>5))throw new FamiliaError('请选择有效的关系感受');
  const description=String(value.description||'').trim();if(description.length>2000)throw new FamiliaError('描述最多 2000 字');
  const expression={};
  for(const [field,label,max] of [['speakingStyle','说话习惯',600],['responseExample','回复示例',1200],['avoidedExpressions','避免的表达',600]]){
    const text=value[field]??'';if(typeof text!=='string'||text.length>max)throw new FamiliaError(`${label}应为最多 ${max} 字的文字`);expression[field]=text.trim();
  }
  const qualities=value.qualities||[];if(!Array.isArray(qualities)||qualities.length>6||qualities.some(q=>!QUALITIES.some(item=>item.id===q)))throw new FamiliaError('请选择最多 6 项特质');
  const voiceName=String(value.voiceName||'').trim();if(voiceName.length>120)throw new FamiliaError('声音选项无效');
  const avatar=value.avatar||null;
  if(avatar!==null){
    if(typeof avatar!=='string'||avatar.length>180000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))throw new FamiliaError('头像应为有效的小尺寸照片');
    const bytes=Buffer.from(avatar.split(',')[1],'base64');
    const valid=avatar.startsWith('data:image/jpeg;')?bytes[0]===255&&bytes[1]===216:avatar.startsWith('data:image/png;')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    if(!valid)throw new FamiliaError('无法识别头像图片');
  }
  return {role:value.role,name,age:value.age,relation:value.relation||null,description,rating:value.rating??null,qualities:[...new Set(qualities)],voiceName,avatar,...expression};
}
export async function ownedProfile(user,id){const profile=await get('companion_profiles',id);if(!profile||profile.userId!==user.id)throw new FamiliaError('这位 AI 家人不存在',404);return profile;}
export async function listProfiles(user){return {profiles:(await all('companion_profiles')).filter(p=>p.userId===user.id&&!p.archived).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))};}
export async function createProfile(user,input,key){
  if(typeof key!=='string'||!key.trim()||key.length>120)throw new FamiliaError('缺少有效的请求标识');
  const clean=sanitize(input),hashInput={...clean};
  for(const field of ['speakingStyle','responseExample','avoidedExpressions'])if(!hashInput[field])delete hashInput[field];
  const id=`profile-${hash({userId:user.id,key})}`,requestHash=hash(hashInput),previous=await get('companion_profiles',id);
  if(previous){if(previous.requestHash!==requestHash)throw new FamiliaError('同一请求标识不能用于不同设定',409);return previous;}
  if((await listProfiles(user)).profiles.length>=30)throw new FamiliaError('最多创建 30 位 AI 家人');
  const stamp=new Date().toISOString();const profile={id,userId:user.id,...clean,requestHash,archived:false,createdAt:stamp,updatedAt:stamp};
  if(!await insertIfAbsent('companion_profiles',profile)){const existing=await ownedProfile(user,id);if(existing.requestHash!==requestHash)throw new FamiliaError('请求设定发生变化，请重试',409);return existing;}return profile;
}
export async function updateProfile(user,id,input){
  const profile=await ownedProfile(user,id);if(input.archived!==undefined&&typeof input.archived!=='boolean')throw new FamiliaError('归档选项无效');
  if(input.expectedUpdatedAt!==undefined&&input.expectedUpdatedAt!==profile.updatedAt)throw new FamiliaError('设定已在其他页面更新，请重新打开后再修改',409);
  const next={...profile,...sanitize(input,profile),archived:input.archived??profile.archived,updatedAt:new Date().toISOString()};
  if(!await compareAndPut('companion_profiles',profile,next))throw new FamiliaError('设定已更新，请重新打开后重试',409);return next;
}

// A check-in is an explicit personal report, never a model-derived diagnosis or family score.
const dayInShanghai=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export async function moodHistory(user){
  const current=dayInShanghai(new Date());const anchor=new Date(`${current}T12:00:00+08:00`);
  const records=await Promise.all(Array.from({length:7},(_,i)=>{const date=dayInShanghai(new Date(anchor.getTime()-(6-i)*86400000));return get('mood_checkins',`${user.id}:${date}`).then(record=>({date,value:record?.value??null,note:record?.note||'',updatedAt:record?.updatedAt||null}));}));
  return {series:records,today:records.at(-1).value===null?null:records.at(-1),timeZone:'Asia/Shanghai'};
}
export async function checkIn(user,input){
  if(!Number.isSafeInteger(input.value)||input.value<1||input.value>5)throw new FamiliaError('请选择一个心情');
  const note=String(input.note||'').trim();if(note.length>500)throw new FamiliaError('心情随记最多 500 字');
  const date=dayInShanghai(new Date()),id=`${user.id}:${date}`;
  const entry=await put('mood_checkins',{id,userId:user.id,date,value:input.value,note,updatedAt:new Date().toISOString()});
  return {entry,...await moodHistory(user)};
}
