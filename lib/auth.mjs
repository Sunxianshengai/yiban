import {createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {all,get,put,remove} from './store.mjs';

export const COOKIE_NAME='yiban_session';
const SESSION_AGE=7*24*60*60*1000;
const INVITE_AGE=24*60*60*1000;
const roles=['admin','editor','viewer'];
const digest=value=>createHash('sha256').update(value).digest('hex');
const cleanEmail=value=>String(value||'').trim().toLowerCase();
const publicUser=user=>({id:user.id,name:user.name,email:user.email,role:user.role,familyId:user.familyId});

export function validateAccount(input) {
  const name=String(input.name||'').trim().slice(0,30);
  const email=cleanEmail(input.email);
  const password=String(input.password||'');
  if(!name) throw new Error('请输入姓名');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) throw new Error('请输入有效邮箱');
  if(password.length<8||password.length>128) throw new Error('密码应为 8 到 128 位');
  if(all('users').some(user=>user.email===email)) throw new Error('这个邮箱已经注册');
  return {name,email,password};
}

export function createUser(input,role='viewer') {
  if(!roles.includes(role)) throw new Error('账号角色不合法');
  const {name,email,password}=validateAccount(input);
  const salt=randomBytes(16).toString('hex');
  const passwordHash=scryptSync(password,salt,64).toString('hex');
  const user={id:randomUUID(),name,email,role,familyId:'family',salt,passwordHash,createdAt:new Date().toISOString()};
  put('users',user);return publicUser(user);
}

export function hasAdmin(){return all('users').some(user=>user.role==='admin');}

export function authenticate(email,password) {
  const user=all('users').find(item=>item.email===cleanEmail(email));
  if(!user) throw new Error('邮箱或密码错误');
  const candidate=scryptSync(String(password||''),user.salt,64);
  if(!timingSafeEqual(candidate,Buffer.from(user.passwordHash,'hex'))) throw new Error('邮箱或密码错误');
  return publicUser(user);
}

export function createSession(userId) {
  const token=randomBytes(32).toString('hex');
  put('sessions',{id:digest(token),userId,expiresAt:Date.now()+SESSION_AGE});
  return token;
}

export function sessionFromRequest(request) {
  const raw=request.headers.get('cookie')||'';
  const token=raw.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  const session=get('sessions',digest(token));
  if(!session) return null;
  if(session.expiresAt<Date.now()){remove('sessions',session.id);return null;}
  const user=get('users',session.userId);
  return user?publicUser(user):null;
}

export function revokeSession(request) {
  const token=(request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if(token&&/^[a-f0-9]{64}$/.test(token)) remove('sessions',digest(token));
}

export function issueInvite(role='viewer') {
  if(!['editor','viewer'].includes(role)) throw new Error('邀请码角色不合法');
  const code=randomBytes(6).toString('hex').toUpperCase();
  put('invites',{id:digest(code),role,familyId:'family',expiresAt:Date.now()+INVITE_AGE,createdAt:new Date().toISOString()});
  return {code,role,expiresAt:Date.now()+INVITE_AGE};
}

export function acceptInvite(code,input) {
  const normalized=String(code||'').trim().toUpperCase();
  const invite=/^[A-F0-9]{12}$/.test(normalized)?get('invites',digest(normalized)):null;
  if(!invite||invite.expiresAt<Date.now()) throw new Error('邀请码无效或已过期');
  const user=createUser(input,invite.role);
  remove('invites',invite.id);
  return user;
}

export function listAccounts(){return all('users').map(publicUser).sort((a,b)=>a.role==='admin'?-1:b.role==='admin'?1:a.name.localeCompare(b.name));}

export function accountRole(user,minimum) {
  return roles.indexOf(user.role)<=roles.indexOf(minimum);
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
