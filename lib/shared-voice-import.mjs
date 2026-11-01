import {createHash} from 'node:crypto';

// One import job pins both the reference sample and the existing account list.
export async function importSharedVoice(sample,{store,requestVoice,synthesize,inspect,now=()=>new Date().toISOString()}){
  const hash=createHash('sha256').update(sample).digest('hex');
  if(hash!=='de20f56dd20335ffd04e52459367cc006f7ef067bacd97f3c2f58d0b6f7cff76')throw Error('Reference sample does not match the authorized file');
  inspect(sample);
  const id='shared-voice-import:'+hash;
  let job=await store.get('system',id);
  if(!job){
    const users=await store.all('users');
    const candidate={id,status:'new',sampleHash:hash,prefix:'yb'+hash.slice(0,8),name:'基准克隆音色',model:'qwen-audio-3.1-tts-plus',userIds:users.map(user=>user.id),createdAt:now()};
    await store.insertIfAbsent('system',candidate);job=await store.get('system',id);
  }
  if(job.status==='complete')return {status:job.status,accounts:job.userIds.length,voiceId:job.providerVoiceId,previewBytes:job.previewBytes};
  if(!job.providerVoiceId){
    if(job.status==='creating'){
      const listed=await requestVoice({action:'list_voice',prefix:job.prefix,page_size:100,page_index:0});
      const found=listed.voice_list?.find(voice=>voice.voice_id?.startsWith(job.model+'-'+job.prefix+'-'));
      if(!found)return {status:'uncertain',accounts:job.userIds.length};
      job={...job,providerVoiceId:found.voice_id};await store.put('system',job);
    }else{
      const creating={...job,status:'creating'};
      if(!await store.compareAndPut('system',job,creating))return {status:'busy'};
      job=creating;
      const output=await requestVoice({action:'create_voice',target_model:job.model,prefix:job.prefix,audio:'data:audio/wav;base64,'+sample.toString('base64'),language_hints:['zh'],max_prompt_audio_length:30,enable_preprocess:false,enable_volume_normalization:'false'});
      if(typeof output.voice_id!=='string'||!output.voice_id.startsWith(job.model+'-'))throw Error('Voice service did not return a matching voice ID');
      job={...job,providerVoiceId:output.voice_id};await store.put('system',job);
    }
  }
  const queried=await requestVoice({action:'query_voice',voice_id:job.providerVoiceId});
  if(queried.status!=='OK')return {status:queried.status||'pending',accounts:job.userIds.length,voiceId:job.providerVoiceId};
  if(!job.previewBytes){
    const preview=await synthesize('你回来啦，今天怎么样？想说的话就慢慢说。',job.providerVoiceId,job.model);
    if(preview.length<44)throw Error('Voice preview was empty');
    job={...job,previewBytes:preview.length};await store.put('system',job);
  }
  for(const userId of job.userIds){
    const voiceId='custom-'+createHash('sha256').update(JSON.stringify([userId,job.providerVoiceId])).digest('hex').slice(0,32);
    const record={id:voiceId,userId,name:job.name,providerVoiceId:job.providerVoiceId,model:job.model,registered:true,status:'ready',sampleHash:hash,importId:id,createdAt:now(),updatedAt:now()};
    await store.insertIfAbsent('companion_voices',record);
    const saved=await store.get('companion_voices',voiceId);
    if(!saved||saved.userId!==userId||saved.providerVoiceId!==job.providerVoiceId||saved.status!=='ready'||saved.deleted)throw Error('Voice registration verification failed');
  }
  job={...job,status:'complete',completedAt:now()};await store.put('system',job);
  return {status:'complete',accounts:job.userIds.length,voiceId:job.providerVoiceId,previewBytes:job.previewBytes};
}
