import {randomUUID,createHash} from 'node:crypto';
import {get,put,insertIfAbsent,compareAndPut} from './store.mjs';
import {defaultProfile,ownedProfile} from './familia-store.mjs';
import {currentScope} from './access-scope.mjs';

export const OMNI_MODEL='qwen3.8-omni-flash-realtime';
export class OmniError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const styles={natural:'像熟人之间自然闲聊，轻松、直接，有分寸。',playful:'俏皮损友风格，偶尔机灵地调侃，但不刻意造梗，不嘲讽用户的脆弱。',gentle:'温柔克制，先听懂对方，再简短回应，不连着嘱咐，不一味安慰。',bright:'活泼直率，有自然的语气变化，简洁真诚，不过分热情，不刻意卖萌。'};
const fail=(message,status=400)=>{throw new OmniError(message,status);};
function guard(user){if(!user?.id)fail('请先登录',401);if(currentScope()&&currentScope().userId!==user.id)fail('无权访问这通电话',404);}
export function omniRuntime(env=process.env){
 const mock=env.OMNI_CALL_MOCK==='1'&&!env.VERCEL;
 const enabled=mock||env.OMNI_CALL_ENABLED==='1'&&env.VERCEL==='1'&&env.VERCEL_ENV==='production'||env.OMNI_CALL_PREVIEW_ENABLED==='1'&&(env.VERCEL_ENV==='preview'||!env.VERCEL&&env.YIBAN_DATA_ENV==='test');
 return {mock,enabled,key:env.QWEN_OMNI_API_KEY||env.QWEN_VOICE_API_KEY||'',url:'https://maas.qianwenaiapi.com/api/v1/webrtc/realtime?model='+OMNI_MODEL};
}
async function profileFor(user,id){if(id===undefined||id===null||id==='default')return {...await defaultProfile(user),id:'default'};if(typeof id!=='string'||id.length>120)fail('伙伴选项无效');return ownedProfile(user,id);}
export function voicesFor(user,env=process.env){
 const runtime=omniRuntime(env),voices=[{id:'Tina',name:'Tina · 系统声音',kind:'system'}];
 let registry=[];try{registry=JSON.parse(env.OMNI_CALL_VOICES_JSON||'[]');}catch{throw new OmniError('通话音色配置无效，请联系管理员',503);}
 if(!Array.isArray(registry))fail('通话音色配置无效',503);
 for(const item of registry){if((item.ownerId===user.id||!item.ownerId&&item.ownerRole==='platform-owner'&&user.platformRole==='owner')&&item.model===OMNI_MODEL&&typeof item.id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(item.id))voices.push({id:item.id,name:String(item.name||'专属通话声音').slice(0,50),kind:'custom'});}
 if(runtime.mock)voices.push({id:'mock-omni-'+user.id,name:'专属通话声音 · 模拟',kind:'custom'});
 return voices;
}
export async function callConfig(user,profileId){
 guard(user);const profile=await profileFor(user,profileId),runtime=omniRuntime(),voices=voicesFor(user);
 return {available:runtime.enabled&&Boolean(runtime.key||runtime.mock),preview:process.env.VERCEL_ENV!=='production',points:0,model:OMNI_MODEL,testMode:runtime.mock,profile:{id:profile.id,name:profile.name,avatar:profile.avatar||null,role:profile.role},voices,defaultVoice:voices.find(v=>v.kind==='custom')?.id||'Tina'};
}
export function callSession(input,voice){
 if(!Object.hasOwn(styles,input.style||'natural'))fail('语气选项无效');
 if(!['semantic_vad','server_vad'].includes(input.vad||'semantic_vad'))fail('接话方式无效');
 const silence=input.silence??700;if(!Number.isInteger(silence)||silence<300||silence>1600)fail('停顿设置无效');
 const extra=input.extra||'';if(typeof extra!=='string'||extra.length>1000)fail('补充要求最多 1000 字');
 return {modalities:['text','audio'],voice,input_audio_format:'pcm',output_audio_format:'pcm',input_audio_transcription:{model:'qwen3-asr-flash-realtime'},instructions:'你是一位明确以 AI 身份提供陪伴的中文聊天伙伴。'+styles[input.style||'natural']+'请用适合语音的短句自然交谈，通常一两句话即可，长度随内容变化，不固定分条。不列清单，不用客服腔，不刻意造梗，不重复用户刚说的话。自然使用适量语气词，不每次都追问。不要编造现实中的身体活动、经历或关系。用户插话时停下来听，再根据新内容回应。'+extra.trim(),turn_detection:{type:input.vad||'semantic_vad',threshold:.5,prefix_padding_ms:300,silence_duration_ms:silence,create_response:true,interrupt_response:true}};
}
async function transition(user,id,status){
 guard(user);const previous=await get('omni_calls',user.id);if(!previous||previous.callId!==id||previous.userId!==user.id)fail('这通电话不存在',404);
 if(['ended','failed'].includes(previous.status))return {id,status:previous.status};
 const next={...previous,status,updatedAt:Date.now()};if(!await compareAndPut('omni_calls',previous,next))fail('通话状态已更新，请重试',409);return {id,status};
}
export const heartbeatCall=(user,id)=>transition(user,id,'connected');
export const endCall=(user,id)=>transition(user,id,'ended');
export async function offerCall(user,input,requestSignal){
 guard(user);const runtime=omniRuntime();if(!runtime.enabled)fail('实时通话尚未开放，请使用语音预览站',503);if(!runtime.key&&!runtime.mock)fail('实时声音服务尚未配置',503);
 const profile=await profileFor(user,input.profileId),voices=voicesFor(user);if(!voices.some(v=>v.id===input.voiceId))fail('请选择你有权使用的通话音色',403);
 const session=callSession(input,input.voiceId),sdp=input.sdp;
 if(typeof sdp!=='string'||sdp.length>180000||!sdp.startsWith('v=0')||!sdp.includes('m=audio ')||sdp.includes('m=video '))fail('语音连接请求无效');
 if(typeof input.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(input.requestId))fail('缺少有效通话请求标识');
 const previous=await get('omni_calls',user.id),now=Date.now();
 if(previous?.requestId===input.requestId)fail('请勿重复提交同一次通话，请挂断后重新开始',409);
 if(previous&&!['ended','failed'].includes(previous.status)&&now-previous.updatedAt<90000)fail('另一通电话尚未结束，请先挂断；意外断开后稍候再试',409);
 const call={id:user.id,userId:user.id,callId:randomUUID(),requestId:input.requestId,profileId:profile.id,status:'connecting',createdAt:now,updatedAt:now,offerHash:createHash('sha256').update(sdp).digest('hex')};
 if(previous?!await compareAndPut('omni_calls',previous,call):!await insertIfAbsent('omni_calls',call))fail('通话正在连接，请勿重复操作',409);
 try{
  if(runtime.mock)return {id:call.callId,answer:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',session,preview:true};
  const signal=AbortSignal.any([AbortSignal.timeout(35000),...(requestSignal?[requestSignal]:[])]);
  const response=await fetch(runtime.url,{method:'POST',headers:{Authorization:'Bearer '+runtime.key,'Content-Type':'application/sdp'},body:sdp,signal,redirect:'error'});
  if(!response.ok)throw new OmniError([401,403].includes(response.status)?'千问拒绝连接，请核对实时模型权限和音色账号':'千问暂时无法建立通话，请稍后重试',502);
  const answer=await response.text();if(!answer.trimStart().startsWith('v=0')||answer.length>200000)throw new OmniError('未收到有效的语音连接应答',502);
  if(signal.aborted)throw new OmniError('通话连接已取消',499);
  return {id:call.callId,answer,session,preview:process.env.VERCEL_ENV!=='production'};
 }catch(error){const latest=await get('omni_calls',user.id);if(latest?.callId===call.callId)await compareAndPut('omni_calls',latest,{...latest,status:'failed',updatedAt:Date.now()});if(error instanceof OmniError)throw error;throw new OmniError('连接中断或超时，未自动重连，请重新开始',502);}
}
