// Trial credits are not a currency conversion. Prices are set by the server.
export const CREDIT_PRICES=Object.freeze({
  organize:{label:'AI 整理记忆',points:2,unit:'次'},
  companion:{label:'家伴对话',points:1,unit:'次回复'},
  role:{label:'角色对话',points:1,unit:'次回复'},
  voice_enroll:{label:'声音复刻',points:30,unit:'次'},
  voice_speak:{label:'声音合成',points:2,unit:'每 100 字，不足按 100 字'},
  narrate:{label:'生成讲述稿与配音',points:10,unit:'次'},
  video_480:{label:'照片视频 · 480P',points:20,unit:'秒'},
  video_720:{label:'照片视频 · 720P',points:40,unit:'秒'},
});

export function creditQuote(endpoint,body={}) {
  const feature={ '/organize':'organize','/companion/turn':'companion','/role/turn':'role',
    '/voice/enroll':'voice_enroll','/voice/speak':'voice_speak','/narrate/script':'narrate'}[endpoint];
  if(endpoint==='/narrate/video') {
    const id=String(body.resolution||'').toUpperCase()==='720P'?'video_720':'video_480';
    const input=body.duration;
    const numeric=input===null||input===undefined||input===''?5:Number(input);
    const seconds=Number.isFinite(numeric)?Math.max(2,Math.min(15,Math.round(numeric))):5;
    return {feature:id,...CREDIT_PRICES[id],amount:seconds*CREDIT_PRICES[id].points};
  }
  if(!feature)return null;
  const price=CREDIT_PRICES[feature];
  const amount=feature==='voice_speak'?Math.max(1,Math.ceil(String(body.text||'').length/100))*price.points:price.points;
  return {feature,...price,amount};
}
