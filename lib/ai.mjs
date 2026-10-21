import {localOrganize, storyFromMemories} from './core.mjs';
export const aiReady = () => Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
const enabled = aiReady;

export async function callModel(messages,options={}) {
  const url = new URL(process.env.AI_API_URL);
  if(!['https:','http:'].includes(url.protocol)) throw new Error('模型接口地址需要使用 HTTP 或 HTTPS');
  const body={model:process.env.AI_MODEL,messages,temperature:options.temperature ?? 0.3};
  if(options.maxTokens)body.max_tokens=options.maxTokens;
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_API_KEY}`},body:JSON.stringify(body),signal:AbortSignal.timeout(options.timeout ?? 45000)});
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

// 人生模拟的场景润色：把本地生成的三岔路口交给模型，让处境更像那个人的当年。
// 只允许改写「处境」与「选项的措辞」，事实字段（年份/地点/真相）由调用方保留。
export async function enrichScenes(localScenes,subject,answers=[],promptForScene) {
  if(!enabled()) return null;
  try {
    const text=await callModel(promptForScene(localScenes,subject,answers),{temperature:0.6,maxTokens:1600,timeout:30000});
    const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    const parsed=JSON.parse(clean);
    if(!Array.isArray(parsed?.scenes))return null;
    return localScenes.map((scene,index)=>{
      const draft=parsed.scenes.find(s=>s?.memoryTitle===scene.title)||parsed.scenes[index];
      if(!draft?.situation)return scene;
      const choices=Array.isArray(draft.choices)&&draft.choices.length>=2
        ? draft.choices.slice(0,3).map((choice,i)=>({...scene.choices[i]||scene.choices[0],id:`c${i}`,label:String(choice.label||'').slice(0,80)||scene.choices[i]?.label||''}))
        : scene.choices;
      return {...scene,situation:String(draft.situation).slice(0,160),choices};
    });
  } catch {
    // 润色失败不影响游戏：调用方继续用本地场景。
    return null;
  }
}

// 陪伴对话：单轮补一句。失败不抛给用户，由调用方回落到本地回话——
// 聊天卡住比答得平淡更伤体验。
export async function chatWithCompanion(messages) {
  if(!enabled()) return null;
  try {
    const text=await callModel(messages,{temperature:0.85,maxTokens:400,timeout:30000});
    const clean=String(text||'').trim();
    return clean?clean.slice(0,1200):null;
  } catch {
    return null;
  }
}

export async function generateStory(memories,title) {
  if(!enabled()) return {story:storyFromMemories(memories,title),mode:'local'};
  const story=await callModel([{role:'system',content:'你是家庭故事编辑。将已确认的记忆串联成温柔、短句的讲述。只能使用提供的事实，不能增加对话、关系、地点或事件。最多600字。'},{role:'user',content:JSON.stringify({title,memories:memories.map(m=>({title:m.title,year:m.year,location:m.location,people:m.people,story:m.story}))})}]);
  return {story,mode:'model'};
}
