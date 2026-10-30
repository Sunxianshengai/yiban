import {scopedRoute} from '../../../../lib/request-scope.mjs';
import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {callConfig,offerCall,heartbeatCall,endCall} from '../../../../lib/omni-calls.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function handle(request,{params}){
 try{
  const user=await sessionFromRequest(request);if(!user)return json({error:'请先登录'},401);
  const path=(await params).path||[];
  if(request.method==='GET'&&!path.length)return json(await callConfig(user,new URL(request.url).searchParams.get('profileId')||'default'));
  if(request.method!=='POST')return json({error:'接口不存在'},404);
  if(!sameOrigin(request))return json({error:'请求来源无效'},403);
  if(Number(request.headers.get('content-length')||0)>200000)return json({error:'连接请求过大'},413);
  const text=await request.text();if(text.length>200000)return json({error:'连接请求过大'},413);const body=JSON.parse(text||'{}');
  if(path.length===1&&path[0]==='offer')return json(await offerCall(user,body,request.signal),201);
  if(path.length===2&&/^[a-f0-9-]{36}$/.test(path[0])&&path[1]==='heartbeat')return json(await heartbeatCall(user,path[0]));
  if(path.length===2&&/^[a-f0-9-]{36}$/.test(path[0])&&path[1]==='end')return json(await endCall(user,path[0]));
  return json({error:'接口不存在'},404);
 }catch(error){return json({error:error.message||'通话未能完成'},error.status||400);}
}
const scoped=scopedRoute(handle);
export {scoped as GET,scoped as POST};
