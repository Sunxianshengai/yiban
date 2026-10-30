import {createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {all,get,put,remove,insertIfAbsent,compareAndPut} from './store.mjs';
import {withoutScope,currentScope} from './access-scope.mjs';
import {ensureMembership,addMembership,switchFamily,myFamilies} from './families.mjs';
import {DEFAULT_PREFERENCES, sanitizePreferences} from './core.mjs';

export const COOKIE_NAME='yiban_session';
const SESSION_AGE=7*24*60*60*1000;
const INVITE_AGE=24*60*60*1000;
const roles=['admin','editor','viewer'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const cleanEmail=value=>String(value||'').trim().toLowerCase();
export const publicUser=user=>({id:user.id,name:user.name,email:user.email,role:user.role,familyId:user.familyId||'family',platformRole:user.platformRole||null,avatar:user.avatar||null,preferences:{...DEFAULT_PREFERENCES,...sanitizePreferences(user.preferences)}});

export async function validateAccount(input) {
  const name=String(input.name||'').trim().slice(0,30);
  const email=cleanEmail(input.email);
  const password=String(input.password||'');
  if(!name) throw new Error('请输入姓名');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) throw new Error('请输入有效邮箱');
  if(password.length<8||password.length>128) throw new Error('密码应为 8 到 128 位');
  if(await withoutScope(async()=>(await all('users')).some(user=>user.email===email))) throw new Error('这个邮箱已经注册');
  return {name,email,password};
}

export async function createUser(input,role='viewer',familyId='family') {
  if(!roles.includes(role)) throw new Error('账号角色不合法');
  const {name,email,password}=await validateAccount(input);
  const salt=randomBytes(16).toString('hex');
  const passwordHash=scryptSync(password,salt,64).toString('hex');
  const first=role==='admin'&&!await withoutScope(hasAdmin);
  const user={id:randomUUID(),name,email,role,familyId,salt,passwordHash,createdAt:new Date().toISOString(),preferences:{...DEFAULT_PREFERENCES},...(first?{platformRole:'owner'}:{})};
  const reservation={id:digest(email),userId:user.id};
  if(!await insertIfAbsent('account_emails',reservation))throw Error('这个邮箱已经注册');
  try{
    await put('users',user);
    if(first&&!await insertIfAbsent('system',{id:'platform_owner',userId:user.id})){delete user.platformRole;await put('users',user);}
    return publicUser(user);
  }catch(error){await remove('account_emails',reservation.id);throw error;}
}

export async function hasAdmin(){return withoutScope(async()=>(await all('users')).some(user=>user.platformRole==='owner'||user.role==='admin'));}

export async function authenticate(email,password) {
  const user=(await all('users')).find(item=>item.email===cleanEmail(email));
  if(!user||user.disabled) throw new Error('邮箱或密码错误');
  const candidate=scryptSync(String(password||''),user.salt,64);
  if(!timingSafeEqual(candidate,Buffer.from(user.passwordHash,'hex'))) throw new Error('邮箱或密码错误');
  return publicUser(user);
}

export async function createSession(userId) {
  const token=randomBytes(32).toString('hex');
  await put('sessions',{id:digest(token),userId,expiresAt:Date.now()+SESSION_AGE});
  return token;
}

export async function sessionFromRequest(request) {
  const raw=request.headers.get('cookie')||'';
  const token=raw.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  const session=await get('sessions',digest(token));
  if(!session) return null;
  if(session.expiresAt<Date.now()){await remove('sessions',session.id);return null;}
  let user=await get('users',session.userId);if(!user||user.disabled)return null;
  const membership=await ensureMembership(user);if(user.role!==membership.role)user={...user,role:membership.role};
  if(await platformOwner(user))user={...user,platformRole:'owner'};
  return publicUser(user);
}

export async function revokeSession(request) {
  const token=(request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if(token&&/^[a-f0-9]{64}$/.test(token)){await (await import('./proactive-push.mjs')).revokeSubscriptions(request);await remove('sessions',digest(token));}
}

export async function issueInvite(role='viewer',familyId=currentScope()?.familyId||'family') {
  if(!['admin','editor','viewer'].includes(role)) throw new Error('邀请码角色不合法');
  const code=randomBytes(6).toString('hex').toUpperCase();
  await put('invites',{id:digest(code),role,familyId,expiresAt:Date.now()+INVITE_AGE,createdAt:new Date().toISOString()});
  return {code,role,expiresAt:Date.now()+INVITE_AGE};
}

export async function acceptInvite(code,input) {
  const normalized=String(code||'').trim().toUpperCase();
  const invite=/^[A-F0-9]{12}$/.test(normalized)?await get('invites',digest(normalized)):null;
  if(!invite||invite.expiresAt<Date.now()) throw new Error('邀请码无效或已过期');
  if(invite.claimedAt)throw Error('邀请码已被使用');
  await validateAccount(input);
  // Claim an invitation before creating an account: concurrent registrations
  // cannot both consume a single-use family invitation.
  const claimed={...invite,claimedAt:Date.now()};
  if(!await compareAndPut('invites',invite,claimed))throw Error('邀请码已被使用');
  let user;try{user=await createUser(input,invite.role,invite.familyId||'family');await addMembership(user.id,user.familyId,invite.role);await remove('invites',invite.id);}catch(error){await compareAndPut('invites',claimed,invite);throw error;}
  return user;
}

export async function listAccounts(){return (await all('users')).map(publicUser).sort((a,b)=>a.role==='admin'?-1:b.role==='admin'?1:a.name.localeCompare(b.name));}
export async function platformOwner(user){return withoutScope(async()=>{
  const saved=await get('system','platform_owner');if(saved)return saved.userId===user.id;
  const admins=(await all('users')).filter(item=>item.platformRole==='owner'||item.role==='admin'&&(item.familyId||'family')==='family').sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id));
  if(!admins[0])return false;await insertIfAbsent('system',{id:'platform_owner',userId:admins[0].id});return (await get('system','platform_owner')).userId===user.id;
});}
export async function platformAccount(user,id){if(!await platformOwner(user))throw Object.assign(Error('仅平台管理员可操作积分'),{status:403});return withoutScope(()=>get('users',id));}
export async function joinFamilyInvite(user,code){return withoutScope(async()=>{
  const normalized=String(code||'').trim().toUpperCase(),invite=/^[A-F0-9]{12}$/.test(normalized)?await get('invites',digest(normalized)):null;
  if(!invite||invite.claimedAt||invite.expiresAt<Date.now())throw Error('邀请码无效或已使用');
  if((await myFamilies(user)).families.length>=10)throw Error('每个账号最多加入 10 个家庭');
  const claimed={...invite,claimedAt:Date.now()};if(!await compareAndPut('invites',invite,claimed))throw Error('邀请码已使用');
  await ensureMembership(user);const familyId=invite.familyId||'family';const existing=await get('family_memberships',familyId+':'+user.id);
  if(!existing||existing.revokedAt)await addMembership(user.id,familyId,invite.role);
  await remove('invites',invite.id);return switchFamily(user,familyId);
});}

export function accountRole(user,minimum) {
  return roles.includes(user?.role)&&roles.includes(minimum)&&roles.indexOf(user.role)<=roles.indexOf(minimum);
}

export function setSessionCookie(response,token,request) {
  response.cookies.set(COOKIE_NAME,token,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:SESSION_AGE/1000});
  return response;
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
  return response;
}

export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if(!origin) return true;
  try {
    const submitted=new URL(origin);
    const host=request.headers.get('x-forwarded-host')||request.headers.get('host')||new URL(request.url).host;
    const protocol=request.headers.get('x-forwarded-proto')||new URL(request.url).protocol.slice(0,-1);
    return submitted.host===host&&submitted.protocol===`${protocol}:`;
  }catch{return false;}
}
