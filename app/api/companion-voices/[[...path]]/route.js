import {scopedRoute} from '../../../../lib/request-scope.mjs';
import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {listCompanionVoices,createCompanionVoice,refreshCompanionVoice,changeCompanionVoice,deleteCompanionVoice,previewCompanionVoice,saveCompanionAudio} from '../../../../lib/companion-voice-library.mjs';
import {inspectVoiceWav} from '../../../../lib/voice-audio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function handle(request,{params}){
  try{
    const user=await sessionFromRequest(request);if(!user)return json({error:'请先登录'},401);
    if(request.method!=='GET'&&!sameOrigin(request))return json({error:'请求来源无效'},403);
    const path=(await params).path||[],[id,action]=path;if(path.length>2)return json({error:'接口不存在'},404);
    if(id==='material'&&!action&&request.method==='POST'){
      if(Number(request.headers.get('content-length'))>3*1024*1024+4096)return json({error:'录音超过大小限制'},413);
      const form=await request.formData(),file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>3*1024*1024)return json({error:'录音无效或过大'},400);
      const data=Buffer.from(await file.arrayBuffer());inspectVoiceWav(data);return json(await saveCompanionAudio(user,data));
    }
    if(!id&&request.method==='GET')return json(await listCompanionVoices(user));
    if(!id&&request.method==='POST')return json(await createCompanionVoice(user,await request.json(),request.headers.get('idempotency-key')),201);
    if(id&&action==='status'&&request.method==='POST')return json(await refreshCompanionVoice(user,id));
    if(id&&action==='preview'&&request.method==='POST')return json(await previewCompanionVoice(user,id,(await request.json()).index??0));
    if(id&&!action&&request.method==='PATCH')return json(await changeCompanionVoice(user,id,await request.json()));
    if(id&&!action&&request.method==='DELETE')return json(await deleteCompanionVoice(user,id));
    return json({error:'接口不存在'},404);
  }catch(error){return json({error:error.message||'声音操作未能完成'},error.status||400);}
}
const scoped=scopedRoute(handle);
export {scoped as GET,scoped as POST,scoped as PATCH,scoped as DELETE};
