import {get,compareAndPut,all,remove} from './store.mjs';
import {ownedThread,chain,threadMessages} from './chat-workspace.mjs';
import {listPersonalMemories,applyChatMemoryAction} from './personal-memory.mjs';

async function retireCallbacks(user,profileId,previous){
  if(!previous)return;
  for(const item of await all('chat_callbacks'))if(item.userId===user.id&&(item.personaId??null)===profileId&&item.status==='open'&&(item.sourceMessageId&&item.sourceMessageId===previous.source?.messageId||previous.topic&&item.hook?.includes(previous.topic)))await remove('chat_callbacks',item.id);
}
export async function memoryProposal(user,profileId,text,referencedIds=[],source=null){
  if(/假如|假设|如果|开玩笑|扮演|小说/.test(text))return null;
  const kind=/忘记|别再记|不要记住/.test(text)?'forget':/结束了|取消了|办完了|做完了|面试完|考完了/.test(text)?'resolve':/记错|改成|改为|不是.+而是|正确的是/.test(text)?'correct':/以后|今后|往后/.test(text)&&/别|不要|少|称呼|叫我|简短|追问|建议/.test(text)?'boundary':null;
  if(!kind)return null;
  const state=await listPersonalMemories(user,profileId);
  if(!state.enabled)return null;
  if(kind==='boundary'&&state.mode==='auto')return null; // existing automatic, source-checked boundary extraction
  const items=state.items.filter(item=>!item.expired),quote=/[“「"]([^”」"]+)[”」"]/.exec(text)?.[1];
  let selected=quote?items.filter(item=>item.text.includes(quote)):[];
  if(!selected.length&&kind!=='boundary')selected=items.filter(item=>referencedIds.includes(item.id));
  if(!selected.length&&kind==='resolve')selected=items.filter(item=>item.kind==='plan'&&item.topic&&text.includes(item.topic));
  if(kind==='resolve'&&!quote){const plans=items.filter(item=>item.kind==='plan'&&item.topic&&text.includes(item.topic));if(plans.length)selected=plans;}
  if(!selected.length&&kind==='forget'&&!quote)return null; // don't guess the target from a generic word
  const proposedText=kind==='correct'?text.split(/改成|改为|正确的是|其实是/).slice(1).join('').replace(/^[：:\s“「"]+|[”」"]+$/g,'').trim():text;
  if(kind==='resolve'&&source&&state.mode==='auto'&&selected.length===1&&selected[0].kind==='plan'&&selected[0].topic&&text.includes(selected[0].topic)){
    const result=await applyChatMemoryAction(user,profileId,{key:source.messageId,kind,targetId:selected[0].id,expectedRevision:selected[0].revision,text,source});await retireCallbacks(user,profileId,result.previous);
    return {kind,status:'applied',resultId:result.id};
  }
  return {kind,status:'pending',candidates:selected.map(item=>({id:item.id,revision:item.revision})),proposedText:proposedText.slice(0,600)};
}
export async function confirmMemoryAction(user,threadId,messageId,input){
  const thread=await ownedThread(user,threadId),message=await get('chat_messages',messageId);
  if(thread.activeJobId)throw Error('请等待回复结束后确认');
  if(!message||message.userId!==user.id||message.threadId!==threadId||message.role!=='user'||message.status!=='completed')throw Error('消息不存在');
  const proposal=message.memoryProposal;
  if(!proposal)throw Error('没有待确认的记忆修改');
  if(proposal.status==='applied')return message;
  const visible=chain(await threadMessages(user,threadId),thread.headId);
  if(!visible.some(item=>item.id===message.id))throw Error('请在当前对话版本中确认');
  const profileId=thread.options.profileId??null;
  const selected=proposal.candidates.find(item=>item.id===input.targetId);
  if(proposal.kind!=='boundary'&&!selected)throw Error('请选择这次匹配到的记忆；有歧义可打开记忆管理');
  const text=String(input.text??proposal.proposedText).trim();
  const result=await applyChatMemoryAction(user,profileId,{key:message.id,kind:proposal.kind,targetId:selected?.id,expectedRevision:selected?.revision,text,source:{threadId,messageId}});
  await retireCallbacks(user,profileId,result.previous);
  const latest=await get('chat_messages',message.id);
  if(latest?.status==='completed')await compareAndPut('chat_messages',latest,{...latest,memoryProposal:{kind:proposal.kind,status:'applied',resultId:result.id}});
  return get('chat_messages',message.id);
}
