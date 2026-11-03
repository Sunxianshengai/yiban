import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const directory=mkdtempSync(path.join(tmpdir(),'yiban-pet-'));
Object.assign(process.env,{NODE_ENV:'test',YIBAN_DATA_DIR:directory});delete process.env.DATABASE_URL;delete process.env.VERCEL;
const p=await import('../lib/pet-service.mjs'),auth=await import('../lib/auth.mjs'),store=await import('../lib/store.mjs');
after(async()=>{(await store.creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});
test('pet settings reject executable ids, invalid physics and excessive clones',()=>{assert.throws(()=>p.cleanPetConfig({physics:{gravity:Infinity}}));assert.throws(()=>p.cleanPetConfig({pets:Array(5).fill(p.defaultPetConfig().pets[0])}));assert.throws(()=>p.cleanPetConfig({pets:[{...p.defaultPetConfig().pets[0],id:'../../other'}]}));assert.throws(()=>p.cleanPetConfig({animationWeights:{idle:90,move:90,turn:0}}));});
test('pet settings, identity, snapshots and todo ownership are isolated',async()=>{
 const user=await auth.createUser({name:'一',email:'pet-a@test.invalid',password:'Password123'},'admin');const other=await auth.createUser({name:'二',email:'pet-b@test.invalid',password:'Password123'},'admin');
 await p.savePetConfig(user,{pets:[{...p.defaultPetConfig().pets[0],name:'我的小羊'}]});assert.equal((await p.petConfig(other)).pets[0].name,'瞌睡小羊');
 const a=await p.petThread(user,'sleepy-sheep'),b=await p.petThread(other,'sleepy-sheep');assert.notEqual(a.binding.profileId,b.binding.profileId);assert.equal(a.thread.options.profileId,a.binding.profileId);assert.equal(a.thread.options.memoryMode,'off');assert.equal((await p.petThread(user,'sleepy-sheep')).thread.id,a.thread.id);
 await p.petSleep(user,'sleepy-sheep',true);assert.equal((await p.petSnapshot(user)).pets['sleepy-sheep'].sleep.data.sleeping,true);assert.deepEqual((await p.petSnapshot(other)).pets,{});
 const {todo}=await p.petTodos(user,'POST',null,{text:'喝水',dueAt:null});assert.equal((await p.petTodos(other,'GET')).todos.length,0);await assert.rejects(p.petTodos(other,'PATCH',todo.id,{done:true}),/不存在/);assert.equal((await p.petTodos(user,'PATCH',todo.id,{done:true})).todo.done,true);
});

test('due todo reminders are claimed once and stay in their account',async()=>{
 const user=await auth.createUser({name:'提醒',email:'pet-reminder@test.invalid',password:'Password123'},'admin');
 const context=await p.petThread(user,'sleepy-sheep');
 const proactive=await import('../lib/proactive-contact.mjs');
 const time=offset=>new Date(Date.now()+offset*60000).toISOString().slice(11,16);
 await proactive.updateSettings(user,context.binding.profileId,{enabled:false,quietStart:time(10),quietEnd:time(11),timezone:'UTC',expectedRevision:0});
 const {todo}=await p.petTodos(user,'POST',null,{text:'站起来活动',dueAt:Date.now()-1000});
 await p.petTick(user);
 const state=await p.petSnapshot(user);assert.equal(state.pets['sleepy-sheep'].say.data.text,'待办提醒：站起来活动');
 assert.equal((await store.get('pet_todos',todo.id)).remindedAt,todo.dueAt);
 await p.petTick(user);assert.equal((await p.petSnapshot(user)).pets['sleepy-sheep'].say.counter,state.pets['sleepy-sheep'].say.counter);
 const whisper=await p.petWhisper(user,'sleepy-sheep');assert.equal(whisper.result.status,'disabled');
 assert.equal((await p.petSnapshot(user)).pets['sleepy-sheep'].say.data.source,'system');
 assert.equal((await p.petThread(user,'sleepy-sheep')).messages.length,0);
});
