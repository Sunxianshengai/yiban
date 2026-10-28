// AI 伙伴的「专属音色」：CosyVoice 预置音色（与真人克隆 voiceId 分开）。
// 仅在用户明确要求「发语音」且已配置 DASHSCOPE_API_KEY 时合成，成本可控；
// 合成失败时静默降级为纯文字，模型与界面都不谎称已发语音。
export const AI_VOICES=[
  {id:'longxiaochun_v2',label:'小春 · 温柔女声'},
  {id:'longwan',label:'婉婉 · 活泼女声'},
  {id:'longshu',label:'书书 · 沉稳女声'},
  {id:'longcheng',label:'成成 · 温和男声'},
  {id:'longshuo',label:'硕硕 · 低沉男声'},
];

export function validAiVoice(id){return id===null||AI_VOICES.some(item=>item.id===id);}

// 合成判定：必须是本轮明确要求 + 已选音色 + 服务已配置；三者缺一都不合成。
export function shouldSynthesizeVoice({directives=[],voice=null,configured=false}={}){
  if(!configured||!voice)return false;
  return directives.some(item=>item.includes('语音'));
}
