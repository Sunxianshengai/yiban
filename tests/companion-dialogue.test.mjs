import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expressionSettings} from '../lib/companion-styles.mjs';
import {dialogueIntent,selectDialogueExamples,dialoguePrompt,dialogueStream,blockedInReply,replyStyleProblems} from '../lib/companion-dialogue.mjs';

test('intent hints honor boundaries, explicit help, corrections and brief acknowledgements',()=>{
 for(const [text,expected] of [['别叫我宝贝','boundary'],['我烦，不想听建议','listen'],['我紧张，帮我准备一下','help'],['补充一下，我是在开玩笑','correction'],['我去吃饭了','leave'],['嗯','ack'],['来个玩法','play']])assert.equal(dialogueIntent(text),expected,text);
});
test('each style has 30 original multi-turn scenarios, retrieved per topic without mixing personalities',()=>{
 for(const styleId of ['banter','gentle','bright']){
  const rows=selectDialogueExamples(styleId,'闹钟',40);assert.equal(rows.length,30);assert.equal(new Set(rows.map(r=>r.id)).size,30);assert.ok(rows.every(r=>r.styleId===styleId&&r.turns.length===4));
  assert.match(selectDialogueExamples(styleId,'猫坐在键盘上')[0].topic,/猫/);
 }
 assert.equal(selectDialogueExamples(null,'猫').length,0);
});
test('prompt follows current correction, discourages recent repeated language and treats examples as fiction',()=>{
 const history=[{role:'assistant',status:'completed',text:'你说，我听着'},{role:'assistant',status:'stopped',text:'已中断不能接着说'},{role:'user',text:'补充一下，我是在开玩笑'}];
 const prompt=dialoguePrompt({styleId:'banter',verbalTics:'low',blockedExpressions:['你说，我听着']},history);
 assert.match(prompt,/俏皮损友/);assert.match(prompt,/后面的纠正优先/);assert.match(prompt,/停止沿用旧判断/);assert.match(prompt,/语气词少用/);assert.match(prompt,/你说，我听着/);assert.doesNotMatch(prompt,/已中断不能接着说/);assert.match(prompt,/不是当前用户的经历/);
 assert.doesNotMatch(dialoguePrompt({styleId:'gentle'},history,{mode:'story'}),/原创的虚构多轮风格示例/);
});
test('expression preferences reject malformed input and normalize harmless duplicate entries',()=>{
 assert.deepEqual(expressionSettings({blockedExpressions:[' 抱抱 ','抱抱']}),{styleId:null,blockedExpressions:['抱抱'],verbalTics:'natural'});
 for(const value of [{styleId:'unknown'},{blockedExpressions:'抱抱'},{blockedExpressions:['a']},{blockedExpressions:['换\n行']},{blockedExpressions:Array(21).fill('抱抱')},{verbalTics:'robot'}])assert.throws(()=>expressionSettings(value));
 assert.deepEqual(blockedInReply('你说，\u200b 我听着',['你说，我听着']),['你说，我听着']);
});
const collect=async stream=>{let result='';for await(const delta of stream)result+=delta;return result;};
test('ordinary replies remain incremental, with no additional model request',async()=>{
 let calls=0;async function* model(){calls++;yield '第一';yield '第二';}
 const emitted=[];for await(const delta of dialogueStream([],{stream:model}))emitted.push(delta);
 assert.deepEqual(emitted,['第一','第二']);assert.equal(calls,1);
});
test('strict bans never leak first attempt, repair once and preserve request cancellation',async()=>{
 let calls=0;const controller=new AbortController();
 async function* model(messages,{signal}){assert.equal(signal,controller.signal);calls++;if(calls===1){yield '我完全';yield '理解你';}else{assert.match(messages.at(-1).content,/重写/);yield '今天这事确实烦。';}}
 assert.equal(await collect(dialogueStream([],{stream:model,blocked:['我完全理解你'],signal:controller.signal})),'今天这事确实烦。');assert.equal(calls,2);
 let leaked='';await assert.rejects(async()=>{for await(const delta of dialogueStream([],{blocked:['抱抱'],stream:async function*(){yield '抱抱';}}))leaked+=delta;},/积分已退回/);assert.equal(leaked,'');
});
test('selected styles repair explicit invented daily experiences before any visible delivery',async()=>{
 assert.ok(replyStyleProblems('今天路过一家店，看见一个招牌。').length);
 assert.deepEqual(replyStyleProblems('想象一下，今天路过一家店，看见一个招牌。'),[]);
 let calls=0;async function* stream(){yield ++calls===1?'今天路过一家店。':'想象一家永远写着最后三天的店，倒计时根本没动。';}
 const answer=await collect(dialogueStream([],{stream,review:true}));assert.match(answer,/想象/);assert.equal(calls,2);
});
test('recent request for no advice carries across a follow-up without becoming a permanent preference',()=>{
 const messages=[{role:'user',text:'今天累，不想听建议'},{role:'assistant',text:'发生什么了？',status:'completed'},{role:'user',text:'你随便聊两句，不用追问原因'}];
 assert.equal(dialogueIntent(messages.at(-1).text),'boundary');assert.match(dialoguePrompt({},messages),/继续尊重这个要求/);assert.match(dialoguePrompt({},messages),/不继续用问题推动/);
 assert.doesNotMatch(dialoguePrompt({},messages,{text:'帮我想个办法'}),/继续尊重这个要求/);
 assert.throws(()=>expressionSettings({blockedExpressions:['\u200b\u200c']}));
});
