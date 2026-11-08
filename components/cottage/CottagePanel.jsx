'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,Check,ChevronRight,FileText,Image as ImageIcon,LoaderCircle,Mail,Mic,Plus,Search,Square,Trash2,Upload,Volume2,X} from 'lucide-react';
import {uploadMedia} from '../../lib/upload-client.mjs';
import CottageAudio from './CottageAudio';
import './cottage-panel.css';

const TITLES={books:'记忆书架',photos:'照片故事',letters:'时光信匣',audio:'原声回放',search:'找一段记忆',continue:'继续上次的故事','capture-photo':'把素材交给小羊','capture-audio':'留下一段声音','capture-text':'写下一件小事'};
const ACCEPT='image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm';
const MIME=new Set(ACCEPT.split(','));
const dateOf=value=>new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric'}).format(new Date(value));
const labelOf=item=>item.kind==='audio'?'有原声':item.kind==='photo'?'有照片':'文字记忆';
const imageOf=item=>item.media?.find(media=>media.contentType?.startsWith('image/'));

async function api(path,options={}){
 const response=await fetch('/api'+path,{cache:'no-store',...options,headers:{...(typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.message||body.error||'暂时没有连接上，请再试一次。');
 return body;
}

export default function CottagePanel({section,closing=false,onClose,onSaved,onCaptureChange,initialFiles=[],autoSaveFiles=false}){
 const capture=section.startsWith('capture-');
 const [mode,setMode]=useState(capture?'capture':'browse'),[items,setItems]=useState([]),[loading,setLoading]=useState(!capture),[hasMore,setHasMore]=useState(false),[loadingMore,setLoadingMore]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[selectedBook,setSelectedBook]=useState(null),[query,setQuery]=useState('');
 const [title,setTitle]=useState(''),[text,setText]=useState(''),[book,setBook]=useState('生活随记'),[files,setFiles]=useState([]),[busy,setBusy]=useState('');
 const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[success,setSuccess]=useState('');
 const [captureKind,setCaptureKind]=useState(section==='capture-audio'?'audio':section==='capture-photo'?'photo':'text');
 const dialog=useRef(null),fileInput=useRef(null),recorder=useRef(null),stream=useRef(null),alive=useRef(true),fileState=useRef([]),urls=useRef(new Set()),processed=useRef(new Set()),settings=useRef(null),request=useRef(null),autoPending=useRef(false),loadController=useRef(null),saveController=useRef(null),uploadController=useRef(null),busyRef=useRef('');
 const callbacks=useRef({onClose,onSaved,onCaptureChange});callbacks.current={onClose,onSaved,onCaptureChange};
 const recordingStarted=useRef(0),titleRef=useRef(title),textRef=useRef(text),bookRef=useRef(book);titleRef.current=title;textRef.current=text;bookRef.current=book;
 const updateFiles=useCallback(next=>{fileState.current=next;if(alive.current)setFiles(next);},[]);
 const phase=(value,message)=>{if(alive.current)callbacks.current.onCaptureChange?.({phase:value,text:message});};
 const changeBusy=value=>{busyRef.current=value;if(alive.current)setBusy(value);};
 const dirty=mode==='edit'?Boolean(selected&&(title!==(selected.title||'')||text!==(selected.text||'')||book!==(selected.book||'生活随记'))):mode==='capture'&&Boolean(title.trim()||text.trim()||files.length);
 const close=useCallback(()=>{if(busyRef.current)return;if(recording||dirty){if(!window.confirm(recording?'还在录音，结束并离开吗？':'这段内容还没有收好，确定离开吗？'))return;}callbacks.current.onClose?.();},[recording,dirty]);

 const load=useCallback(async()=>{
  loadController.current?.abort();const controller=new AbortController();loadController.current=controller;setLoading(true);setError('');
  try{const result=await api('/cottage/entries',{signal:controller.signal});if(alive.current){setItems(result.items||[]);setHasMore(Boolean(result.hasMore));if(section==='continue'&&result.items?.[0]){setSelected(result.items[0]);setMode('detail');}}}
  catch(failure){if(alive.current&&failure.name!=='AbortError')setError(failure.message);}
  finally{if(alive.current&&!controller.signal.aborted)setLoading(false);}
 },[section]);

 useEffect(()=>{alive.current=true;return()=>{alive.current=false;loadController.current?.abort();saveController.current?.abort();uploadController.current?.abort();if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();}stream.current?.getTracks().forEach(track=>track.stop());for(const url of urls.current)URL.revokeObjectURL(url);};},[]);
 useEffect(()=>{if(!capture)void load();},[capture,load]);
 useEffect(()=>{if(error)dialog.current?.querySelector('[role="alert"]')?.scrollIntoView({block:'nearest'});},[error]);
 useEffect(()=>{dialog.current?.querySelector('[data-cottage-close]')?.focus();},[]);
 useEffect(()=>{const keyboard=event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){const focusable=[...dialog.current.querySelectorAll('button,input,textarea,select,audio,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',keyboard);return()=>document.removeEventListener('keydown',keyboard);},[close]);
 useEffect(()=>{if(!recording)return;const timer=setInterval(()=>{const elapsed=Math.floor((Date.now()-recordingStarted.current)/1000);setSeconds(elapsed);if(elapsed>=180&&recorder.current?.state==='recording')recorder.current.stop();},500);return()=>clearInterval(timer);},[recording]);

 async function storageMode(signal){if(!settings.current)settings.current=api('/auth/status',{signal}).then(value=>Boolean(value.remoteStorage)).catch(failure=>{settings.current=null;throw failure;});return settings.current;}
 function resetForm(){setTitle('');setText('');setBook('生活随记');setSuccess('');setError('');updateFiles([]);request.current=null;}
 function startCapture(kind){resetForm();setSelected(null);setSelectedBook(null);setCaptureKind(kind);setMode('capture');setTimeout(()=>{if(kind==='photo')fileInput.current?.click();else if(kind==='text')dialog.current?.querySelector('textarea')?.focus();},0);}
 function remember(item){setItems(previous=>[item,...previous.filter(entry=>entry.id!==item.id)]);setSelected(item);setMode('detail');setSuccess('已经收进你的小屋。');setError('');updateFiles([]);request.current=null;callbacks.current.onSaved?.(item);phase('saved','已经收好啦。');}

 async function submit(event,{attachments=fileState.current,automatic=false}={}){
  event?.preventDefault();if(busyRef.current||recording)return;
  if(attachments.some(file=>file.status!=='ready')){setError('还有素材没有上传成功，请先重试或移除。');return;}
  const media=attachments.map(file=>({url:file.url,name:file.name.slice(0,200),contentType:file.contentType}));
  const data={title:titleRef.current.trim()||(automatic?attachments[0]?.name.replace(/\.[^.]+$/,'').slice(0,100):''),text:textRef.current.trim(),book:bookRef.current.trim()||'生活随记',media};
  if(!data.text&&!media.length&&mode!=='edit'){setError('写一句话，或放进照片、录音，就可以留下这段记忆。');return;}
  const fingerprint=JSON.stringify(data);if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,key:crypto.randomUUID()};
  const controller=new AbortController();saveController.current=controller;changeBusy('saving');setError('');phase('saving','小羊正在把故事收好…');
  try{const editing=mode==='edit',result=await api(editing?`/cottage/entries/${encodeURIComponent(selected.id)}`:'/cottage/entries',{method:editing?'PATCH':'POST',headers:{'idempotency-key':request.current.key},body:JSON.stringify(editing?{title:data.title,text:data.text,book:data.book,expectedUpdatedAt:selected.updatedAt}:data),signal:controller.signal});if(alive.current)remember(result.item);}
  catch(failure){if(alive.current&&failure.name!=='AbortError'){setError(failure.message);phase('error','还没收好，内容仍在这里。');}}
  finally{changeBusy('');}
 }

 async function addFiles(incoming,{automatic=false,retry=false}={}){
  if(busyRef.current||recording)return;setError('');setSuccess('');
  const incomingFiles=Array.from(incoming||[]);if(!incomingFiles.length)return;
  if(incomingFiles.length+(retry?0:fileState.current.length)>8){setError('一次最多收下 8 份素材，可以分成几段记忆保存。');return;}
  const invalid=incomingFiles.find(file=>!MIME.has(file.type.split(';')[0])||!file.size||file.size>50*1024*1024);
  if(invalid){setError(`“${invalid.name}”暂时无法接收，请选择 50 MB 以内的 JPG、PNG、WebP 或音频文件。`);return;}
  const additions=retry?fileState.current.filter(file=>file.status==='error').map(file=>({...file,status:'uploading',error:null})):incomingFiles.map(file=>{const preview=URL.createObjectURL(file);urls.current.add(preview);return {id:crypto.randomUUID(),file,name:file.name,contentType:file.type.split(';')[0],preview,status:'uploading'};});
  let next=retry?fileState.current.map(file=>additions.find(addition=>addition.id===file.id)||file):[...fileState.current,...additions];updateFiles(next);autoPending.current=automatic||autoPending.current;const controller=new AbortController();uploadController.current=controller;changeBusy('uploading');phase('uploading','小羊正在接收素材…');
  try{const remoteStorage=await storageMode(controller.signal);if(!alive.current)return;
   for(const addition of additions){if(!alive.current)return;try{const normalized=addition.file.type===addition.contentType?addition.file:new File([addition.file],addition.name,{type:addition.contentType});const result=await uploadMedia((path,options)=>api(path,{...options,signal:controller.signal}),normalized,{remoteStorage});next=next.map(file=>file.id===addition.id?{...file,status:'ready',url:result.url}:file);}catch(failure){next=next.map(file=>file.id===addition.id?{...file,status:'error',error:failure.message}:file);}updateFiles(next);}
  }catch(failure){next=next.map(file=>file.status==='uploading'?{...file,status:'error',error:failure.message}:file);updateFiles(next);}
  finally{changeBusy('');}
  if(!alive.current)return;
  if(next.some(file=>file.status==='error')){setError('有素材没有接收成功，已成功的部分仍保留在这里。');phase('error','有素材没接稳，可以再试一次。');return;}
  phase('idle','素材接住啦，可以再补一句。');
  if(autoPending.current){autoPending.current=false;await submit(null,{attachments:next,automatic:true});}
 }

 useEffect(()=>{if(!initialFiles?.length)return;const timer=setTimeout(()=>{const fingerprint=initialFiles.map(file=>`${file.name}:${file.size}:${file.lastModified}`).join('|');if(processed.current.has(fingerprint))return;processed.current.add(fingerprint);void addFiles(initialFiles,{automatic:autoSaveFiles});},0);return()=>clearTimeout(timer);},[initialFiles,autoSaveFiles]);

 async function startRecording(){
  if(busyRef.current)return;setError('');setSuccess('');
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError('此设备暂时不能直接录音。可以使用下方的“上传录音”，或在 HTTPS 页面中重试。');return;}
  changeBusy('microphone');
  try{const input=await navigator.mediaDevices.getUserMedia({audio:true});if(!alive.current){input.getTracks().forEach(track=>track.stop());return;}stream.current=input;const preferred=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));const media=new MediaRecorder(input,preferred?{mimeType:preferred}:undefined),chunks=[];recorder.current=media;
   media.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
   media.onerror=()=>{media.onstop=null;if(media.state!=='inactive')media.stop();input.getTracks().forEach(track=>track.stop());if(alive.current){setRecording(false);changeBusy('');setError('录音中断了，请检查麦克风后再试一次。');phase('error','录音中断了，可以再试一次。');}};
   media.onstop=()=>{input.getTracks().forEach(track=>track.stop());if(!alive.current)return;setRecording(false);changeBusy('');const type=(media.mimeType||'audio/webm').split(';')[0],extension=type==='audio/mp4'?'m4a':type==='audio/ogg'?'ogg':'webm';const blob=new Blob(chunks,{type});if(!blob.size){setError('没有录到声音，请检查麦克风后重试。');phase('error','没有录到声音，可以再试一次。');return;}void addFiles([new File([blob],`我的原声-${new Date().toISOString().slice(0,10)}.${extension}`,{type})]);};
   media.start();recordingStarted.current=Date.now();setSeconds(0);setRecording(true);phase('recording','我在听，慢慢说。');
  }catch{stream.current?.getTracks().forEach(track=>track.stop());if(alive.current){setError('未能开启麦克风，请允许录音权限，或上传已有录音。');phase('error','麦克风还没有开启。');}}
  finally{changeBusy('');}
 }

 async function removeEntry(){if(!selected||busyRef.current||!window.confirm('要移除这段记忆吗？'))return;const controller=new AbortController();saveController.current=controller;changeBusy('deleting');setError('');try{await api(`/cottage/entries/${encodeURIComponent(selected.id)}`,{method:'DELETE',signal:controller.signal});if(!alive.current)return;setItems(previous=>previous.filter(item=>item.id!==selected.id));setSelected(null);setMode('browse');setSuccess('已移除这段记忆。');callbacks.current.onSaved?.(null);}catch(failure){if(alive.current&&failure.name!=='AbortError')setError(failure.message);}finally{changeBusy('');}}
 async function more(){if(loadingMore||loading)return;const controller=new AbortController();loadController.current=controller;setLoadingMore(true);setError('');try{const result=await api(`/cottage/entries?offset=${items.length}`,{signal:controller.signal});if(alive.current){setItems(previous=>[...previous,...(result.items||[]).filter(item=>!previous.some(old=>old.id===item.id))]);setHasMore(Boolean(result.hasMore));}}catch(failure){if(alive.current&&failure.name!=='AbortError')setError(failure.message);}finally{if(alive.current)setLoadingMore(false);}}
 const filtered=items.filter(item=>(section==='photos'?item.media?.some(media=>media.contentType.startsWith('image/')):section==='audio'?item.media?.some(media=>media.contentType.startsWith('audio/')):section==='letters'?item.kind==='text':true)&&(!selectedBook||item.book===selectedBook)&&(!query.trim()||`${item.title} ${item.text} ${item.book}`.toLowerCase().includes(query.trim().toLowerCase())));
 const books=Object.entries(items.reduce((all,item)=>{const name=item.book||'生活随记';(all[name]??=[]).push(item);return all;},{}));
 const busyNow=Boolean(busy)||recording;
 const itemView=item=><button key={item.id} className="cottage-entry" onClick={()=>{setSelected(item);setMode('detail');setSuccess('');}}>{imageOf(item)?<img src={imageOf(item).url} alt="" loading="lazy"/>:<span className="cottage-entry-icon">{item.kind==='audio'?<Volume2 size={23}/>:<Mail size={23}/>}</span>}<span className="cottage-entry-copy"><strong>{item.title||'一段记忆'}</strong><span>{item.text||'原始素材已经收好，随时可以补充故事。'}</span><small>{dateOf(item.createdAt)} · {labelOf(item)}</small></span><ChevronRight size={17}/></button>;
 const back=()=>{if(mode==='edit'){if(dirty&&!window.confirm('补充的内容还没保存，确定返回吗？'))return;setMode('detail');resetForm();return;}setSelected(null);setSelectedBook(null);setMode('browse');setSuccess('');};

 return <div className={`cottage-panel-shell ${closing?'is-closing':''}`} data-section={section}><button className="cottage-panel-shade" tabIndex={-1} aria-label="关闭记忆面板" onClick={close}/><section ref={dialog} className="cottage-panel" data-mode={mode} role="dialog" aria-modal="true" aria-labelledby="cottage-panel-title">
  <header className="cottage-panel-header"><div>{((selected&&mode!=='capture')||selectedBook)&&<button className="cottage-icon-button" onClick={back} disabled={busyNow} aria-label="返回记忆列表"><ArrowLeft size={20}/></button>}<h2 id="cottage-panel-title">{mode==='detail'?'打开一段记忆':mode==='edit'?'补充这段故事':mode==='capture'?TITLES[`capture-${captureKind}`]:selectedBook||TITLES[section]}</h2></div><button data-cottage-close className="cottage-icon-button" onClick={close} disabled={Boolean(busy)} aria-label="关闭记忆面板"><X size={21}/></button></header>
  <div className="cottage-panel-scroll">
   {success&&<p className="cottage-panel-success" role="status"><Check size={17}/>{success}</p>}
   {error&&<div className="cottage-panel-error" role="alert"><p>{error}</p>{files.some(file=>file.status==='error')?<button type="button" disabled={busyNow} onClick={()=>addFiles(fileState.current.filter(file=>file.status==='error').map(file=>file.file),{retry:true})}>重新上传</button>:mode==='browse'&&<button onClick={load}>重新连接</button>}</div>}
   {(mode==='capture'||mode==='edit')?<form className="cottage-capture-form" onSubmit={submit}>
    {mode==='capture'&&<div className="cottage-capture-kinds" role="group" aria-label="记录方式">{[['photo','照片',ImageIcon],['audio','原声',Mic],['text','文字',FileText]].map(([kind,label,Glyph])=><button type="button" key={kind} aria-pressed={captureKind===kind} disabled={busyNow} onClick={()=>setCaptureKind(kind)}><Glyph size={17}/>{label}</button>)}</div>}
    <p className="cottage-panel-intro">{mode==='edit'?'原声和照片都在，给这段记忆再补上一点故事。':'先留下一点，名字和故事都可以慢慢补。'}</p>
    {mode!=='edit'&&<><div className="cottage-capture-tools"><button type="button" disabled={busyNow} onClick={()=>{fileInput.current.accept=ACCEPT;fileInput.current.click();}}><ImageIcon size={19}/>照片或录音</button><button type="button" disabled={Boolean(busy)} className={recording?'is-recording':''} onClick={recording?()=>recorder.current?.stop():startRecording}>{recording?<Square size={17}/>:<Mic size={19}/>} {recording?'结束录音':'直接说一段'}</button></div><input ref={fileInput} type="file" multiple hidden accept={ACCEPT} onChange={event=>{const chosen=event.target.files;void addFiles(chosen);event.target.value='';}}/>
     {recording&&<div className="cottage-recording-status" role="status"><span className="cottage-recording-dot"/>正在录音 <strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong><small>最长 3 分钟，结束后可试听。</small></div>}
     {!files.length&&!recording&&captureKind!=='text'&&<button className="cottage-drop-zone" type="button" disabled={busyNow} onClick={()=>fileInput.current.click()} onDragOver={event=>{event.preventDefault();event.stopPropagation();}} onDrop={event=>{event.preventDefault();event.stopPropagation();void addFiles(event.dataTransfer.files);}}>{captureKind==='audio'?<Mic size={25}/>:<Upload size={25}/>}<span>{captureKind==='audio'?'说一段，留住此刻的声音':'把照片或录音放在这里'}</span><small>{captureKind==='audio'?'点击上方录音，也可以上传已有录音':'也可以只写一句话'}</small></button>}
     {files.length>0&&<div className="cottage-attachment-list">{files.map(file=><div className="cottage-attachment" key={file.id}>{file.contentType.startsWith('image/')?<img src={file.preview} alt={file.name}/>:<Volume2 size={21}/>}<div><span>{file.name}</span>{file.status==='uploading'?<small>正在接收…</small>:file.status==='error'?<small className="has-error">{file.error}</small>:file.contentType.startsWith('audio/')?<CottageAudio src={file.url||file.preview} name={file.name}/>:<small>照片已接住</small>}</div><button type="button" className="cottage-icon-button" aria-label={`移除${file.name}`} disabled={busyNow} onClick={()=>updateFiles(fileState.current.filter(value=>value.id!==file.id))}><X size={17}/></button></div>)}</div>}
    </>}
    <label className="cottage-field"><span>想留下的话</span><textarea value={text} onChange={event=>setText(event.target.value)} disabled={busyNow} maxLength={8000} rows={5} placeholder="今天发生了什么？或者，这份素材背后有什么故事？"/></label>
    <label className="cottage-field"><span>给记忆起个名字 <small>选填</small></span><input value={title} onChange={event=>setTitle(event.target.value)} disabled={busyNow} maxLength={80} placeholder="例如：第一次做成功的红烧肉"/></label>
    <label className="cottage-field"><span>收进哪本书</span><input list="cottage-book-options" value={book} onChange={event=>setBook(event.target.value)} disabled={busyNow} maxLength={60} placeholder="生活随记"/><datalist id="cottage-book-options">{books.map(([name])=><option key={name} value={name}/>)}</datalist></label>
    <p className="cottage-private-note">保存在你自己的小屋，仅当前账号可见。原始照片和声音会一起留下。</p>
    <button className="cottage-primary" type="submit" disabled={busyNow||files.some(file=>file.status!=='ready')||(!text.trim()&&!files.length&&mode!=='edit')}>{busy?<LoaderCircle className="cottage-spin" size={18}/>:<BookOpen size={19}/>} {busy==='uploading'?'正在接收素材…':busy==='saving'?'正在收好…':mode==='edit'?'保存补充':'收进小屋'}</button>
   </form>:mode==='detail'&&selected?<article className="cottage-entry-detail"><div className="cottage-detail-meta"><span>{selected.book||'生活随记'}</span><time dateTime={selected.createdAt}>{dateOf(selected.createdAt)}</time></div><h3>{selected.title||'一段记忆'}</h3>{selected.text&&<p className="cottage-story-text">{selected.text}</p>}{selected.media?.map((media,index)=>media.contentType.startsWith('image/')?<figure key={media.url}><img src={media.url} alt={media.name||`记忆照片 ${index+1}`}/><figcaption>{media.name}</figcaption></figure>:<div className="cottage-detail-audio" key={media.url}><p><Volume2 size={18}/>原始录音</p><CottageAudio src={media.url} name={media.name||'原始录音'}/></div>)}<footer className="cottage-detail-actions"><button type="button" onClick={()=>{setTitle(selected.title||'');setText(selected.text||'');setBook(selected.book||'生活随记');setMode('edit');setSuccess('');}}><FileText size={17}/>补充文字</button><button type="button" className="cottage-delete" onClick={removeEntry} disabled={Boolean(busy)}><Trash2 size={16}/>移除记忆</button></footer></article>:<>
    <p className="cottage-panel-intro">{section==='books'?'每一本书，都慢慢装进你的生活。':section==='photos'?'那些被留下的画面，故事还可以继续。':section==='audio'?'按下播放，回到声音发生的那一刻。':section==='letters'?'随手写下的话，都收在这里。':section==='continue'?'从最近的一段记忆，继续讲下去。':'找一本书，或一句曾经留下的话。'}</p>
    <div className="cottage-panel-toolbar"><label className="cottage-search"><Search size={18}/><input autoFocus={section==='search'} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="找一段故事、一本书…" aria-label="搜索我的记忆"/></label><button className="cottage-new-button" onClick={()=>startCapture(section==='photos'?'photo':section==='audio'?'audio':'text')}><Plus size={18}/><span>留一段</span></button></div>
    {loading?<div className="cottage-panel-empty" role="status"><LoaderCircle className="cottage-spin" size={27}/><p>正在翻开你的小屋…</p></div>:!filtered.length?<div className="cottage-panel-empty"><BookOpen size={34}/><h3>{query?'还没找到这段记忆':'这里等着你的第一个故事'}</h3><p>{query?'换个词找找，或留下一段新的故事。':'一张照片、一段声音、一句话，都可以作为开始。'}</p><button className="cottage-primary" onClick={()=>startCapture(section==='photos'?'photo':section==='audio'?'audio':'text')}><Plus size={18}/>留下第一段记忆</button></div>:section==='books'&&!selectedBook&&!query?<div className="cottage-book-list">{books.map(([name,entries])=><button className="cottage-book" key={name} onClick={()=>setSelectedBook(name)}>{imageOf(entries.find(imageOf)||{})?<img src={imageOf(entries.find(imageOf)).url} alt=""/>:<BookOpen size={28}/>}<span><strong>{name}</strong><small>{entries.length} 段记忆 · 最近于 {dateOf(entries[0].createdAt)}</small></span><ChevronRight size={19}/></button>)}</div>:section==='photos'?<div className="cottage-photo-grid">{filtered.map(item=><button key={item.id} onClick={()=>{setSelected(item);setMode('detail');}}><img loading="lazy" src={imageOf(item).url} alt={item.title||'记忆照片'}/><span><strong>{item.title||'一段记忆'}</strong><small>{dateOf(item.createdAt)}</small></span></button>)}</div>:<div className="cottage-entry-list">{filtered.map(itemView)}</div>}
    {hasMore&&!loading&&<button className="cottage-load-more" onClick={more} disabled={loadingMore}>{loadingMore?<LoaderCircle className="cottage-spin" size={17}/>:<BookOpen size={17}/>} {loadingMore?'正在翻找…':'加载更早的记忆'}</button>}
   </>}
  </div>
 </section></div>;
}
