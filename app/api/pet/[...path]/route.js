import {sessionFromRequest,sameOrigin} from '../../../../lib/auth.mjs';
import {petConfig,savePetConfig,petSnapshot,writePetLeaf,petBalance,petChat,petThread,petSleep,petWhisper,petTodos,PET_ACTIONS,PetError,petTick,petChatEvent} from '../../../../lib/pet-service.mjs';
import {after} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function handle(request,{params}){
 try{
  const user=await sessionFromRequest(request);if(!user)return json({ok:false,error:'请先登录',message:'请先登录忆伴'},401);
  const method=request.method;if(method!=='GET'&&!sameOrigin(request))return json({ok:false,error:'请求来源无效'},403);
  const {path}=await params;const [resource,id,file]=path;const url=new URL(request.url);const pet=url.searchParams.get('pet')||'sleepy-sheep';
  const input=async()=>{const length=Number(request.headers.get('content-length')||0);if(length>200000)throw new PetError('请求内容过大',413);return request.json().catch(()=>({}));};
  if(resource==='config'&&!id){if(method==='GET')return json({main:await petConfig(user)});if(method==='PUT')return json(await savePetConfig(user,await input()));if(method==='POST')return json(await savePetConfig(user,{}, {reset:true}));}
  if(resource==='config'&&id==='meta')return json({user:'忆伴 · 当前账号桌宠设置',default:'内置瞌睡小羊',animations:'原创角色素材',todos:'本人待办',storage:[]});
  if(resource==='models')return json({providers:[]});
  if(resource==='voice'&&id==='voices')return json({voices:[{id:'device-default',name:'设备默认声音',tag:'本地朗读'}],message:'语音沿用伙伴音色与本设备朗读设置'});
  if(resource==='tick'&&method==='POST'){after(()=>petTick(user).catch(e=>console.error('[pet tick]',e.message)));return json({ok:true});}
  if(resource==='event'&&method==='POST'){const body=await input();if(typeof body.jobId!=='string')throw new PetError('Invalid job');return json(await petChatEvent(user,body.jobId));}
  if(resource==='state')return json(await petSnapshot(user));
  if(resource==='catalog')return json({actions:PET_ACTIONS,profile:'sleepy-sheep',source:'dsh-pet',sourceCommit:'31aa345b11a18fc16d5fd35c42b8b9441071170e'});
  if(resource==='thumb'){const name=(file||'').replace(/\.(webm|mov)$/,'');if(!['main',...(await petConfig(user)).pets.map(p=>p.id)].includes(id)||!PET_ACTIONS.includes(name))throw new PetError('素材不存在',404);return new Response(null,{status:307,headers:{Location:`/pets/sleepy-sheep/${name}.webm`}});}
  if(resource==='logo')return new Response(null,{status:307,headers:{Location:'/pets/sleepy-sheep/poster.png'}});
  if(resource==='pet-display'&&method==='POST'){const body=await input(),config=await petConfig(user);if(!config.pets.some(p=>p.id===body.id))throw new PetError('宠物不存在',404);return json(await savePetConfig(user,{pets:config.pets.map(p=>p.id===body.id?{...p,display:body.display}:p)}));}
  if(resource==='pet-config'&&method==='PUT'){const body=await input();return json(await savePetConfig(user,{pets:body.pets}));}
  if(resource==='todos')return json(await petTodos(user,method,id,method==='GET'||method==='DELETE'?{}:await input()));
  if(resource==='balance'&&method==='POST'){await petBalance(user);return json({ok:true});}
  if(resource==='sleep'&&method==='POST')return json(await petSleep(user,pet,true));
  if(resource==='wake'&&method==='POST')return json(await petSleep(user,pet,false));
  if(resource==='whisper'&&method==='POST')return json(await petWhisper(user,pet));
  if(resource==='chat'&&method==='POST')return json(await petChat(user,pet,await input(),{signal:request.signal,schedule:after,key:request.headers.get('idempotency-key')}));
  if(resource==='chat'&&method==='GET'){const view=await petThread(user,pet);return json({ok:true,threadId:view.thread.id,profileId:view.binding.profileId,messages:view.messages,rounds:view.messages.map(m=>({role:m.role,content:m.text,ts:Date.parse(m.createdAt)}))});}
  if(resource==='binding')return json(await petThread(user,pet));
  if(resource==='playback'&&method==='POST')return json({ok:true});
  if(resource==='lock'&&id==='release'&&method==='POST')return json({ok:true});
  if(resource==='anim'&&method==='POST'){const body=await input();if(!PET_ACTIONS.includes(body.name))throw new PetError('动作不存在',404);if(!(await petConfig(user)).pets.some(p=>p.id===pet))throw new PetError('宠物不存在',404);await writePetLeaf(user,pet,'anim',{name:body.name});return json({ok:true});}
  return json({ok:false,error:'桌宠接口不存在',message:'这项能力请在忆伴主聊天中使用'},404);
 }catch(e){return json({ok:false,error:e.message,message:e.message,reason:'bad-request'},e.status||400);}
}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE};
