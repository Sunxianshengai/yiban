import {all,get,insertIfAbsent,compareAndPut} from './store.mjs';
import {options,now} from './chat-workspace.mjs';
export async function importLegacy(user){
  const histories=(await all('companion_threads')).filter(t=>t.userId===user.id);
  for(const history of histories){
    const id=`legacy-${history.id}`;let thread=await get('chat_threads',id);
    if(thread?.deletedAt||thread?.legacyImported)continue;
    const originals=(history.messages||[]).filter(m=>typeof m.text==='string'&&m.text);
    const createdAt=history.createdAt||now();const ids=originals.map((_,i)=>`${id}:m:${i}`);
    await insertIfAbsent('chat_threads',{id,userId:user.id,title:(originals.find(m=>m.role==='user')?.text||'以前的对话').slice(0,28),options:options(),archived:false,headId:ids.at(-1)||null,activeJobId:null,createdAt,updatedAt:history.updatedAt||createdAt,legacyImported:false,legacyNotes:history.notes||[]});
    for(let i=0;i<originals.length;i++){const original=originals[i];await insertIfAbsent('chat_messages',{id:ids[i],userId:user.id,threadId:id,parentId:ids[i-1]||null,role:original.role==='user'?'user':'assistant',text:original.text,status:'completed',sources:[],createdAt:original.at||createdAt});}
    thread=await get('chat_threads',id);if(!thread.deletedAt&&!thread.legacyImported)await compareAndPut('chat_threads',thread,{...thread,legacyImported:true});
  }
}
