import {createHash} from 'node:crypto';
import {createOperation,readAccount,transitionOperation,savePendingResult,readOperation,readRequest,readBalance} from './credits-store.mjs';
import {get,put,compareAndPut} from './store.mjs';

export class CreditError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function key(value){if(typeof value!=='string'||!value.trim()||value.length>160)throw new CreditError('请求标识无效');return value;}

export async function grant({userId,actorId,amount,note,requestKey}) {
  if(!Number.isSafeInteger(amount)||amount<1||amount>1000000)throw new CreditError('发放积分须为 1 到 1,000,000 的整数');
  const reason=String(note||'').trim().slice(0,200);
  if(!reason)throw new CreditError('请填写发放说明');
  const hash=fingerprint({userId,actorId,amount,note:reason});
  const result=await createOperation({userId,actorId,amount,note:reason,requestKey:key(requestKey),requestHash:hash,feature:'admin_grant',grant:true});
  if(result.operation.requestHash!==hash)throw new CreditError('同一请求标识不能用于不同的发放',409);
  return {operationId:result.operation.id,...await account(userId)};
}

export async function account(userId,options) {
  const pending=(await readAccount(userId,{limit:1})).pending;
  for(const op of pending) {
    if(op.metadata.async) {
      if(op.metadata.kind==='chat'){
        const job=await get('chat_jobs',op.metadata.pollKey);
        if(job?.status==='completed'||(job?.status==='committing'&&op.result))await complete(userId,op.id,op.result||{status:200,body:{jobId:job.id,threadId:job.threadId,messageId:job.messageId}});
        else if(['failed','stopped'].includes(job?.status))await refund(userId,op.id,'聊天未完成，积分已退回');
        else if(Date.now()-(job?Date.parse(job.updatedAt):op.updatedAt)>180000){
          const failed=job?{...job,status:'failed',error:'连接已中断，积分已退回',updatedAt:new Date().toISOString()}:null;
          if(!job||await compareAndPut('chat_jobs',job,failed)){
            await refund(userId,op.id,'聊天中断，冻结积分已退回');
            if(job){const message=await get('chat_messages',job.messageId);if(message)await put('chat_messages',{...message,status:'failed'});}
            const thread=await get('chat_threads',op.metadata.threadId);if(thread?.activeJobId===op.metadata.pollKey)await compareAndPut('chat_threads',thread,{...thread,activeJobId:null});
          }
        }
        continue;
      }
      const task=op.metadata.pollKey?await get('memory_videos',op.metadata.pollKey):null;
      if((!task||task.creditOperationId!==op.id)&&Date.now()-op.updatedAt>30*60*1000)await refund(userId,op.id,'请求中断且未登记视频任务，积分已退回');
      else if(task?.creditOperationId===op.id&&task.status==='failed')await refund(userId,op.id,'视频失败，积分已退回');
      else if(task?.creditOperationId===op.id&&task.status==='ready'&&task.name)await complete(userId,op.id,
        {status:200,body:{status:'ready',url:`/api/media/${task.name}`,resolution:task.resolution,duration:task.duration}});
      continue;
    }
    if(op.result)await complete(userId,op.id,op.result);
    else if(Date.now()-op.updatedAt>30*60*1000)await refund(userId,op.id,'请求中断超过 30 分钟，冻结积分已退回');
  }
  const result=await readAccount(userId,options);
  return {...result,pending:result.pending.map(({id,feature,amount,createdAt,metadata})=>({id,feature,amount,createdAt,pollKey:metadata.pollKey||null}))};
}

export async function reserve({userId,feature,amount,requestKey,requestHash,metadata={}}) {
  if(!Number.isSafeInteger(amount)||amount<1)throw new CreditError('积分报价无效');
  const result=await createOperation({userId,feature,amount,requestKey:key(requestKey),requestHash,metadata,note:feature});
  if(!result.operation)throw new CreditError(`积分不足，本次需要 ${amount} 积分，请联系管理员发放`,402);
  if(result.operation.requestHash!==requestHash||result.operation.feature!==feature||result.operation.amount!==amount)
    throw new CreditError('同一请求标识不能用于不同的消费',409);
  return result;
}

export const complete=(userId,id,result)=>transitionOperation(userId,id,'completed',{result,note:'任务完成，积分已结算'});
export const refund=(userId,id,note)=>transitionOperation(userId,id,'refunded',{note:String(note||'任务失败，积分已退回').slice(0,200)});
export const pendingResult=savePendingResult;
export const operation=readOperation;
export const requestOperation=readRequest;
export const balance=readBalance;
