import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCompanionReply,COMPANION_STICKERS,companionReplyProtocol} from '../lib/companion-chat.mjs';

test('semantic bubbles survive every chunk boundary without exposing control lines',()=>{
  const text='昨晚的开场白，用上没？\n---\n先歇着。\n---\n[[sticker:greeting]]';
  for(let cut=1;cut<text.length;cut++){
    const partial=parseCompanionReply(text.slice(0,cut),{allowedStickers:['greeting']});
    assert.ok(!partial.text.includes('[[sticker:'));assert.ok(!partial.text.includes('\n---'));
    const complete=parseCompanionReply(text,{final:true,allowedStickers:['greeting']});assert.deepEqual(complete.parts,[{type:'text',text:'昨晚的开场白，用上没？'},{type:'text',text:'先歇着。'},{type:'sticker',stickerId:'greeting'}]);
  }
});
test('reply controls never split code fences or turn arbitrary URLs into media',()=>{
  const code='```md\n---\n[[sticker:greeting]]\n```';assert.equal(parseCompanionReply(code,{final:true,allowedStickers:['greeting']}).parts.length,1);
  const rejected=parseCompanionReply('你好\n---\n[[sticker:unknown]]\n---\n[[sticker:greeting]]',{final:true,allowedStickers:[]});assert.deepEqual(rejected.parts,[{type:'text',text:'你好'}]);
  const capped=parseCompanionReply(Array.from({length:8},(_,i)=>`第${i}条`).join('\n---\n')+'\n---\n[[sticker:greeting]]\n---\n[[sticker:quiet]]',{final:true,allowedStickers:['greeting','quiet']});assert.equal(capped.parts.filter(p=>p.type==='text').length,4);assert.equal(capped.parts.filter(p=>p.type==='sticker').length,1);assert.match(capped.text,/第7条/);
  assert.ok(COMPANION_STICKERS.every(item=>item.src.startsWith('/companions/')&&!item.src.includes('..')));
  assert.match(companionReplyProtocol({allowedStickers:[]}),/不要发送图片表情/);
});
