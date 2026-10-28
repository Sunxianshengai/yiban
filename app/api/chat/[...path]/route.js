import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {meta,listThreads,createThread,readThread,updateThread,deleteThread,selectBranch,feedback,interactMessage,deleteMessage,threadGreeting,newThreadGreeting} from '../../../../lib/chat-workspace.mjs';
import {all} from '../../../../lib/store.mjs';
import {findChatMessages,forwardChatMessage} from '../../../../lib/chat-management.mjs';
import {confirmMemoryAction} from '../../../../lib/chat-memory-actions.mjs';
import {retryCompanionVoice} from '../../../../lib/companion-voice.mjs';
import {retryMedia} from '../../../../lib/chat-media.mjs';
import {prepareGeneration,generationResponse,getJob,stopJob} from '../../../../lib/chat-generation.mjs';
import {after} from 'next/server';
import {listCallbacks,setEnabled,forgetCallback,knockState} from '../../../../lib/chat-callbacks.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
async function handle(request,{params}){
  try{
    const user=await sessionFromRequest(request);if(!user)return Response.json({error:'请先登录'},{status:401});
    if(request.method!=='GET'&&!sameOrigin(request))return Response.json({error:'请求来源无效'},{status:403});
    const {path}=await params;const [resource,id,action]=path;const url=new URL(request.url),method=request.method;
    if(method==='GET'&&resource==='meta')return Response.json(meta());
    if(resource==='callbacks'){
      // 主动开口的线头：只属于本人，与家庭记忆库无关。
      if(method==='GET')return Response.json(await listCallbacks(user));
      if(method==='POST'&&id&&action==='forget')return Response.json(await forgetCallback(user,id));
      if(method==='POST'&&!id){const body=await request.json();return Response.json(await setEnabled(user,body.enabled));}
    }
    if(method==='GET'&&resource==='knock')return Response.json(await knockState(user));
    if(method==='GET'&&resource==='memories')return Response.json({memories:(await all('memories')).filter(m=>m.status==='confirmed').map(m=>({id:m.id,title:m.title,year:m.year,cover:m.cover,people:m.people}))});
    if(resource==='jobs'&&id){if(method==='GET')return Response.json(await getJob(user,id));if(method==='POST'&&action==='cancel')return Response.json(await stopJob(user,id));}
    if(method==='GET'&&resource==='messages')return Response.json(await findChatMessages(user,{q:url.searchParams.get('q'),favorites:url.searchParams.get('favorites')==='true',offset:url.searchParams.get('offset')}));
    if(resource==='threads'){
      if(method==='POST'&&id&&action==='media-retry'){const body=await request.json();return Response.json(await retryMedia(user,id,body.messageId));}
      if(method==='POST'&&id&&action==='memory-action'){const body=await request.json();return Response.json(await confirmMemoryAction(user,id,body.messageId,body));}
      if(method==='POST'&&id&&action==='voice-retry'){const body=await request.json();return Response.json(await retryCompanionVoice(user,id,body.messageId));}
      if(method==='POST'&&id&&action==='forward')return Response.json(await forwardChatMessage(user,id,{...await request.json(),key:request.headers.get('idempotency-key')}));
      if(method==='POST'&&id&&action==='interact'){const body=await request.json();return Response.json(await interactMessage(user,id,body.messageId,body));}
      if(method==='POST'&&id&&action==='select'){const body=await request.json();return Response.json(await selectBranch(user,id,body.messageId));}
      if(method==='POST'&&id&&action==='feedback'){const body=await request.json();return Response.json(await feedback(user,id,body.messageId,body.feedback));}
      if(method==='POST'&&id&&action==='delete-message'){const body=await request.json();return Response.json(await deleteMessage(user,id,body.messageId));}
      if(method==='POST'&&id&&action==='generate'){const prepared=await prepareGeneration(user,id,await request.json(),request.headers.get('idempotency-key'),request.headers.get('x-credit-limit'));return generationResponse(user,prepared,request.signal,{schedule:after});}
      if(method==='GET'&&!id)return Response.json(await listThreads(user,{q:url.searchParams.get('q'),archived:url.searchParams.get('archived')==='true',offset:url.searchParams.get('offset')}));
      if(method==='GET'&&id&&action==='greeting')return Response.json(await threadGreeting(user,id));
      if(method==='GET'&&id==='greeting')return Response.json(await newThreadGreeting(user,{memoryMode:url.searchParams.get('memoryMode')}));
      if(method==='GET'&&id&&!action)return Response.json(await readThread(user,id));
      if(method==='POST'&&!id)return Response.json(await createThread(user,await request.json()),{status:201});
      if(method==='PATCH'&&id&&!action)return Response.json(await updateThread(user,id,await request.json()));
      if(method==='DELETE'&&id&&!action)return Response.json(await deleteThread(user,id));
    }
    return Response.json({error:'接口不存在'},{status:404});
  }catch(error){return Response.json({error:error.message||'请求未能完成',...(error.code?{code:error.code}:{}),...(error.jobId?{jobId:error.jobId}:{})},{status:error.status||400});}
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
