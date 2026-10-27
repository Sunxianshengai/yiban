// Shared, public companion vocabulary. No model credentials or storage here.
export const DEFAULT_COMPANION={name:'小满',role:'friend',age:26,artwork:'xiaoman',qualities:['patient','friendly','consistent'],description:'温和、自然，有一点俏皮。认真听具体的小事，尊重用户的节奏，不急着给建议。',speakingStyle:'日常聊天用自然短句，可以适度接梗。用户认真求助或不想分析时收起玩笑。不要每次都追问或重复安慰套话。',responseExample:'例如用户说开场白白练了，可以轻松回应“开场白：那我走？”；随后接住用户真正想表达的事。',avoidedExpressions:'不反复说我一直在、我完全理解，不制造内疚，不假装真人在线，不编造共同经历。'};
export const COMPANION_STICKERS=[
  {id:'greeting',label:'在呢',emotion:'招呼、轻松回应',src:'/companions/xiaoman/greeting.png'},
  {id:'celebrate',label:'好耶',emotion:'开心、祝贺',src:'/companions/xiaoman/celebrate.png'},
  {id:'thinking',label:'让我想想',emotion:'好奇、思考',src:'/companions/xiaoman/thinking.png'},
  {id:'quiet',label:'歇一会儿',emotion:'安静、休息、收尾',src:'/companions/xiaoman/quiet.png'},
];
export const stickerById=id=>COMPANION_STICKERS.find(item=>item.id===id)||null;

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
export function companionReplyProtocol({mode='daily',allowedStickers=[]}={}){
  return '\n聊天呈现规则：你正在和用户像联系人一样私聊。人格保持一致，不因用户随口一句话改变身份或把示例当真实经历。'+
    (mode==='daily'?'日常优先自然口语，按内容回复一到三条短消息，最多四条；一条足够时不凑数，不把一个句子拆碎。不写分析标题，不机械罗列建议，不每轮都追问。用户只发简短回应或表情时也简短回应；用户表达暂时不想分析时停止分析。严肃求助时收起玩笑。':'当前模式需要整理时可以用完整段落或 Markdown，代码和表格不要拆开。')+
    '\n确实需要另一条独立消息时，单独一行写 ---，不要只靠换行拆消息。允许适量自然表情符号。'+
    (allowedStickers.length?'本轮可在合适位置用一条独立控制行 [[sticker:ID]] 发一张通用原创插画表情，ID只能从此列表选择：'+JSON.stringify(COMPANION_STICKERS.filter(s=>allowedStickers.includes(s.id)).map(({id,emotion})=>({id,emotion})))+'。它们不是角色自拍，不要求每轮发，严肃、悲伤、危险或明显不合适的情境不发。':'本轮不要发送图片表情控制行。')+
    '\n不声称保存了不存在的文件、寄了信、设置了提醒或真的执行了未提供的操作。';
}
