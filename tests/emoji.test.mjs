import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEmojiData,recordEmoji,recentEmojis,toggleFavorite,DEFAULT_EMOJIS} from '../lib/emoji.mjs';

const memoryStorage=()=>{const map=new Map();return {get:key=>map.has(key)?map.get(key):null,set:(key,value)=>map.set(key,value)};};

test('recordEmoji counts usage and recentEmojis orders by frequency',()=>{
  const storage=memoryStorage();
  let data=loadEmojiData(storage,'a');
  assert.deepEqual(recentEmojis(data),DEFAULT_EMOJIS.slice(0,8));
  for(const emoji of ['😂','😂','👍','😂'])data=recordEmoji(storage,'a',emoji);
  assert.deepEqual(recentEmojis(data).slice(0,2),['😂','👍']);
});

test('capacity eviction keeps the most recent emoji in the list',()=>{
  const storage=memoryStorage();
  let data=loadEmojiData(storage,'a');
  const fillers=[];for(let i=0;i<24;i++){const emoji=`😀${i}`;fillers.push(emoji);data=recordEmoji(storage,'a',emoji);}
  data=recordEmoji(storage,'a','🎉');
  const recent=recentEmojis(data);
  assert.ok(recent.includes('🎉'),'最近使用的表情必须保留');
  assert.equal(recentEmojis(data).length,12);
});

test('favorites toggle and survive a reload from the same storage',()=>{
  const storage=memoryStorage();
  let data=toggleFavorite(storage,'a','🎉');
  assert.ok(data.favs.includes('🎉'));
  data=toggleFavorite(storage,'a','🎉');
  assert.ok(!data.favs.includes('🎉'));
  data=toggleFavorite(storage,'a','❤️');
  assert.deepEqual(loadEmojiData(storage,'a').favs,['❤️']);
});

test('corrupted storage falls back to clean state',()=>{
  const storage=memoryStorage();
  storage.set('yiban:emoji:freq:a','{broken');
  storage.set('yiban:emoji:favs:a','not-json');
  const data=loadEmojiData(storage,'a');
  assert.equal(data.freq.count,0);
  assert.deepEqual(data.favs,[]);
  assert.deepEqual(recentEmojis(data),DEFAULT_EMOJIS.slice(0,8));
});
