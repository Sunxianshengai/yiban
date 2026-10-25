// Shared by the browser and provider adapter; UTF-8 and frames may span any chunk.
export async function* readSSE(body){
  if(!body)throw new Error('响应流为空');
  const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
  try{
    while(true){
      const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
      if(buffer.length>1024*1024)throw new Error('响应数据过长');
      let end;
      while((end=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);let event='message';const lines=[];for(const line of packet.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))lines.push(line.slice(5).trimStart());}if(lines.length)yield {event,data:lines.join('\n')};}
      if(done)break;
    }
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
