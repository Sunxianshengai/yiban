import {timingSafeEqual} from 'node:crypto';
import * as store from '../../../../lib/store.mjs';
import {withoutScope} from '../../../../lib/access-scope.mjs';
import {qwenVoiceConfig,qwenVoiceRequest,qwenVoiceAudio} from '../../../../lib/qwen-companion-voice.mjs';
import {inspectVoiceWav} from '../../../../lib/voice-audio.mjs';
import {importSharedVoice} from '../../../../lib/shared-voice-import.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=240;
async function importRequest(input){
  if(input.action!=='create_voice')return qwenVoiceRequest(input);
  const config=qwenVoiceConfig();
  const response=await fetch(config.base+'/services/audio/tts/customization',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({model:'voice-enrollment',input}),signal:AbortSignal.timeout(150000),redirect:'error'});
  const result=await response.json();
  if(!response.ok||!result.output||result.code)throw Error('Voice provider '+response.status+': '+String(result.code||'invalid output'));
  return result.output;
}
export async function POST(request){
  const expected=process.env.YIBAN_SHARED_VOICE_IMPORT_TOKEN;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!expected||Date.now()>Date.parse('2026-11-01T14:30:00Z')||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Not found'},{status:404});
  if(Number(request.headers.get('content-length'))>1000000)return Response.json({error:'Sample too large'},{status:413});
  const sample=Buffer.from(await request.arrayBuffer());if(sample.length>1000000)return Response.json({error:'Sample too large'},{status:413});
  try{
    const result=await withoutScope(()=>importSharedVoice(sample,{store,requestVoice:importRequest,synthesize:qwenVoiceAudio,inspect:inspectVoiceWav}));
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.message},{status:502,headers:{'Cache-Control':'no-store'}});}
}
