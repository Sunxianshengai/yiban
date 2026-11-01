import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {importSharedVoice} from '../lib/shared-voice-import.mjs';
const path=process.env.YIBAN_REFERENCE_SAMPLE;
test('one clone is verified and granted once to the snapshot of existing users',async()=>{
  const docs=new Map(),key=(collection,id)=>collection+':'+id;let creates=0,previews=0;
  const store={get:async(c,id)=>docs.get(key(c,id)),all:async()=>[{id:'a'},{id:'b'}],put:async(c,v)=>docs.set(key(c,v.id),v),insertIfAbsent:async(c,v)=>{if(docs.has(key(c,v.id)))return false;docs.set(key(c,v.id),v);return true;},compareAndPut:async(c,old,v)=>{if(docs.get(key(c,v.id))!==old)return false;docs.set(key(c,v.id),v);return true;}};
  const deps={store,inspect:()=>{},requestVoice:async input=>{if(input.action==='create_voice'){creates++;return {voice_id:'qwen-audio-3.1-tts-plus-yb-test'};}return {status:'OK'};},synthesize:async()=>{previews++;return Buffer.alloc(100);}};
  const sample=await readFile(path),result=await importSharedVoice(sample,deps);
  assert.equal(result.status,'complete');assert.equal(result.accounts,2);
  assert.equal([...docs.keys()].filter(k=>k.startsWith('companion_voices:')).length,2);
  assert.equal((await importSharedVoice(sample,deps)).status,'complete');assert.equal(creates,1);assert.equal(previews,1);
  await assert.rejects(importSharedVoice(Buffer.from('wrong sample'),deps),/does not match/);
});
