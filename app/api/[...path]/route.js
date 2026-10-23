import { NextResponse } from 'next/server';

// 检查某个媒体文件名是否被任何记忆的 cover/audio/video 引用。
// 旧实现是全表扫描：每次媒体请求都把全部记忆拉出来逐条比对（O(n) JSON.parse）。
// 查看者只可通过已发布记忆读取素材；编辑者还可读取草稿引用的素材。
function mediaNeedle(file){return `/api/media/${file}`;}
async function hasMemoryMediaRef(file,includeDraft=false) {
  const needle=mediaNeedle(file);
  const memories=await all('memories');
  return memories.some(m=>(includeDraft||m.status==='confirmed')&&(m.cover===needle||m.audio===needle||m.video===needle));
}

// 对一个流按字节区间截取（媒体 Range 请求专用）。
// end 为 null 时截到流末尾；不预读总长度，Content-Range 用通配（浏览器与
// <audio>/<video> 都接受 bytes start-* 形式，只是失去断点续传的精确性）。
function streamSlice(stream,start,end=null) {
  let skipped=0;
  // createReadStream 给的是 Node Readable（没有 getReader），
  // Vercel Blob 的 blob.stream 给的是 Web ReadableStream（有 getReader）。
  const webStream=stream.getReader?stream:Readable.toWeb(stream);
  const reader=webStream.getReader();
  return new ReadableStream({
    async pull(controller) {
      for(;;) {
        const {done,value}=await reader.read();
        if(done){controller.close();return;}
        const chunkStart=skipped,chunkEnd=skipped+value.length;
        skipped=chunkEnd;
        if(chunkEnd<=start) continue;
        const from=Math.max(0,start-chunkStart);
        const to=end===null?value.length:Math.min(value.length,end-chunkStart+1);
        if(from>=to) continue;
        controller.enqueue(value.subarray(from,to));
        if(end!==null&&chunkEnd>end){controller.close();return;}
        return;
      }
    },
    cancel(){try{reader.cancel();}catch{}}
  });
}
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { handleUploadPresigned } from '@vercel/blob/client';
import { head as headBlob, issueSignedToken } from '@vercel/blob';
import { all,get,put,remove,log,snapshot,saveMedia,readMedia,readMediaBuffer,deleteMedia,usesRemoteStorage } from '../../../lib/store.mjs';
import { fetchAudioBuffer } from '../../../lib/voice.mjs';
import { tidyMemory, searchMemories } from '../../../lib/core.mjs';
import {organize,generateStory,aiReady,aiStatus,chatWithCompanion,chatWithRole,generateLifeStage,generateLifeEnding} from '../../../lib/ai.mjs';
import {CONCERNS,TONES,KINDS,ROLES,MAX_TEXT as ROLE_MAX_TEXT,sanitizeRole,roleOpening,buildRoleMessages,roleById} from '../../../lib/roles.mjs';
import {startRun,recordChoice,currentStage,publicRun,buildEnding,MAX_STAGES,MAX_CHOICE_TEXT,STAT_META} from '../../../lib/life.mjs';
import {PERSONAS,RELATIONS,MAX_MESSAGES,MAX_NOTES,MAX_TEXT,sanitizeCompanion,openingLine,retrieveMemories,buildMessages,localNotes} from '../../../lib/companion.mjs';
import {voiceConfigured,enrollVoice,synthesizeVoice,cacheKey} from '../../../lib/voice.mjs';
import {generateNarration,pickNarrator,narrationKey,videoKey,buildVideoPrompt,videoConfigured,createVideoTask,fetchVideoTask,clampResolution,clampSeconds,MAX_SCRIPT,MAX_IMAGE_BYTES,VIDEO_RESOLUTIONS,VIDEO_DEFAULT_RESOLUTION,VIDEO_DEFAULT_SECONDS} from '../../../lib/narrate.mjs';
import {accountRole,acceptInvite,authenticate,clearSessionCookie,createSession,createUser,hasAdmin,issueInvite,listAccounts,revokeSession,sameOrigin,sessionFromRequest,setSessionCookie} from '../../../lib/auth.mjs';
import {ACCENTS,FONT_SCALES,sanitizePreferences} from '../../../lib/core.mjs';
import {STAGES,MILESTONES,INTERVIEW,GROWTH_QUESTIONS,HIGHLIGHT_TEMPLATES,buildTimeline,buildParallel,milestoneProgress,sanitizeQuote,sanitizeCapsule,sanitizeBirthYear,sanitizeHighlight,capsuleState} from '../../../lib/lifestage.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status});
// 媒体统一从我们自己的网关出：远程存储的 Blob 是私有访问，浏览器拿 blobUrl 放不出来。
const mediaUrl=name=>`/api/media/${name}`;
// 系统生成的文件（配音、图生视频）落库时标 shared：谁的浏览器都该能播，但也不算谁的私有上传。
async function saveGenerated(name,data,contentType,userId){
  const stored=await saveMedia(name,data,contentType);
  await put('uploads',{id:name,userId:userId||null,shared:true,blobUrl:stored.blobUrl,blobPath:stored.blobPath,contentType,createdAt:new Date().toISOString()});
  return name;
}
const bad=(e,status=400)=>json({error:e.message||'请求未能完成'},e?.status||status);
const unauthorized=()=>json({error:'请先登录'},401);
const forbidden=()=>json({error:'当前账号没有执行此操作的权限'},403);
const guard=async(request,role='viewer')=>{const user=await sessionFromRequest(request);return {user,error:!user?unauthorized():!accountRole(user,role)?forbidden():null};};
const ensureOrigin=request=>sameOrigin(request)?null:forbidden();
const isManagedMedia=async file=>(await hasMemoryMediaRef(file,true));
const allowed={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','audio/ogg':'.ogg','audio/webm':'.webm','video/mp4':'.mp4','video/webm':'.webm' };
const validBlobPath=pathname=>typeof pathname==='string'&&/^yiban\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(pathname);

/** 造下一幕。这一步完全由模型写——写不出来就如实报错，不拿本地模板冒充。 */
async function nextStage(run,{freeText}={}) {
  const index=(run.stages||[]).length;
  const stage=await generateLifeStage(run,{freeText});
  return {...stage,index,mode:'model'};
}

/** 收尾：同样只由模型写；失败就让调用方把错误原样交给玩家。 */
async function finishRun(run) {
  // 结局的正文由模型写，但「这是假设」那句提醒、以及属性读数这些结构性的东西
  // 不能指望模型每次都写全——它们必须来自本地，所以这里以本地结局为底再覆盖正文。
  const base=run.ending||buildEnding(run);
  const text=await generateLifeEnding(run);
  return {...run,ending:{...base,mode:'model',text}};
}

export async function GET(request,{params}) {
  const {path:parts}=await params;
  try {
    if(parts[0]==='auth'&&parts[1]==='status') return json({needsSetup:!(await hasAdmin()),user:await sessionFromRequest(request),remoteStorage:usesRemoteStorage});
    const auth=await guard(request);if(auth.error)return auth.error;
    if(parts[0]==='auth'&&parts[1]==='accounts') return auth.user.role==='admin'?json({accounts:await listAccounts()}):forbidden();
    if(parts[0]==='state') {
      const data=await snapshot();
      if(!accountRole(auth.user,'editor')) {
        data.memories=data.memories.filter(m=>m.status==='confirmed');
        data.activity=data.activity.filter(a=>a.type!=='comment');
      }
      return json({...data,account:auth.user,canEdit:accountRole(auth.user,'editor')});
    }
    if(parts[0]==='search') {
      const q=new URL(request.url).searchParams.get('q');
      return json({memories:searchMemories((await all('memories')).filter(m=>m.status==='confirmed'),q),mode:'keyword'});
    }
    if(parts[0]==='voice'&&parts[1]==='status') {
      return json({configured:voiceConfigured(),provider:'cosyvoice'});
    }
    if(parts[0]==='narrate'&&parts[1]) {
      // 只读：这段记忆有没有现成的口述稿、有没有现成的视频。
      // 前端一进详情页就问一次，命中就什么都不用付钱。
      const memory=await get('memories',parts[1]);
      if(!memory) return json({error:'记忆不存在'},404);
      if(memory.status!=='confirmed'&&!accountRole(auth.user,'editor')) return json({error:'记忆不存在'},404);
      const members=await all('members');
      const narrator=pickNarrator(memory,members);
      const nKey=narrator?narrationKey(memory.id,narrator.id,memory.updatedAt||memory.createdAt||''):null;
      const record=nKey?await get('narrations',nKey):null;
      const video=record?.script?await get('memory_videos',videoKey({memoryId:memory.id,memberId:narrator.id,voiceId:narrator.voiceId,script:record.script,resolution:VIDEO_DEFAULT_RESOLUTION,duration:VIDEO_DEFAULT_SECONDS})):null;
      return json({
        memoryId:memory.id,
        narrator:narrator?{id:narrator.id,name:narrator.name,relation:narrator.relation}:null,
        script:record?.script||null,
        audioUrl:record?.audioUrl||null,
        video:video?{status:video.status,url:video.status==='ready'&&video.name?`/api/media/${video.name}`:null,taskId:video.taskId||null,resolution:video.resolution,duration:video.duration}:null,
        voiceEnabled:voiceConfigured(),videoEnabled:videoConfigured(),aiEnabled:aiReady(),
        maxScript:MAX_SCRIPT,resolutions:VIDEO_RESOLUTIONS,
      });
    }
    if(parts[0]==='narrate-video'&&parts[1]) {
      // 轮询图生视频任务。任务成功且拿到临时 url 时，立刻下载转存到 Blob——
      // DashScope 那个 url 只有 24 小时寿命，转存完才是我们自己的长期资产。
      const record=await get('memory_videos',parts[1]);
      if(!record) return json({error:'没有这个视频任务'},404);
      if(record.userId&&record.userId!==auth.user.id&&!accountRole(auth.user,'editor')) return forbidden();
      if(record.status==='ready'&&record.name) return json({status:'ready',url:mediaUrl(record.name),resolution:record.resolution,duration:record.duration});
      if(record.status==='failed') return json({status:'failed',message:record.message||'生成失败'});
      if(!record.taskId) return json({status:'pending'});
      const task=await fetchVideoTask(record.taskId);
      if(task.status==='pending') return json({status:'pending'});
      if(task.status==='failed') {
        await put('memory_videos',{...record,status:'failed',message:String(task.message||'生成失败').slice(0,200),updatedAt:new Date().toISOString()});
        return json({status:'failed',message:task.message||'生成失败'});
      }
      if(!task.videoUrl) {
        await put('memory_videos',{...record,status:'failed',message:'任务成功但没有拿到视频地址',updatedAt:new Date().toISOString()});
        return json({status:'failed',message:'任务成功但没有拿到视频地址'});
      }
      const buffer=await fetchAudioBuffer(task.videoUrl);
      if(buffer.length>50*1024*1024) {
        await put('memory_videos',{...record,status:'failed',message:'生成的视频超过 50 MB，无法保存',updatedAt:new Date().toISOString()});
        return json({status:'failed',message:'生成的视频超过 50 MB，无法保存'});
      }
      const name=`${randomUUID()}.mp4`;
      await saveGenerated(name,buffer,'video/mp4',auth.user.id);
      const done={...record,status:'ready',blobUrl:null,name,updatedAt:new Date().toISOString()};
      await put('memory_videos',done);
      await log('narration',`让「${record.memoryTitle||'一段回忆'}」动起来了`,record.memoryId);
      return json({status:'ready',url:mediaUrl(name),resolution:record.resolution,duration:record.duration});
    }
    if(parts[0]==='companion') {
      // 家伴：整块的对话入口数据。首屏就可以渲染，不用等第二个请求。
      const [settingsDoc,members,confirmed,anniversaries]=await Promise.all([
        get('settings','family'),all('members'),all('memories').then(list=>list.filter(m=>m.status==='confirmed')),all('anniversaries'),
      ]);
      const companion=settingsDoc?.companion||sanitizeCompanion({}, {});
      const threads=(await all('companion_threads')).filter(t=>t.userId===auth.user.id).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
      const thread=threads[0]||null;
      // 开场白要「有由头」：优先今天是个纪念日，其次随机一段自己的记忆。
      const mine=confirmed.filter(m=>(m.people||[]).includes(auth.user.name));
      const pool=mine.length?mine:confirmed;
      const opening=openingLine(companion,{memories:pool.length?[pool[Math.floor(Date.now()/86400000)%pool.length]]:[],anniversaries});
      return json({
        companion,opening,personas:PERSONAS,relations:RELATIONS,
        messages:thread?.messages||[],notes:thread?.notes||[],
        threadId:thread?.id||null,threadCount:threads.length,
        voiceMembers:members.filter(m=>m.voiceId).map(m=>({id:m.id,name:m.name})),
        aiEnabled:aiReady(),ai:aiStatus(),voiceEnabled:voiceConfigured(),memoryCount:pool.length,
      });
    }
    if(parts[0]==='role') {
      // 一屋子可以换的人。按「你心里堵着什么」分组，不按辈分排。
      if(parts[1]==='thread') {
        // 某个角色的对话记录。每个角色各聊各的，互不串味。
        const roleId=String(new URL(request.url).searchParams.get('roleId')||'');
        const role=ROLES.some(r=>r.id===roleId)?roleById(roleId):null;
        if(!role) return json({error:'没有这个角色'},404);
        const thread=await get('role_threads',`${auth.user.id}:${role.id}`);
        const setting=sanitizeRole({roleId:role.id,toneId:thread?.toneId,name:thread?.name,useMemories:thread?.useMemories});
        return json({
          role,setting,opening:roleOpening(role),
          messages:thread?.messages||[],threadId:thread?.id||null,
        });
      }
      const [confirmed,threads]=await Promise.all([
        all('memories').then(list=>list.filter(m=>m.status==='confirmed')),
        all('role_threads').then(list=>list.filter(t=>t.userId===auth.user.id)),
      ]);
      const mine=confirmed.filter(m=>(m.people||[]).includes(auth.user.name));
      return json({
        concerns:CONCERNS,tones:TONES,kinds:KINDS,
        // lines 是这个角色自己的话术池，不让前端拿到——它是「怎么说话」，不是展示内容。
        roles:ROLES.map(({lines,...rest})=>rest),
        threads:threads.map(t=>({roleId:t.roleId,toneId:t.toneId,name:t.name,useMemories:Boolean(t.useMemories),count:(t.messages||[]).length,updatedAt:t.updatedAt||null})),
        aiEnabled:aiReady(),ai:aiStatus(),memoryCount:(mine.length?mine:confirmed).length,
      });
    }
    // ── 全年龄段：人生阶段 / 成长时间轴 / 家庭平行时间轴 ──
    if(parts[0]==='stage') {
      if(parts[1]==='meta') {
        // 前端拿到阶段表、里程碑清单、成长对比问题就够了；
        // 采访问题库按阶段取，避免一次下发全部 21 条。
        return json({stages:STAGES,milestones:MILESTONES,growthQuestions:GROWTH_QUESTIONS});
      }
      if(parts[1]==='interview') {
        const stageId=String(new URL(request.url).searchParams.get('stage')||'');
        return json({stage:stageId,questions:INTERVIEW[stageId]||INTERVIEW.elder});
      }
      if(parts[1]==='timeline') {
        // A 成长时间轴：一个人从出生到现在。只能看已确认的记忆（草稿没核对过）。
        const memberId=String(new URL(request.url).searchParams.get('memberId')||'');
        const members=await all('members');const confirmed=(await all('memories')).filter(m=>m.status==='confirmed');
        const member=members.find(m=>m.id===memberId);
        if(member) return json(buildTimeline(member,confirmed.filter(m=>m.subjectId===member.id||m.people.includes(member.name))));
        // 没指定成员就给全家人各一条，按出生年排。
        return json({members:members.map(m=>buildTimeline(m,confirmed.filter(x=>x.subjectId===m.id||x.people.includes(m.name))))});
      }
      if(parts[1]==='parallel') {
        // E 家庭平行时间轴：同一年，全家人各几岁、那年发生了什么。
        const year=new URL(request.url).searchParams.get('year');
        const [members,confirmed]=await Promise.all([all('members'),all('memories').then(l=>l.filter(m=>m.status==='confirmed'))]);
        return json(buildParallel(members,confirmed,year));
      }
      if(parts[1]==='milestones') {
        const memberId=String(new URL(request.url).searchParams.get('memberId')||'');
        const record=await get('milestones',memberId)||{id:memberId,done:[]};
        return json({memberId,...milestoneProgress(record.done||[])});
      }
      if(parts[1]==='quotes') {
        // C 童言童语：按时间倒序，最新的在前面。
        const memberId=String(new URL(request.url).searchParams.get('memberId')||'');
        const list=(await all('quotes')).filter(q=>!memberId||q.memberId===memberId);
        return json({quotes:list.sort((a,b)=>String(b.saidAt||'').localeCompare(String(a.saidAt||''))).slice(0,200)});
      }
      if(parts[1]==='answers') {
        // H 成长对比：同一个问题，不同年份问同一个人。
        const memberId=String(new URL(request.url).searchParams.get('memberId')||'');
        const list=(await all('answers')).filter(a=>!memberId||a.memberId===memberId);
        return json({answers:list.sort((a,b)=>String(a.year||'0').localeCompare(String(b.year||'0')))});
      }
    }
    if(parts[0]==='capsules') {
      // I 时间胶囊：只列「我写的」和「到日子了写给全家的」。没到开启日期的不泄露内容。
      const now=new Date();
      const list=await all('capsules');
      return json({capsules:list.map(c=>{
        const state=capsuleState(c,now);
        return {...c,locked:state.locked,daysLeft:state.daysLeft,
          // 到期前包括作者在内都只看到信封，不下发正文。
          text:state.locked?'':c.text};
      }).sort((a,b)=>String(a.openAt||'').localeCompare(String(b.openAt||'')))});
    }
    if(parts[0]==='highlights') {
      // G 高光时刻：列全部，前端按成员过滤。模板定义一并下发，少一次请求。
      const list=await all('highlights');
      const members=await all('members');
      return json({templates:HIGHLIGHT_TEMPLATES,highlights:list.sort((a,b)=>String(b.year||'0').localeCompare(String(a.year||'0'))),
        members:members.map(m=>({id:m.id,name:m.name,color:m.color||'sage'}))});
    }
    if(parts[0]==='media') {
      const file=parts[1]||'';
      // 允许 base64url 字母表（生成的配音名是 voice-<base64url>）：
      // 原来只放行十六进制，导致所有合成音频的 URL 都被判「无效文件名」。
      // 仍然禁止点号与斜杠，杜绝 ../ 穿越。
      if(!/^[A-Za-z0-9_-]+\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(file)) return json({error:'无效文件名'},404);
      const upload=await get('uploads',file);
      // shared 标记的是「由系统生成、属于这家人的内容」（口述音频、生成的视频）：
      // 发起人生成一次，全家人都该能听能看，不该按上传者归属拦掉。
      // 归属判定走 uploads 集合单条查询，不再全表扫描 memories（旧实现每次媒体请求
      // 都把全部记忆拉出来逐条比对，记忆越多这条路径越慢）。
       const canReadUpload=upload?.shared||upload?.userId===auth.user.id;
       if(!canReadUpload&&!(await hasMemoryMediaRef(file,accountRole(auth.user,'editor')))) return json({error:'素材不存在'},404);
      const media=await readMedia(file,upload?.blobUrl);
      if(!media)return json({error:'素材不存在'},404);
      const ext=path.extname(file);
      const types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.webm':'video/webm','.mp4':'video/mp4'};
      const headers={'Content-Type':media.contentType||types[ext],'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Accept-Ranges':'bytes'};
      const range=request.headers.get('range');
      if(range) {
        // 流式 Range：只截取请求的区间，不把整段视频读进内存。
        const match=/^bytes=(\d+)-(\d*)$/.exec(range);
        if(!match) return new Response(null,{status:416,headers:{'Content-Range':'bytes */*'}});
        const start=Number(match[1]);
        const endHeader=match[2]?Number(match[2]):null;
        if(endHeader!==null&&endHeader<start) return new Response(null,{status:416,headers:{'Content-Range':'bytes */*'}});
        // 起点越界：流读完即空 → 回 416（浏览器会当作「区间不可满足」处理）。
        // 探针读一块再封成新流：probe reader 与 body reader 必须是同一个 reader，
        // 各调一次 getReader() 会得到两个独立读取位置（第二遍从头读导致死锁/断流）。
        const reader=streamSlice(media.data,start,endHeader).getReader();
        const probe=await reader.read();
        if(probe.done&&start>0) return new Response(null,{status:416,headers:{'Content-Range':'bytes */*'}});
        const body=new ReadableStream({start(c){if(!probe.done)c.enqueue(probe.value);},async pull(c){const r=await reader.read();if(r.done){c.close();return;}c.enqueue(r.value);},cancel(){reader.cancel().catch(()=>{});}});
        return new Response(body,{status:206,headers:{...headers,'Content-Range':`bytes ${start}-/*`}});
      }
      return new Response(media.data,{headers});
    }
    return json({error:'页面不存在'},404);
  } catch(e) {return bad(e,parts[0]==='media'?404:500);}
}

export async function POST(request,{params}) {
  const {path:parts}=await params;
  try {
    const originError=ensureOrigin(request);if(originError)return originError;
    if(parts[0]==='upload'&&parts[1]==='token') {
      if(!usesRemoteStorage)return json({error:'当前未启用 Vercel Blob'},404);
      const body=await request.json();
      let user=null;
      if(body.type==='blob.generate-presigned-url') {
        const auth=await guard(request,'editor');if(auth.error)return auth.error;
        user=auth.user;
      }
      const result=await handleUploadPresigned({
        request,
        body,
        getSignedToken:async pathname=>{
          if(!user||!validBlobPath(pathname))throw new Error('上传请求无效');
          const constraints={allowedContentTypes:Object.keys(allowed),maximumSizeInBytes:50*1024*1024};
          const token=await issueSignedToken({...constraints,pathname,operations:['put'],validUntil:Date.now()+15*60*1000});
          await put('uploads',{id:path.basename(pathname),userId:user.id,blobPath:pathname,blobUrl:null,createdAt:new Date().toISOString()});
          return {token,urlOptions:{...constraints,addRandomSuffix:false,allowOverwrite:false,tokenPayload:JSON.stringify({userId:user.id})}};
        },
        onUploadCompleted:async({blob,tokenPayload})=>{
          const payload=JSON.parse(tokenPayload||'{}');
          const name=path.basename(blob.pathname);
          if(!payload.userId||!validBlobPath(blob.pathname))throw new Error('上传回执无效');
          const upload=await get('uploads',name);
          if(upload?.userId===payload.userId)await put('uploads',{...upload,blobUrl:blob.url,contentType:blob.contentType});
        },
      });
      return json(result);
    }
    if(parts[0]==='upload'&&parts[1]==='complete') {
      if(!usesRemoteStorage)return json({error:'当前未启用 Vercel Blob'},404);
      const auth=await guard(request,'editor');if(auth.error)return auth.error;
      const {pathname}=await request.json();
      if(!validBlobPath(pathname))throw new Error('上传请求无效');
      const name=path.basename(pathname),upload=await get('uploads',name);
      if(upload?.userId!==auth.user.id)return forbidden();
      // Verify storage before reporting success; the webhook may arrive later.
      const blob=await headBlob(pathname);
      await put('uploads',{...upload,blobUrl:blob.url,contentType:blob.contentType});
      return json({url:`/api/media/${name}`});
    }
    if(parts[0]==='auth') {
      if(parts[1]==='setup') {
        const body=await request.json();
        if(await hasAdmin())return forbidden();
        const user=await createUser(body,'admin');
        return setSessionCookie(json({user},201),await createSession(user.id),request);
      }
      if(parts[1]==='login') {
        const body=await request.json();const user=await authenticate(body.email,body.password);
        return setSessionCookie(json({user}),await createSession(user.id),request);
      }
      if(parts[1]==='register') {
        if(!await hasAdmin())throw new Error('请先创建管理员账号');
        const body=await request.json();
        const code=String(body.code||'').trim();
        // 邀请码自带角色：管理员邀请码建管理员，编辑/查看者邀请码按原角色加入。
        // 注意这里**不能**在没有邀请码时直接 createUser(...,'admin')：那等于给
        // 任何匿名访客开了一条「自己注册成管理员」的路。首个管理员只走 /auth/setup。
        if(!code) throw new Error('请填写家庭邀请码');
        const user=await acceptInvite(code,body);
        return setSessionCookie(json({user},201),await createSession(user.id),request);
      }
      if(parts[1]==='logout') {
        await revokeSession(request);return clearSessionCookie(json({ok:true}));
      }
    }
    const auth=await guard(request);if(auth.error)return auth.error;
    if(parts[0]==='auth'&&parts[1]==='invite') {
      if(auth.user.role!=='admin')return forbidden();
      const body=await request.json();return json(await issueInvite(body.role));
    }
    // 写操作统一按白名单放行「任何已登录用户都能用」的接口，其余一律要求 editor。
    // 反过来写（黑名单列 editor 接口）会让以后新增的接口默认对所有登录用户开放，
    // 直到有人想起把它加进数组——voice/enroll 就是这样裸奔过的。新接口必须先在这里登记。
    // narrate 对 viewer 开放的是「听」：/narrate/script 写稿+配音只花几毛钱，看的人也该能听。
    // 真正按秒计费的 /narrate/video 在分支里单独再要一次 editor。
    const openToViewer=['activity','auth','capsules','comments','companion','game','highlights','life','narrate','role','stage','voice'].includes(parts[0]);
    if(!openToViewer&&!accountRole(auth.user,'editor'))return forbidden();
    if(parts[0]==='upload') {
      const contentLength=Number(request.headers.get('content-length')||0);
      if(contentLength>52*1024*1024) throw new Error('文件不能超过 50 MB');
      const form=await request.formData(); const file=form.get('file');
      if(!file||typeof file==='string'||!file.size) throw new Error('请选择一个文件');
      const extension=allowed[file.type];
      if(!extension) throw new Error('支持 JPG / PNG / WebP 图片，MP3 / WAV / M4A / OGG / WebM 音频和 MP4 / WebM 视频');
      if(file.size>50*1024*1024) throw new Error('文件不能超过 50 MB');
      const name=randomUUID()+extension;
      const stored=await saveMedia(name,Buffer.from(await file.arrayBuffer()),file.type);
      await put('uploads',{id:name,userId:auth.user.id,blobUrl:stored.blobUrl,blobPath:stored.blobPath,contentType:file.type,createdAt:new Date().toISOString()});
      return json({url:`/api/media/${name}`,type:file.type,name:file.name});
    }
    const body=await request.json();
    if(parts[0]==='comments') {
      const memory=await get('memories',body.memoryId);if(!memory) throw new Error('记忆不存在');
      const comment=String(body.text||'').trim().slice(0,1000);if(!comment) throw new Error('请输入留言');
      const activity={id:randomUUID(),familyId:'family',userId:auth.user.id,type:'comment',text:`给「${memory.title}」留下了留言`,comment,memoryId:memory.id,createdAt:new Date().toISOString()};
      return json(await put('activity',activity),201);
    }
    if(parts[0]==='memories') {
      // subjectId（这段是谁的回忆）由 tidyMemory 收好了，这里只补「谁记下的」。
      const memory=tidyMemory(body);
      memory.recorderId=auth.user.id;
      for(const key of ['cover','audio','video']) if(body[key]) {
        if(!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
        memory[key]=body[key];
      }
      if(memory.cover) memory.assetType='photo';
      memory.id=randomUUID();memory.familyId='family';memory.createdAt=new Date().toISOString();memory.updatedAt=memory.createdAt;memory.isDemo=false;
      await put('memories',memory);await log('created',`添加了记忆「${memory.title}」`,memory.id);
      return json(memory,201);
    }
    if(parts[0]==='organize') {
      let imageData=null;
      if(body.cover&&/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(body.cover)&&process.env.AI_API_KEY) {
        const name=path.basename(body.cover);
        const media=await readMediaBuffer(name,(await get('uploads',name))?.blobUrl);
        if(!media)throw new Error('图片素材不存在');
        if(media.data.length>8*1024*1024) throw new Error('模型整理使用的图片请控制在 8 MB 以内');
        const ext=path.extname(body.cover);imageData=`data:${ext==='.jpg'?'image/jpeg':ext==='.png'?'image/png':'image/webp'};base64,${media.data.toString('base64')}`;
      }
      return json(await organize(body,imageData));
    }
    if(parts[0]==='albums') {
      const title=String(body.title||'').trim().slice(0,80);if(!title) throw new Error('请填写专辑名称');
      const ids=[...new Set(body.memoryIds||[])];
      const selected=await Promise.all(ids.map(id=>get('memories',id)));
      const validIds=ids.filter((id,index)=>selected[index]?.status==='confirmed');
      if(!validIds.length) throw new Error('请至少选择一段已确认的记忆');
      const album={id:randomUUID(),familyId:'family',title,description:String(body.description||'').slice(0,200),memoryIds:validIds,cover:selected[ids.indexOf(validIds[0])].cover,story:'',createdAt:new Date().toISOString()};
      await put('albums',album);await log('album',`创建了专辑「${title}」`);return json(album,201);
    }
    if(parts[0]==='story') {
      // 两条路：传 albumId 走专辑（专辑页用），直接传 memoryIds 走「成长纪念册」——
      // 纪念册是一次性的排版产物，不该为了串一次就建一张永远留着的专辑。
      let memories=[],title=String(body.title||'').trim().slice(0,80);
      if(body.albumId) {
        const album=await get('albums',body.albumId); if(!album) throw new Error('专辑不存在');
        memories=(await Promise.all(album.memoryIds.map(id=>get('memories',id)))).filter(m=>m?.status==='confirmed');
        if(!memories.length) throw new Error('这张专辑还没有已确认的记忆');
        title=album.title;
      }else{
        const ids=Array.isArray(body.memoryIds)?body.memoryIds.filter(Boolean).slice(0,24):[];
        if(!ids.length) throw new Error('先挑几段记忆');
        memories=(await Promise.all(ids.map(id=>get('memories',id)))).filter(m=>m?.status==='confirmed');
        if(!memories.length) throw new Error('挑中的记忆都还没经过家属核对');
      }
      return json(await generateStory(memories,title));
    }
    // ── 全年龄段的写接口 ──
    // 这些都走 openToViewer：家里的任何一个人都能给孩子记一句话、勾一个里程碑、
    // 写一封时间胶囊。真正要花钱的（声音复刻、图生视频）仍然单独要求 editor。
    if(parts[0]==='stage') {
      if(parts[1]==='milestones') {
        const memberId=String(body.memberId||'');if(!memberId) throw new Error('先选一位家人');
        const key=String(body.key||'');
        if(!MILESTONES.some(m=>m.key===key)) throw new Error('没有这个里程碑');
        const old=await get('milestones',memberId)||{id:memberId,done:[]};
        const done=body.done?[...new Set([...(old.done||[]),key])]:(old.done||[]).filter(k=>k!==key);
        await put('milestones',{...old,id:memberId,done});
        if(body.done) await log('milestone',`记下了一个里程碑：${MILESTONES.find(m=>m.key===key).label}`);
        return json({...milestoneProgress(done),memberId});
      }
      if(parts[1]==='quotes') {
        const quote={...sanitizeQuote(body),id:randomUUID(),familyId:'family',userId:auth.user.id,createdAt:new Date().toISOString()};
        await put('quotes',quote);
        await log('quote',`记下了一句童言童语`);
        return json(quote,201);
      }
      if(parts[1]==='answers') {
        const key=String(body.key||'');if(!GROWTH_QUESTIONS.some(q=>q.key===key)) throw new Error('没有这个问题');
        const answer=String(body.answer||'').trim().slice(0,300);if(!answer) throw new Error('先写下答案');
        const record={id:randomUUID(),familyId:'family',memberId:String(body.memberId||''),key,answer,
          year:/^\d{4}$/.test(String(body.year||''))?String(body.year):new Date().getFullYear().toString(),
          createdAt:new Date().toISOString()};
        await put('answers',record);return json(record,201);
      }
    }
    if(parts[0]==='capsules') {
      const capsule={...sanitizeCapsule(body),id:randomUUID(),familyId:'family',authorId:auth.user.id,createdAt:new Date().toISOString()};
      await put('capsules',capsule);
      await log('capsule',`写了一封时间胶囊，将在 ${capsule.openAt} 开启`);
      return json(capsule,201);
    }
    if(parts[0]==='highlights') {
      // G 高光时刻：一次郑重其事的记录，值得单独存、单独展示。
      const highlight={...sanitizeHighlight(body),id:randomUUID(),familyId:'family',userId:auth.user.id,createdAt:new Date().toISOString()};
      // 挂上主图：允许从已有记忆里选一段（存 memoryId），前端只展示已确认的记忆作候选。
      if(body.memoryId) {
        const memory=await get('memories',String(body.memoryId));
        if(!memory||memory.status!=='confirmed') throw new Error('主图对应的记忆不存在或还没确认');
        highlight.memoryId=memory.id;
      }
      await put('highlights',highlight);
      await log('highlight',`记下一个高光时刻：${HIGHLIGHT_TEMPLATES.find(t=>t.id===highlight.template).label}`);
      return json(highlight,201);
    }
    if(parts[0]==='activity') {
      const types={play:'播放',remember:'点击了「我记得」',like:'点击了「喜欢」',replay:'点击了「再听一次」',pause:'暂停了播放'};
      if(!types[body.type]) throw new Error('不支持的互动类型');
      const memory=await get('memories',body.memoryId);if(!memory||memory.status!=='confirmed') throw new Error('记忆不可播放');
      return json(await log(body.type,`${types[body.type]}「${memory.title}」`,memory.id));
    }
    if(parts[0]==='life'&&parts[1]==='subjects') {
      // 人生推演的开局入口：列出「可以从哪一段记忆开始」。
      // 只认已确认的记忆——草稿还没被家属核对过，不能拿来当人生起点。
      const confirmed=(await all('memories')).filter(m=>m.status==='confirmed');
      const members=await all('members');
      const origins=confirmed
        .filter(m=>String(m.story||m.title||'').trim())
        .map(m=>({id:m.id,title:m.title,year:m.year||'',location:m.location||'',people:m.people||[],theme:m.theme,cover:m.cover||null,excerpt:String(m.story||'').slice(0,120)}))
        .sort((a,b)=>String(b.year||'0').localeCompare(String(a.year||'0')));
      return json({origins,members:members.map(m=>({id:m.id,name:m.name,relation:m.relation||'家人'})),stats:STAT_META,maxStages:MAX_STAGES,maxChoiceText:MAX_CHOICE_TEXT,aiReady:aiReady()});
    }
    if(parts[0]==='life'&&parts[1]==='start') {
      // 从一段记忆往后推演。起点是事实，往后全是「如果」。
      const memory=await get('memories',String(body.memoryId||''));
      if(!memory) throw new Error('没有找到这段记忆');
      if(memory.status!=='confirmed') throw new Error('这段记忆还没有经过家属核对，先确认再拿它开局');
      const subjectName=String(body.subjectName||memory.people?.[0]||'这位家人').slice(0,40);
      const run=startRun({memory,subjectName});
      const stage=await nextStage(run);
      const record={...run,id:randomUUID(),familyId:'family',userId:auth.user.id,stages:[stage],createdAt:new Date().toISOString()};
      await put('life_runs',record);
      // 只留最近的几局：每局带八幕全文，不清理会一直堆。
      const mine=(await all('life_runs')).filter(r=>r.userId===auth.user.id);
      for(const stale of mine.slice(8)) await remove('life_runs',stale.id);
      return json(publicRun(record),201);
    }
    if(parts[0]==='life'&&parts[1]==='turn') {
      // 一次选择。玩家可以选预设选项，也可以自己写「我想……」。
      const record=await get('life_runs',String(body.runId||''));
      if(!record) throw new Error('这一局已经不在了，重新开一局吧');
      if(record.userId!==auth.user.id) return forbidden();
      if(record.status!=='playing') throw new Error('这一局已经走完了');
      const stage=currentStage(record);
      if(!stage) throw new Error('这一幕还没准备好');
      const freeText=body.choiceId?null:String(body.text||'').trim().slice(0,MAX_CHOICE_TEXT);
      if(!body.choiceId&&!freeText) throw new Error('选一个，或者写一句你想怎么做');
      // 自由输入：先让模型写下一幕，它顺带判定那句话落到了哪几个属性上。
      // 先不落库，等选择和这一幕一起写回去，避免出现「选了但没生成」的半截状态。
      const upcoming=await nextStage(record,{freeText});
      const moved=recordChoice(record,{choiceId:body.choiceId,text:freeText,freeDeltas:upcoming.freeDeltas});
      const lastPicked=moved.stages[moved.stageIndex-1]?.answer||null;
      if(moved.status==='finished') {
        const done=await finishRun(moved);
        await put('life_runs',done);
        await log('game',`走完了一段「如果」：${done.subjectName}的另一条路`);
        return json({...publicRun(done),reveal:lastPicked});
      }
      const updated={...moved,stages:[...moved.stages,upcoming]};
      await put('life_runs',updated);
      return json({...publicRun(updated),reveal:lastPicked});
    }
    if(parts[0]==='companion'&&parts[1]==='turn') {
      // 一次对话回合。事实只有一个来源：confirmed 记忆里检索出来的那几条，
      // 检索结果随回复一起回给前端，用户可以点进去核对原文。
      const raw=String(body.text||'').trim().slice(0,MAX_TEXT);
      if(!raw) throw new Error('说点什么吧');
      const settingsDoc=await get('settings','family');
      const companion=settingsDoc?.companion||sanitizeCompanion({},{});
      const confirmed=(await all('memories')).filter(m=>m.status==='confirmed');
      const memories=retrieveMemories(confirmed,raw,3);
      let thread=body.threadId?await get('companion_threads',String(body.threadId)):null;
      if(thread&&thread.userId!==auth.user.id) return forbidden();
      if(!thread) thread={id:randomUUID(),familyId:'family',userId:auth.user.id,messages:[],notes:[],createdAt:new Date().toISOString()};
      // 不再有本地兜底：模型没答上来就如实报错，绝不拿模板话冒充它。
      const reply=await chatWithCompanion(buildMessages(companion,{history:thread.messages,text:raw,memories,notes:thread.notes}));
      const answer={text:reply,mode:'model',memoryIds:memories.map(m=>m.id)};
      const messages=[...thread.messages,{role:'user',text:raw,at:new Date().toISOString()},{role:'companion',text:answer.text,at:new Date().toISOString(),mode:answer.mode}];
      // 超长的对话折进 notes：不删用户的话，只是不再逐条发给模型。
      const trimmed=messages.length>MAX_MESSAGES?messages.slice(-MAX_MESSAGES):messages;
      const notes=messages.length>MAX_MESSAGES?localNotes(messages.slice(0,-MAX_MESSAGES),thread.notes):thread.notes;
      const updated={...thread,messages:trimmed,notes:notes.slice(-MAX_NOTES),updatedAt:new Date().toISOString()};
      await put('companion_threads',updated);
      return json({
        messages:trimmed.slice(-2),notes:updated.notes,threadId:updated.id,
        mode:answer.mode,
        sources:memories.map(m=>({id:m.id,title:m.title,year:m.year,location:m.location})),
      },201);
    }
    if(parts[0]==='companion'&&parts[1]==='reset') {
      // 换一个话题：把当前这段聊完的记录收起来，下次从干净的对话开始。
      // 记事本（notes）保留——「记得你」这件事不该被一次换话题抹掉。
      const thread=body.threadId?await get('companion_threads',String(body.threadId)):null;
      if(thread&&thread.userId!==auth.user.id) return forbidden();
      if(thread) await put('companion_threads',{...thread,messages:[],updatedAt:new Date().toISOString()});
      return json({ok:true});
    }
    if(parts[0]==='companion'&&parts[1]==='config') {
      // 改家伴的名字/性格/关系。写进 settings，整家人共用同一个家伴——
      // 这是「家庭共享空间」的一部分，不按账号各养一只。
      if(!accountRole(auth.user,'editor')) return forbidden();
      const settingsDoc=await get('settings','family');
      const companion=sanitizeCompanion(body,settingsDoc?.companion||{});
      const updated={...settingsDoc,companion};
      await put('settings',updated);
      return json({companion},201);
    }
    if(parts[0]==='role'&&parts[1]==='turn') {
      // 一次换角色对话。记忆是「可选的」：用户主动勾了「借用家里这段记忆」才喂进去，
      // 默认只当身份原型说话——找人聊心事先别急着翻旧账。
      const raw=String(body.text||'').trim().slice(0,ROLE_MAX_TEXT);
      if(!raw) throw new Error('说点什么吧');
      const setting=sanitizeRole({roleId:body.roleId,toneId:body.toneId,name:body.name,useMemories:body.useMemories});
      const id=`${auth.user.id}:${setting.roleId}`;
      let thread=await get('role_threads',id);
      const memories=setting.useMemories?retrieveMemories((await all('memories')).filter(m=>m.status==='confirmed'),raw,2):[];
      const history=thread?.messages||[];
      // 不再有本地兜底：模型没答上来就如实报错。
      const reply=await chatWithRole(buildRoleMessages(setting,{history,text:raw,memories}));
      const answer={text:reply,mode:'model',memoryIds:memories.map(m=>m.id)};
      const now=new Date().toISOString();
      const messages=[...history,{role:'user',text:raw,at:now},{role:'role',text:answer.text,at:now,mode:answer.mode}];
      const trimmed=messages.length>MAX_MESSAGES?messages.slice(-MAX_MESSAGES):messages;
      const updated={...(thread||{id:`${auth.user.id}:${setting.roleId}`,familyId:'family',userId:auth.user.id,createdAt:now}),roleId:setting.roleId,toneId:setting.toneId,name:setting.name,useMemories:setting.useMemories,messages:trimmed,updatedAt:now};
      await put('role_threads',updated);
      return json({
        messages:trimmed.slice(-2),setting,threadId:updated.id,
        mode:answer.mode,
        sources:memories.map(m=>({id:m.id,title:m.title,year:m.year,location:m.location})),
      },201);
    }
    if(parts[0]==='role'&&parts[1]==='reset') {
      // 换个人聊，或者跟同一个人重新开始：只清这段对话，设定保留。
      const roleId=String(body.roleId||'');
      const id=`${auth.user.id}:${roleId}`;
      const thread=await get('role_threads',id);
      if(thread) await put('role_threads',{...thread,messages:[],updatedAt:new Date().toISOString()});
      return json({ok:true});
    }
    if(parts[0]==='members') {
      const name=String(body.name||'').trim().slice(0,30);if(!name) throw new Error('请填写成员姓名');
      // birthYear 是全年龄段功能的地基：有了它才能算「那年你几岁」。
      const birthYear=sanitizeBirthYear(body.birthYear);
      const member={id:randomUUID(),familyId:'family',name,relation:String(body.relation||'家人').slice(0,30),role:'家庭成员',color:'sage',birthYear};
      await put('members',member);return json(member,201);
    }
    if(parts[0]==='anniversaries') {
      const title=String(body.title||'').trim().slice(0,80);const date=String(body.date||'');
      if(!title||!/^\d{2}-\d{2}$/.test(date)) throw new Error('请填写名称并选择日期');
      const [month,day]=date.split('-').map(Number);const d=new Date(2024,month-1,day);
      if(d.getMonth()!==month-1||d.getDate()!==day) throw new Error('日期不合法');
      return json(await put('anniversaries',{id:randomUUID(),familyId:'family',title,date,memoryIds:[]}));
    }
    if(parts[0]==='voice'&&parts[1]==='enroll') {
      if(!voiceConfigured())return json({error:'未配置声音合成服务，请联系管理员'},503);
      // 复刻声音会在服务商侧付费生成音色，只有编辑者能发起；
      // 且 consent 必须由界面真实勾选后由服务端判定，不接受调用方自填 true。
      if(!accountRole(auth.user,'editor'))return forbidden();
      const {memberId,audioUrl,consent}=body;
      if(!memberId||!audioUrl) throw new Error('缺少成员或录音');
      const member=await get('members',memberId);if(!member) throw new Error('成员不存在');
      if(consent!==true) throw new Error('必须本人明确同意才能复刻声音');
      let source=audioUrl;
      if(typeof audioUrl==='string'&&audioUrl.startsWith('/api/media/')) {
        const name=audioUrl.split('/').pop();
        const upload=await get('uploads',name);
        if(!upload?.blobUrl) throw new Error('声音复刻需要 Vercel Blob 存储支持；请确认已连接 Blob 后重试。');
        source=upload.blobUrl;
      }
      const result=await enrollVoice({memberId,audioUrl:source,consent});
      const updated={...member,voiceId:result.voiceId,voiceStatus:'ready',voiceEnrolledAt:new Date().toISOString(),voiceConsent:Boolean(consent)};
      await put('members',updated);
      return json(updated,201);
    }
    if(parts[0]==='voice'&&parts[1]==='speak') {
      if(!voiceConfigured())return json({error:'未配置声音合成服务，请联系管理员'},503);
      const {memberId,text,options}=body;
      // 按量计费接口：限制单次文本长度，避免一次请求塞进整本书。
      if(!text||!text.trim()) throw new Error('合成文本为空');
      if(text.length>2000) throw new Error('合成文本不能超过 2000 字');
      let member=null;
      if(memberId){member=await get('members',memberId);}
      if(!member||!member.voiceId) return json({error:'该成员尚未复刻声音',voiceId:null},404);
      const key=cacheKey(member.voiceId,text,options||{});
      const cached=await get('voice_cache',key);
      if(cached?.blobUrl) return json({audioUrl:mediaUrl(cached.id||key),cached:true,voiceId:member.voiceId});
      const {audioUrl,format}=await synthesizeVoice({voiceId:member.voiceId,text,options});
      // 落盘到 Blob 再缓存：无论返回内联 base64 还是临时签名 url，都转成稳定的地址，
      // 避免重复计费与临时 url 失效。
      const buffer=audioUrl.startsWith('data:')?Buffer.from(audioUrl.split(',')[1],'base64'):await fetchAudioBuffer(audioUrl);
      const name=`voice-${key}.${format}`;
      await saveGenerated(name,buffer,`audio/${format}`,auth.user.id);
      await put('voice_cache',{id:key,memberId:member.id,voiceId:member.voiceId,text:text.slice(0,200),name,blobUrl:null,format,createdAt:new Date().toISOString()});
      // 远程存储给的是私有 Blob 地址，浏览器不能直接播；统一走我们自己的 /api/media 网关。
      return json({audioUrl:mediaUrl(name),cached:false,voiceId:member.voiceId});
    }
    if(parts[0]==='narrate'&&parts[1]==='script') {
      // 写口述稿并立刻配音。两条都是一次性开销，命中缓存则不重复花钱。
      const {memoryId,memberId,force}=body;
      const memory=await get('memories',memoryId);
      if(!memory) throw new Error('没有找到这段记忆');
      if(memory.status!=='confirmed'&&!accountRole(auth.user,'editor')) throw new Error('这段记忆还没有经过家属核对，先确认再让它开口');
      const members=await all('members');
      const narrator=memberId?members.find(m=>m.id===memberId):pickNarrator(memory,members);
      if(!narrator) throw new Error('还没有家人复刻过声音。先给一位家人复刻声音，再让 TA 来讲。');
      if(!narrator.voiceId) throw new Error(`${narrator.name} 还没有复刻声音`);
      const nKey=narrationKey(memory.id,narrator.id,memory.updatedAt||memory.createdAt||'');
      const existing=await get('narrations',nKey);
      // 稿子已经写过就别再花钱重写。没配声音服务时 audioUrl 本来就是空的，
      // 不能因此判定「没生成过」——否则每点一次都要再跑一遍模型。
      if(existing?.script&&!force&&(existing.audioUrl||!voiceConfigured())) {
        return json({script:existing.script,audioUrl:existing.audioUrl||null,narrator:{id:narrator.id,name:narrator.name},cached:true,voiceId:narrator.voiceId,warning:existing.audioUrl?undefined:'未配置声音合成服务，只用文字展示'});
      }
      const script=await generateNarration(memory,narrator.name);
      if(!voiceConfigured()) {
        // 稿子能写，但没配声音服务：先把稿子给出去，别让用户的等待白费。
        await put('narrations',{id:nKey,memoryId:memory.id,memberId:narrator.id,script,narratorName:narrator.name,audioUrl:null,createdAt:new Date().toISOString()});
        return json({script,audioUrl:null,narrator:{id:narrator.id,name:narrator.name},cached:false,voiceId:narrator.voiceId,warning:'未配置声音合成服务，只用文字展示'});
      }
      const key=cacheKey(narrator.voiceId,script,{});
      const cachedAudio=await get('voice_cache',key);
      let audioUrl=cachedAudio?.name?mediaUrl(cachedAudio.name):null;
      if(!audioUrl) {
        const synth=await synthesizeVoice({voiceId:narrator.voiceId,text:script,options:{}});
        const buffer=synth.audioUrl.startsWith('data:')?Buffer.from(synth.audioUrl.split(',')[1],'base64'):await fetchAudioBuffer(synth.audioUrl);
        const name=`voice-${key}.${synth.format}`;
        await saveGenerated(name,buffer,`audio/${synth.format}`,auth.user.id);
        await put('voice_cache',{id:key,memberId:narrator.id,voiceId:narrator.voiceId,text:script.slice(0,200),name,blobUrl:null,format:synth.format,createdAt:new Date().toISOString()});
        audioUrl=mediaUrl(name);
      }
      await put('narrations',{id:nKey,memoryId:memory.id,memberId:narrator.id,script,narratorName:narrator.name,audioUrl,voiceId:narrator.voiceId,createdAt:new Date().toISOString()});
      return json({script,audioUrl,narrator:{id:narrator.id,name:narrator.name},cached:false,voiceId:narrator.voiceId});
    }
    if(parts[0]==='narrate'&&parts[1]==='video') {
      // 付费接口，单独再要一次 editor：白名单里 narrate 对 viewer 开放的是「听」。
      if(!accountRole(auth.user,'editor'))return forbidden();
      if(!videoConfigured()) return json({error:'未配置视频生成服务，请联系管理员'},503);
      const {memoryId,force,resolution,duration}=body;
      const memory=await get('memories',memoryId);
      if(!memory) throw new Error('没有找到这段记忆');
      if(!memory.cover?.startsWith('/api/media/')) throw new Error('这段记忆还没有照片，动起来需要一张封面');
      const members=await all('members');
      const narrator=pickNarrator(memory,members);
      if(!narrator?.voiceId) throw new Error('还没有家人复刻过声音。先让一位家人讲这段记忆，再让它动起来。');
      const nKey=narrationKey(memory.id,narrator.id,memory.updatedAt||memory.createdAt||'');
      const narration=await get('narrations',nKey);
      if(!narration?.script) throw new Error('先让 TA 把这段回忆讲一遍，再来让它动起来');
      const res=clampResolution(resolution),secs=clampSeconds(duration);
      const vKey=videoKey({memoryId:memory.id,memberId:narrator.id,voiceId:narrator.voiceId,script:narration.script,resolution:res,duration:secs});
      const existing=await get('memory_videos',vKey);
      if(existing?.status==='ready'&&existing.name) return json({status:'ready',url:mediaUrl(existing.name),resolution:existing.resolution,duration:existing.duration,cached:true});
      if(existing?.status==='pending'&&existing.taskId) return json({status:'pending',taskId:vKey,resolution:existing.resolution,duration:existing.duration,cached:true});
      // 把封面图读成 data URI 传给 DashScope：我们的媒体是私有 Blob，公网 url 传不过去。
      const coverFile=path.basename(memory.cover);
      const upload=await get('uploads',coverFile);
      const media=await readMediaBuffer(coverFile,upload?.blobUrl);
      if(!media) throw new Error('读不到这段记忆的封面照片');
      if(media.data.length>MAX_IMAGE_BYTES) throw new Error('封面照片超过 4 MB，先换一张小一点的再试');
      const mime=media.contentType||(coverFile.endsWith('.png')?'image/png':coverFile.endsWith('.webp')?'image/webp':'image/jpeg');
      const imageDataUri=`data:${mime};base64,${media.data.toString('base64')}`;
      const created=await createVideoTask({imageDataUri,prompt:buildVideoPrompt(memory),resolution:res,duration:secs});
      const record={id:vKey,memoryId:memory.id,memoryTitle:memory.title||'',memberId:narrator.id,voiceId:narrator.voiceId,scriptHash:narration.script.length,taskId:created.taskId,status:'pending',resolution:res,duration:secs,userId:auth.user.id,createdAt:new Date().toISOString()};
      await put('memory_videos',record);
      return json({status:'pending',taskId:vKey,resolution:res,duration:secs,cached:false},202);
    }
    return json({error:'接口不存在'},404);
  }catch(e){return bad(e);}
}

export async function PATCH(request,{params}) {
  const {path:parts}=await params;
  try {
    const originError=ensureOrigin(request);if(originError)return originError;
    // 个性化偏好：任何已登录用户都能修改「自己」的偏好（不分角色）。
    if(parts[0]==='auth'&&parts[1]==='preferences') {
      const authSelf=await guard(request);if(authSelf.error)return authSelf.error;
      const body=await request.json().catch(()=>({}));
      const user=await get('users',authSelf.user.id);if(!user)return json({error:'账号不存在'},404);
      const prefs=sanitizePreferences({...user.preferences,...body});
      const updated={...user,preferences:prefs};
      await put('users',updated);
      return json({preferences:prefs});
    }
    const auth=await guard(request,'editor');if(auth.error)return auth.error;
    const body=await request.json();
    if(parts[0]==='memories') {
      const old=await get('memories',parts[1]);if(!old) return json({error:'记忆不存在'},404);
      const updated={...old,...tidyMemory(body,old),updatedAt:new Date().toISOString()};
      for(const key of ['cover','audio','video']) if(body[key] && body[key]!==old[key]) {
        if(!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
        updated[key]=body[key];
      }
      if(updated.cover?.startsWith('/api/media/')) updated.assetType='photo';
      if(body.clearAudio) updated.audio=null;
      if(body.clearVideo) updated.video=null;
      await put('memories',updated);return json(updated);
    }
    if(parts[0]==='members') {
      // 补出生年份：全年龄段功能的地基，缺了它就算不出「那年几岁」。
      const old=await get('members',parts[1]);if(!old) throw new Error('成员不存在');
      const patch={...old};
      if(body.name!==undefined){const name=String(body.name||'').trim().slice(0,30);if(!name) throw new Error('请填写成员姓名');patch.name=name;}
      if(body.birthYear!==undefined) patch.birthYear=sanitizeBirthYear(body.birthYear);
      if(body.relation!==undefined) patch.relation=String(body.relation||'').slice(0,30);
      if(body.color!==undefined&&['sage','peach','lavender','blue','gold'].includes(body.color)) patch.color=body.color;
      await put('members',patch);return json(patch);
    }
    if(parts[0]==='settings') {
      const old=await get('settings','family');
      const update={...old,familyName:String(body.familyName??old.familyName).trim().slice(0,60)||old.familyName,fontSize:['large','extra'].includes(body.fontSize)?body.fontSize:old.fontSize,highContrast:Boolean(body.highContrast??old.highContrast),autoPlay:Boolean(body.autoPlay??old.autoPlay),speechRate:Math.min(1.2,Math.max(0.5,Number(body.speechRate??old.speechRate)||0.85))};
      return json(await put('settings',update));
    }
    if(parts[0]==='albums') {
      const old=await get('albums',parts[1]);if(!old) throw new Error('专辑不存在');
      return json(await put('albums',{...old,story:String(body.story??old.story).slice(0,10000)}));
    }
    return json({error:'接口不存在'},404);
  }catch(e){return bad(e);}
}

export async function DELETE(request,{params}) {
  const {path:parts}=await params;
  try {
    const originError=ensureOrigin(request);if(originError)return originError;
    if(parts[0]==='auth'&&parts[1]==='accounts') {
      const auth=await guard(request);if(auth.error)return auth.error;
      if(auth.user.role!=='admin')return forbidden();
      const target=await get('users',parts[2]);if(!target)return json({error:'账号不存在'},404);
      if(target.role==='admin')throw new Error('不能删除管理员账号');
      for(const session of await all('sessions'))if(session.userId===target.id)await remove('sessions',session.id);
      await remove('users',target.id);return json({ok:true});
    }
    if(parts[0]==='capsules') {
      const auth=await guard(request);if(auth.error)return auth.error;
      const capsule=await get('capsules',parts[1]);if(!capsule)return json({error:'内容不存在'},404);
      if(capsule.authorId!==auth.user.id&&!accountRole(auth.user,'editor'))return forbidden();
      await remove('capsules',capsule.id);return json({ok:true});
    }
    const auth=await guard(request,'editor');if(auth.error)return auth.error;
    if(!['memories','albums','members','anniversaries','quotes','answers','highlights'].includes(parts[0])) return json({error:'接口不存在'},404);
    const old=await get(parts[0],parts[1]);if(!old) return json({error:'内容不存在'},404);
    if(parts[0]==='members'&&old.role==='管理员') throw new Error('比赛版请保留管理员');
    await remove(parts[0],parts[1]);
    if(parts[0]==='memories') {
      for(const album of await all('albums')) if(album.memoryIds.includes(old.id)) {
        const ids=album.memoryIds.filter(id=>id!==old.id);await put('albums',{...album,memoryIds:ids,cover:ids.length?(await get('memories',ids[0]))?.cover:null,story:''});
      }
      for(const key of ['cover','audio','video']) if(old[key]?.startsWith('/api/media/')) {
        const file=path.basename(old[key]);if(!await isManagedMedia(file)){const upload=await get('uploads',file);await deleteMedia(file,upload?.blobUrl);await remove('uploads',file);}
      }
      for(const record of await all('activity')) if(record.memoryId===old.id) await remove('activity',record.id);
    }
    return json({ok:true});
  }catch(e){return bad(e);}
}
