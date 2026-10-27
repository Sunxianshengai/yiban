// 语音朗读的能力协商层。
// 现状：浏览器 speechSynthesis 负责发声，服务端只告诉前端「有没有更好的后端可用」。
// 声音克隆（CosyVoice）已在 lib/voice.mjs 就绪，但要复刻一个音色、按字符计费，
// 所以这里先只暴露开关与端点契约，等真的接入时前端不必改结构。
//
// 未来接入克隆声音时，只需要：
//   1. 让 speechConfig().server 返回 {available:true, endpoint:'/api/voice/speak'};
//   2. 给成员配上 voiceId（lib/voice.mjs 的 enrollVoice 已能产出）；
//   3. 前端 speak() 优先取服务端音频，失败再回落到浏览器合成。
import {voiceConfigured} from './voice.mjs';

export const SPEECH_PROVIDERS = {
  browser: {id: 'browser', label: '设备合成声音', cloneable: false},
  cosyvoice: {id: 'cosyvoice', label: '复刻音色（CosyVoice）', cloneable: true},
};

// 默认只开浏览器合成——它免费、离线、无需同意书。
// REA_SPEECH_SERVER=cosyvoice 也不会自动打开：复刻音色必须由本人勾选同意，
// 所以真实启用还要成员上有 voiceId 且经 /api/voice/speak 计费。
export function speechConfig() {
  const configured = voiceConfigured();
  return {
    fallback: 'browser',
    browser: true,
    server: {available: false, provider: 'cosyvoice', configured, endpoint: configured ? '/api/voice/speak' : null},
    note: configured
      ? '已配置声音合成服务。当前默认使用设备朗读；接入复刻音色后，同一条回复可以换成家人的声音。'
      : '当前使用设备自带的合成声音朗读。接入声音克隆服务后，可换成复刻音色。',
  };
}
