import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const directory=mkdtempSync(path.join(tmpdir(),'yiban-credits-'));
process.env.NODE_ENV='test';
process.env.YIBAN_DATA_DIR=directory;
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
const credits=await import('../lib/credits.mjs');
after(async()=>{(await (await import('../lib/store.mjs')).creditStorage()).db.close();rmSync(directory,{recursive:true,force:true});});

test('管理员发放计入个人余额和流水，同一发放请求只入账一次',async()=>{
  assert.equal((await credits.account('member-a')).balance,0);
  await credits.grant({userId:'member-a',actorId:'admin',amount:100,note:'家庭体验',requestKey:'grant-a'});
  await credits.grant({userId:'member-a',actorId:'admin',amount:100,note:'家庭体验',requestKey:'grant-a'});
  const account=await credits.account('member-a');
  assert.equal(account.balance,100);
  assert.equal(account.held,0);
  assert.equal(account.entries.length,1);
  assert.equal(account.entries[0].kind,'grant');
  assert.equal(account.entries[0].note,'家庭体验');
});

test('同时发起的消费不能超扣；重复结算、重复退回只生效一次',async()=>{
  await credits.grant({userId:'member-b',actorId:'admin',amount:10,note:'并发体验',requestKey:'grant-b'});
  const requests=await Promise.allSettled(Array.from({length:6},(_,i)=>credits.reserve({userId:'member-b',feature:'story',amount:5,requestKey:`story-${i}`,requestHash:`hash-${i}`})));
  const accepted=requests.filter(r=>r.status==='fulfilled');
  assert.equal(accepted.length,2);
  assert.equal(requests.filter(r=>r.status==='rejected'&&r.reason.status===402).length,4);
  assert.equal((await credits.account('member-b')).balance,0);
  assert.equal((await credits.account('member-b')).held,10);
  const first=accepted[0].value.operation,second=accepted[1].value.operation;
  await credits.complete('member-b',first.id,{status:200,body:{story:'保存的故事'}});
  await credits.complete('member-b',first.id,{status:200,body:{story:'保存的故事'}});
  await credits.refund('member-b',second.id,'模型生成失败');
  await credits.refund('member-b',second.id,'模型生成失败');
  const account=await credits.account('member-b');
  assert.equal(account.balance,5);
  assert.equal(account.held,0);
  assert.equal(account.entries.filter(e=>e.kind==='refund').length,1);
  assert.equal(account.entries.filter(e=>e.kind==='settle').length,1);
});

test('独立进程争抢同一余额仍不能超扣',async()=>{
  await credits.grant({userId:'member-process',actorId:'admin',amount:5,note:'多进程验证',requestKey:'process-grant'});
  const outcomes=await Promise.all(Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>{
    const script=`const c=await import('./lib/credits.mjs');try{await c.reserve({userId:'member-process',feature:'story',amount:5,requestKey:'process-${i}',requestHash:'p-${i}'});console.log('accepted');}catch(e){if(e.status!==402)throw e;console.log('insufficient');}`;
    const child=spawn(process.execPath,['--input-type=module','-e',script],{env:process.env,stdio:['ignore','pipe','pipe']});
    let output='',error='';
    child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>error+=data);
    child.on('error',reject);child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error)));
  })));
  assert.equal(outcomes.filter(value=>value==='accepted').length,1);
  const wallet=await credits.account('member-process');
  assert.equal(wallet.balance,0);assert.equal(wallet.held,5);
});

test('篡改发放内容、非整数金额和重复请求冲突不会改变余额',async()=>{
  await assert.rejects(credits.grant({userId:'member-a',actorId:'admin',amount:101,note:'家庭体验',requestKey:'grant-a'}),{status:409});
  await assert.rejects(credits.grant({userId:'another-member',actorId:'admin',amount:100,note:'家庭体验',requestKey:'grant-a'}),{status:409});
  await assert.rejects(credits.grant({userId:'member-a',actorId:'admin',amount:1.5,note:'家庭体验',requestKey:'bad-amount'}),{status:400});
  assert.equal((await credits.account('member-a')).balance,100);
  const first=await credits.reserve({userId:'member-a',feature:'story',amount:5,requestKey:'reserve-repeat',requestHash:'same'});
  const again=await credits.reserve({userId:'member-a',feature:'story',amount:5,requestKey:'reserve-repeat',requestHash:'same'});
  assert.equal(again.created,false);assert.equal(first.operation.id,again.operation.id);
  await assert.rejects(credits.reserve({userId:'member-a',feature:'story',amount:5,requestKey:'reserve-repeat',requestHash:'different'}),{status:409});
  await credits.refund('member-a',first.operation.id,'取消');
});

test('同一视频资源跨账号只能有一笔活动冻结，失败后可以重新创建',async()=>{
  for(const userId of ['video-a','video-b'])await credits.grant({userId,actorId:'admin',amount:200,note:'视频并发',requestKey:`grant-${userId}`});
  const submit=userId=>credits.reserve({userId,feature:'video_480',amount:100,requestKey:`task-${userId}`,requestHash:userId,metadata:{async:true,resourceKey:'same-video'}});
  const results=await Promise.allSettled(['video-a','video-b'].map(submit));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  const op=results.find(r=>r.status==='fulfilled').value.operation;
  await credits.refund(op.userId,op.id,'失败退回');
  const other=op.userId==='video-a'?'video-b':'video-a';
  assert.equal((await submit(other)).created,true);
});

test('中断且未登记任务的冻结额度超过 30 分钟后可恢复',async()=>{
  await credits.grant({userId:'interrupted',actorId:'admin',amount:50,note:'恢复验证',requestKey:'recovery-grant'});
  await credits.reserve({userId:'interrupted',feature:'story',amount:5,requestKey:'lost-sync',requestHash:'lost-sync'});
  await credits.reserve({userId:'interrupted',feature:'video_480',amount:20,requestKey:'lost-async',requestHash:'lost-async',metadata:{async:true,pollKey:'never-created',resourceKey:'orphan-video'}});
  await (await import('../lib/store.mjs')).put('memory_videos',{id:'previous-failed',creditOperationId:'an-old-operation',status:'failed'});
  await credits.reserve({userId:'interrupted',feature:'video_480',amount:10,requestKey:'lost-retry',requestHash:'lost-retry',metadata:{async:true,pollKey:'previous-failed',resourceKey:'previous-failed'}});
  const now=Date.now;
  try {
    Date.now=()=>now()+31*60*1000;
    const account=await credits.account('interrupted');
    assert.equal(account.balance,50);assert.equal(account.held,0);
    assert.equal(account.entries.filter(e=>e.kind==='refund').length,3);
  }finally{Date.now=now;}
});
