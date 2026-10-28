// Isolated acceptance fixture. Does not call a paid model or contain real user data.
import http from 'node:http';
import {encodePcmWav} from '../lib/chat-audio-client.mjs';
const port=Number(process.env.MOCK_CAPABILITIES_PORT||3899);
http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  try{
    const body=JSON.parse(raw||'{}');let result;
    if(req.url==='/tts'){
      const samples=new Float32Array(16000);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i/16000*2*Math.PI*440)*0.08;
      result={output:{audio:{data:Buffer.from(encodePcmWav(samples)).toString('base64')}}};
    }else if(body.model==='mock-asr')result={choices:[{message:{content:'今天去公园，看见了一只橘猫。'}}]};
    else if(body.model==='mock-vision')result={choices:[{message:{content:'照片中是一只橘猫，坐在公园的长椅上。'}}]};
    else{res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  }catch{res.writeHead(400);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Capability fixture on ${port}`));
