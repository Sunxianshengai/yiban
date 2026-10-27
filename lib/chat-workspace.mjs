import {randomUUID} from 'node:crypto';
import {all,get,put,remove,compareAndPut} from './store.mjs';
import {aiStatus} from './ai.mjs';
import {CREDIT_PRICES} from './credit-prices.mjs';
import {ownedProfile} from './familia-store.mjs';
import {proactiveOpener} from './companion-chat.mjs';
import {speechConfig} from './speech.mjs';
export class ChatError extends Error {constructor(message,status=400,code){super(message);this.status=status;this.code=code;}}
export const MODES=[{id:'daily',label:'日常聊聊',description:'说说今天，慢慢聊开'},{id:'recall',label:'聊聊回忆',description:'从家里的往事找回片刻'},{id:'story',label:'整理故事',description:'把讲述整理成可核对的草稿'}];
export const TONES=[{id:'natural',label:'自然'},{id:'concise',label:'简洁'},{id:'warm',label:'温柔'},{id:'curious',label:'追问'}];
export const MEMORY_MODES=[{id:'auto',label:'自动查找家庭记忆'},{id:'selected',label:'只参考我选择的记忆'},{id:'off',label:'不引用家庭记忆'}];
export const now=()=>new Date().toISOString();
export function options(input={},previous={}){
  const pick=(key,items,fallback)=>{const value=input[key]??previous[key]??fallback;if(!items.some(x=>x.id===value))throw new ChatError('会话选项无效');return value;};
  const memoryIds=input.memoryIds??previous.memoryIds??[];
  if(!Array.isArray(memoryIds)||memoryIds.length>6||memoryIds.some(id=>typeof id!=='string'||id.length>160))throw new ChatError('最多选择 6 段家庭记忆');
  const profileId=input.profileId===undefined?(previous.profileId??null):input.profileId;
  if(profileId!==null&&(typeof profileId!=='string'||profileId.length>160))throw new ChatError('AI 家人选项无效');
  return {mode:pick('mode',MODES,'daily'),tone:pick('tone',TONES,'natural'),memoryMode:pick('memoryMode',MEMORY_MODES,'auto'),memoryIds:[...new Set(memoryIds)],profileId};
}
export const meta=()=>({modes:MODES,tones:TONES,memoryModes:MEMORY_MODES,ai:aiStatus(),price:CREDIT_PRICES.companion.points,maxText:8000,pacing:'sentence',voice:speechConfig()});
export async function ownedThread(user,id){const t=await get('chat_threads',id);if(!t||t.userId!==user.id||t.deletedAt)throw new ChatError('对话不存在',404);return t;}
export async function createThread(user,input={}){
  const setting=options(input.options);if(setting.profileId){const profile=await ownedProfile(user,setting.profileId);if(profile.archived)throw new ChatError('请先恢复这位 AI 家人',409);}
  return put('chat_threads',{id:randomUUID(),userId:user.id,title:String(input.title||'新对话').trim().slice(0,80)||'新对话',titleEdited:Boolean(input.title),options:setting,archived:false,headId:null,activeJobId:null,createdAt:now(),updatedAt:now()});
}
export async function threadMessages(user,threadId){await ownedThread(user,threadId);return (await all('chat_messages')).filter(m=>m.userId===user.id&&m.threadId===threadId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
export function chain(messages,headId){const index=new Map(messages.map(m=>[m.id,m]));const result=[],visited=new Set();let current=index.get(headId);while(current&&!visited.has(current.id)){visited.add(current.id);result.unshift(current);current=index.get(current.parentId);}return result;}
export async function readThread(user,id){
  let thread=await ownedThread(user,id),job=null;
  if(thread.activeJobId){
    const saved=await get('chat_jobs',thread.activeJobId);
    if(!saved){
      if(Date.now()-Date.parse(thread.updatedAt)>180000){
        // A process can stop between acquiring the lock and persisting its job.
        await (await import('./credits.mjs')).account(user.id);
        await compareAndPut('chat_threads',thread,{...thread,activeJobId:null,updatedAt:now()});
      }else throw new ChatError('正在恢复上次请求，请稍后重新打开对话',409);
    }else job=await (await import('./chat-generation.mjs')).getJob(user,thread.activeJobId);
    thread=await ownedThread(user,id);
  }
  const messages=await threadMessages(user,id);return {thread,messages:chain(messages,thread.headId),allMessages:messages,job};
}
// 空会话的开场建议：纪念日 / 家庭记忆 / 人格默认，逐级降级。
// 只生成一张可以点开再发送的卡片，不替用户把话发出去，也不做定时推送。
export async function greetingSource({memoryMode='auto',memoryIds=[]}={}){
  const [memories,anniversaries]=await Promise.all([
    all('memories').then(list=>list.filter(m=>m.status==='confirmed').sort((a,b)=>String(b.year||'').localeCompare(String(a.year||'')))),
    all('anniversaries').catch(()=>[]),
  ]);
  const pool=memoryMode==='off'?[]:memoryMode==='selected'?memories.filter(m=>(memoryIds||[]).includes(m.id)):memories.slice(0,3);
  return proactiveOpener({memories:pool,anniversaries});
}
export async function threadGreeting(user,id){
  const thread=await ownedThread(user,id);
  const messages=await threadMessages(user,id);
  if(messages.some(m=>m.role==='user'))return {greeting:null};
  return {greeting:await greetingSource(thread.options)};
}
// 还没建会话时的开场建议：按当前会话设置取，不落库、不占额度。
export async function newThreadGreeting(user,{memoryMode='auto'}={}){
  const mode=MEMORY_MODES.some(item=>item.id===memoryMode)?memoryMode:'auto';
  return {greeting:await greetingSource({memoryMode:mode})};
}
export async function listThreads(user,{q='',archived=false,offset=0}={}){
  await (await import('./chat-history.mjs')).importLegacy(user);
  const needle=String(q||'').trim().toLocaleLowerCase().slice(0,200);let threads=(await all('chat_threads')).filter(t=>t.userId===user.id&&!t.deletedAt&&Boolean(t.archived)===archived);
  if(needle){const ids=new Set((await all('chat_messages')).filter(m=>m.userId===user.id&&m.text.toLocaleLowerCase().includes(needle)).map(m=>m.threadId));threads=threads.filter(t=>t.title.toLocaleLowerCase().includes(needle)||ids.has(t.id));}
  threads.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));const start=Math.max(0,Math.floor(Number(offset)||0));
  const recent=(await all('chat_messages')).filter(message=>message.userId===user.id),byId=new Map(recent.map(message=>[message.id,message]));
  return {threads:threads.slice(start,start+50).map(thread=>({...thread,preview:byId.get(thread.headId)?.text?.slice(0,100)||thread.title,unreadCount:chain(recent.filter(m=>m.threadId===thread.id),thread.headId).filter(m=>m.proactive&&(!thread.readAt||m.createdAt>thread.readAt)).length})),hasMore:threads.length>start+50};
}
export async function interactMessage(user,threadId,messageId,input){
  await ownedThread(user,threadId);const previous=await get('chat_messages',messageId);
  if(!previous||previous.userId!==user.id||previous.threadId!==threadId)throw new ChatError('消息不存在',404);
  if(previous.status==='generating')throw new ChatError('请等待回复完成',409);
  const next={...previous};
  if(input.favorite!==undefined){if(typeof input.favorite!=='boolean')throw new ChatError('收藏选项无效');next.favorite=input.favorite;}
  if(input.reaction!==undefined){if(![null,'❤️','😄','🥹','👏'].includes(input.reaction))throw new ChatError('表情回应无效');next.reaction=input.reaction;}
  if(!await compareAndPut('chat_messages',previous,next))throw new ChatError('消息已更新，请重试',409);return next;
}
export async function selectBranch(user,id,messageId){
  const thread=await ownedThread(user,id);if(thread.activeJobId)throw new ChatError('请先停止正在生成的回复',409);
  const messages=await threadMessages(user,id);let head=messages.find(m=>m.id===messageId);if(!head)throw new ChatError('消息不存在',404);
  const seen=new Set();while(!seen.has(head.id)){seen.add(head.id);const children=messages.filter(m=>m.parentId===head.id);if(!children.length)break;head=children.at(-1);}
  if(!await compareAndPut('chat_threads',thread,{...thread,headId:head.id,updatedAt:now()}))throw new ChatError('对话已更新，请刷新后重试',409);
  return readThread(user,id);
}
export async function feedback(user,id,messageId,value){
  await ownedThread(user,id);const message=await get('chat_messages',messageId);
  if(!message||message.userId!==user.id||message.threadId!==id||message.role!=='assistant')throw new ChatError('消息不存在',404);
  if(!['up','down',null].includes(value))throw new ChatError('反馈选项无效');
  if(message.status==='generating')throw new ChatError('请等待回复完成后再反馈',409);
  const next={...message,feedback:value};if(!await compareAndPut('chat_messages',message,next))throw new ChatError('消息已更新，请重试',409);return next;
}
export async function updateThread(user,id,input){
  const thread=await ownedThread(user,id);if(thread.activeJobId)throw new ChatError('请等待当前回复完成或先停止生成',409);const next={...thread,updatedAt:now()};
  if(input.title!==undefined){const title=String(input.title).trim();if(!title||title.length>80)throw new ChatError('对话名称应为 1–80 字');next.title=title;next.titleEdited=true;}
  if(input.archived!==undefined){if(typeof input.archived!=='boolean')throw new ChatError('归档选项无效');next.archived=input.archived;}
  if(input.options){next.options=options(input.options,thread.options);if(next.options.profileId!==(thread.options.profileId??null)){if(thread.headId)throw new ChatError('已有聊天记录，请新建对话后更换 AI 家人',409);if(next.options.profileId)await ownedProfile(user,next.options.profileId);}}
  if(!await compareAndPut('chat_threads',thread,next))throw new ChatError('对话已更新，请刷新后重试',409);return next;
}
export async function deleteThread(user,id){
  const thread=await ownedThread(user,id);if(thread.activeJobId)throw new ChatError('请先停止正在生成的回复',409);
  if(!await compareAndPut('chat_threads',thread,{...thread,title:'已删除',deletedAt:now(),options:{},headId:null}))throw new ChatError('对话已更新，请刷新后重试',409);
  if(id.startsWith('legacy-')){const legacy=await get('companion_threads',id.slice(7));if(legacy?.userId===user.id)await remove('companion_threads',legacy.id);}
  for(const collection of ['chat_messages','chat_jobs'])for(const record of await all(collection))if(record.userId===user.id&&record.threadId===id)await remove(collection,record.id);return {ok:true};
}
