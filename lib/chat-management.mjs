import {visibleMessagePage} from './chat-repository.mjs';
import {createHash} from 'node:crypto';
import {all,get} from './store.mjs';
import {ownedThread,threadMessages,chain,ChatError} from './chat-workspace.mjs';
import {commitDocuments,documentGuard} from './document-transaction.mjs';
import {ownedMedia} from './chat-media.mjs';

export async function findChatMessages(user,{q='',favorites=false,offset=0}={}){
  const needle=String(q||'').trim().toLocaleLowerCase().slice(0,200),page=await visibleMessagePage(user.id,{needle,favorites,offset});
  return {messages:page.slice(0,40).map(({message,title,archived})=>({id:message.id,threadId:message.threadId,title,text:[message.text,message.audio?.transcript,message.vision?.description].filter(Boolean).join('\n').slice(0,600)||'图片、语音或表情消息',role:message.role,createdAt:message.createdAt,favorite:Boolean(message.favorite),archived})),hasMore:page.length>40};
}
export async function forwardChatMessage(user,threadId,{messageId,targetThreadId,key}){
  await ownedThread(user,threadId);const target=await ownedThread(user,targetThreadId),source=await get('chat_messages',messageId);
  if(!source||source.threadId!==threadId||source.userId!==user.id||source.status!=='completed')throw new ChatError('原消息不存在',404);
  if(!chain(await threadMessages(user,threadId),(await ownedThread(user,threadId)).headId).some(item=>item.id===source.id))throw new ChatError('请转发当前版本中的消息');
  if(typeof key!=='string'||!key||key.length>120)throw new ChatError('缺少转发标识');
  const id='forward-'+createHash('sha256').update(JSON.stringify([user.id,key])).digest('hex'),existing=await get('chat_messages',id);
  if(existing){if(existing.threadId!==targetThreadId||existing.forwarded?.messageId!==messageId||existing.forwarded?.threadId!==threadId)throw new ChatError('转发标识冲突',409);return existing;}
  if(target.archived||target.activeJobId)throw new ChatError('目标对话暂时无法接收，请恢复对话或等待回复完成',409);
  for(const item of source.images||[])await ownedMedia(user,item.url,'images');
  if(source.audio)await ownedMedia(user,source.audio.url,'audio');
  const createdAt=new Date().toISOString(),message={id,userId:user.id,threadId:target.id,role:'user',text:source.text,parts:source.parts||[],...(source.images?{images:source.images}:{}),...(source.audio?{audio:source.audio}:{}),...(source.stickerId?{stickerId:source.stickerId}:{}),forwarded:{threadId,messageId},status:'completed',parentId:target.headId,createdAt};
  if(!await commitDocuments([documentGuard('chat_threads',target),documentGuard('chat_messages',source)],[documentGuard('chat_threads',{...target,headId:id,updatedAt:createdAt}),documentGuard('chat_messages',message)]))throw new ChatError('对话发生变化，请重试',409);
  return message;
}
