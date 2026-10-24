import {randomUUID} from 'node:crypto';
import * as credits from './credits.mjs';
import {CREDIT_PRICES,creditQuote} from './credit-prices.mjs';

export async function billedPost(request,action,userId=null) {
  const copy=request.headers.get('content-type')?.includes('application/json')?request.clone():null;
  let current=null;
  let hash;
  const requestHash=()=>hash??=(async()=>credits.fingerprint({path:new URL(request.url).pathname,body:copy?await copy.json():null}))();
  const replay=async op=>{
    if(op.state==='refunded')throw new credits.CreditError('这次请求的积分已退回，请重新发起',409);
    if(!op.result) {const error=new credits.CreditError('这次请求仍在处理中，请勿重复提交',409);error.code='CREDIT_PENDING';throw error;}
    if(op.state==='reserved'&&!op.metadata.async)await credits.complete(op.userId,op.id,op.result);
    return Response.json(op.result.body,{status:op.result.status});
  };
  const idempotencyKey=request.headers.get('idempotency-key');
  if(userId&&idempotencyKey&&creditQuote(new URL(request.url).pathname.replace(/^\/api/,''))) {
    const previous=await credits.requestOperation(userId,idempotencyKey);
    if(previous) {
      if(previous.requestHash!==await requestHash())throw new credits.CreditError('同一请求标识不能用于不同的消费',409);
      return replay(previous);
    }
  }
  const billing={
    get operationId(){return current?.id||null;},
    async reserve(userId,feature,amount=CREDIT_PRICES[feature]?.points,metadata={}) {
      if(current) return;
      const quoted=request.headers.get('x-credit-limit');
      if(quoted!==null) {
        const limit=Number(quoted);
        if(!Number.isSafeInteger(limit)||limit<0)throw new credits.CreditError('积分报价上限无效');
        if(amount>limit)throw new credits.CreditError('功能价格已更新，请刷新页面确认新价目后重试；本次未扣积分',409);
      }
      const result=await credits.reserve({userId,feature,amount,metadata,requestHash:await requestHash(),
        requestKey:idempotencyKey||randomUUID()});
      if(!result.created) {
        const op=result.operation;
        const error=new Error('已返回原请求结果');
        error.response=await replay(op);
        throw error;
      }
      current=result.operation;
    },
  };
  let response;
  try {response=await action(billing);}
  catch(error) {
    if(current)await credits.refund(current.userId,current.id,'请求执行失败，积分已退回');
    throw error;
  }
  if(!current)return response;
  if(!response.ok) {
    await credits.refund(current.userId,current.id,'生成或保存失败，积分已退回');
    return response;
  }
  const result={status:response.status,body:await response.clone().json()};
  // Persist delivered output before settlement so a retry can recover without a new model call.
  await credits.pendingResult(current.userId,current.id,result);
  if(!current.metadata.async)await credits.complete(current.userId,current.id,result);
  return response;
}
