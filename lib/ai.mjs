import {localOrganize, storyFromMemories} from './core.mjs';
const enabled = () => Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL);

async function callModel(messages) {
  const url = new URL(process.env.AI_API_URL);
  if(!['https:','http:'].includes(url.protocol)) throw new Error('模型接口地址需要使用 HTTP 或 HTTPS');
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_API_KEY}`},body:JSON.stringify({model:process.env.AI_MODEL,messages,temperature:0.3}),signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`模型服务返回 ${response.status}，请检查本机配置和服务额度`);
  const result=await response.json();
  const content=result.choices?.[0]?.message?.content;
  if(typeof content!=='string') throw new Error('模型返回内容格式不兼容');
  return content;
}

export async function organize(input,imageData=null) {
  if(!enabled()) return localOrganize(input);
  const content=[{type:'text',text:`请整理这段家庭记忆，仅用提供的事实。照片只能描述可见场景，不可猜测人物身份、年份和关系。保留用户已填的人物/日期。输出纯JSON：title,story,year,location,people数组,theme（家人/老家/旅行/青春/节日/日常）,tags数组。不确定的字段留空。输入：${JSON.stringify(input)}`}];
  if(imageData) content.push({type:'image_url',image_url:{url:imageData}});
  const text=await callModel([{role:'system',content:'你是家庭记忆整理助手。不得编造家庭经历。输出必须由家属核对。'},{role:'user',content}]);
  const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  let result;
  try {result=JSON.parse(clean);} catch {throw new Error('模型没有返回有效的结构化内容，请重试或手动整理');}
  return {...result,mode:'model',note:'模型整理结果，请核对人物、时间和故事事实后再发布。'};
}

export async function generateStory(memories,title) {
  if(!enabled()) return {story:storyFromMemories(memories,title),mode:'local'};
  const story=await callModel([{role:'system',content:'你是家庭故事编辑。将已确认的记忆串联成温柔、短句的讲述。只能使用提供的事实，不能增加对话、关系、地点或事件。最多600字。'},{role:'user',content:JSON.stringify({title,memories:memories.map(m=>({title:m.title,year:m.year,location:m.location,people:m.people,story:m.story}))})}]);
  return {story,mode:'model'};
}
