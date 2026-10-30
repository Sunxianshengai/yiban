// Local-only synthetic audio provider. Never reads real recordings or API keys.
import http from 'node:http';
import {encodePcmWav} from '../lib/chat-audio-client.mjs';
const port=Number(process.env.VOICE_MOCK_PORT||3879),voices=new Map();
const audio=Buffer.from(encodePcmWav(Float32Array.from({length:24000*4},(_,i)=>Math.sin(i*Math.PI*2*220/24000)*.08),24000));
http.createServer(async(request,response)=>{
  if(request.url==='/sample.wav'){response.writeHead(200,{'Content-Type':'audio/wav'});response.end(audio);return;}
  try{
    let body='';for await(const chunk of request)body+=chunk;const input=JSON.parse(body).input;
    let result;
    if(request.url.endsWith('/customization')){
      if(input.action==='create_voice'){const id=input.target_model+'-'+input.prefix+'-local';voices.set(input.prefix,id);result={voice_id:id};}
      else if(input.action==='list_voice')result={voice_list:voices.has(input.prefix)?[{voice_id:voices.get(input.prefix)}]:[]};
      else result={status:'OK'};
    }else result={audio:{url:`http://127.0.0.1:${port}/sample.wav`}};
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({output:result}));
  }catch{response.writeHead(400);response.end('{}');}
}).listen(port,'127.0.0.1',()=>console.log('Synthetic companion voice provider on '+port));
