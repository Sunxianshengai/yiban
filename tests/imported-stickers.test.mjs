import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {IMPORTED_STICKERS} from '../lib/imported-stickers.mjs';
import {selectCompanionStickers,parseCompanionReply,companionReplyProtocol,stickerById} from '../lib/companion-chat.mjs';

test('reviewed export stickers have real local files, correct formats and no duplicate content',()=>{
  const hashes=new Set(),ids=new Set();
  for(const item of IMPORTED_STICKERS){
    assert.match(item.id,/^[a-z-]+$/);assert.ok(!ids.has(item.id));ids.add(item.id);
    assert.match(item.src,/^\/companions\/imported\/[a-f0-9]+\.(gif|jpg|png)$/);
    const bytes=readFileSync(new URL('../public'+item.src,import.meta.url));
    const digest=createHash('sha256').update(bytes).digest('hex');assert.ok(!hashes.has(digest));hashes.add(digest);
    if(item.src.endsWith('.gif'))assert.match(bytes.subarray(0,6).toString(),/^GIF8[79]a$/);
    if(item.src.endsWith('.jpg'))assert.equal(bytes.readUInt16BE(0),0xffd8);
    if(item.src.endsWith('.png'))assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.ok(item.tags.length>=3&&item.label&&item.emotion);
  }
  assert.equal(readdirSync(new URL('../public/companions/imported/',import.meta.url)).length,IMPORTED_STICKERS.length);
  assert.ok(IMPORTED_STICKERS.some(item=>item.animated));
});

test('AI retrieves contextual memes with a bounded choice set and respects cooldown and manual-only memes',()=>{
  const picked=selectCompanionStickers('点的外卖到了，好饿，准备吃饭');
  assert.ok(picked.length<=24);
  assert.ok(picked.slice(0,8).some(id=>stickerById(id).group==='imported'&&stickerById(id).tags.includes('吃饭')));
  assert.ok(picked.every(id=>stickerById(id).aiEnabled!==false));
  const next=selectCompanionStickers('点的外卖到了，好饿，准备吃饭',{recentIds:picked});
  assert.ok(next.every(id=>!picked.includes(id)));
  assert.equal(selectCompanionStickers('hello',{limit:0}).length,0);
  const item=IMPORTED_STICKERS.find(s=>s.label==='好呀');
  assert.equal(selectCompanionStickers('发一个好呀表情')[0],item.id);
  const raw=`好滴呢\n---\n[[sticker:${item.id}]]`;
  assert.deepEqual(parseCompanionReply(raw,{final:true,allowedStickers:[item.id]}).parts,[{type:'text',text:'好滴呢'},{type:'sticker',stickerId:item.id}]);
  assert.equal(parseCompanionReply(raw,{final:true,allowedStickers:[]}).parts.length,1);
  assert.match(companionReplyProtocol({allowedStickers:[item.id]}),/好呀/);
});
