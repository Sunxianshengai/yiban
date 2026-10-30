export async function voiceAPI(path='',{body,...options}={}){
  const response=await fetch('/api/companion-voices'+(path?'/'+path:''),{...options,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'声音操作失败，请重试');return result;
}
export async function prepareVoiceFile(file){
  if(!file.size||file.size>20*1024*1024)throw Error('请选择 20 MB 以内的录音');
  const context=new (window.AudioContext||window.webkitAudioContext)();let decoded;
  try{decoded=await context.decodeAudioData(await file.arrayBuffer());}catch{throw Error('浏览器无法读取这段录音，请改用 WAV 或 MP3');}finally{await context.close();}
  if(decoded.duration<3||decoded.duration>30)throw Error('请使用 3–30 秒录音，建议 10–20 秒');
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*24000),24000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering(),samples=rendered.getChannelData(0),buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(offset,text)=>[...text].forEach((letter,index)=>view.setUint8(offset+index,letter.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const sample=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true);}
  return {file:new File([buffer],'companion-voice.wav',{type:'audio/wav'}),duration:decoded.duration,sourceName:file.name};
}
