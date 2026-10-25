import test from 'node:test';
import assert from 'node:assert/strict';
import {draftKey,readDraft,hasDraftContent,memoryTitle} from '../lib/memory-draft.mjs';
import {searchMemories} from '../lib/core.mjs';

test('drafts are scoped to one account, expire, and tolerate blocked or corrupt storage',()=>{
  const data=new Map([[draftKey('one'),JSON.stringify({form:{story:'家人的原话'},savedAt:Date.now()})]]);
  const storage={getItem:k=>data.get(k)};
  assert.equal(readDraft(storage,'one').story,'家人的原话');
  assert.equal(readDraft(storage,'two'),null);
  data.set(draftKey('one'),JSON.stringify({form:{story:'过期'},savedAt:Date.now()-8*86400000}));
  assert.equal(readDraft(storage,'one'),null);
  data.set(draftKey('one'),'{bad');assert.equal(readDraft(storage,'one'),null);
  assert.equal(readDraft({getItem(){throw Error('blocked');}},'one'),null);
});
test('quick recording derives a title without replacing the original story',()=>{
  const form={story:'今天和妈妈一起做饭。她教我做了红烧肉。'};
  assert.equal(memoryTitle(form),'今天和妈妈一起做饭');
  assert.equal(form.story,'今天和妈妈一起做饭。她教我做了红烧肉。');
  assert.equal(memoryTitle({audio:'/api/media/a.webm'}),'一段家人的声音');
  assert.equal(hasDraftContent({story:'  '}),false);
});
test('relative searches use this family instead of the demonstration family',()=>{
  const memory=name=>({id:name,title:'做饭',people:[name],tags:[],story:'一次平常的晚饭'});
  const result=searchMemories([memory('张女士'),memory('林阿姨')],'妈妈',[{name:'张女士',relation:'母亲'}]);
  assert.deepEqual(result.map(m=>m.id),['张女士']);
});
