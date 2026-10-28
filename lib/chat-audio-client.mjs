export function encodePcmWav(samples,sampleRate=16000){
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(offset,value)=>[...value].forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((value,index)=>{const sample=Math.max(-1,Math.min(1,value));view.setInt16(44+index*2,sample<0?sample*32768:sample*32767,true);});return buffer;
}
export async function recordingFile(chunks,mime){
  const encoded=new Blob(chunks,{type:mime}),context=new (window.AudioContext||window.webkitAudioContext)();
  try{
    const decoded=await context.decodeAudioData(await encoded.arrayBuffer()),offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
    const pcm=await offline.startRendering();return new File([encodePcmWav(pcm.getChannelData(0))],'语音消息.wav',{type:'audio/wav'});
  }finally{await context.close();}
}
