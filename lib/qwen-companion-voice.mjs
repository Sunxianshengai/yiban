import {repairVoiceWav} from './voice-audio.mjs';
export function qwenVoiceConfig(){
  const key=process.env.QWEN_VOICE_API_KEY;
  if(!key)return null;
  const base=(process.env.QWEN_VOICE_BASE_URL||'https://maas.qianwenaiapi.com/api/v1').replace(/\/$/,'');
  const url=new URL(base),mock=process.env.YIBAN_VOICE_MOCK==='1'&&!process.env.VERCEL&&['localhost','127.0.0.1'].includes(url.hostname);
  if(!mock&&(url.protocol!=='https:'||url.hostname!=='maas.qianwenaiapi.com'))throw Error('千问声音服务地址无效');
  return {key,base,mock,model:process.env.QWEN_VOICE_MODEL||'qwen-audio-3.1-tts-plus'};
}
export async function qwenVoiceRequest(input){
  const config=qwenVoiceConfig();if(!config)throw Error('专属音色服务尚未配置，请联系管理员');
  const response=await fetch(config.base+'/services/audio/tts/customization',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'voice-enrollment',input}),signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!response.ok)throw Error(response.status===429?'声音服务繁忙，请稍后查询状态':'千问音色请求未能完成，请查询状态或联系管理员');
  const result=await response.json();if(!result.output||result.code)throw Error('千问未返回有效音色结果');
  return result.output;
}
export async function qwenVoiceAudio(text,voiceId,model){
  const config=qwenVoiceConfig();if(!config)throw Error('专属音色服务尚未配置');
  const response=await fetch(config.base+'/services/audio/tts/SpeechSynthesizer',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:{text,voice:voiceId,format:'wav',sample_rate:24000}}),signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!response.ok)throw Error('专属声音生成失败，文字已保留');
  let audio=response;
  if(!(response.headers.get('content-type')||'').startsWith('audio/')){
    const result=await response.json(),raw=result.output?.audio?.url;if(!raw)throw Error('声音服务未返回音频');
    const url=new URL(raw);
    // Qianwen currently returns HTTP URLs for its signed OSS audio. Upgrade
    // trusted Aliyun storage to TLS before any request; never fetch plain HTTP.
    if(url.protocol==='http:'&&url.hostname.endsWith('.aliyuncs.com'))url.protocol='https:';
    const mock=config.mock&&url.origin===new URL(config.base).origin;
    if(!mock&&(url.protocol!=='https:'||!['aliyuncs.com','qianwenaiapi.com'].some(domain=>url.hostname.endsWith('.'+domain))))throw Error('声音服务返回的音频地址无效');
    // Signed storage URLs never receive the API credential and cannot redirect.
    audio=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!audio.ok)throw Error('声音文件读取失败');
  }
  const reader=audio.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10*1024*1024)throw Error('声音文件超过限制');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return repairVoiceWav(Buffer.concat(chunks));
}
