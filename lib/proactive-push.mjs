import {createHash} from 'node:crypto';
import webpush from 'web-push';
import {all,get,put,remove,compareAndPut} from './store.mjs';
import {readSettings,isQuiet} from './proactive-contact.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
export const sessionHash=request=>{const value=request.headers.get('cookie')?.match(/(?:^|;\s*)yiban_session=([a-f0-9]{64})(?:;|$)/)?.[1];return value?hash(value):null;};
export function pushConfig(){return {enabled:Boolean(process.env.WEB_PUSH_PUBLIC_KEY&&process.env.WEB_PUSH_PRIVATE_KEY),publicKey:process.env.WEB_PUSH_PUBLIC_KEY||null};}
export function validateSubscription(input){
 const s=input?.subscription;let u;try{u=new URL(s?.endpoint);}catch{throw Error('通知订阅地址无效');}
 const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.port&&u.port!=='443'||u.username||u.password||s.endpoint.length>2048||!(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com')))throw Error('通知服务地址不受支持');
 const key=s.keys?.p256dh,auth=s.keys?.auth;
 if(typeof key!=='string'||typeof auth!=='string'||!/^[\w-]+={0,2}$/.test(key)||!/^[\w-]+={0,2}$/.test(auth)||Buffer.from(key,'base64url').length!==65||Buffer.from(key,'base64url')[0]!==4||Buffer.from(auth,'base64url').length!==16)throw Error('通知订阅密钥无效');
 return {endpoint:s.endpoint,expirationTime:null,keys:{p256dh:key,auth}};
}
export async function subscribe(user,request,input){
 if(!pushConfig().enabled)throw Error('设备通知尚未配置');const subscription=validateSubscription(input),binding=sessionHash(request);if(!binding)throw Error('请重新登录');
 const id=hash(subscription.endpoint);if(!(await get('notification_subscriptions',id))&&(await all('notification_subscriptions')).filter(s=>s.userId===user.id).length>=10)throw Error('设备数量已达上限，请先关闭旧设备通知');await put('notification_subscriptions',{id,userId:user.id,sessionHash:binding,subscription,showContent:input.showContent===true,createdAt:new Date().toISOString()});return {id,enabled:true};
}
export async function deviceState(user,request){const binding=sessionHash(request);const items=(await all('notification_subscriptions')).filter(s=>s.userId===user.id&&s.sessionHash===binding);return {enabled:items.length>0,showContent:items.some(s=>s.showContent),available:pushConfig().enabled,publicKey:pushConfig().publicKey};}
export async function unsubscribe(user,request){const binding=sessionHash(request);for(const s of await all('notification_subscriptions'))if(s.userId===user.id&&s.sessionHash===binding)await remove('notification_subscriptions',s.id);return {ok:true};}
export async function revokeSubscriptions(request){const binding=sessionHash(request);if(binding)for(const s of await all('notification_subscriptions'))if(s.sessionHash===binding)await remove('notification_subscriptions',s.id);}
export async function delivery(user,request,jobId){
 const job=await get('proactive_jobs',jobId);if(!job||job.userId!==user.id||!['completed','dismissed'].includes(job.status))throw Error('消息不可用');
 const setting=await readSettings(user,job.profileId);if(!setting.enabled||setting.pausedUntil>Date.now()||isQuiet(setting,Date.now()))return {suppressed:true};
 const device=(await all('notification_subscriptions')).find(s=>s.userId===user.id&&s.sessionHash===sessionHash(request));if(!device)return {suppressed:true};
 const message=await get('chat_messages',job.messageId),thread=await get('chat_threads',job.threadId);if(!message||!thread||thread.deletedAt||thread.archived)return {suppressed:true};
 const profile=job.profileId?await get('companion_profiles',job.profileId):await get('companion_defaults',user.id);
 return {title:`忆伴 · ${profile?.name||'小满'}`,body:device.showContent?message.text.slice(0,100):'伙伴发来一条消息',url:`/app?chat=${encodeURIComponent(job.threadId)}&message=${encodeURIComponent(job.messageId)}`,tag:jobId};
}
export async function flushPush({time=Date.now(),send=webpush.sendNotification}={}){
 if(!pushConfig().enabled)return {disabled:true};let sent=0;const deadline=Date.now()+30000;
 for(const old of (await all('notification_outbox')).filter(x=>x.status==='pending'&&(!x.nextAttemptAt||x.nextAttemptAt<=time)).slice(0,10)){
  if(Date.now()>deadline-8000)break;
  const user=await get('users',old.userId),job=await get('proactive_jobs',old.jobId),thread=job?.threadId?await get('chat_threads',job.threadId):null;
  if(!user||!thread||thread.deletedAt||thread.archived||time-Date.parse(old.createdAt)>6*3600000){await compareAndPut('notification_outbox',old,{...old,status:'expired'});continue;}
  let setting;try{setting=await readSettings(user,old.profileId);}catch{await compareAndPut('notification_outbox',old,{...old,status:'suppressed'});continue;}const presence=await get('proactive_state',user.id);
  if(!setting.enabled||setting.pausedUntil>time||isQuiet(setting,time)||presence?.activityAt>time-10*60000||thread.readAt>=old.createdAt){await compareAndPut('notification_outbox',old,{...old,status:'suppressed'});continue;}
  const claimed={...old,status:'sending',leaseUntil:time+120000};if(!await compareAndPut('notification_outbox',old,claimed))continue;
  const delivered=[...(old.delivered||[])];let failed=false,budgetLimited=false;
  for(const sub of (await all('notification_subscriptions')).filter(s=>s.userId===user.id&&!delivered.includes(s.id))){
   if(Date.now()>deadline-8000){budgetLimited=true;break;}
   const session=await get('sessions',sub.sessionHash);if(!session||session.userId!==user.id||session.expiresAt<time){await remove('notification_subscriptions',sub.id);continue;}
   const current=await get('notification_subscriptions',sub.id);if(current?.userId!==sub.userId||current?.sessionHash!==sub.sessionHash)continue;
   try{await send(sub.subscription,JSON.stringify({jobId:old.jobId}),{TTL:3600,timeout:8000,vapidDetails:{subject:process.env.WEB_PUSH_SUBJECT||'https://yiban-memory.eu.cc',publicKey:process.env.WEB_PUSH_PUBLIC_KEY,privateKey:process.env.WEB_PUSH_PRIVATE_KEY}});delivered.push(sub.id);sent++;}
   catch(error){if([404,410].includes(error.statusCode))await remove('notification_subscriptions',sub.id);else failed=true;}
  }
  await compareAndPut('notification_outbox',claimed,{...old,status:budgetLimited||failed&&old.attempts<3?'pending':'sent',delivered,attempts:old.attempts+(budgetLimited?0:1),nextAttemptAt:time+900000});
 }
 // An interrupted worker may have sent already. Browser notification tags collapse
 // retries; the message itself is never generated again by push delivery.
 for(const stale of (await all('notification_outbox')).filter(x=>x.status==='sending'&&x.leaseUntil<time))await compareAndPut('notification_outbox',stale,{...stale,status:'pending'});
 return {sent};
}
