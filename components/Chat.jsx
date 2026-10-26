'use client';
import {useEffect,useRef,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {readSSE} from '../lib/sse.mjs';
import Icon from './Icon';
import {Button,Modal} from './UI';
import {PersonaAvatar,SpeechComposer} from './Familia';

const DEFAULTS={mode:'daily',tone:'natural',memoryMode:'auto',memoryIds:[]};
const ended=job=>!job||['completed','failed','stopped'].includes(job.status);
const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
async function chatAPI(path,options={}){
  const response=await fetch(`/api/chat/${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'暂时无法连接，请重试'),data);return data;
}
function Tool({label,icon,onClick,disabled,pressed}){return <button type="button" className="cw-tool" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}><Icon name={icon} size={17}/></button>;}
function CodeBlock({children,...props}){
  const ref=useRef(null);const[copied,setCopied]=useState(false);
  return <div className="cw-code"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(ref.current?.textContent||'');setCopied(true);}catch{setCopied(false);}}}>{copied?'已复制':'复制代码'}</button><pre {...props} ref={ref}>{children}</pre></div>;
}
function RichText({text}){return <div className="cw-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{pre:CodeBlock,a:({node,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:({alt})=><span>[图片：{alt||'外部图片'}]</span>}}>{text}</ReactMarkdown></div>;}

export default function Chat({accountId='me',accountName='',notify,onOpenMemory,onSaveMemory,canEdit=false,profiles=[],profileId=null,onBack,onRecord,openSpeech=false}){
  const[meta,setMeta]=useState(null),[threads,setThreads]=useState([]),[hasMore,setHasMore]=useState(false),[query,setQuery]=useState(''),[archived,setArchived]=useState(false);
  const[active,setActive]=useState(null),[view,setView]=useState(null),[settings,setSettings]=useState({...DEFAULTS,profileId}),[draft,setDraft]=useState(''),[job,setJob]=useState(null);
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[historyOpen,setHistoryOpen]=useState(false),[sidebar,setSidebar]=useState(false),[mobile,setMobile]=useState(false),[speech,setSpeech]=useState(openSpeech);
  const[dialog,setDialog]=useState(null),[dialogText,setDialogText]=useState(''),[memories,setMemories]=useState([]),[memoryQuery,setMemoryQuery]=useState(''),[selected,setSelected]=useState([]);
  const[edit,setEdit]=useState(null),[editText,setEditText]=useState(''),[jump,setJump]=useState(false),[speaking,setSpeaking]=useState(null),[pending,setPending]=useState(null);
  const feed=useRef(null),input=useRef(null),nearBottom=useRef(true),sequence=useRef(0),mounted=useRef(true),connection=useRef(null),activeRef=useRef(null),listSequence=useRef(0),historyRef=useRef(null),mainRef=useRef(null),historyToggle=useRef(null);
  const prefix=`yiban:chat:${accountId}:`;const isBusy=busy||!ended(job);const archivedThread=Boolean(view?.thread.archived);
  const messages=view?.messages||[];
  const currentProfileId=view?.thread?view.thread.options.profileId:settings.profileId;
  const persona=profiles.find(profile=>profile.id===currentProfileId)||null;
  const displayName=persona?.name||'家伴';
  async function refreshList(append=false){const ticket=++listSequence.current;try{const result=await chatAPI(`threads?q=${encodeURIComponent(query)}&archived=${archived}&offset=${append?threads.length:0}`);if(mounted.current&&ticket===listSequence.current){setThreads(previous=>append?[...previous,...result.threads]:result.threads);setHasMore(result.hasMore);}}catch(e){if(mounted.current)setError(e.message);}}
  async function loadThread(id){
    const ticket=++sequence.current;activeRef.current=id;setActive(id);setView(null);setJob(null);setPending(null);setEdit(null);setError('');setHistoryOpen(false);setLoading(true);nearBottom.current=true;
    storage.set(prefix+'active',id||'');setDraft(storage.get(prefix+'draft:'+id)||'');
    try{const result=await chatAPI(`threads/${id}`);if(mounted.current&&sequence.current===ticket){setView(result);setSettings(result.thread.options);setJob(result.job);}}
    catch(e){if(mounted.current&&sequence.current===ticket)setError(e.message);}finally{if(mounted.current&&sequence.current===ticket)setLoading(false);}
  }
  async function reloadThread(id){const result=await chatAPI(`threads/${id}`);if(mounted.current&&activeRef.current===id){setView(result);setSettings(result.thread.options);setJob(result.job);}return result;}
  function newChat(){sequence.current++;activeRef.current=null;setActive(null);setView(null);setJob(null);setSettings({...DEFAULTS,profileId:persona?.id||profileId||null});setDraft(storage.get(prefix+'draft:new')||'');setError('');setEdit(null);setPending(null);setLoading(false);setHistoryOpen(false);storage.set(prefix+'active','');requestAnimationFrame(()=>input.current?.focus());}
  useEffect(()=>{
    mounted.current=true;
    (async()=>{try{const [info,result]=await Promise.all([chatAPI('meta'),chatAPI('threads')]);if(!mounted.current)return;setMeta(info);setThreads(result.threads);setHasMore(result.hasMore);const saved=storage.get(prefix+'active');if(saved){const previous=await chatAPI(`threads/${saved}`);if(profileId&&previous.thread.options.profileId!==profileId)newChat();else await loadThread(saved);}else{setDraft(storage.get(prefix+'draft:new')||'');setLoading(false);}}catch(e){if(mounted.current){setError(e.message);setLoading(false);}}})();
    return()=>{mounted.current=false;connection.current?.abort();window.speechSynthesis?.cancel();};
  },[accountId]);
  useEffect(()=>{const timer=setTimeout(()=>refreshList(),250);return()=>clearTimeout(timer);},[query,archived]);
  useEffect(()=>{if(loading)return;storage.set(prefix+'draft:'+(active||'new'),draft);if(input.current){input.current.style.height='auto';input.current.style.height=`${Math.min(200,input.current.scrollHeight)}px`;}},[draft,active,loading]);
  useEffect(()=>{
    function dismiss(event){document.querySelectorAll('.cw-menu[open]').forEach(menu=>{if(event.type==='keydown'||!menu.contains(event.target))menu.removeAttribute('open');});if(event.key==='Escape')setHistoryOpen(false);}
    function escape(event){if(event.key==='Escape')dismiss(event);}
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[]);
  useEffect(()=>{const media=window.matchMedia('(max-width:768px)');setMobile(media.matches);const change=()=>{setMobile(media.matches);setHistoryOpen(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{
    if(!historyOpen||!mobile)return;
    const panel=historyRef.current,previous=document.activeElement;
    const background=[mainRef.current,...document.querySelectorAll('.topbar,.mobile-nav')].filter(Boolean);
    const previousInert=background.map(element=>element.inert);
    const items=()=>[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')].filter(element=>element.getClientRects().length);
    items()[0]?.focus();background.forEach(element=>{element.inert=true;});
    function trap(event){if(event.key!=='Tab')return;const list=items(),first=list[0],last=list.at(-1);if(!panel.contains(document.activeElement)){event.preventDefault();first?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    document.addEventListener('keydown',trap);
    return()=>{document.removeEventListener('keydown',trap);background.forEach((element,index)=>{element.inert=previousInert[index];});if(previous?.isConnected)previous.focus();else historyToggle.current?.focus();};
  },[historyOpen,mobile]);
  useEffect(()=>{if(nearBottom.current&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;},[messages,job?.text]);
  // Reopened pages follow persisted jobs instead of submitting the same message twice.
  useEffect(()=>{
    if(!job||ended(job)||busy)return;let cancelled=false;let timer;
    async function poll(){try{const next=await chatAPI(`jobs/${job.id}`);if(cancelled)return;setJob(next);setView(current=>current?{...current,messages:current.messages.map(m=>m.id===next.messageId?{...m,text:next.text,status:next.status,sources:next.sources}:m)}:current);if(ended(next)){await reloadThread(next.threadId);await refreshList();window.dispatchEvent(new Event('credits-changed'));}else timer=setTimeout(poll,1000);}catch(e){if(!cancelled){setError(e.message);timer=setTimeout(poll,2500);}}}
    timer=setTimeout(poll,700);return()=>{cancelled=true;clearTimeout(timer);};
  },[job?.id,job?.status,busy]);
  async function changeSettings(next){if(isBusy)return;setError('');try{if(active){const thread=await chatAPI(`threads/${active}`,{method:'PATCH',body:{options:next}});setView(current=>({...current,thread}));setSettings(thread.options);}else setSettings(next);}catch(e){setError(e.message);}}
  async function generate(payload,retry){
    if(isBusy||loading||archivedThread)return;setError('');setBusy(true);nearBottom.current=true;setJump(false);
    let id=activeRef.current,key=retry?.key||crypto.randomUUID(),started=false;const text=payload.text||'';const controller=new AbortController();connection.current=controller;
    try{
      if(!id){const thread=await chatAPI('threads',{method:'POST',body:{options:settings}});id=thread.id;activeRef.current=id;setActive(id);storage.set(prefix+'active',id);setView({thread,messages:[],allMessages:[]});}
      const request={key,payload,threadId:id};setPending(request);storage.set(prefix+'pending',JSON.stringify(request));
      const response=await fetch(`/api/chat/threads/${id}/generate`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'X-Credit-Limit':String(meta.price)},body:JSON.stringify(payload),signal:controller.signal});
      if(!response.ok){const result=await response.json();throw Object.assign(new Error(result.error||'发送失败，请重试'),result);}
      for await(const frame of readSSE(response.body)){
        if(!mounted.current)break;const data=JSON.parse(frame.data);
        if(frame.event==='start'){
          started=true;setDraft('');storage.set(prefix+'draft:new','');setEdit(null);setJob({id:data.jobId,threadId:id,messageId:data.messageId,status:'running',text:''});
          await reloadThread(id);
          setView(current=>current?{...current,messages:current.messages.map(m=>m.id===data.messageId?{...m,text:'',status:'generating'}:m)}:current);
        }else if(frame.event==='delta')setView(current=>current?{...current,messages:current.messages.map(m=>m.role==='assistant'&&m.id===current.thread.headId?{...m,text:m.text+data.text}:m)}:current);
        else if(frame.event==='snapshot'||frame.event==='pending'){setJob(data);await reloadThread(id);}
        else if(frame.event==='done'){setJob(data);setPending(null);storage.set(prefix+'pending','');if(data.status!=='completed')setError(data.error||'生成未完成，积分已退回');}
        else if(frame.event==='error')throw new Error(data.error);
      }
      await reloadThread(id);await refreshList();
    }catch(e){
      if(!mounted.current)return;
      if(e.name!=='AbortError')setError(e.message);
      if(id){try{const result=await reloadThread(id);if(result.job&&!ended(result.job))setPending(null);}catch{}}
      if(!started&&text)setDraft(text);
    }finally{if(mounted.current){setBusy(false);connection.current=null;window.dispatchEvent(new Event('credits-changed'));}}
  }
  async function stop(){if(!job)return;try{const result=await chatAPI(`jobs/${job.id}/cancel`,{method:'POST',body:{}});setJob(result);if(result.status==='cancelling')connection.current?.abort();}catch(e){setError(e.message);}}
  async function selectVersion(id){try{const result=await chatAPI(`threads/${active}/select`,{method:'POST',body:{messageId:id}});setView(result);setJob(result.job);}catch(e){setError(e.message);}}
  async function copy(text){try{await navigator.clipboard.writeText(text);notify?.('已复制');}catch{setError('浏览器无法复制，请选中文字后复制');}}
  async function feedback(message,value){try{const updated=await chatAPI(`threads/${active}/feedback`,{method:'POST',body:{messageId:message.id,feedback:message.feedback===value?null:value}});setView(current=>({...current,messages:current.messages.map(m=>m.id===message.id?updated:m)}));}catch(e){setError(e.message);}}
  function readAloud(message){if(!window.speechSynthesis){setError('此浏览器暂不支持朗读');return;}window.speechSynthesis.cancel();if(speaking===message.id){setSpeaking(null);return;}const utterance=new SpeechSynthesisUtterance(message.text);utterance.lang='zh-CN';const selectedVoice=window.speechSynthesis.getVoices().find(voice=>voice.name===persona?.voiceName);if(selectedVoice)utterance.voice=selectedVoice;utterance.onend=()=>setSpeaking(null);utterance.onerror=()=>setSpeaking(null);setSpeaking(message.id);window.speechSynthesis.speak(utterance);}
  async function openMemories(){try{const result=await chatAPI('memories');setMemories(result.memories);setSelected(settings.memoryIds);setMemoryQuery('');setDialog({type:'memories'});}catch(e){setError(e.message);}}
  async function threadAction(type){try{
    if(type==='rename')await chatAPI(`threads/${active}`,{method:'PATCH',body:{title:dialogText}});
    else if(type==='delete'){await chatAPI(`threads/${active}`,{method:'DELETE'});newChat();}
    else await chatAPI(`threads/${active}`,{method:'PATCH',body:{archived:!archivedThread}});
    setDialog(null);if(type!=='delete')await reloadThread(active);await refreshList();
  }catch(e){setError(e.message);}}
  const heading=view?.thread.title||'新对话';
  return <div className={`cw-workspace ${sidebar?'':'cw-collapsed'} ${historyOpen?'cw-history-open':''}`}>
    {historyOpen&&<button className="cw-drawer-backdrop" aria-label="关闭历史会话" onClick={()=>setHistoryOpen(false)}/>}
    <aside id="chat-history" ref={historyRef} className="cw-history" aria-label="历史会话" role={mobile&&historyOpen?'dialog':undefined} aria-modal={mobile&&historyOpen?true:undefined}>
      <div className="cw-history-top"><strong>陪伴对话</strong><Tool label="关闭历史会话" icon="close" onClick={()=>setHistoryOpen(false)}/></div>
      <button className="cw-new" onClick={newChat} disabled={busy}><Icon name="edit" size={18}/>新对话<Icon name="plus" size={14}/></button>
      <label className="cw-search"><Icon name="search" size={17}/><input aria-label="搜索历史会话" placeholder="搜索对话" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="cw-history-tabs"><button aria-pressed={!archived} onClick={()=>setArchived(false)}>最近对话</button><button aria-pressed={archived} onClick={()=>setArchived(true)}><Icon name="archive" size={14}/>已归档</button></div>
      <div className="cw-history-list">{threads.map(thread=><button key={thread.id} disabled={busy} className={`cw-history-item ${active===thread.id?'selected':''}`} aria-current={active===thread.id?'true':undefined} onClick={()=>loadThread(thread.id)}><Icon name="message" size={16}/><span>{thread.title}</span></button>)}{!threads.length&&<p className="cw-history-empty">{query?'没有找到相关对话':archived?'归档的对话会保留在这里':'聊过的话，会留在这里。'}</p>}{hasMore&&<button className="cw-more" onClick={()=>refreshList(true)}>加载更多</button>}</div>
      <div className="cw-history-foot"><Icon name="lock" size={15}/><span>聊天记录仅自己可见<br/>家庭记忆由家人共同维护</span></div>
    </aside>
    <section ref={mainRef} className="cw-main" aria-label="聊天工作区">
      <header className="cw-header"><div className="cw-header-left"><button className="cw-tool cw-back" aria-label="返回联系页" onClick={()=>onBack?.(persona)}><Icon name="back" size={23}/></button><PersonaAvatar profile={persona}/><div className="cw-contact-name"><h1 title={heading}>{displayName}</h1><small>AI 陪伴</small></div></div><div className="cw-header-actions"><button className="cw-tool cw-voice-action" aria-label="语音输入" onClick={()=>setSpeech(true)}><Icon name="phone" size={23}/></button><button ref={historyToggle} className="cw-tool cw-history-toggle" aria-label="展开历史会话" aria-controls="chat-history" aria-expanded={mobile?historyOpen:sidebar} onClick={()=>mobile?setHistoryOpen(value=>!value):setSidebar(value=>!value)}><Icon name="message" size={23}/></button><details className="cw-menu"><summary aria-label="对话菜单"><Icon name="more"/></summary><div><small>{meta?.ai.model||'尚未配置模型'} · {heading}</small><button disabled={isBusy} onClick={()=>{document.querySelector('.cw-header .cw-menu')?.removeAttribute('open');setDialog({type:'options'});}}><Icon name="settings" size={16}/>聊天设置</button><button disabled={busy} onClick={newChat}><Icon name="plus" size={16}/>新对话</button>{active&&<><button disabled={isBusy} onClick={()=>{setDialogText(heading);setDialog({type:'rename'});}}><Icon name="edit" size={16}/>重命名</button><button disabled={isBusy} onClick={()=>threadAction('archive')}><Icon name="archive" size={16}/>{archivedThread?'恢复对话':'归档对话'}</button><button disabled={isBusy} onClick={()=>setDialog({type:'delete'})}><Icon name="trash" size={16}/>删除对话</button></>}</div></details></div></header>
      <div className="cw-feed" ref={feed} onScroll={()=>{const element=feed.current;nearBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;setJump(!nearBottom.current);}}>
        {loading?<div className="cw-loading" role="status"><span className="spinner"/>正在打开对话…</div>:messages.length===0?<div className="cw-welcome"><PersonaAvatar profile={persona} large/><h2>开始和{displayName}聊聊</h2><p>从今天的小事开始，也可以问问家人已经核对的回忆。</p><small>这是 AI 陪伴，不代表任何真实家人。</small></div>:<div className="cw-message-list" role="log" aria-label="聊天消息">
          {messages.map(message=>{const user=message.role==='user',siblings=(view.allMessages||[]).filter(m=>m.role===message.role&&m.parentId===message.parentId),version=siblings.findIndex(m=>m.id===message.id),generating=message.status==='generating'||(job?.messageId===message.id&&!ended(job));
            return <article key={message.id} className={`cw-message ${user?'cw-user':'cw-assistant'}`} aria-label={user?'你的消息':'家伴的回复'}>
              {!user&&<div className="cw-speaker"><PersonaAvatar profile={persona}/><span>{displayName}</span></div>}
              {edit===message.id?<div className="cw-edit-message"><textarea aria-label="编辑消息" value={editText} maxLength={8000} onChange={e=>setEditText(e.target.value)}/><small>将生成新的对话分支，原版本仍会保留。成功回复 {meta?.price} 积分。</small><div><Button variant="ghost" onClick={()=>setEdit(null)}>取消</Button><Button disabled={isBusy||!editText.trim()} onClick={()=>generate({action:'edit',messageId:message.id,text:editText})}>保存并重新生成</Button></div></div>:user?<p className="cw-user-text">{message.text}</p>:message.text?<RichText text={message.text}/>:generating?<p className="cw-thinking" role="status"><span/>正在想一想…</p>:<p className="muted">这次没有生成回复。</p>}
              {!user&&Boolean(message.sources?.length)&&<div className="cw-sources"><span><Icon name="book" size={14}/>参考家庭记忆</span>{message.sources.map(source=><button key={source.id} onClick={()=>onOpenMemory?.(source.id)}>{source.title}<Icon name="arrow" size={13}/></button>)}</div>}
              {!user&&['failed','stopped'].includes(message.status)&&<p className="cw-message-status"><Icon name="info" size={14}/>{message.status==='stopped'?'已停止':'回复未完成'} · 积分已退回</p>}
              {!generating&&edit!==message.id&&<div className="cw-message-actions"><Tool label="复制消息" icon="copy" onClick={()=>copy(message.text)} disabled={!message.text}/>{user?<Tool label="编辑消息" icon="edit" disabled={isBusy||archivedThread} onClick={()=>{setEdit(message.id);setEditText(message.text);}}/>:<><Tool label="重新生成" icon="repeat" disabled={isBusy||archivedThread} onClick={()=>generate({action:'regenerate',messageId:message.id})}/><Tool label={speaking===message.id?'停止朗读':'朗读回复'} icon={speaking===message.id?'stop':'volume'} onClick={()=>readAloud(message)} disabled={!message.text}/><Tool label="有帮助" icon="thumbs-up" pressed={message.feedback==='up'} onClick={()=>feedback(message,'up')}/><Tool label="需要改进" icon="thumbs-down" pressed={message.feedback==='down'} onClick={()=>feedback(message,'down')}/>{canEdit&&onSaveMemory&&<Tool label="存为记忆草稿" icon="book" disabled={!message.text} onClick={()=>onSaveMemory({story:message.text.slice(0,6000),title:'',draftId:message.id})}/>}</>}{siblings.length>1&&<div className="cw-versions"><Tool label="上一个版本" icon="back" disabled={isBusy||version<=0} onClick={()=>selectVersion(siblings[version-1].id)}/><span>{version+1} / {siblings.length}</span><Tool label="下一个版本" icon="arrow" disabled={isBusy||version>=siblings.length-1} onClick={()=>selectVersion(siblings[version+1].id)}/></div>}</div>}
            </article>;})}
        </div>}
      </div>
      <div className="cw-quick-replies" aria-label="快捷短语">{['你好',`嗨，${displayName}`,'谢谢你的建议','想聊聊今天','找一段回忆'].map((text,index)=><button key={text} className={index===0?'selected':''} disabled={isBusy||!meta?.ai.ready} onClick={()=>{setDraft(text);input.current?.focus();}}>{text}</button>)}</div>
      <div className="cw-compose-area">{jump&&<button className="cw-jump" onClick={()=>{nearBottom.current=true;feed.current.scrollTo({top:feed.current.scrollHeight,behavior:'smooth'});setJump(false);}}><Icon name="down" size={16}/>回到最新消息</button>}
        {error&&<div className="cw-error" role="alert"><Icon name="info" size={17}/><span>{error}</span>{pending&&!isBusy&&<button onClick={()=>generate(pending.payload,pending)}>重试本次请求</button>}<button aria-label="关闭错误提示" onClick={()=>setError('')}><Icon name="close" size={16}/></button></div>}
        {!meta?.ai.ready&&meta&&<p className="cw-service-note">陪伴服务尚未开启，请联系管理员。历史记录仍可查看。</p>}
        {archivedThread?<div className="cw-archived-note"><Icon name="archive" size={18}/>这段对话已归档。<button onClick={()=>threadAction('archive')}>恢复并继续聊</button></div>:<form className="cw-composer" onSubmit={e=>{e.preventDefault();if(draft.trim())generate({text:draft});}}>
          <textarea ref={input} aria-label="发送给家伴的消息" placeholder={meta?.ai.ready?'向家伴发送消息…':'服务尚未开启'} value={draft} maxLength={8000} rows={2} disabled={!meta?.ai.ready||loading} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(draft.trim()&&!isBusy)generate({text:draft});}}}/>
          <div className="cw-composer-bar"><div className="cw-composer-tools"><button type="button" className="cw-tool" aria-label="打开语音输入" onClick={()=>setSpeech(true)}><Icon name="mic" size={20}/></button><button type="button" className="cw-tool" aria-label={canEdit?'记录一段回忆':'引用家庭记忆'} onClick={()=>canEdit?onRecord?.():openMemories()}><Icon name="camera" size={20}/></button></div>{isBusy?<button type="button" className="cw-send cw-stop" aria-label="停止生成" onClick={stop} disabled={!job||job.status==='committing'}><Icon name="stop" size={18}/></button>:<button type="submit" className="cw-send" aria-label="发送消息" disabled={!draft.trim()||!meta?.ai.ready||loading}><Icon name="send" size={19}/></button>}</div>
        </form>}
        <div className="cw-compose-note"><span>成功回复 {meta?.price||1} 积分 · 失败或停止退回</span><span>Enter 发送 · Shift + Enter 换行</span></div><p className="cw-disclaimer">AI 的回答可能有误，家庭往事请核对原文。朗读使用设备合成声音。</p>
      </div>
    </section>
    {speech&&!loading&&<SpeechComposer onClose={()=>setSpeech(false)} onUse={text=>{setDraft(text);setSpeech(false);requestAnimationFrame(()=>input.current?.focus());}}/>}
    {dialog?.type==='options'&&<Modal title="聊天设置" onClose={()=>setDialog(null)}><p className="fa-dialog-hint">设定会保存在当前对话；每次成功回复 {meta?.price||1} 积分。</p><div className="cw-options"><label title="对话方式"><select aria-label="对话方式" disabled={isBusy} value={settings.mode} onChange={e=>changeSettings({...settings,mode:e.target.value})}>{(meta?.modes||[]).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><Icon name="down" size={13}/></label><label title="表达风格"><select aria-label="表达风格" disabled={isBusy} value={settings.tone} onChange={e=>changeSettings({...settings,tone:e.target.value})}>{(meta?.tones||[]).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><Icon name="down" size={13}/></label><details className="cw-menu cw-memory-menu"><summary aria-label="家庭记忆选项"><Icon name="book" size={16}/><span>{settings.memoryMode==='off'?'不引用':settings.memoryMode==='selected'?`记忆 ${settings.memoryIds.length}`:'家庭记忆'}</span><Icon name="down" size={13}/></summary><div><small>只参考家人已确认的内容</small><button disabled={isBusy} onClick={()=>changeSettings({...settings,memoryMode:'auto'})}><Icon name={settings.memoryMode==='auto'?'check':'search'} size={16}/>自动查找相关记忆</button><button disabled={isBusy} onClick={openMemories}><Icon name="book" size={16}/>选择家庭记忆…</button><button disabled={isBusy} onClick={()=>changeSettings({...settings,memoryMode:'off'})}><Icon name={settings.memoryMode==='off'?'check':'close'} size={16}/>本轮不引用记忆</button></div></details></div><div className="modal-actions"><Button onClick={()=>setDialog(null)}>完成</Button></div></Modal>}
    {dialog?.type==='rename'&&<Modal title="重命名对话" onClose={()=>setDialog(null)}><form onSubmit={e=>{e.preventDefault();threadAction('rename');}}><label className="field">对话名称<input autoFocus value={dialogText} maxLength={80} onChange={e=>setDialogText(e.target.value)}/></label><div className="modal-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button type="submit" disabled={!dialogText.trim()}>保存</Button></div></form></Modal>}
    {dialog?.type==='delete'&&<Modal title="删除这段对话？" onClose={()=>setDialog(null)}><p>删除后无法恢复聊天记录。积分消费记录会保留。</p><div className="modal-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button onClick={()=>threadAction('delete')}>确认删除</Button></div></Modal>}
    {dialog?.type==='memories'&&<Modal title="选择家庭记忆" description="最多选 6 段已确认的记忆，家伴只会参考所选内容。" onClose={()=>setDialog(null)}><label className="cw-search"><Icon name="search" size={18}/><input aria-label="搜索可引用的记忆" placeholder="搜索标题或年份" value={memoryQuery} onChange={e=>setMemoryQuery(e.target.value)}/></label><div className="cw-memory-picker">{memories.filter(m=>(m.title+String(m.year||'')).includes(memoryQuery)).map(memory=><label key={memory.id}><input type="checkbox" checked={selected.includes(memory.id)} disabled={selected.length>=6&&!selected.includes(memory.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,memory.id]:ids.filter(id=>id!==memory.id))}/><span><strong>{memory.title}</strong><small>{memory.year||'年份待补充'}</small></span></label>)}{!memories.length&&<p>还没有已确认的家庭记忆。家人确认发布后，就能在这里选择。</p>}</div><div className="modal-actions"><span>{selected.length} / 6 段</span><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button onClick={async()=>{await changeSettings({...settings,memoryMode:'selected',memoryIds:selected});setDialog(null);}}>使用所选记忆</Button></div></Modal>}
  </div>;
}

