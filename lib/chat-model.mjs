import {modelConfig,ModelError} from './ai.mjs';
import {readSSE} from './sse.mjs';
export async function* streamChat(messages,{signal}={}){
  const config=modelConfig();if(!config)throw new ModelError('陪伴服务尚未开启，请联系管理员',503);
  let response;
  try{response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify({model:config.model,messages,stream:true,temperature:0.65,max_tokens:2048}),signal});}
  catch(error){if(signal?.aborted)throw error;throw new ModelError('连接模型服务失败，请稍后重试',504);}
  if(!response.ok)throw new ModelError(response.status===429?'服务繁忙，请稍后重试':response.status===401?'模型服务授权失效，请联系管理员':'模型服务未能完成请求',response.status===429?429:502);
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const result=await response.json().catch(()=>null);const text=result?.choices?.[0]?.message?.content;
    if(typeof text!=='string'||!text.trim())throw new ModelError('模型没有返回有效回复');
    yield text;return; // Some compatible providers return one real result despite stream=true.
  }
  let ended=false,characters=0;
  for await(const frame of readSSE(response.body)){
    if(frame.data==='[DONE]'){ended=true;break;}
    let data;try{data=JSON.parse(frame.data);}catch{throw new ModelError('模型响应格式异常，请重试');}
    if(data.error)throw new ModelError('模型生成中断，请重试');
    const choice=data.choices?.[0];const text=choice?.delta?.content;
    if(typeof text==='string'&&text){characters+=text.length;if(characters>32000)throw new ModelError('回复超过长度上限，请缩小问题范围');yield text;}
    if(choice?.finish_reason){if(!['stop','length'].includes(choice.finish_reason))throw new ModelError('这次回复未能完成，请换一种表达');ended=true;}
  }
  if(!ended)throw new ModelError('连接意外中断，回复尚未完成，请重试',502);
}
