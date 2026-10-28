import {randomUUID} from 'node:crypto';
import {get,put,compareAndPut,saveMedia} from './store.mjs';
import {ownedThread} from './chat-workspace.mjs';
import {defaultProfile,ownedProfile} from './familia-store.mjs';
import {AI_VOICES} from './ai-voices.mjs';

export function companionVoiceConfig(){
  const key=process.env.YIBAN_TTS_KEY||process.env.DASHSCOPE_API_KEY;
  const host=process.env.DASHSCOPE_WORKSPACE_ID?`${process.env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com`:'dashscope.aliyuncs.com';
  return key?{key,url:process.env.YIBAN_TTS_URL||`https://${host}/api/v1/services/audio/tts/SpeechSynthesizer`,model:process.env.YIBAN_TTS_MODEL||'cosyvoice-v2'}:null;
}
export async function synthesizeCompanionVoice(user,text,voice){
  const config=companionVoiceConfig();if(!config)throw Error('声音服务尚未配置');
  const preset=AI_VOICES.find(item=>item.id===voice);if(!preset)throw Error('请选择有效音色');
  const happy=/好耶|太好了|真棒|恭喜/.test(text),calm=/晚安|歇一会|慢慢|休息/.test(text);
  const response=await fetch(config.url,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.YIBAN_TTS_MODEL||preset.model||config.model,input:{text,voice:preset.providerVoice||voice,format:'mp3',sample_rate:22050,rate:calm?0.95:happy?1.03:1,pitch:1,...(preset.model==='cosyvoice-v3-flash'?{instruction:`你正在进行闲聊对话，你说话的情感是${happy?'happy':'neutral'}.`}:{})}}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('声音生成失败');
  const type=response.headers.get('content-type')||'';let data;
  if(type.startsWith('audio/'))data=Buffer.from(await response.arrayBuffer());
  else{
    const json=await response.json(),audio=json.output?.audio;
    if(audio?.data)data=Buffer.from(audio.data,'base64');
    else if(audio?.url){const url=new URL(audio.url);if(url.hostname.endsWith('.aliyuncs.com')&&url.protocol==='http:')url.protocol='https:';if(url.protocol!=='https:')throw Error('音频地址无效');const file=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!file.ok)throw Error('音频读取失败');data=Buffer.from(await file.arrayBuffer());}
  }
  if(!data?.length||data.length>10*1024*1024)throw Error('声音内容无效');
  const name=`companion-${randomUUID()}.mp3`,stored=await saveMedia(name,data,'audio/mpeg');
  await put('uploads',{id:name,userId:user.id,shared:false,blobUrl:stored.blobUrl,blobPath:stored.blobPath,contentType:'audio/mpeg',createdAt:new Date().toISOString()});
  // Duration comes from the audio element's metadata, not a character count.
  return {url:`/api/media/${name}`,duration:null,synthetic:true};
}
export async function retryCompanionVoice(user,threadId,messageId){
  const thread=await ownedThread(user,threadId),message=await get('chat_messages',messageId);
  if(!message||message.userId!==user.id||message.threadId!==threadId||message.role!=='assistant'||message.status!=='completed'||!message.text||message.text.length>1200)throw Error('这条消息不能生成语音');
  if(message.audio)return message;
  if(!['failed','unavailable'].includes(message.voiceStatus))throw Error('这条消息没有待重试的语音');
  const profile=thread.options.profileId?await ownedProfile(user,thread.options.profileId):await defaultProfile(user);
  if(profile.voiceMode==='off')throw Error('当前已设为只用文字，请先调整语音偏好');
  if(!profile.voice||!companionVoiceConfig())throw Error('请先设置伙伴音色并配置声音服务');
  if((message.voiceAttempts||0)>=3)throw Error('语音已尝试三次，请稍后重新聊天');
  const pending={...message,voiceStatus:'generating',voiceAttempts:(message.voiceAttempts||0)+1};
  if(!await compareAndPut('chat_messages',message,pending))throw Error('语音正在处理，请刷新后查看');
  try{const audio=await synthesizeCompanionVoice(user,message.text,profile.voice),latest=await get('chat_messages',messageId);if(latest?.status!=='completed')return latest;const next={...latest,audio,voiceStatus:'ready'};await compareAndPut('chat_messages',latest,next);return next;}
  catch{const latest=await get('chat_messages',messageId);if(latest?.status==='completed')await compareAndPut('chat_messages',latest,{...latest,voiceStatus:'failed'});throw Error('语音生成失败，文字已保留');}
}
