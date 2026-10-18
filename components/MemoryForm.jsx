'use client';
import {useState} from 'react';
import {upload as uploadToBlob} from '@vercel/blob/client';
import Icon from './Icon';
import {Button,Field,Cover} from './UI';
import {THEMES} from '../lib/core.mjs';

export default function MemoryForm({initial,onSave,onCancel,api,aiEnabled,remoteStorage=false,notify}) {
  const [form,setForm]=useState(initial?{...initial,people:initial.people.join('、'),tags:initial.tags.join('、')}:{title:'',year:'',location:'',people:'',theme:'家人',tags:'',story:'',status:'draft',cover:null,audio:null,video:null});
  const [busy,setBusy]=useState('');const [consent,setConsent]=useState(Boolean(initial));const [note,setNote]=useState('');
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const upload=async(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    setBusy('upload');
    try {
      let result;
      if(remoteStorage) {
        const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','audio/ogg':'ogg','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm'}[file.type];
        if(!extension)throw new Error('不支持的素材格式');
        const blob=await uploadToBlob(`yiban/${crypto.randomUUID()}.${extension}`,file,{access:'private',handleUploadUrl:'/api/upload/token',contentType:file.type,multipart:file.size>5*1024*1024});
        result={url:`/api/media/${blob.pathname.split('/').pop()}`,type:file.type,name:file.name};
      } else {
        const data=new FormData();data.append('file',file);
        result=await api('/upload',{method:'POST',body:data});
      }
      const key=result.type.startsWith('image/')?'cover':result.type.startsWith('audio/')?'audio':'video';
      setForm(f=>({...f,[key]:result.url,...(key==='cover'?{assetType:'photo'}:{}),...(key==='audio'?{clearAudio:false}:{}),...(key==='video'?{clearVideo:false}:{}),title:f.title||file.name.replace(/\.[^.]+$/,'')}));notify('素材上传完成');
    }catch(e){notify(e.message,'error');}finally{setBusy('');event.target.value='';}
  };
  const organize=async()=>{
    setBusy('ai');try{const result=await api('/organize',{method:'POST',body:JSON.stringify({...form,people:form.people.split(/[,，、]/).filter(Boolean),tags:form.tags.split(/[,，、]/).filter(Boolean)})});setForm(f=>({...f,title:result.title||f.title,story:result.story||f.story,year:result.year||f.year,location:result.location||f.location,people:Array.isArray(result.people)?result.people.join('、'):f.people,tags:Array.isArray(result.tags)?result.tags.join('、'):f.tags,theme:THEMES.includes(result.theme)?result.theme:f.theme,status:'draft'}));setNote(result.note);notify(result.mode==='local'?'本地整理完成，请核对后发布':'AI 整理完成，请核对后发布');}catch(e){notify(e.message,'error');}finally{setBusy('');}
  };
  const save=async(e)=>{e.preventDefault();if(!consent){notify('请确认素材使用授权','error');return;}setBusy('save');try{await onSave(form);}catch(e){notify(e.message,'error');}finally{setBusy('');}};
  return <form onSubmit={save} className="memory-form"><div className="upload-section"><div className="upload-preview"><Cover memory={form}/></div><div className="upload-copy"><span className="eyebrow">保存一个温暖的瞬间</span><h3>{initial?'补充这段回忆':'从一张照片开始'}</h3><p>照片、家人录音和视频，都能成为记忆的入口。</p><label className={`btn btn-secondary ${busy?'disabled':''}`}><Icon name="upload"/>选择照片 / 音频 / 视频<input type="file" hidden onChange={upload} disabled={Boolean(busy)} accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm,video/mp4,video/webm"/></label>{busy==='upload'&&<span className="upload-status">正在上传…</span>}{form.audio&&<div className="attached-file"><Icon name="volume"/>家人录音已添加<button type="button" onClick={()=>setForm(f=>({...f,audio:null,clearAudio:true}))} aria-label="移除录音"><Icon name="close" size={14}/></button></div>}{form.video&&<div className="attached-file"><Icon name="play"/>家庭视频已添加<button type="button" onClick={()=>setForm(f=>({...f,video:null,clearVideo:true}))} aria-label="移除视频"><Icon name="close" size={14}/></button></div>}</div></div>
    <div className="form-grid"><Field label="记忆名称 *"><input required maxLength={80} placeholder="例如：那年，我们一起去西湖" value={form.title} onChange={e=>change('title',e.target.value)}/></Field><Field label="主题"><select value={form.theme} onChange={e=>change('theme',e.target.value)}>{THEMES.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="年份"><input inputMode="numeric" placeholder="例如：1995" value={form.year} maxLength={4} onChange={e=>change('year',e.target.value)}/></Field><Field label="地点"><input placeholder="例如：杭州 · 西湖" value={form.location} onChange={e=>change('location',e.target.value)}/></Field><Field label="照片里的家人"><input placeholder="用顿号分隔，例如：妈妈、爸爸、小雨" value={form.people} onChange={e=>change('people',e.target.value)}/></Field><Field label="记忆标签"><input placeholder="例如：童年、全家福、夏天" value={form.tags} onChange={e=>change('tags',e.target.value)}/></Field></div>
    <Field label="这段记忆的故事"><textarea rows={5} placeholder="讲讲照片背后的故事。哪些人、在哪里、发生了什么？" value={form.story} maxLength={6000} onChange={e=>change('story',e.target.value)}/></Field>
    <div className="ai-helper"><div><Icon name="sparkle"/><div><strong>{aiEnabled?'让 AI 帮你整理':'本地辅助整理'}</strong><p>{aiEnabled?'根据素材生成描述和标签，结果由你确认。':'从你填写的文字提取年份和主题；接入模型后可理解照片。'}</p></div></div><Button type="button" variant="secondary" busy={busy==='ai'} disabled={Boolean(busy)} onClick={organize}>{aiEnabled?'AI 整理':'整理文字'}</Button></div>{note&&<div className="inline-notice"><Icon name="info"/><span>{note}</span></div>}
    <label className="check-row"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我已取得素材使用同意，并会核对人物、时间和家庭故事。</span></label><label className="check-row"><input type="checkbox" checked={form.status==='confirmed'} onChange={e=>change('status',e.target.checked?'confirmed':'draft')}/><span>内容已核对，发布到老人端<span className="muted">（不勾选则保存为待确认）</span></span></label><div className="modal-actions"><Button type="button" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" icon="check" busy={busy==='save'} disabled={Boolean(busy)||!consent}>{form.status==='confirmed'?'保存并发布':'保存待确认'}</Button></div>
  </form>;
}
