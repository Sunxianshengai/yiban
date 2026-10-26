import test from 'node:test';
import assert from 'node:assert/strict';
import {tidyMemory,searchMemories,localOrganize,storyFromMemories,sanitizePreferences} from '../lib/core.mjs';
import {seedMemories} from '../lib/seed.mjs';

test('spoken searches find family memories rather than requiring exact titles',()=>{
  assert.ok(searchMemories(seedMemories,'我想看看女儿小时候的照片').some(m=>m.id==='demo-child'));
  assert.ok(searchMemories(seedMemories,'有没有老家的照片').some(m=>m.id==='demo-home'));
  assert.ok(searchMemories(seedMemories,'播放春节的故事').some(m=>m.id==='demo-newyear'));
  assert.equal(searchMemories(seedMemories,'月球探险').length,0);
});
test('editing content preserves attachments, rejects invalid year and trims fields',()=>{
  const old={title:'原始记忆',year:'1995',theme:'家人',cover:'/api/media/abc.jpg',audio:'/api/media/abc.mp3',people:['妈妈'],tags:[],status:'confirmed',favorite:true};
  const result=tidyMemory({title:'  修改后的记忆  ',people:'妈妈、爸爸'},old);
  assert.equal(result.cover,old.cover);assert.equal(result.audio,old.audio);assert.equal(result.status,'confirmed');assert.equal(result.favorite,true);
  assert.deepEqual(result.people,['妈妈','爸爸']);assert.equal(result.title,'修改后的记忆');
  assert.throws(()=>tidyMemory({title:'测试',year:'abc'}));assert.throws(()=>tidyMemory({title:' '}));
});
test('offline organization and story generation retain supplied facts',()=>{
  const input={title:'1995年去杭州',story:'我们坐火车去西湖。',people:['妈妈'],tags:[]};
  const result=localOrganize(input);
  assert.equal(result.mode,'local');assert.equal(result.year,'1995');assert.equal(result.story,input.story);assert.deepEqual(result.people,['妈妈']);
  assert.match(storyFromMemories([{...result,location:''}],'旅行'),/我们坐火车去西湖。/);
  const blank=localOrganize({title:'照片',story:'',tags:[]});assert.equal(blank.year,'');assert.equal(blank.people.length,0);
});

test('system theme persists as an explicit preference while invalid themes fall back',()=>{
  assert.equal(sanitizePreferences({theme:"system"}).theme,"system");
  assert.equal(sanitizePreferences({theme:"invalid"}).theme,"day");
});
