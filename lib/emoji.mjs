// 聊天里的 emoji 表情系统：数据层照搬 emoji-mart 的 frequently-used 决策——
// 计数表按使用次数排序，超过容量裁掉最末位、最近一次用的永远保留；
// 收藏是单独的数组，常用列表为空时给一组默认兜底。
// storage 抽象成 {get,set}，组件层传 localStorage 包装，测试传内存实现。
export const EMOJI_CATEGORIES=[
  {label:'常用',emojis:['😂','🥹','😍','😭','😅','🤣','😊','🥰','😎','🤔','😴','🥺']},
  {label:'手势',emojis:['👍','👏','🙏','🤝','👌','✌️','🤞','💪','🫶','👋','🤙','🙌']},
  {label:'心情',emojis:['❤️','💔','✨','🎉','🔥','🌸','🌈','☀️','🌙','⭐','🎵','☕']},
  {label:'生活',emojis:['🍚','🍜','🍎','🍰','🐱','🐶','🌸','🌺','🚶','🏃','🛒','📖']},
  {label:'表态',emojis:['😭','😡','🤯','🙃','😬','🙄','😶','🫠','😮','😢','🤒','🤗']},
];

export const DEFAULT_EMOJIS=['👍','😂','❤️','🥹','👏','🙏','😊','🎉'];

const FREQ_CAP=24;

export function loadEmojiData(storage,accountId){
  const read=key=>{try{const parsed=JSON.parse(storage.get(`yiban:emoji:${key}:${accountId}`)||'null');return parsed&&typeof parsed==='object'?parsed:null;}catch{return null;}};
  const freq=read('freq');const favs=read('favs');
  return {freq:freq&&typeof freq.count==='number'&&freq.count>=0?freq:{count:0,map:{}},favs:Array.isArray(favs)?favs.filter(item=>typeof item==='string'&&item.length<=12):[]};
}

function save(storage,accountId,data){
  storage.set(`yiban:emoji:freq:${accountId}`,JSON.stringify(data.freq));
  storage.set(`yiban:emoji:favs:${accountId}`,JSON.stringify(data.favs));
}

// 每次使用 +1；容量到顶时踢掉次数最少且不是 last 的那个——emoji-mart 同款策略。
export function recordEmoji(storage,accountId,emoji){
  if(typeof emoji!=='string'||!emoji||emoji.length>12)return loadEmojiData(storage,accountId);
  const data=loadEmojiData(storage,accountId);
  data.freq.count+=1;
  data.freq.map[emoji]=(data.freq.map[emoji]||0)+1;
  const entries=Object.entries(data.freq.map);
  if(entries.length>FREQ_CAP){
    entries.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    const overflow=entries.slice(FREQ_CAP);
    for(const [id] of overflow)delete data.freq.map[id];
  }
  data.freq.last=emoji;
  save(storage,accountId,data);
  return data;
}

export function toggleFavorite(storage,accountId,emoji){
  if(typeof emoji!=='string'||!emoji||emoji.length>12)return loadEmojiData(storage,accountId);
  const data=loadEmojiData(storage,accountId);
  data.favs=data.favs.includes(emoji)?data.favs.filter(item=>item!==emoji):[emoji,...data.favs].slice(0,16);
  save(storage,accountId,data);
  return data;
}

// 最近使用：按次数降序、同分按字典序，last 永远在列；空态回默认兜底。
export function recentEmojis(data){
  const entries=Object.entries(data.freq.map);
  if(!entries.length)return DEFAULT_EMOJIS.slice(0,8);
  entries.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const list=entries.map(([id])=>id);
  if(data.freq.last&&!list.includes(data.freq.last))list.push(data.freq.last);
  return list.slice(0,12);
}
