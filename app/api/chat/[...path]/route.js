import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {meta,listThreads,createThread,readThread,updateThread,deleteThread,selectBranch,feedback} from '../../../../lib/chat-workspace.mjs';
import {all} from '../../../../lib/store.mjs';
import {prepareGeneration,generationResponse,getJob,stopJob} from '../../../../lib/chat-generation.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
async function handle(request,{params}){
  try{
    const user=await sessionFromRequest(request);if(!user)return Response.json({error:'请先登录'},{status:401});
    if(request.method!=='GET'&&!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
    const {path}=await params;const [resource,id,action]=path;const url=new URL(request.url),method=request.method;
    if(method==='GET'&&resource==='meta')return Response.json(meta());
    if(method==='GET'&&resource==='memories')return Response.json({memories:(await all('memories')).filter(m=>m.status==='confirmed').map(m=>({id:m.id,title:m.title,year:m.year,cover:m.cover,people:m.people}))});
    if(resource==='jobs'&&id){if(method==='GET')return Response.json(await getJob(user,id));if(method==='POST'&&action==='cancel')return Response.json(await stopJob(user,id));}
    if(resource==='threads'){
      if(method==='POST'&&id&&action==='select'){const body=await request.json();return Response.json(await selectBranch(user,id,body.messageId));}
      if(method==='POST'&&id&&action==='feedback'){const body=await request.json();return Response.json(await feedback(user,id,body.messageId,body.feedback));}
      if(method==='POST'&&id&&action==='generate'){const prepared=await prepareGeneration(user,id,await request.json(),request.headers.get('idempotency-key'),request.headers.get('x-credit-limit'));return generationResponse(user,prepared,request.signal);}
      if(method==='GET'&&!id)return Response.json(await listThreads(user,{q:url.searchParams.get('q'),archived:url.searchParams.get('archived')==='true',offset:url.searchParams.get('offset')}));
      if(method==='GET'&&id&&!action)return Response.json(await readThread(user,id));
      if(method==='POST'&&!id)return Response.json(await createThread(user,await request.json()),{status:201});
      if(method==='PATCH'&&id&&!action)return Response.json(await updateThread(user,id,await request.json()));
      if(method==='DELETE'&&id&&!action)return Response.json(await deleteThread(user,id));
    }
    return Response.json({error:'接口不存在'},{status:404});
  }catch(error){return Response.json({error:error.message||'请求未能完成',...(error.code?{code:error.code}:{}),...(error.jobId?{jobId:error.jobId}:{})},{status:error.status||400});}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
