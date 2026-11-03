import {ownedThread,threadMessages,chain,ChatError} from './chat-workspace.mjs';
import {ownedProfile,defaultProfile,updateProfile,updateDefaultProfile} from './familia-store.mjs';
import {normalizedExpression} from './companion-dialogue.mjs';
import {expressionSettings} from './companion-styles.mjs';

export async function avoidMessageExpression(user,threadId,input){
 const thread=await ownedThread(user,threadId);
 if(thread.activeJobId)throw new ChatError('请等待当前回复完成后再调整表达',409);
 const message=chain(await threadMessages(user,threadId),thread.headId).find(m=>m.id===input.messageId);
 if(!message||message.role!=='assistant'||message.status!=='completed')throw new ChatError('请选择当前对话里已完成的 AI 回复',404);
 const phrase=input.phrase;
 try{expressionSettings({blockedExpressions:[phrase]});}catch(error){throw new ChatError(error.message);}
 if(typeof phrase!=='string'||phrase.trim().length<2||phrase.length>40||/[\r\n]/.test(phrase))throw new ChatError('请选择回复中的 2–40 字，不要换行');
 if(!normalizedExpression(message.text).includes(normalizedExpression(phrase)))throw new ChatError('请选择这条回复中实际出现的表达');
 const id=thread.options.profileId,profile=id?await ownedProfile(user,id):await defaultProfile(user);
 const phrases=profile.blockedExpressions||[];
 if(phrases.some(p=>normalizedExpression(p)===normalizedExpression(phrase)))return {saved:true,profile:{...profile,id:id||'default'}};
 if(phrases.length>=20)throw new ChatError('已设置 20 项，请先在人格与表达中整理');
 const change={blockedExpressions:[...phrases,phrase.trim()],expectedUpdatedAt:profile.updatedAt};
 const updated=id?await updateProfile(user,id,change):await updateDefaultProfile(user,change);
 return {saved:true,profile:updated};
}
