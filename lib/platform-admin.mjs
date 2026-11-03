import {randomUUID} from 'node:crypto';
import {all,get,put,queryDocuments,compareAndPut} from './store.mjs';
import {withoutScope} from './access-scope.mjs';
import {platformOwner,publicUser} from './auth.mjs';
import {account} from './credits.mjs';

// Explicit business-data allowlist: no sessions, credentials, invitation tokens,
// provider jobs, push endpoints, or arbitrary database/collection access.
export const PLATFORM_COLLECTIONS={memories:'家庭记忆',members:'家人人物',anniversaries:'纪念日',activity:'家庭互动',settings:'家庭设置',quotes:'家人语录',answers:'问答',highlights:'精选',milestones:'人生节点',chat_threads:'历史会话',chat_messages:'聊天消息',companion_profiles:'AI 伴侣',personal_memory_scopes:'个人长期记忆',mood_checkins:'心情记录'};
const error=(message,status)=>Object.assign(Error(message),{status});
export async function requirePlatformOwner(user){if(!user||!await platformOwner(user))throw error('仅平台管理员可访问',user?403:401);}
async function audit(user,action,details={}){await put('system',{id:'platform-action:'+randomUUID(),actorId:user.id,action,...details,createdAt:new Date().toISOString()});}
export async function platformOverview(user){
  await requirePlatformOwner(user);
  return withoutScope(async()=>{
    const [families,users,memberships]=await Promise.all([all('families'),all('users'),all('family_memberships')]);
    return {families:families.map(f=>({id:f.id,name:f.name,members:memberships.filter(m=>m.familyId===f.id&&!m.revokedAt).length})),accounts:users.map(u=>({...publicUser(u),disabled:Boolean(u.disabled)})),collections:PLATFORM_COLLECTIONS};
  });
}
export async function platformData(user,params){
  await requirePlatformOwner(user);const collection=params.get('collection');
  if(!Object.hasOwn(PLATFORM_COLLECTIONS,collection))throw error('不支持的数据类型',400);
  const requestedOffset=Number(params.get('offset')||0),offset=Number.isSafeInteger(requestedOffset)&&requestedOffset>=0?Math.min(requestedOffset,10000000):0,filters=[];
  const userId=params.get('userId'),familyId=params.get('familyId');
  if(userId)filters.push({field:'userId',value:userId});
  if(familyId)filters.push({field:'familyId',value:familyId});
  return withoutScope(async()=>{
    const rows=await queryDocuments(collection,{filters,order:[{field:'createdAt',desc:true},{field:'id'}],offset,limit:51});
    await audit(user,'read-data',{collection,filterFamilyId:familyId||null,filterUserId:userId||null});
    return {items:rows.slice(0,50),hasMore:rows.length>50,offset};
  });
}
export async function platformAccountWallet(user,id){await requirePlatformOwner(user);return withoutScope(async()=>{if(!await get('users',id))throw error('账号不存在',404);await audit(user,'read-wallet',{targetUserId:id});return account(id);});}
export async function updatePlatformAccount(user,id,input){
  await requirePlatformOwner(user);
  return withoutScope(async()=>{
    const old=await get('users',id);if(!old)throw error('账号不存在',404);
    if(Object.keys(input).some(k=>!['name','disabled'].includes(k)))throw error('仅支持修改名字或停用状态',400);
    if(await platformOwner(old)&&Object.hasOwn(input,'disabled'))throw error('不能停用平台管理员',403);
    const next={...old};
    if(Object.hasOwn(input,'name')){if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>30)throw error('名字应为 1–30 字',400);next.name=input.name.trim();}
    if(Object.hasOwn(input,'disabled')){if(typeof input.disabled!=='boolean')throw error('停用状态无效',400);next.disabled=input.disabled;}
    if(!await compareAndPut('users',old,next))throw error('账号已更新，请重试',409);
    await audit(user,'update-account',{targetUserId:id,fields:Object.keys(input)});return {...publicUser(next),disabled:Boolean(next.disabled)};
  });
}
