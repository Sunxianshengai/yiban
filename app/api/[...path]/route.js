import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { handleUploadPresigned } from '@vercel/blob/client';
import { head as headBlob, issueSignedToken } from '@vercel/blob';
import { all,get,put,remove,log,snapshot,saveMedia,readMedia,deleteMedia,usesRemoteStorage } from '../../../lib/store.mjs';
import { fetchAudioBuffer } from '../../../lib/voice.mjs';
import { tidyMemory, searchMemories } from '../../../lib/core.mjs';
import {organize,generateStory} from '../../../lib/ai.mjs';
import {voiceConfigured,enrollVoice,synthesizeVoice,cacheKey} from '../../../lib/voice.mjs';
import {accountRole,acceptInvite,authenticate,clearSessionCookie,createSession,createUser,hasAdmin,issueInvite,listAccounts,revokeSession,sameOrigin,sessionFromRequest,setSessionCookie} from '../../../lib/auth.mjs';
import {AGE_GROUPS,ACCENTS,FONT_SCALES,sanitizePreferences} from '../../../lib/core.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status});
const bad=(e,status=400)=>json({error:e.message||'请求未能完成'},status);
const unauthorized=()=>json({error:'请先登录'},401);
const forbidden=()=>json({error:'当前账号没有执行此操作的权限'},403);
const guard=async(request,role='viewer')=>{const user=await sessionFromRequest(request);return {user,error:!user?unauthorized():!accountRole(user,role)?forbidden():null};};
const ensureOrigin=request=>sameOrigin(request)?null:forbidden();
const isManagedMedia=async file=>(await all('memories')).some(m=>['cover','audio','video'].some(key=>m[key]===`/api/media/${file}`));
const allowed={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','audio/ogg':'.ogg','audio/webm':'.webm','video/mp4':'.mp4','video/webm':'.webm' };
const validBlobPath=pathname=>typeof pathname==='string'&&/^yiban\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(pathname);

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
    if(parts[0]==='media') {
      const file=parts[1]||'';
      if(!/^[a-f0-9-]+\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(file)) return json({error:'无效文件名'},404);
      const upload=await get('uploads',file);
      if(!await isManagedMedia(file)&&upload?.userId!==auth.user.id) return json({error:'素材不存在'},404);
      const media=await readMedia(file,upload?.blobUrl);
      if(!media)return json({error:'素材不存在'},404);
      const data=media.data;
      const ext=path.extname(file);
      const types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.webm':'video/webm','.mp4':'video/mp4'};
      const headers={'Content-Type':media.contentType||types[ext],'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Accept-Ranges':'bytes'};
      const range=request.headers.get('range');
      if(range) {
        const match=/^bytes=(\d+)-(\d*)$/.exec(range);
        if(!match) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.length}`}});
        const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
        if(start>end||start>=data.length) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.length}`}});
        return new Response(data.subarray(start,end+1),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':String(end-start+1)}});
      }
      return new Response(data,{headers:{...headers,'Content-Length':String(data.length)}});
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
        let user;
        if(code) {
          user=await acceptInvite(code,body);
          if(user.role!=='admin') throw new Error('管理员注册需要管理员邀请码');
        } else {
          user=await createUser(body,'admin');
        }
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
    const requiredRole=['upload','comments','memories','organize','albums','story','members','anniversaries'].includes(parts[0])?'editor':'viewer';
    if(!accountRole(auth.user,requiredRole))return forbidden();
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
      const memory=tidyMemory(body);
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
        const media=await readMedia(name,(await get('uploads',name))?.blobUrl);
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
      const album=await get('albums',body.albumId); if(!album) throw new Error('专辑不存在');
      const memories=(await Promise.all(album.memoryIds.map(id=>get('memories',id)))).filter(m=>m?.status==='confirmed');
      if(!memories.length) throw new Error('这张专辑还没有已确认的记忆');
      return json(await generateStory(memories,album.title));
    }
    if(parts[0]==='activity') {
      const types={play:'播放',remember:'点击了「我记得」',like:'点击了「喜欢」',replay:'点击了「再听一次」',pause:'暂停了播放'};
      if(!types[body.type]) throw new Error('不支持的互动类型');
      const memory=await get('memories',body.memoryId);if(!memory||memory.status!=='confirmed') throw new Error('记忆不可播放');
      return json(await log(body.type,`${types[body.type]}「${memory.title}」`,memory.id));
    }
    if(parts[0]==='members') {
      const name=String(body.name||'').trim().slice(0,30);if(!name) throw new Error('请填写成员姓名');
      const member={id:randomUUID(),familyId:'family',name,relation:String(body.relation||'家人').slice(0,30),role:'家庭成员',color:'sage'};
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
      const {memberId,audioUrl,consent}=body;
      if(!memberId||!audioUrl) throw new Error('缺少成员或录音');
      const member=await get('members',memberId);if(!member) throw new Error('成员不存在');
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
      if(!text||!text.trim()) throw new Error('合成文本为空');
      let member=null;
      if(memberId){member=await get('members',memberId);}
      if(!member||!member.voiceId) return json({error:'该成员尚未复刻声音',voiceId:null},404);
      const key=cacheKey(member.voiceId,text,options||{});
      const cached=await get('voice_cache',key);
      if(cached?.blobUrl) return json({audioUrl:cached.blobUrl,cached:true,voiceId:member.voiceId});
      const {audioUrl,format}=await synthesizeVoice({voiceId:member.voiceId,text,options});
      let finalUrl=audioUrl;
      // 落盘到 Blob 再缓存：无论返回内联 base64 还是临时签名 url，都转成稳定的 Blob 地址，
      // 避免重复计费与临时 url 失效。
      const buffer=audioUrl.startsWith('data:')?Buffer.from(audioUrl.split(',')[1],'base64'):await fetchAudioBuffer(audioUrl);
      const name=`voice-${key}.${format}`;
      finalUrl=(await saveMedia(name,buffer,`audio/${format}`)).blobUrl||finalUrl;
      await put('voice_cache',{id:key,memberId:member.id,voiceId:member.voiceId,text:text.slice(0,200),blobUrl:finalUrl,format,createdAt:new Date().toISOString()});
      return json({audioUrl:finalUrl,cached:false,voiceId:member.voiceId});
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
      return json({preferences:publicUser(updated).preferences});
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
    if(parts[0]==='settings') {
      const old=await get('settings','family');
      const update={...old,familyName:String(body.familyName??old.familyName).trim().slice(0,60)||old.familyName,elderName:String(body.elderName??old.elderName).trim().slice(0,30)||old.elderName,fontSize:['large','extra'].includes(body.fontSize)?body.fontSize:old.fontSize,highContrast:Boolean(body.highContrast??old.highContrast),autoPlay:Boolean(body.autoPlay??old.autoPlay),speechRate:Math.min(1.2,Math.max(0.5,Number(body.speechRate??old.speechRate)||0.85))};
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
    const auth=await guard(request,'editor');if(auth.error)return auth.error;
    if(!['memories','albums','members','anniversaries'].includes(parts[0])) return json({error:'接口不存在'},404);
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
