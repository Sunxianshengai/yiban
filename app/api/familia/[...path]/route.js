import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {listProfiles,createProfile,updateProfile,moodHistory,checkIn} from '../../../../lib/familia-store.mjs';
import {listPersonalMemories,createPersonalMemory,changePersonalMemory,forgetPersonalMemory,setPersonalMemoryEnabled} from '../../../../lib/personal-memory.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function json(body,options={}){return Response.json(body,{...options,headers:{'Cache-Control':'private, no-store'}});}
async function handle(request,{params}){
  try{
    const user=await sessionFromRequest(request);if(!user)return json({error:'请先登录'},{status:401});
    if(request.method!=='GET'&&!sameOrigin(request))return json({error:'请求来源无效'},{status:403});
    const {path}=await params;const [resource,id]=path;
    if(resource==='personal-memories'&&path.length<=2){
      const profileId=new URL(request.url).searchParams.get('profileId')||null;
      if(request.method==='GET'&&!id)return json(await listPersonalMemories(user,profileId));
      if(request.method==='POST'&&!id)return json(await createPersonalMemory(user,profileId,await request.json(),request.headers.get('idempotency-key')),{status:201});
      if(request.method==='PATCH'&&!id)return json(await setPersonalMemoryEnabled(user,profileId,await request.json()));
      if(request.method==='PATCH'&&id)return json(await changePersonalMemory(user,profileId,id,await request.json()));
      if(request.method==='DELETE'&&id)return json(await forgetPersonalMemory(user,profileId,id,(await request.json()).expectedRevision));
    }
    if(resource==='moods'&&path.length===1){
      if(request.method==='GET')return json(await moodHistory(user));
      if(request.method==='POST')return json(await checkIn(user,await request.json()));
    }
    if(resource==='profiles'&&path.length<=2){
      if(request.method==='GET'&&!id)return json(await listProfiles(user));
      if(request.method==='POST'&&!id)return json(await createProfile(user,await request.json(),request.headers.get('idempotency-key')),{status:201});
      if(request.method==='PATCH'&&id)return json(await updateProfile(user,id,await request.json()));
    }
    return json({error:'接口不存在'},{status:404});
  }catch(error){return json({error:error.message||'请求未能完成'},{status:error.status||400});}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
