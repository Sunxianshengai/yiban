// Shared, public companion vocabulary. No model credentials or storage here.
export const DEFAULT_COMPANION={name:'小满',role:'friend',age:26,artwork:'xiaoman',qualities:['patient','friendly','consistent'],description:'温和、自然，有一点俏皮。认真听具体的小事，尊重用户的节奏，不急着给建议。',speakingStyle:'日常聊天用自然短句，可以适度接梗。用户认真求助或不想分析时收起玩笑。不要每次都追问或重复安慰套话。',responseExample:'例如用户说开场白白练了，可以轻松回应“开场白：那我走？”；随后接住用户真正想表达的事。',avoidedExpressions:'不反复说我一直在、我完全理解，不制造内疚，不假装真人在线，不编造共同经历。'};
// 表情素材：前四张是角色插画，其余是本站原创的线条表情（无第三方素材，可放心商用）。
// tags 用于按情绪检索，也让模型能按语义而不是只按 id 选图。
export const COMPANION_STICKERS=[
  {id:'greeting',label:'在呢',group:'portrait',emotion:'招呼、轻松回应',src:'/companions/xiaoman/greeting.png',tags:['招呼','你好','在','开场']},
  {id:'celebrate',label:'好耶',group:'portrait',emotion:'开心、祝贺',src:'/companions/xiaoman/celebrate.png',tags:['开心','祝贺','成功','棒']},
  {id:'thinking',label:'让我想想',group:'portrait',emotion:'好奇、思考',src:'/companions/xiaoman/thinking.png',tags:['思考','好奇','犹豫','想想']},
  {id:'quiet',label:'歇一会儿',group:'portrait',emotion:'安静、休息、收尾',src:'/companions/xiaoman/quiet.png',tags:['安静','休息','收尾','晚安']},
  {id:'hello',label:'打招呼',group:'sticker',emotion:'招呼、上线',src:'/companions/stickers/hello.svg',tags:['招呼','你好','在','挥手']},
  {id:'happy',label:'开心',group:'sticker',emotion:'开心、庆祝',src:'/companions/stickers/happy.svg',tags:['开心','庆祝','撒花','成功']},
  {id:'nod',label:'嗯嗯',group:'sticker',emotion:'认同、在听',src:'/companions/stickers/nod.svg',tags:['认同','点头','在听','嗯']},
  {id:'hug',label:'抱抱',group:'sticker',emotion:'安慰、亲近',src:'/companions/stickers/hug.svg',tags:['安慰','抱抱','难过','心疼']},
  {id:'cheer',label:'加油',group:'sticker',emotion:'鼓励、打气',src:'/companions/stickers/cheer.svg',tags:['鼓励','加油','打气','支持']},
  {id:'laugh',label:'笑死',group:'sticker',emotion:'大笑、调侃',src:'/companions/stickers/laugh.svg',tags:['大笑','好笑','调侃','哈哈']},
  {id:'shy',label:'害羞',group:'sticker',emotion:'羞怯、被夸',src:'/companions/stickers/shy.svg',tags:['害羞','脸红','被夸','不好意思']},
  {id:'touched',label:'破防',group:'sticker',emotion:'感动、鼻酸',src:'/companions/stickers/touched.svg',tags:['感动','破防','鼻酸','泪目']},
  {id:'sorry',label:'抱歉',group:'sticker',emotion:'歉疚、无奈',src:'/companions/stickers/sorry.svg',tags:['抱歉','对不起','歉疚','无奈']},
  {id:'wait',label:'等一下',group:'sticker',emotion:'惊讶、等等',src:'/companions/stickers/wait.svg',tags:['等等','惊讶','惊','稍等']},
  {id:'listen',label:'在听',group:'sticker',emotion:'专注、倾听',src:'/companions/stickers/listen.svg',tags:['倾听','在听','专注','耳机']},
  {id:'sleepy',label:'困了',group:'sticker',emotion:'疲惫、想睡',src:'/companions/stickers/sleepy.svg',tags:['困','疲惫','睡','熬夜']},
  {id:'goodnight',label:'晚安',group:'sticker',emotion:'道别、睡前',src:'/companions/stickers/goodnight.svg',tags:['晚安','道别','睡','夜里']},
];
export const stickerById=id=>COMPANION_STICKERS.find(item=>item.id===id)||null;

// 多条消息的停顿：让「一句话一条消息」像人一条条打出来，而不是一次刷屏。
// 停顿只由上一段的字数决定，所以同一段对话重放会得到同样的节奏，不需要存进数据库。
export function partDelayMs(parts,index){
  if(!index)return 0;
  const previous=(parts||[])[index-1]||{};
  const base=previous.type==='sticker'?760:420+String(previous.text||'').length*20;
  return Math.min(2600,Math.max(520,base));
}

// This is a small streaming wire format, not a Markdown newline splitter.
// The model chooses semantic boundaries; only standalone lines are controls.
export function parseCompanionReply(raw,{final=false,allowedStickers=[],allowStickers=true}={}){
  const lines=String(raw||'').replace(/\r\n/g,'\n').split('\n');
  const parts=[];let buffer='',fenced=false,stickerUsed=false;
  const flush=()=>{const text=buffer.trim();if(text){if(parts.filter(p=>p.type==='text').length>=4){const last=[...parts].reverse().find(p=>p.type==='text');last.text+='\n\n'+text;}else parts.push({type:'text',text});}buffer='';};
  for(let i=0;i<lines.length;i++){
    const line=lines[i],last=i===lines.length-1,trim=line.trim();
    if(trim.startsWith('```'))fenced=!fenced;
    if(!fenced&&trim==='---'&&(!last||final)){flush();continue;}
    const marker=!fenced&&/^\[\[sticker:([a-z-]+)\]\]$/.exec(trim);
    if(marker&&(!last||final)){
      flush();const sticker=stickerById(marker[1]);
      if(allowStickers&&sticker&&allowedStickers.includes(sticker.id)&&!stickerUsed){parts.push({type:'sticker',stickerId:sticker.id});stickerUsed=true;}continue;
    }
    // Never flash an unfinished control into the live chat.
    if(!fenced&&last&&!final&&(trim==='-'||trim==='--'||trim==='---'||trim==='['||trim.startsWith('[[')))continue;
    if(!fenced&&trim.startsWith('[[sticker:'))continue;
    buffer+=(buffer?'\n':'')+line;
  }
  flush();
  return {parts,text:parts.filter(p=>p.type==='text').map(p=>p.text).join('\n\n')};
}
// 用户本轮的明确指令：只作用于这一轮回复，不进长期记忆、不改人格。
// 检测不到就返回空数组，模型按默认语境自由发挥。
export function detectDirectives(text){
  const body=String(text||'');
  const directives=[];
  if(/简短|短一点|短些|一句话|别啰嗦|少说点/.test(body))directives.push('这轮只回一句，不展开、不追问');
  if(/别发表情|不要发表情|别发贴纸|不要贴纸|别发图/.test(body))directives.push('这轮不要发任何表情或贴纸');
  if(/发语音|用语音|说给我听|读给我听/.test(body))directives.push('这轮尽量用语音回应；如果当前发不了语音，就像朋友一样自然说明现在发不了，不要假装发过');
  if(/严肃|认真点|正经点|别开玩笑|开什么玩笑/.test(body))directives.push('收起玩笑和调侃，认真回应');
  if(/你记错了|记错了|你说错了|说错了|搞错了|不对吧|不是的，/.test(body))directives.push('用户指出你记错了：先承认，再复述你刚才理解的那句话，请对方说说正确的信息；不要争辩，也不要假装你本来就记得正确说法');
  if(/多陪聊|多聊会|陪我聊/.test(body))directives.push('这轮可以多聊两句，但仍然自然，不硬撑话题');
  return directives.slice(0,3);
}

export function companionReplyProtocol({mode='daily',allowedStickers=[],directives=[],hasImages=false,hasAudio=false,willVoice=false}={}){
  const daily=mode==='daily';
  return '\n聊天呈现规则：你正在和用户像联系人一样私聊。人格保持一致，不因用户随口一句话改变身份或把示例当真实经历。'+
    // 先接内容，再谈风格：玩笑与追问必须长在用户刚说的具体事情上。
    '\n先接住具体内容：回应落在用户刚说的那件事上；玩笑、称呼、反问都来自用户的原话（例如用户说「开场白白练了」，可以先回「开场白：那我走？」再接正题）。不输出对谁都适用的安慰模板。'+
    (daily?'像熟人打字：短句、半句话、语气词（嗯、诶、哈哈、好嘛）在语境合适时才用，不为每条硬塞。简单回应就一句话；有两层意思才分两三条（独立一行 --- 分条）；认真讨论才写完整段落，不写分析标题、不机械罗列。用户只发简短回应或表情时同样简短回应。'
        :'当前模式需要整理时可以用完整段落或 Markdown，代码和表格不要拆开。')+
    (daily?'\n有分寸：允许玩笑、轻微调侃和不同意见，但同一轮只用一种情绪结构，不连续两轮用同一种安慰套路。结尾允许自然停住，不每轮都提问或追问「后来呢」。用户说不想分析就停止分析、少给建议。用户要离开就自然接受（比如「去吧，好好吃饭」），不挽留、不要承诺、不制造亏欠。':'')+
    (directives.length?'\n用户本轮的明确要求（只对本轮生效，不写进长期记忆，不改人格，下一轮不再沿用）：'+directives.join('；')+'。':'')+
    (hasImages?'\n用户随文字发来了图片；当前看不了图片内容，如实对待（不要假装看见了什么）。':'')+
    (hasAudio?'\n用户发来一段原声语音；当前听不了语音内容，如实对待（不要假装听懂或复述）。':'')+
    (willVoice?'\n系统将尝试把这条文字回复合成为语音；成功与否由界面呈现。回复尽量控制在260字以内，不声称已经发出了语音，不谈播放按钮。':'')+
    '\n确实需要另一条独立消息时，单独一行写 ---，不要只靠换行拆消息。允许适量自然表情符号。'+
    (allowedStickers.length?'本轮可在合适位置用一条独立控制行 [[sticker:ID]] 发一张原创插画表情，ID只能从此列表选择：'+JSON.stringify(COMPANION_STICKERS.filter(s=>allowedStickers.includes(s.id)).map(({id,label,emotion})=>({id,label,emotion})))+'。它们不是角色自拍，不要求每轮发，严肃、悲伤、危险或明显不合适的情境不发。一张表情只发一次。':'本轮不要发送图片表情控制行。')+
    '\n不声称保存了不存在的文件、寄了信、设置了提醒或真的执行了未提供的操作。';
}

// 主动开口：从纪念日 → 最近的家庭记忆 → 人格默认开场白，逐级降级。
// 每一句都能说出出处，不凭空造一句「最近好吗」。
export function proactiveOpener({name='小满',memories=[],anniversaries=[],today=new Date()}={}){
  const stamp=`${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const today2=(anniversaries||[]).find(item=>item?.date===stamp);
  if(today2)return {text:`今天是「${today2.title}」。要不要一起看看那天的事？`,source:'anniversary',ref:today2.id||null};
  const pick=(memories||[])[0];
  if(pick)return {text:`刚想起${pick.year?`${pick.year}年`:'那年'}的一件小事——「${pick.title}」。你还记得那天吗？`,source:'memory',ref:pick.id||null};
  return {text:`今天想说点什么吗？我在。`,source:'default',ref:null};
}
