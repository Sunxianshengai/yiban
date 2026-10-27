import {timingSafeEqual} from 'node:crypto';
import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {readSettings,updateSettings,activity,reasonFor,dismissReason,runProactiveTick} from '../../../../lib/proactive-contact.mjs';
import {pushConfig,subscribe,unsubscribe,deviceState,delivery,flushPush} from '../../../../lib/proactive-push.mjs';
import {get,compareAndPut} from '../../../../lib/store.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
async function handle(request,{params}){
 try{
  const {path}=await params,[resource,id,action]=path,url=new URL(request.url);
  if(resource==='run'){
   const expected=process.env.PROACTIVE_CRON_SECRET,actual=request.headers.get('authorization')?.replace(/^Bearer /,'');
   if(!expected||!actual||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:'未授权'},{status:401});
   if(request.method!=='POST')return Response.json({error:'请使用 POST'},{status:405});
   const result=await runProactiveTick();return Response.json({...result,push:await flushPush()});
  }
  const user=await sessionFromRequest(request);if(!user)return Response.json({error:'请先登录'},{status:401});
  if(request.method!=='GET'&&!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
  const body=request.method==='GET'?{}:await request.json(),profileId=body.profileId??url.searchParams.get('profileId')??null;
  if(resource==='settings'){if(request.method==='GET')return Response.json({...await readSettings(user,profileId),schedulerReady:Boolean(process.env.PROACTIVE_CRON_SECRET),heartbeat:(await get('proactive_runner','runner'))?.lastRunAt||null});if(request.method==='PATCH')return Response.json(await updateSettings(user,profileId,body));}
  if(resource==='activity'&&request.method==='POST')return Response.json(await activity(user,{profileId,typing:body.typing===true}));
  if(resource==='device'){if(request.method==='GET')return Response.json(await deviceState(user,request));if(request.method==='POST')return Response.json(await subscribe(user,request,body));if(request.method==='DELETE')return Response.json(await unsubscribe(user,request));}
  if(resource==='reason'&&id){if(request.method==='GET')return Response.json(await reasonFor(user,id));if(request.method==='POST')return Response.json(await dismissReason(user,id));}
  if(resource==='delivery'&&id&&request.method==='GET')return Response.json(await delivery(user,request,id));
  if(resource==='read'&&request.method==='POST'){
   const message=await get('chat_messages',body.messageId),thread=message?await get('chat_threads',message.threadId):null;
   if(!message||message.userId!==user.id||!thread||thread.userId!==user.id||thread.deletedAt)return Response.json({error:'消息不存在'},{status:404});
   if(!thread.readAt||message.createdAt>thread.readAt)await compareAndPut('chat_threads',thread,{...thread,readAt:message.createdAt});return Response.json({ok:true});
  }
  return Response.json({error:'接口不存在'},{status:404});
 }catch(error){return Response.json({error:error.message||'请求失败'},{status:error.status||400});}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
