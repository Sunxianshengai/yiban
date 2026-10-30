import {randomUUID} from 'node:crypto';
import {get,put,insertIfAbsent,all,compareAndPut} from './store.mjs';
import {withoutScope,accessDenied} from './access-scope.mjs';
import {commitDocuments,documentGuard} from './document-transaction.mjs';
const memberKey=(familyId,userId)=>familyId+':'+userId;
export async function ensureMembership(user){
  const familyId=user.familyId||'family';
  return withoutScope(async()=>{
    let membership=await get('family_memberships',memberKey(familyId,user.id));
    // Only the legacy family can adopt old users without explicit membership.
    if(!membership&&familyId==='family'){
      await insertIfAbsent('families',{id:'family',familyId:'family',name:'原有家庭',createdAt:user.createdAt||new Date().toISOString()});
      membership={id:memberKey(familyId,user.id),familyId,userId:user.id,role:user.role||'viewer'};await insertIfAbsent('family_memberships',membership);
    }
    if(!membership||membership.revokedAt)throw accessDenied();return membership;
  });
}
export async function myFamilies(user){
  return withoutScope(async()=>{
    await ensureMembership(user);
    const memberships=(await all('family_memberships')).filter(item=>item.userId===user.id&&!item.revokedAt),families=[];
    for(const membership of memberships){const family=await get('families',membership.familyId);if(family)families.push({id:family.id,name:family.name,role:membership.role,active:family.id===user.familyId});}
    return {families};
  });
}
export async function createFamily(user,name){
  const title=String(name||'').trim();if(!title||title.length>60)throw Error('家庭名称应为 1–60 字');
  return withoutScope(async()=>{
    await ensureMembership(user);
    const account=await get('users',user.id);if(!account)throw accessDenied();
    if((await myFamilies(user)).families.length>=10)throw Error('每个账号最多加入 10 个家庭');
    const id=randomUUID(),createdAt=new Date().toISOString();
    const next={...account,familyId:id,role:'admin'};
    const writes=[documentGuard('families',{id,familyId:id,name:title,createdAt}),documentGuard('settings',{id:'family:'+id,familyId:id,familyName:title,fontSize:'large',highContrast:false,autoPlay:false,speechRate:.85,demoNotice:false}),documentGuard('family_memberships',{id:memberKey(id,user.id),familyId:id,userId:user.id,role:'admin',createdAt}),documentGuard('users',next)];
    if(!await commitDocuments([documentGuard('users',account)],writes))throw Object.assign(Error('家庭设置已更新，请重试'),{status:409});
    return {id:next.id,name:next.name,email:next.email,role:next.role,familyId:id,platformRole:next.platformRole||null};
  });
}
export async function switchFamily(user,familyId){
  return withoutScope(async()=>{
    await ensureMembership(user);const membership=await get('family_memberships',memberKey(familyId,user.id));
    if(!membership||membership.revokedAt)throw accessDenied();const account=await get('users',user.id);if(!account)throw accessDenied();
    const next={...account,familyId,role:membership.role};if(!await compareAndPut('users',account,next))throw Object.assign(Error('账号已更新，请重试'),{status:409});
    return {id:next.id,name:next.name,email:next.email,role:next.role,familyId,platformRole:next.platformRole||null};
  });
}
export async function addMembership(userId,familyId,role){
  await put('family_memberships',{id:memberKey(familyId,userId),userId,familyId,role,createdAt:new Date().toISOString()});
}
export async function removeFamilyAccount(actor,userId){
  if(actor.role!=='admin')throw Object.assign(Error('仅家庭管理员可操作'),{status:403});
  return withoutScope(async()=>{
    const target=await get('users',userId);if(!target)throw accessDenied();
    const membership=await ensureMembership(target),scopeMembership=target.familyId===actor.familyId?membership:await get('family_memberships',memberKey(actor.familyId,userId));
    if(!scopeMembership||scopeMembership.revokedAt)throw accessDenied();if(scopeMembership.role==='admin')throw Error('不能移除家庭管理员');
    if(!await compareAndPut('family_memberships',scopeMembership,{...scopeMembership,revokedAt:new Date().toISOString()}))throw Object.assign(Error('家庭成员已更新，请重试'),{status:409});
    if(target.familyId===actor.familyId){const other=(await all('family_memberships')).find(item=>item.userId===userId&&item.familyId!==actor.familyId&&!item.revokedAt);await put('users',other?{...target,familyId:other.familyId,role:other.role}:{...target,disabled:true});}
    // Membership removal never deletes another family's records or private chat.
    return {ok:true,removedFromFamily:true};
  });
}
