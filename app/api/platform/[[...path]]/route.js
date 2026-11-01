import {scopedRoute} from '../../../../lib/request-scope.mjs';
import {sessionFromRequest,sameOrigin,manageFamilySession} from '../../../../lib/auth.mjs';
import {platformOverview,platformData,platformAccountWallet,updatePlatformAccount,requirePlatformOwner} from '../../../../lib/platform-admin.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>Response.json(value,{status});
async function handler(request,{params}){
  try{
    const user=await sessionFromRequest(request);await requirePlatformOwner(user);
    const path=(await params).path||[],method=request.method;
    if(method!=='GET'&&!sameOrigin(request))return json({error:'请求来源无效'},403);
    if(method==='GET'&&!path.length)return json(await platformOverview(user));
    if(method==='GET'&&path[0]==='data')return json(await platformData(user,new URL(request.url).searchParams));
    if(method==='GET'&&path[0]==='accounts'&&path[2]==='credits')return json(await platformAccountWallet(user,path[1]));
    if(method==='PATCH'&&path[0]==='accounts'&&path.length===2)return json(await updatePlatformAccount(user,path[1],await request.json()));
    if(method==='POST'&&path[0]==='family-context'){
      const body=await request.json();if(body.familyId!==null&&typeof body.familyId!=='string')return json({error:'家庭无效'},400);
      return json(await manageFamilySession(request,body.familyId));
    }
    return json({error:'接口不存在'},404);
  }catch(e){return json({error:e.message||'请求未完成'},e.status||400);}
}
export const GET=scopedRoute(handler),POST=scopedRoute(handler),PATCH=scopedRoute(handler);
