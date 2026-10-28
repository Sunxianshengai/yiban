// AI 伙伴的「专属音色」：CosyVoice 预置音色（与真人克隆 voiceId 分开）。
// 自然/按要求/仅文字由 voiceReplyIntent 控制；服务失败在消息中显示并可重试。
export const AI_VOICES=[
  {id:'longanhuan',label:'安欢 · 自然女声',model:'cosyvoice-v3-flash'},
  {id:'longanyang',label:'安洋 · 自然男声',model:'cosyvoice-v3-flash'},
  {id:'longxiaochun_v2',label:'小春 · 温柔女声'},
  {id:'longwan',label:'婉婉 · 普通话女声',providerVoice:'longwan_v2'},
  {id:'longshu',label:'书书 · 沉稳男声',providerVoice:'longshu_v2'},
  {id:'longcheng',label:'成成 · 温和男声',providerVoice:'longcheng_v2'},
  {id:'longshuo',label:'硕硕 · 自然男声（兼容）',providerVoice:'longanyang',model:'cosyvoice-v3-flash'},
];

export function validAiVoice(id){return id===null||AI_VOICES.some(item=>item.id===id);}

// 合成判定：必须是本轮明确要求 + 已选音色 + 服务已配置；三者缺一都不合成。
export function shouldSynthesizeVoice({directives=[],voice=null,configured=false}={}){
  if(!configured||!voice)return false;
  return directives.some(item=>item.includes('语音'));
}

// Explicit requests win; natural replies have a three-reply cooldown and stay short.
export function voiceReplyIntent({text='',audio=false,mode='auto',recent=[],voice=null}={}){
  if(mode==='off'||/别发语音|不要语音|不要发语音|只发文字|打字就好/.test(text))return false;
  if(/发语音|用语音|说给我听|读给我听/.test(text))return true;
  if(!voice||mode==='manual'||recent.slice(-3).some(item=>item.audio||item.voiceStatus==='ready'))return false;
  return audio||/想听你|陪我一会|有点累|好累|晚安|睡不着|好消息|太开心/.test(text);
}
