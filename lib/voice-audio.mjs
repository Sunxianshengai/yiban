// PCM WAV validation is shared by enrollment and the browser's local converter.
export function inspectVoiceWav(bytes){
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=offset=>String.fromCharCode(...new Uint8Array(bytes.buffer,bytes.byteOffset+offset,4));
  if(bytes.length<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw Error('请选择可读取的 WAV 录音');
  let format=null,audioBytes=0;
  for(let offset=12;offset+8<=bytes.length;){
    const size=data.getUint32(offset+4,true),start=offset+8;
    if(start+size>bytes.length)throw Error('录音文件不完整');
    if(tag(offset)==='fmt '&&size>=16)format={encoding:data.getUint16(start,true),channels:data.getUint16(start+2,true),sampleRate:data.getUint32(start+4,true),align:data.getUint16(start+12,true),bits:data.getUint16(start+14,true)};
    if(tag(offset)==='data')audioBytes+=size;
    offset=start+size+(size%2);
  }
  if(!format||format.encoding!==1||format.channels!==1||format.bits!==16||format.align!==2||format.sampleRate<16000||format.sampleRate>48000||!audioBytes)throw Error('录音应为 16–48 kHz、16-bit 单声道 WAV');
  const duration=audioBytes/(format.sampleRate*2);
  if(duration<3||duration>30)throw Error('请使用 3–30 秒清晰录音，建议 10–20 秒');
  return {...format,duration};
}

// Providers may use streaming RIFF length placeholders even for complete audio.
export function repairVoiceWav(input){
  const bytes=Buffer.from(input);
  if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('声音服务没有返回有效 WAV');
  bytes.writeUInt32LE(bytes.length-8,4);
  for(let offset=12;offset+8<=bytes.length;){
    const size=bytes.readUInt32LE(offset+4);
    if(bytes.toString('ascii',offset,offset+4)==='data'){const actual=size===0?bytes.length-offset-8:Math.min(size,bytes.length-offset-8);if(actual<=0)throw Error('声音服务返回了空 WAV');bytes.writeUInt32LE(actual,offset+4);return bytes;}
    if(size>bytes.length-offset-8)break;
    offset+=8+size+(size%2);
  }
  throw Error('声音服务返回的 WAV 缺少音频内容');
}
