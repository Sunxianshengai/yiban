import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCompanionReply,COMPANION_STICKERS,companionReplyProtocol,partDelayMs,proactiveOpener,stickerById,detectDirectives} from '../lib/companion-chat.mjs';

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

// 逐条露出的节奏必须是纯函数：同一条回复重放，停顿不能变。
test('paced reveal is deterministic, bounded and independent of wall-clock time',()=>{
  assert.equal(partDelayMs([{type:'text',text:'先听你说。'}],0),0);
  const parts=[{type:'text',text:'先听你说。'},{type:'text',text:'不急着复盘。'},{type:'sticker',stickerId:'greeting'},{type:'text',text:'嗯。'}];
  assert.equal(partDelayMs(parts,1),420+5*20);
  assert.equal(partDelayMs(parts,3),760);
  assert.equal(partDelayMs(parts,1),partDelayMs(parts,1));
  const long=partDelayMs([{type:'text',text:'字'.repeat(400)}],1),short=partDelayMs([{type:'text',text:'嗯'}],1);
  assert.equal(long,2600);assert.equal(short,520);
});

// 表情库：id 唯一、四张角色图不能改名，新增的原创表情要能被检索到。
test('sticker library keeps legacy artwork and exposes searchable emotions',()=>{
  const ids=COMPANION_STICKERS.map(item=>item.id);assert.equal(new Set(ids).size,ids.length);
  for(const id of ['greeting','celebrate','thinking','quiet']) assert.match(stickerById(id).src,/^\/companions\/xiaoman\/.+\.png$/);
  assert.equal(COMPANION_STICKERS.length,17);assert.equal(stickerById('hug').src,'/companions/stickers/hug.svg');
  assert.ok(COMPANION_STICKERS.every(item=>item.label&&item.emotion&&item.tags.length>=3));
  assert.equal(stickerById('nope'),null);
});

// 主动开口必须说得出出处：纪念日优先，其次记忆，最后才是通用寒暄。
test('proactive opener degrades from anniversary to memory to plain greeting',()=>{
  const day=new Date(2026,9,27);
  const anniversary=proactiveOpener({anniversaries:[{id:'a1',title:'外公生日',date:'10-27'},{id:'a2',title:'别的日子',date:'03-01'}],memories:[{id:'m1',title:'那年夏天',year:1998}],today:day});
  assert.equal(anniversary.source,'anniversary');assert.equal(anniversary.ref,'a1');assert.match(anniversary.text,/外公生日/);
  const memory=proactiveOpener({anniversaries:[],memories:[{id:'m1',title:'那年夏天',year:1998}],today:day});
  assert.equal(memory.source,'memory');assert.match(memory.text,/1998年/);assert.match(memory.text,/那年夏天/);
  const bare=proactiveOpener({today:day});assert.equal(bare.source,'default');assert.equal(bare.ref,null);
});
test('detectDirectives only fires on explicit per-turn requests',()=>{
  assert.deepEqual(detectDirectives('今天好累，不想动'),[]);
  assert.deepEqual(detectDirectives('简短点跟我说'),['这轮只回一句，不展开、不追问']);
  assert.ok(detectDirectives('别发表情了，认真点').includes('这轮不要发任何表情或贴纸'));
  assert.ok(detectDirectives('发语音给我听').some(item=>item.includes('语音')));
  assert.ok(detectDirectives('别开玩笑了').some(item=>item.includes('收起玩笑')));
});

test('reply protocol carries directives and media honesty per turn',()=>{
  const withDirectives=companionReplyProtocol({allowedStickers:[],directives:['这轮只回一句，不展开、不追问']});
  assert.match(withDirectives,/用户本轮的明确要求/);
  assert.match(withDirectives,/只对本轮生效/);
  const withImages=companionReplyProtocol({allowedStickers:[],hasImages:true});
  assert.match(withImages,/看不了图片内容/);
  const withAudio=companionReplyProtocol({allowedStickers:[],hasAudio:true});
  assert.match(withAudio,/听不了语音内容/);
  const plain=companionReplyProtocol({allowedStickers:['nod']});
  assert.match(plain,/开场白：那我走/);
  assert.doesNotMatch(plain,/用户本轮的明确要求/);
});
