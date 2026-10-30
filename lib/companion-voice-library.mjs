import {createHash,randomUUID} from 'node:crypto';
import {all,get,put,insertIfAbsent,compareAndPut,readMediaBuffer,saveMedia} from './store.mjs';
import {ownedMedia} from './chat-media.mjs';
import {AI_VOICES} from './ai-voices.mjs';
import {inspectVoiceWav} from './voice-audio.mjs';
import {qwenVoiceConfig,qwenVoiceRequest,qwenVoiceAudio} from './qwen-companion-voice.mjs';

export const VOICE_SAMPLES=['你回来啦，今天怎么样？','噗哈哈哈，怎么又是这样。','好，那我们明天再聊。','今天是不是有点累？想说的话就慢慢说。','我刚刚想起你说的那件事，后来怎么样了？'];
const collection='companion_voices',stamp=()=>new Date().toISOString();
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const publicVoice=voice=>({id:voice.id,name:voice.name,status:voice.status,error:voice.error||null,createdAt:voice.createdAt,updatedAt:voice.updatedAt});
function voiceName(value){const name=typeof value==='string'?value.trim():'';if(!name||name.length>30)throw fail('音色名称应为 1–30 字');return name;}
export async function ownedCompanionVoice(user,id){const voice=await get(collection,id);if(!voice||voice.userId!==user.id||voice.deleted)throw fail('音色不存在或无权使用',404);return voice;}
export async function validateCompanionVoice(user,id){
  if(!id||AI_VOICES.some(voice=>voice.id===id))return;
  const voice=await ownedCompanionVoice(user,id);if(voice.status!=='ready')throw fail('音色尚未就绪，请先完成创建和试听');
}
async function registerConfiguredVoices(user){
  // Admin-managed registration reuses an existing voice without uploading its
  // reference recording again. Each entry is explicitly scoped to one user.
  const raw=process.env.QWEN_COMPANION_VOICES_JSON;if(!raw)return;
  let entries;try{entries=JSON.parse(raw);}catch{throw fail('已有音色登记配置无效，请联系管理员',503);}
  if(!Array.isArray(entries))throw fail('已有音色登记配置无效，请联系管理员',503);
  for(const entry of entries.filter(item=>item.userId===user.id).slice(0,10)){
    const model=entry.model||'qwen-audio-3.1-tts-plus';
    if(!['qwen-audio-3.1-tts-plus','qwen-audio-3.1-tts-flash'].includes(model)||typeof entry.voiceId!=='string'||!entry.voiceId.startsWith(model+'-')||entry.voiceId.length>240)throw fail('已有音色与模型不匹配，请联系管理员',503);
    const id='custom-'+createHash('sha256').update(JSON.stringify([user.id,entry.voiceId])).digest('hex').slice(0,32);
    await insertIfAbsent(collection,{id,userId:user.id,name:voiceName(entry.name),providerVoiceId:entry.voiceId,model,registered:true,status:'pending',createdAt:stamp(),updatedAt:stamp()});
  }
}
export async function listCompanionVoices(user){await registerConfiguredVoices(user);const config=qwenVoiceConfig();return {voices:(await all(collection)).filter(voice=>voice.userId===user.id&&!voice.deleted).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicVoice),configured:Boolean(config),testMode:Boolean(config?.mock),samples:VOICE_SAMPLES};}
async function creationLock(user){
  const id=user.id,current=await get('companion_voice_locks',id),next={id,token:randomUUID(),expires:Date.now()+90000};
  if(current?.expires>Date.now()||!(current?await compareAndPut('companion_voice_locks',current,next):await insertIfAbsent('companion_voice_locks',next)))throw fail('已有音色正在创建，请稍候',409);
  return next;
}
export async function createCompanionVoice(user,input,key){
  if(input.consent!==true)throw fail('请确认已获得声音本人的授权');
  if(typeof key!=='string'||!key.trim()||key.length>120)throw fail('缺少有效的请求标识');
  const name=voiceName(input.name),hash=createHash('sha256').update(JSON.stringify([user.id,key])).digest('hex'),id='custom-'+hash.slice(0,32);
  const fingerprint=createHash('sha256').update(JSON.stringify([name,input.audioUrl])).digest('hex');
  const existing=await get(collection,id);
  if(existing){if(existing.deleted||existing.fingerprint!==fingerprint)throw fail('同一请求标识不能重复用于不同素材',409);return publicVoice(existing);}
  const config=qwenVoiceConfig();if(!config)throw fail('专属音色服务尚未配置，请联系管理员',503);
  const upload=await ownedMedia(user,input.audioUrl,'audio');if(upload.extension!=='wav')throw fail('请先将录音转换为 WAV 后提交');
  const media=await readMediaBuffer(upload.id,upload.blobUrl);
  if(!media?.data?.length||media.data.length>3*1024*1024)throw fail('录音内容无效或超过 3 MB');
  inspectVoiceWav(media.data);
  const lock=await creationLock(user);
  try{
    const voices=(await all(collection)).filter(voice=>voice.userId===user.id);
    if(voices.filter(voice=>!voice.deleted).length>=10)throw fail('最多保存 10 个专属音色');
    if(voices.filter(voice=>!voice.registered&&voice.createdAt.slice(0,10)===stamp().slice(0,10)).length>=5)throw fail('今天已创建 5 次，请明天再试',429);
    const voice={id,userId:user.id,name,status:'creating',prefix:'yb'+hash.slice(0,8),model:config.model,fingerprint,consentAt:stamp(),createdAt:stamp(),updatedAt:stamp()};
    if(!await insertIfAbsent(collection,voice))return publicVoice(await ownedCompanionVoice(user,id));
    try{
      const output=await qwenVoiceRequest({action:'create_voice',target_model:voice.model,prefix:voice.prefix,audio:'data:audio/wav;base64,'+media.data.toString('base64'),language_hints:['zh'],max_prompt_audio_length:30,enable_preprocess:false,enable_volume_normalization:'false'});
      if(!output.voice_id||typeof output.voice_id!=='string')throw Error('音色结果待确认');
      const next={...voice,providerVoiceId:output.voice_id,status:'pending',updatedAt:stamp()};await compareAndPut(collection,voice,next);return publicVoice(next);
    }catch{
      // A timed-out creation may already have succeeded upstream. Reconcile by
      // the stable prefix; never blindly retry a paid enrollment.
      const next={...voice,status:'uncertain',error:'创建结果待确认，请查询状态；无需重复提交录音',updatedAt:stamp()};await compareAndPut(collection,voice,next);return publicVoice(next);
    }
  }finally{await compareAndPut('companion_voice_locks',lock,{...lock,expires:0});}
}
export async function refreshCompanionVoice(user,id){
  const voice=await ownedCompanionVoice(user,id);if(['ready','failed'].includes(voice.status))return publicVoice(voice);
  if(voice.status==='creating'&&Date.now()-Date.parse(voice.createdAt)<60000)return publicVoice(voice);
  const lockId=id,current=await get('companion_voice_queries',lockId);
  if(current?.until>Date.now())return publicVoice(voice);
  const gate={id:lockId,until:Date.now()+2500};if(!(current?await compareAndPut('companion_voice_queries',current,gate):await insertIfAbsent('companion_voice_queries',gate)))return publicVoice(voice);
  let providerVoiceId=voice.providerVoiceId;
  if(!providerVoiceId){
    const output=await qwenVoiceRequest({action:'list_voice',prefix:voice.prefix,page_size:10,page_index:0});
    providerVoiceId=output.voice_list?.find(item=>item.voice_id?.startsWith(voice.model+'-'+voice.prefix+'-'))?.voice_id;
    if(!providerVoiceId)return publicVoice({...voice,error:'暂未查到音色，请稍后查询或联系管理员；不要重复创建'});
  }
  const output=await qwenVoiceRequest({action:'query_voice',voice_id:providerVoiceId});
  const status=output.status==='OK'?'ready':output.status==='DEPLOYING'?'pending':'failed';
  const next={...voice,providerVoiceId,status,error:status==='failed'?'音色未能就绪，请检查素材或联系管理员':null,updatedAt:stamp()};
  if(!await compareAndPut(collection,voice,next))return publicVoice(await ownedCompanionVoice(user,id));return publicVoice(next);
}
export async function changeCompanionVoice(user,id,input){
  const voice=await ownedCompanionVoice(user,id),next={...voice,name:voiceName(input.name),updatedAt:stamp()};
  if(!await compareAndPut(collection,voice,next))throw fail('音色已更新，请刷新后再修改',409);return publicVoice(next);
}
export async function deleteCompanionVoice(user,id){
  const voice=await ownedCompanionVoice(user,id);
  const profiles=[...await all('companion_profiles'),...await all('companion_defaults')];
  if(profiles.some(profile=>profile.userId===user.id&&profile.voice===id&&!profile.archived))throw fail('请先为使用此音色的伙伴更换声音，再移除',409);
  if(!['ready','failed'].includes(voice.status))throw fail('音色仍在处理，请先查询状态',409);
  // Remove only the user's library entry. Never invalidate historic audio or
  // an upstream voice that could be reused outside this app.
  if(!await compareAndPut(collection,voice,{...voice,deleted:true,updatedAt:stamp()}))throw fail('音色已更新，请刷新',409);
  return {removed:true};
}
export async function saveCompanionAudio(user,data,format='wav'){
  const name=`companion-${randomUUID()}.${format}`,contentType=format==='wav'?'audio/wav':'audio/mpeg',stored=await saveMedia(name,data,contentType);
  await put('uploads',{id:name,userId:user.id,shared:false,blobUrl:stored.blobUrl,blobPath:stored.blobPath,contentType,createdAt:stamp()});
  return {url:`/api/media/${name}`,duration:null,synthetic:true};
}
export async function customCompanionAudio(user,text,id){const voice=await ownedCompanionVoice(user,id);if(voice.status!=='ready')throw fail('专属音色尚未就绪');return saveCompanionAudio(user,await qwenVoiceAudio(text,voice.providerVoiceId,voice.model));}
export async function previewCompanionVoice(user,id,index=0){
  if(!Number.isInteger(index)||index<0||index>=VOICE_SAMPLES.length)throw fail('试听文本无效');
  const preset=AI_VOICES.some(item=>item.id===id);if(!preset)await validateCompanionVoice(user,id);
  const cacheId=createHash('sha256').update(JSON.stringify([user.id,id,index])).digest('hex'),previous=await get('companion_voice_previews',cacheId);
  if(previous?.audio)return {audio:previous.audio,text:VOICE_SAMPLES[index],cached:true};
  if(previous?.status==='running'&&previous.until>Date.now())throw fail('试听正在生成，请稍候',409);
  if((previous?.attempts||0)>=3)throw fail('这句试听已尝试三次，请联系管理员',429);
  const next={id:cacheId,attempts:(previous?.attempts||0)+1,status:'running',until:Date.now()+90000};
  if(!(previous?await compareAndPut('companion_voice_previews',previous,next):await insertIfAbsent('companion_voice_previews',next)))throw fail('试听正在生成，请稍候',409);
  try{
    const audio=preset?await (await import('./companion-voice.mjs')).synthesizeCompanionVoice(user,VOICE_SAMPLES[index],id):await customCompanionAudio(user,VOICE_SAMPLES[index],id);
    await compareAndPut('companion_voice_previews',next,{...next,audio,status:'ready'});return {audio,text:VOICE_SAMPLES[index],cached:false};
  }catch(error){await compareAndPut('companion_voice_previews',next,{...next,status:'failed'});throw error;}
}
