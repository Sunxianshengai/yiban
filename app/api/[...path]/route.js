import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { all,get,put,remove,log,snapshot } from '../../../lib/store.mjs';
import { tidyMemory, searchMemories } from '../../../lib/core.mjs';
import {organize,generateStory} from '../../../lib/ai.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status});
const bad=(e,status=400)=>json({error:e.message||'请求未能完成'},status);
const allowed={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','audio/ogg':'.ogg','audio/webm':'.webm','video/mp4':'.mp4','video/webm':'.webm' };

export async function GET(request,{params}) {
  const {path:parts}=await params;
  try {
    if(parts[0]==='state') return json(snapshot());
    if(parts[0]==='search') {
      const q=new URL(request.url).searchParams.get('q');
      return json({memories:searchMemories(all('memories').filter(m=>m.status==='confirmed'),q),mode:'keyword'});
    }
    if(parts[0]==='media') {
      const file=parts[1]||'';
      if(!/^[a-f0-9-]+\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(file)) return json({error:'无效文件名'},404);
      const data=await readFile(path.join(process.cwd(),'data','uploads',file));
      const ext=path.extname(file);
      const types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.ogg':'audio/ogg','.webm':'video/webm','.mp4':'video/mp4'};
      const headers={'Content-Type':types[ext],'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600','Accept-Ranges':'bytes'};
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
    if(parts[0]==='upload') {
      const contentLength=Number(request.headers.get('content-length')||0);
      if(contentLength>52*1024*1024) throw new Error('文件不能超过 50 MB');
      const form=await request.formData(); const file=form.get('file');
      if(!file||typeof file==='string'||!file.size) throw new Error('请选择一个文件');
      const extension=allowed[file.type];
      if(!extension) throw new Error('支持 JPG / PNG / WebP 图片，MP3 / WAV / M4A / OGG / WebM 音频和 MP4 / WebM 视频');
      if(file.size>50*1024*1024) throw new Error('文件不能超过 50 MB');
      const dir=path.join(process.cwd(),'data','uploads'); await mkdir(dir,{recursive:true});
      const name=randomUUID()+extension;
      await writeFile(path.join(dir,name),Buffer.from(await file.arrayBuffer()));
      return json({url:`/api/media/${name}`,type:file.type,name:file.name});
    }
    const body=await request.json();
    if(parts[0]==='comments') {
      const memory=get('memories',body.memoryId);if(!memory) throw new Error('记忆不存在');
      const comment=String(body.text||'').trim().slice(0,1000);if(!comment) throw new Error('请输入留言');
      const activity={id:randomUUID(),type:'comment',text:`给「${memory.title}」留下了留言`,comment,memoryId:memory.id,createdAt:new Date().toISOString()};
      return json(put('activity',activity),201);
    }
    if(parts[0]==='memories') {
      const memory=tidyMemory(body);
      for(const key of ['cover','audio','video']) if(body[key]) {
        if(!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
        memory[key]=body[key];
      }
      if(memory.cover) memory.assetType='photo';
      memory.id=randomUUID();memory.createdAt=new Date().toISOString();memory.updatedAt=memory.createdAt;memory.isDemo=false;
      put('memories',memory);log('created',`添加了记忆「${memory.title}」`,memory.id);
      return json(memory,201);
    }
    if(parts[0]==='organize') {
      let imageData=null;
      if(body.cover&&/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(body.cover)&&process.env.AI_API_KEY) {
        const data=await readFile(path.join(process.cwd(),'data','uploads',path.basename(body.cover)));
        if(data.length>8*1024*1024) throw new Error('模型整理使用的图片请控制在 8 MB 以内');
        const ext=path.extname(body.cover);imageData=`data:${ext==='.jpg'?'image/jpeg':ext==='.png'?'image/png':'image/webp'};base64,${data.toString('base64')}`;
      }
      return json(await organize(body,imageData));
    }
    if(parts[0]==='albums') {
      const title=String(body.title||'').trim().slice(0,80);if(!title) throw new Error('请填写专辑名称');
      const ids=[...new Set(body.memoryIds||[])].filter(id=>get('memories',id)?.status==='confirmed');
      if(!ids.length) throw new Error('请至少选择一段已确认的记忆');
      const album={id:randomUUID(),title,description:String(body.description||'').slice(0,200),memoryIds:ids,cover:get('memories',ids[0]).cover,story:'',createdAt:new Date().toISOString()};
      put('albums',album);log('album',`创建了专辑「${title}」`);return json(album,201);
    }
    if(parts[0]==='story') {
      const album=get('albums',body.albumId); if(!album) throw new Error('专辑不存在');
      const memories=album.memoryIds.map(id=>get('memories',id)).filter(m=>m?.status==='confirmed');
      if(!memories.length) throw new Error('这张专辑还没有已确认的记忆');
      return json(await generateStory(memories,album.title));
    }
    if(parts[0]==='activity') {
      const types={play:'播放',remember:'点击了「我记得」',like:'点击了「喜欢」',replay:'点击了「再听一次」',pause:'暂停了播放'};
      if(!types[body.type]) throw new Error('不支持的互动类型');
      const memory=get('memories',body.memoryId);if(!memory||memory.status!=='confirmed') throw new Error('记忆不可播放');
      return json(log(body.type,`${types[body.type]}「${memory.title}」`,memory.id));
    }
    if(parts[0]==='members') {
      const name=String(body.name||'').trim().slice(0,30);if(!name) throw new Error('请填写成员姓名');
      const member={id:randomUUID(),name,relation:String(body.relation||'家人').slice(0,30),role:'家庭成员',color:'sage'};
      put('members',member);return json(member,201);
    }
    if(parts[0]==='anniversaries') {
      const title=String(body.title||'').trim().slice(0,80);const date=String(body.date||'');
      if(!title||!/^\d{2}-\d{2}$/.test(date)) throw new Error('请填写名称并选择日期');
      const [month,day]=date.split('-').map(Number);const d=new Date(2024,month-1,day);
      if(d.getMonth()!==month-1||d.getDate()!==day) throw new Error('日期不合法');
      return json(put('anniversaries',{id:randomUUID(),title,date,memoryIds:[]}));
    }
    return json({error:'接口不存在'},404);
  }catch(e){return bad(e);}
}

export async function PATCH(request,{params}) {
  const {path:parts}=await params;
  try {
    const body=await request.json();
    if(parts[0]==='memories') {
      const old=get('memories',parts[1]);if(!old) return json({error:'记忆不存在'},404);
      const updated={...old,...tidyMemory(body,old),updatedAt:new Date().toISOString()};
      for(const key of ['cover','audio','video']) if(body[key] && body[key]!==old[key]) {
        if(!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
        updated[key]=body[key];
      }
      if(updated.cover?.startsWith('/api/media/')) updated.assetType='photo';
      if(body.clearAudio) updated.audio=null;
      if(body.clearVideo) updated.video=null;
      put('memories',updated);return json(updated);
    }
    if(parts[0]==='settings') {
      const old=get('settings','family');
      const update={...old,familyName:String(body.familyName??old.familyName).trim().slice(0,60)||old.familyName,elderName:String(body.elderName??old.elderName).trim().slice(0,30)||old.elderName,fontSize:['large','extra'].includes(body.fontSize)?body.fontSize:old.fontSize,highContrast:Boolean(body.highContrast??old.highContrast),autoPlay:Boolean(body.autoPlay??old.autoPlay),speechRate:Math.min(1.2,Math.max(0.5,Number(body.speechRate??old.speechRate)||0.85))};
      return json(put('settings',update));
    }
    if(parts[0]==='albums') {
      const old=get('albums',parts[1]);if(!old) throw new Error('专辑不存在');
      return json(put('albums',{...old,story:String(body.story??old.story).slice(0,10000)}));
    }
    return json({error:'接口不存在'},404);
  }catch(e){return bad(e);}
}

export async function DELETE(request,{params}) {
  const {path:parts}=await params;
  try {
    if(!['memories','albums','members','anniversaries'].includes(parts[0])) return json({error:'接口不存在'},404);
    const old=get(parts[0],parts[1]);if(!old) return json({error:'内容不存在'},404);
    if(parts[0]==='members'&&old.role==='管理员') throw new Error('比赛版请保留管理员');
    remove(parts[0],parts[1]);
    if(parts[0]==='memories') {
      for(const album of all('albums')) if(album.memoryIds.includes(old.id)) {
        const ids=album.memoryIds.filter(id=>id!==old.id);put('albums',{...album,memoryIds:ids,cover:ids.length?get('memories',ids[0])?.cover:null,story:''});
      }
      for(const key of ['cover','audio','video']) if(old[key]?.startsWith('/api/media/')) await unlink(path.join(process.cwd(),'data','uploads',path.basename(old[key]))).catch(()=>{});
      for(const record of all('activity')) if(record.memoryId===old.id) remove('activity',record.id);
    }
    return json({ok:true});
  }catch(e){return bad(e);}
}
