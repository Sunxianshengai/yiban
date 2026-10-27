'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {readSSE} from '../lib/sse.mjs';
import Icon from './Icon';
import {Button,Modal} from './UI';
import {PersonaAvatar,SpeechComposer} from './Familia';
import {CreditBalance} from './Credits';
import PersonalMemory from './PersonalMemory';
import CompanionDetails from './CompanionDetails';
import ProactiveSettings,{proactiveAPI} from './ProactiveSettings';
import {chatAPI} from '../lib/chat-client.mjs';
import {uploadMedia} from '../lib/upload-client.mjs';
import {DEFAULT_COMPANION,COMPANION_STICKERS,stickerById,partDelayMs} from '../lib/companion-chat.mjs';
async function walletAPI(path){const response=await fetch('/api'+path,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}

const DEFAULTS={mode:'daily',tone:'natural',memoryMode:'off',memoryIds:[]};
const ended=job=>!job||['completed','failed','stopped'].includes(job.status);
const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
function Tool({label,icon,onClick,disabled,pressed}){return <button type="button" className="cw-tool" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}><Icon name={icon} size={17}/><span className="pw-tool-caption">{label==='复制消息'?'复制':label==='重新生成'?'重新生成':label==='朗读回复'?'朗读':label}</span></button>;}
function CodeBlock({children,...props}){
  const ref=useRef(null);const[copied,setCopied]=useState(false);
  return <div className="cw-code"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(ref.current?.textContent||'');setCopied(true);}catch{setCopied(false);}}}>{copied?'已复制':'复制代码'}</button><pre {...props} ref={ref}>{children}</pre></div>;
}
function RichText({text}){return <div className="cw-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{pre:CodeBlock,a:({node,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>,img:({alt})=><span>[图片：{alt||'外部图片'}]</span>}}>{text}</ReactMarkdown></div>;}
// 逐条露出：按当前已露出的条数，算出下一条还需要等多久。
// 只在「正在生成的最后一条消息」上生效；刷新页面或生成结束后直接显示全文。
function usePacedReveal(message,generating,revealed,setRevealed){
  const key=message?.id,count=message?.parts?.length||0;
  useEffect(()=>{
    if(!generating||!key)return;
    const shown=revealed[key]??1;
    if(shown>=count)return;
    const timer=setTimeout(()=>setRevealed(current=>{const next={...current};next[key]=Math.min(count,(current[key]??1)+1);return next;}),partDelayMs(message.parts,shown));
    return()=>clearTimeout(timer);
  },[key,count,generating,revealed,message?.parts]);
}

export default function Chat({accountId='me',accountName='',accountAvatar=null,forceProfile=false,defaultProfile=DEFAULT_COMPANION,onCreate,onEditPersona,notify,onOpenMemory,onSaveMemory,canEdit=false,profiles=[],profileId=null,onBack,onRecord,openSpeech=false,onCredits,api=null,remoteStorage=false}){
  const[meta,setMeta]=useState(null),[threads,setThreads]=useState([]),[hasMore,setHasMore]=useState(false),[query,setQuery]=useState(''),[archived,setArchived]=useState(false);
  const[active,setActive]=useState(null),[view,setView]=useState(null),[settings,setSettings]=useState({...DEFAULTS,profileId}),[draft,setDraft]=useState(''),[job,setJob]=useState(null);
  const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[historyOpen,setHistoryOpen]=useState(false),[sidebar,setSidebar]=useState(false),[mobile,setMobile]=useState(false),[speech,setSpeech]=useState(openSpeech);
  const[actionMessage,setActionMessage]=useState(null),[dialog,setDialog]=useState(null),[dialogText,setDialogText]=useState(''),[memories,setMemories]=useState([]),[memoryQuery,setMemoryQuery]=useState(''),[selected,setSelected]=useState([]);
  const[personalDialog,setPersonalDialog]=useState(null);
  const[leftTab,setLeftTab]=useState('contacts'),[panel,setPanel]=useState(null),[menuPosition,setMenuPosition]=useState({left:20,top:160}),[queued,setQueued]=useState([]),[chatTheme,setChatTheme]=useState(()=>storage.get(`yiban:companion-theme:${accountId}`)||'light');
  const queuedRef=useRef([]),queueCancel=useRef(null),submitRef=useRef(null);
  queuedRef.current=queued;
  const closePanel=useCallback(()=>setPanel(null),[]);
  const [proactiveMessage,setProactiveMessage]=useState(null);
  const presenceAt=useRef(0);

  const[edit,setEdit]=useState(null),[editText,setEditText]=useState(''),[jump,setJump]=useState(false),[speaking,setSpeaking]=useState(null),[pending,setPending]=useState(null);
  // 引用回复：指向某条消息的引用条，发送时随 payload 带给服务端。
  const[replyTo,setReplyTo]=useState(null);const replyRef=useRef(null);replyRef.current=replyTo;
  // 聊天图片：选图立即上传，全部就绪后随消息一起发；最多 4 张，10 MB 内。
  const[images,setImages]=useState([]);const imagesRef=useRef([]);useEffect(()=>{imagesRef.current=images;},[images]);
  const[viewer,setViewer]=useState(null);
  const albumInput=useRef(null);
  async function addImages(fileList){
    const files=[...fileList].filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size&&file.size<=10*1024*1024);
    if(!files.length){setError('支持 10 MB 内的 JPG、PNG、WebP 图片');return;}
    const room=Math.max(0,4-imagesRef.current.length);
    if(!room){setError('一次最多发 4 张图片');return;}
    const items=files.slice(0,room).map(file=>({id:crypto.randomUUID(),file,status:'uploading',preview:URL.createObjectURL(file)}));
    setImages(current=>[...current,...items]);
    for(const item of items){
      try{const result=await uploadMedia(api,item.file,{remoteStorage,maxBytes:10*1024*1024});
        setImages(current=>current.map(entry=>entry.id===item.id?{...entry,status:'ready',url:result.url}:entry));
      }catch(failure){setImages(current=>current.map(entry=>entry.id===item.id?{...entry,status:'failed',error:failure.message}:entry));}
    }
  }
  function removeImage(id){setImages(current=>{const target=current.find(entry=>entry.id===id);if(target?.preview)URL.revokeObjectURL(target.preview);return current.filter(entry=>entry.id!==id);});}
  async function retryImage(item){setImages(current=>current.map(entry=>entry.id===item.id?{...entry,status:'uploading',error:null}:entry));try{const result=await uploadMedia(api,item.file,{remoteStorage,maxBytes:10*1024*1024});setImages(current=>current.map(entry=>entry.id===item.id?{...entry,status:'ready',url:result.url}:entry));}catch(failure){setImages(current=>current.map(entry=>entry.id===item.id?{...entry,status:'failed',error:failure.message}:entry));}}
  useEffect(()=>{if(!viewer)return;function key(event){if(event.key==='Escape')setViewer(null);if(viewer.images.length>1&&(event.key==='ArrowLeft'||event.key==='ArrowRight'))setViewer(current=>current&&{...current,index:(current.index+(event.key==='ArrowRight'?1:-1)+current.images.length)%current.images.length});}document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[viewer]);
  // 发送可靠性：还没被服务端确认的用户消息放在 outbox 里，逐条显示「发送中／失败可重试」。
  // 与服务端的 requestKey 去重配合——重试复用同一个 key，不会重复扣积分或发出两条消息。
  const[outbox,setOutbox]=useState([]);
  function loadOutbox(id){try{const parsed=JSON.parse(storage.get(prefix+'outbox:'+(id||'new'))||'[]');return Array.isArray(parsed)?parsed.filter(item=>item&&item.key&&typeof item.text==='string'&&item.payload):[];}catch{return[];}}
  function updateOutbox(id,update){setOutbox(current=>{const next=update(current);storage.set(prefix+'outbox:'+(id||'new'),JSON.stringify(next));return next;});}
  // 重新打开会话时对账：文本已经在服务端消息里的直接清掉（避免和服务端消息重复显示），
  // 剩下的一律按失败处理，让用户决定重试还是存回草稿。
  function reconcileOutbox(id,messages){const stored=loadOutbox(id);if(!stored.length)return;const texts=new Set(messages.filter(m=>m.role==='user').map(m=>m.text));updateOutbox(id,()=>stored.filter(item=>item.status==='failed'||!texts.has(item.text)).map(item=>item.status==='failed'?item:{...item,status:'failed'}));}
  // 多条消息的呈现节奏：服务端一次给出全部段落，这里逐条露出，
  // 让「一句话一条消息」看起来像人在打字，而不是一次性刷屏。
  const[revealed,setRevealed]=useState({}),[greeting,setGreeting]=useState(null),revealTimer=useRef(null);
  const longPress=useRef(null),feed=useRef(null),input=useRef(null),nearBottom=useRef(true),sequence=useRef(0),mounted=useRef(true),connection=useRef(null),activeRef=useRef(null),listSequence=useRef(0),historyRef=useRef(null),mainRef=useRef(null),historyToggle=useRef(null);
  const prefix=`yiban:chat:${accountId}:`;const isBusy=busy||!ended(job);const archivedThread=Boolean(view?.thread.archived);
  const messages=view?.messages||[];
  const currentProfileId=view?.thread?view.thread.options.profileId:settings.profileId;
  const persona=profiles.find(profile=>profile.id===currentProfileId)||null;
  const currentPersona=persona||defaultProfile;
  const displayName=currentPersona.name||'小满';
  useEffect(()=>{if(loading)return;const target=new URLSearchParams(location.search).get('message');if(target)document.getElementById('chat-message-'+target)?.scrollIntoView({block:'center'});},[loading,active]);
  useEffect(()=>{
    let live=true;
    async function check(){if(document.visibilityState!=='visible')return;try{await proactiveAPI('activity',{method:'POST',body:{profileId:currentProfileId||null,typing:Boolean(draft)}});if(!isBusy&&activeRef.current)await reloadThread(activeRef.current);if(live)await refreshList();}catch{}}
    const timer=setInterval(check,30000);check();const changed=()=>check();window.addEventListener('focus',changed);document.addEventListener('visibilitychange',changed);navigator.serviceWorker?.addEventListener('message',changed);
    return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',changed);document.removeEventListener('visibilitychange',changed);navigator.serviceWorker?.removeEventListener('message',changed);};
  },[accountId,currentProfileId,isBusy]);
  useEffect(()=>{if(!draft||Date.now()-presenceAt.current<15000)return;presenceAt.current=Date.now();proactiveAPI('activity',{method:'POST',body:{profileId:currentProfileId||null,typing:true}}).catch(()=>{});},[draft,currentProfileId]);
  useEffect(()=>{const last=messages.at(-1);if(!last||loading||document.visibilityState!=='visible'||!nearBottom.current)return;proactiveAPI('read',{method:'POST',body:{messageId:last.id}}).catch(()=>{});},[messages.at(-1)?.id,loading]);

  async function refreshList(append=false){const ticket=++listSequence.current;try{const result=await chatAPI(`threads?q=${encodeURIComponent(query)}&archived=${archived}&offset=${append?threads.length:0}`);if(mounted.current&&ticket===listSequence.current){setThreads(previous=>append?[...previous,...result.threads]:result.threads);setHasMore(result.hasMore);}}catch(e){if(mounted.current)setError(e.message);}}
  async function loadThread(id){
    if(queuedRef.current.length)return;
    const ticket=++sequence.current;activeRef.current=id;setActive(id);setView(null);setJob(null);setPending(null);setEdit(null);setError('');setHistoryOpen(false);setLoading(true);nearBottom.current=true;setReplyTo(null);setImages([]);setViewer(null);
    setOutbox([]);
    storage.set(prefix+'active',id||'');setDraft(storage.get(prefix+'draft:'+id)||'');
    try{const result=await chatAPI(`threads/${id}`);if(mounted.current&&sequence.current===ticket){setView(result);setSettings(result.thread.options);setJob(result.job);reconcileOutbox(id,result.messages||[]);}}
    catch(e){if(mounted.current&&sequence.current===ticket)setError(e.message);}finally{if(mounted.current&&sequence.current===ticket)setLoading(false);}
  }
  async function reloadThread(id){const result=await chatAPI(`threads/${id}`);if(mounted.current&&activeRef.current===id){setView(result);setSettings(result.thread.options);setJob(result.job);}return result;}
  function newChat(nextProfileId=currentProfileId){sequence.current++;activeRef.current=null;setActive(null);setView(null);setJob(null);setSettings({...DEFAULTS,profileId:typeof nextProfileId==='string'?nextProfileId:null});setDraft(storage.get(prefix+'draft:new')||'');setError('');setEdit(null);setPending(null);setReplyTo(null);setImages([]);setViewer(null);setOutbox([]);setLoading(false);setHistoryOpen(false);storage.set(prefix+'active','');requestAnimationFrame(()=>input.current?.focus());}
  useEffect(()=>{
    mounted.current=true;
    (async()=>{try{const [info,result]=await Promise.all([chatAPI('meta'),chatAPI('threads')]);if(!mounted.current)return;setMeta(info);setThreads(result.threads);setHasMore(result.hasMore);const deep=new URLSearchParams(location.search).get('chat');const saved=deep||storage.get(prefix+'active');if(saved){const previous=await chatAPI(`threads/${saved}`);if(forceProfile&&(previous.thread.options.profileId??null)!==(profileId??null)){const matching=result.threads.find(thread=>(thread.options.profileId??null)===(profileId??null));if(matching)await loadThread(matching.id);else newChat(profileId);}else await loadThread(saved);}else{setDraft(storage.get(prefix+'draft:new')||'');setLoading(false);}}catch(e){if(mounted.current){setError(e.message);setLoading(false);}}})();
    return()=>{mounted.current=false;connection.current?.abort();window.speechSynthesis?.cancel();};
  },[accountId]);
  useEffect(()=>{const timer=setTimeout(()=>refreshList(),250);return()=>clearTimeout(timer);},[query,archived]);
  useEffect(()=>{if(loading)return;storage.set(prefix+'draft:'+(active||'new'),draft);if(input.current){input.current.style.height='auto';input.current.style.height=`${Math.min(200,input.current.scrollHeight)}px`;}},[draft,active,loading]);
  useEffect(()=>{
    function dismiss(event){document.querySelectorAll('.cw-menu[open]').forEach(menu=>{if(event.type==='keydown'||!menu.contains(event.target))menu.removeAttribute('open');});if(event.key==='Escape'){setHistoryOpen(false);setActionMessage(null);}}
    function escape(event){if(event.key==='Escape')dismiss(event);}
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[]);
  useEffect(()=>{const media=window.matchMedia('(max-width:768px)');setMobile(media.matches);setSidebar(window.matchMedia('(min-width:1181px)').matches);const change=()=>{setMobile(media.matches);setHistoryOpen(false);if(window.innerWidth<1181)setSidebar(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
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
    async function poll(){try{const next=await chatAPI(`jobs/${job.id}`);if(cancelled)return;setJob(next);setView(current=>current?{...current,messages:current.messages.map(m=>m.id===next.messageId?{...m,text:next.text,parts:next.parts||m.parts,status:next.status,sources:next.sources}:m)}:current);if(ended(next)){await reloadThread(next.threadId);await refreshList();window.dispatchEvent(new Event('credits-changed'));}else timer=setTimeout(poll,1000);}catch(e){if(!cancelled){setError(e.message);timer=setTimeout(poll,2500);}}}
    timer=setTimeout(poll,700);return()=>{cancelled=true;clearTimeout(timer);};
  },[job?.id,job?.status,busy]);
  async function changeSettings(next){if(isBusy)return;setError('');try{if(active){const thread=await chatAPI(`threads/${active}`,{method:'PATCH',body:{options:next}});setView(current=>({...current,thread}));setSettings(thread.options);}else setSettings(next);}catch(e){setError(e.message);}}
  async function generate(payload,retry){
    if(isBusy||loading||archivedThread)return;setError('');setBusy(true);nearBottom.current=true;setJump(false);
    let id=activeRef.current,key=retry?.key||crypto.randomUUID(),started=false;const text=payload.text||payload.texts?.join('\n')||'';const controller=new AbortController();connection.current=controller;
    // 只有普通发送进 outbox；编辑/重新生成/换种说法走各自的消息状态，不在这条链路上。
    const outboxText=payload.texts?payload.texts.map(item=>item.trim()).join('\n'):String(payload.text||'').trim();
    const payloadImages=Array.isArray(payload.images)?payload.images:[];
    const trackable=(!payload.action||payload.action==='send')&&!payload.stickerId&&(Boolean(outboxText)||payloadImages.length>0);
    // 引用回复：普通发送时把当前引用条带进 payload；服务端受理后清掉引用条。
    if(trackable&&replyRef.current)payload={replyTo:replyRef.current.id,...payload};
    try{
      if(!id){const thread=await chatAPI('threads',{method:'POST',body:{options:settings}});id=thread.id;activeRef.current=id;setActive(id);storage.set(prefix+'active',id);setView({thread,messages:[],allMessages:[]});}
      if(trackable)updateOutbox(id,items=>[...items.filter(item=>item.key!==key),{key,text:outboxText,images:payloadImages,status:'sending',payload:{...payload},threadId:id,createdAt:Date.now()}]);
      const request={key,payload,threadId:id};setPending(request);storage.set(prefix+'pending',JSON.stringify(request));
      const response=await fetch(`/api/chat/threads/${id}/generate`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,'X-Credit-Limit':String(meta.price)},body:JSON.stringify(payload),signal:controller.signal});
      if(!response.ok){const result=await response.json();throw Object.assign(new Error(result.error||'发送失败，请重试'),result);}
      // 服务端已经受理（用户消息已入库），outbox 条目由服务端消息接管显示。
      if(trackable){updateOutbox(id,items=>items.filter(item=>item.key!==key));setReplyTo(null);}
      for await(const frame of readSSE(response.body)){
        if(!mounted.current)break;const data=JSON.parse(frame.data);
        if(frame.event==='start'){
          started=true;setEdit(null);setJob({id:data.jobId,threadId:id,messageId:data.messageId,status:'running',text:''});
          await reloadThread(id);
          setView(current=>current?{...current,messages:current.messages.map(m=>m.id===data.messageId?{...m,text:'',status:'generating'}:m)}:current);
        }else if(frame.event==='delta')setView(current=>current?{...current,messages:current.messages.map(m=>m.role==='assistant'&&m.id===current.thread.headId?{...m,text:data.fullText??m.text+data.text,parts:data.parts||m.parts}:m)}:current);
        else if(frame.event==='snapshot'||frame.event==='pending'){setJob(data);await reloadThread(id);}
        else if(frame.event==='done'){setJob(data);setPending(null);storage.set(prefix+'pending','');if(data.status!=='completed')setError(data.error||'生成未完成，积分已退回');}
        else if(frame.event==='error')throw new Error(data.error);
      }
      await reloadThread(id);await refreshList();
    }catch(e){
      if(!mounted.current)return;
      if(e.name!=='AbortError')setError(e.message);
      if(id){try{const result=await reloadThread(id);if(result.job&&!ended(result.job))setPending(null);}catch{}}
      if(!started){
        if(trackable)updateOutbox(id,items=>items.map(item=>item.key===key?{...item,status:'failed'}:item));
        else setDraft(current=>[text,...queuedRef.current,current].filter(Boolean).join('\n').slice(0,8000));
        setQueued([]);
      }
    }finally{if(mounted.current){setBusy(false);connection.current=null;window.dispatchEvent(new Event('credits-changed'));}}
  }
  async function stop(){if(!job)return;try{const result=await chatAPI(`jobs/${job.id}/cancel`,{method:'POST',body:{}});setJob(result);if(result.status==='cancelling')connection.current?.abort();}catch(e){setError(e.message);}}
  async function retryOutbox(item){
    if(isBusy||loading)return;setError('');
    updateOutbox(item.threadId||activeRef.current,items=>items.map(entry=>entry.key===item.key?{...entry,status:'sending'}:entry));
    await generate(item.payload,{key:item.key});
  }
  // 失败的消息可以退回输入框当作草稿，由用户改完再发，避免丢字。
  function discardOutbox(item){
    updateOutbox(item.threadId||activeRef.current,items=>items.filter(entry=>entry.key!==item.key));
    setDraft(current=>[item.text,current].filter(Boolean).join('\n').slice(0,8000));
    requestAnimationFrame(()=>input.current?.focus());
  }
  async function selectVersion(id){try{const result=await chatAPI(`threads/${active}/select`,{method:'POST',body:{messageId:id}});setView(result);setJob(result.job);}catch(e){setError(e.message);}}
  async function copy(text){try{await navigator.clipboard.writeText(text);notify?.('已复制');}catch{setError('浏览器无法复制，请选中文字后复制');}}
  async function feedback(message,value){try{const updated=await chatAPI(`threads/${active}/feedback`,{method:'POST',body:{messageId:message.id,feedback:message.feedback===value?null:value}});setView(current=>({...current,messages:current.messages.map(m=>m.id===message.id?updated:m)}));}catch(e){setError(e.message);}}
  function readAloud(message){if(!window.speechSynthesis){setError('此浏览器暂不支持朗读');return;}window.speechSynthesis.cancel();if(speaking===message.id){setSpeaking(null);return;}const utterance=new SpeechSynthesisUtterance(message.text);utterance.lang='zh-CN';const selectedVoice=window.speechSynthesis.getVoices().find(voice=>voice.name===(persona?.voiceName||storage.get('yiban:voice:'+accountId)));if(selectedVoice)utterance.voice=selectedVoice;utterance.onend=()=>setSpeaking(null);utterance.onerror=()=>setSpeaking(null);setSpeaking(message.id);window.speechSynthesis.speak(utterance);}
  async function openMemories(){try{const result=await chatAPI('memories');setMemories(result.memories);setSelected(settings.memoryIds);setMemoryQuery('');setDialog({type:'memories'});}catch(e){setError(e.message);}}
  async function threadAction(type){try{
    if(type==='rename')await chatAPI(`threads/${active}`,{method:'PATCH',body:{title:dialogText}});
    else if(type==='delete'){await chatAPI(`threads/${active}`,{method:'DELETE'});newChat();}
    else await chatAPI(`threads/${active}`,{method:'PATCH',body:{archived:!archivedThread}});
    setDialog(null);if(type!=='delete')await reloadThread(active);await refreshList();
  }catch(e){setError(e.message);}}
  function openActions(message,event){
    event?.preventDefault?.();const rect=event?.currentTarget?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,bottom:innerHeight/2};
    setMenuPosition({left:Math.max(12,Math.min(innerWidth-226,rect.left)),top:Math.max(12,Math.min(innerHeight-440,rect.bottom+8))});setActionMessage(message.id);
  }
  async function interaction(message,values){try{const next=await chatAPI(`threads/${active}/interact`,{method:'POST',body:{messageId:message.id,...values}});setView(current=>({...current,messages:current.messages.map(m=>m.id===next.id?next:m),allMessages:current.allMessages.map(m=>m.id===next.id?next:m)}));}catch(failure){setError(failure.message);}setActionMessage(null);}
  async function chooseCompanion(id){if(isBusy||queued.length)return;setPanel(null);setError('');const previous=threads.find(t=>(t.options.profileId??null)===(id??null)&&!t.archived);if(previous)await loadThread(previous.id);else newChat(id);}
  function toggleTheme(){setChatTheme(value=>{const next=value==='dark'?'light':'dark';storage.set(`yiban:companion-theme:${accountId}`,next);return next;});}
  function enqueue(){const text=draft.trim();if(!meta?.ai.ready||loading||archivedThread)return;
    const readyImages=imagesRef.current;
    if(readyImages.some(entry=>entry.status!=='ready')){setError('图片还在上传，等一下再发');return;}
    if(!text&&!readyImages.length)return;
    if(readyImages.length){if(queued.length){setError('等前面的消息发完再发图片');return;}setImages([]);submitRef.current({text,images:readyImages.map(entry=>({url:entry.url}))});nearBottom.current=true;return;}
    if(queued.length>=8||queued.reduce((n,s)=>n+s.length+1,0)+text.length>8000){setError('连续消息最多 8 条、合计 8000 字，请先等待这轮发送。');return;}setQueued(items=>[...items,text]);setDraft('');nearBottom.current=true;}
  submitRef.current=generate;
  useEffect(()=>{
    if(!queued.length)return;
    if(isBusy){if(job?.status==='running'&&queueCancel.current!==job.id){queueCancel.current=job.id;stop();}return;}
    const timer=setTimeout(()=>{const texts=queuedRef.current;if(!texts.length)return;setQueued([]);submitRef.current(texts.length===1?{text:texts[0]}:{texts});},450);
    return()=>clearTimeout(timer);
  },[queued,isBusy,job?.id,job?.status]);
  useEffect(()=>()=>{if(queuedRef.current.length)storage.set(prefix+'draft:'+(activeRef.current||'new'),queuedRef.current.join('\n'));},[accountId]);
  // 空会话时取一张开场建议卡（纪念日 / 家庭记忆 / 默认寒暄），只填进输入框，不替用户发出去。
  // 还没建会话也算空会话——开口建议不该要求先建一个空对话。
  // 空会话时取一张开场建议卡：隔了一阵回来它先开口；否则按纪念日/记忆给一句。
  // 都只填进输入框，不替用户发出去。
  useEffect(()=>{
    if(messages.length){setGreeting(null);return;}
    let cancelled=false;
    const endpoint=active?`threads/${active}/greeting`:`threads/greeting?memoryMode=${encodeURIComponent(settings.memoryMode||'auto')}`;
    chatAPI('knock').then(async result=>{
      const knock=result?.knock;
      if(cancelled)return;
      if(knock)return setGreeting({text:knock.text,source:'knock',knock});
      const fallback=await chatAPI(endpoint);
      if(!cancelled)setGreeting(fallback.greeting||null);
    }).catch(async()=>{
      try{const fallback=await chatAPI(endpoint);if(!cancelled)setGreeting(fallback.greeting||null);}
      catch{if(!cancelled)setGreeting(null);}
    });
    return()=>{cancelled=true;};
  },[active,messages.length,settings.memoryMode]);
  useEffect(()=>{if(!actionMessage)return;const el=document.querySelector('.im-message-popover'),previous=document.activeElement;el?.querySelector('button')?.focus();function key(event){if(event.key==='Escape'){event.preventDefault();setActionMessage(null);}if(event.key==='Tab'&&el){const list=[...el.querySelectorAll('button:not(:disabled)')];if(event.shiftKey&&document.activeElement===list[0]){event.preventDefault();list.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.isConnected&&previous.focus();};},[actionMessage]);
  const heading=view?.thread.title||'新话题';
  const selectedMessage=messages.find(message=>message.id===actionMessage);
  const isGenerating=message=>Boolean(message)&&(message.status==='generating'||(job?.messageId===message.id&&!ended(job)));
  const liveMessage=messages.length?messages[messages.length-1]:null;
  // 生成中的最后一条：按其 parts 逐条露出；生成结束后一次性显示全部。
  const liveShown=liveMessage?Math.max(1,Math.min(revealed[liveMessage.id]??1,(liveMessage.parts||[]).length||1)):0;
  usePacedReveal(liveMessage,isGenerating(liveMessage),revealed,setRevealed);
  const visibleParts=message=>{const parts=message.parts?.length?message.parts:[{type:'text',text:message.text}];return message===liveMessage&&isGenerating(message)?parts.slice(0,liveShown):parts;};
  const contacts=[{...defaultProfile,id:null},...profiles];
  const timeLabel=value=>value?new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
  return <div data-im-theme={chatTheme} className={`cw-workspace im-workspace ${sidebar?'':'cw-collapsed'} ${historyOpen?'cw-history-open':''} ${panel?'im-panel-open':''}`}>
    {historyOpen&&<button className="cw-drawer-backdrop" aria-label="关闭历史会话" onClick={()=>setHistoryOpen(false)}/>}
    <aside id="chat-history" ref={historyRef} className="cw-history" aria-label={leftTab==='contacts'?'联系人列表':'历史会话'} role={mobile&&historyOpen?'dialog':undefined} aria-modal={mobile&&historyOpen?true:undefined}>
      <div className="cw-history-top"><div><strong>陪伴</strong><p>把今天，慢慢说给我听。</p></div><Tool label="关闭历史会话" icon="close" onClick={()=>setHistoryOpen(false)}/></div>
      <label className="cw-search"><Icon name="search" size={17}/><input aria-label="搜索历史会话" placeholder="搜索伙伴或聊天内容" value={query} onChange={event=>{setQuery(event.target.value);if(event.target.value)setLeftTab('history');}}/></label>
      <div className="cw-history-tabs"><button aria-pressed={leftTab==='contacts'} onClick={()=>{setLeftTab('contacts');setQuery('');setArchived(false);}}>最近聊天</button><button aria-pressed={leftTab==='history'} onClick={()=>setLeftTab('history')}>历史会话</button></div>
      {leftTab==='contacts'?<div className="im-contacts">{contacts.filter(profile=>!query||profile.name.includes(query)).map(profile=>{const recent=threads.find(thread=>(thread.options.profileId??null)===(profile.id??null));const unread=threads.filter(t=>(t.options.profileId??null)===(profile.id??null)).reduce((n,t)=>n+(t.unreadCount||0),0);return <button key={profile.id||'default'} className={`im-contact ${(profile.id??null)===(currentProfileId??null)?'selected':''}`} disabled={isBusy||Boolean(queued.length)} onClick={()=>chooseCompanion(profile.id)}><PersonaAvatar profile={profile}/><span><strong>{profile.name}<small>{timeLabel(recent?.updatedAt)}</small></strong><p>{recent?.preview||'从今天的小事开始聊聊。'}</p><em>{unread?<span className="pc-unread">{unread} 条未读</span>:<>AI {profile.role==='friend'?'伙伴':'家人'}</>}</em></span></button>;})}<button className="im-add-person" onClick={onCreate} disabled={isBusy}><Icon name="plus" size={17}/>添加一位伙伴</button></div>:<><div className="im-history-tools"><button className="cw-new" aria-label="新对话" onClick={()=>newChat()} disabled={isBusy||Boolean(queued.length)}><Icon name="edit" size={16}/>换个话题</button><button aria-pressed={archived} onClick={()=>setArchived(value=>!value)}><Icon name="archive" size={15}/>{archived?'查看最近':'已归档'}</button></div><div className="cw-history-list">{threads.map(thread=><button key={thread.id} disabled={isBusy||Boolean(queued.length)} className={`cw-history-item ${active===thread.id?'selected':''}`} aria-current={active===thread.id?'true':undefined} onClick={()=>loadThread(thread.id)}><Icon name="message" size={16}/><span>{thread.title}</span></button>)}{!threads.length&&<p className="cw-history-empty">{query?'没有找到相关对话':archived?'归档的对话会保留在这里':'聊过的话，会留在这里。'}</p>}{hasMore&&<button className="cw-more" onClick={()=>refreshList(true)}>加载更多</button>}</div></>}
      <div className="pw-chat-wallet"><CreditBalance api={walletAPI} onOpen={onCredits}/><button onClick={onCredits}>消费记录<Icon name="chevron" size={13}/></button></div><div className="cw-history-foot"><Icon name="lock" size={13}/><span>聊天和对你的了解，仅自己可见</span></div>
    </aside>
    <section ref={mainRef} className="cw-main" aria-label="聊天工作区">
      <header className="cw-header"><div className="cw-header-left"><button className="cw-tool cw-back" aria-label="返回联系页" onClick={()=>onBack?.(persona)}><Icon name="back" size={23}/></button><button className="im-chat-person" onClick={()=>setPanel('details')} aria-label="打开联系人详情"><PersonaAvatar profile={currentPersona}/><span><h1 title={heading}>{displayName}</h1><small>AI 伙伴</small></span></button></div><div className="cw-header-actions"><button className="pw-chat-settings" onClick={()=>setDialog({type:'options'})} disabled={isBusy}>聊天设置<Icon name="down" size={15}/></button><button className="cw-tool cw-voice-action" aria-label="语音输入" onClick={()=>setSpeech(true)}><Icon name="phone" size={22}/></button><button ref={historyToggle} className="cw-tool cw-history-toggle" aria-label="展开历史会话" aria-controls="chat-history" aria-expanded={mobile?historyOpen:sidebar} onClick={()=>{setLeftTab('history');if(mobile)setHistoryOpen(value=>!value);else setSidebar(true);}}><Icon name="message" size={22}/></button><details className="cw-menu"><summary aria-label="对话菜单"><Icon name="more"/></summary><div><button onClick={()=>{setPanel('details');document.querySelector('.cw-header .cw-menu')?.removeAttribute('open');}}><Icon name="user" size={16}/>聊天详情</button><button onClick={()=>{setPanel('memory');document.querySelector('.cw-header .cw-menu')?.removeAttribute('open');}}><Icon name="leaf" size={16}/>对我的了解</button><button disabled={isBusy} onClick={()=>{setDialog({type:'options'});document.querySelector('.cw-header .cw-menu')?.removeAttribute('open');}}><Icon name="settings" size={16}/>聊天设置</button><button disabled={isBusy||Boolean(queued.length)} aria-label="新对话" onClick={()=>newChat()}><Icon name="plus" size={16}/>换个话题</button>{active&&<><button disabled={isBusy} onClick={()=>{setDialogText(heading);setDialog({type:'rename'});}}><Icon name="edit" size={16}/>重命名</button><button disabled={isBusy} onClick={()=>threadAction('archive')}><Icon name="archive" size={16}/>{archivedThread?'恢复对话':'归档对话'}</button><button disabled={isBusy} onClick={()=>setDialog({type:'delete'})}><Icon name="trash" size={16}/>删除对话</button></>}</div></details></div></header>
      <div className="cw-feed" ref={feed} onScroll={()=>{const element=feed.current;nearBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;setJump(!nearBottom.current);}}>
        {loading?<div className="cw-loading" role="status"><span className="spinner"/>正在打开对话…</div>:messages.length===0?<div className="cw-welcome"><PersonaAvatar profile={currentPersona} large/><h2>和{displayName}聊聊</h2><p>从今天的小事开始，不用想好怎么开口。</p>{greeting&&<button type="button" className={`cw-greeting${greeting.source==='knock'?' cw-greeting-knock':''}`} onClick={()=>{setDraft(greeting.text);requestAnimationFrame(()=>input.current?.focus());}}><Icon name={greeting.source==='anniversary'?'star':greeting.source==='memory'?'book':greeting.source==='knock'?'clock':'message'} size={16}/><span>{greeting.text}</span><em>{greeting.source==='anniversary'?'今天':greeting.source==='knock'?'它在等你':'要不要聊聊'}</em></button>}<small>自动记忆可在“对我的了解”中关闭、检查或修改。</small></div>:<div className="cw-message-list" role="log" aria-label="聊天消息">
          <div className="im-date-divider">{new Date(messages[0].createdAt).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}</div>
          {messages.map(message=>{const user=message.role==='user',siblings=(view.allMessages||[]).filter(m=>m.role===message.role&&m.parentId===message.parentId),version=siblings.findIndex(m=>m.id===message.id),generating=message.status==='generating'||(job?.messageId===message.id&&!ended(job));const sticker=user&&stickerById(message.stickerId);const parts=message.parts?.length?message.parts:[{type:'text',text:message.text}];
            return <article key={message.id} id={'chat-message-'+message.id} className={`cw-message ${user?'cw-user':'cw-assistant'} ${actionMessage===message.id?'pw-actions-open':''}`} tabIndex={0} aria-label={user?'你的消息':'家伴的回复'} onContextMenu={event=>openActions(message,event)} onPointerDown={event=>{if(event.pointerType==='touch'){const rect=event.currentTarget.getBoundingClientRect();longPress.current=setTimeout(()=>openActions(message,{currentTarget:{getBoundingClientRect:()=>rect}}),500);}}} onPointerUp={()=>clearTimeout(longPress.current)} onPointerCancel={()=>clearTimeout(longPress.current)} onPointerMove={()=>clearTimeout(longPress.current)} onKeyDown={event=>{if(event.key==='Escape')setActionMessage(null);if(event.key==='F10'&&event.shiftKey)openActions(message,event);}}>
              <div className="im-message-avatar">{user?(accountAvatar?<img src={accountAvatar} alt=""/>:<span>{accountName?.slice(0,1)||'我'}</span>):<PersonaAvatar profile={currentPersona}/>}</div>
              <div className="im-message-body">{edit===message.id?<div className="cw-edit-message"><textarea aria-label="编辑消息" value={editText} maxLength={8000} onChange={e=>setEditText(e.target.value)}/><small>保留原版本，成功回复 {meta?.price} 积分。</small><div><Button variant="ghost" onClick={()=>setEdit(null)}>取消</Button><Button disabled={isBusy||!editText.trim()} onClick={()=>generate({action:'edit',messageId:message.id,text:editText})}>保存并重新生成</Button></div></div>:sticker?<div className="im-sticker"><img src={sticker.src} alt={sticker.label}/></div>:<>{message.replyTo&&<button type="button" className="im-quote-block" aria-label="跳到被引用的消息" onClick={()=>document.getElementById('chat-message-'+message.replyTo.messageId)?.scrollIntoView({block:'center'})}><Icon name="back" size={12}/><span>{message.replyTo.excerpt}</span></button>}{message.images?.length?<div className={`im-images im-images-${message.images.length}`}>{message.images.map((image,index)=><button type="button" key={image.url} className="im-image-thumb" aria-label={`查看第 ${index+1} 张图片`} onClick={()=>setViewer({images:message.images,index})}><img src={image.url} alt="" loading="lazy"/></button>)}</div>:null}{visibleParts(message).map((part,index)=>part.type==='sticker'&&stickerById(part.stickerId)?<div className="im-sticker" key={index}><img src={stickerById(part.stickerId).src} alt={stickerById(part.stickerId).label}/></div>:part.type==='text'&&part.text?<div className={`im-bubble ${user?'cw-user-text':''}`} key={index}>{user?part.text:<RichText text={part.text}/>}</div>:null)}{(!message.text&&!parts.some(p=>p.type==='sticker')||generating&&visibleParts(message).length<parts.length)&&generating&&<p className="cw-thinking" role="status"><span/>{displayName}正在回应…</p>}</>}
                {!user&&Boolean(message.sources?.length)&&<div className="cw-sources">{message.sources.map(source=><button key={source.id} onClick={()=>onOpenMemory?.(source.id)}><Icon name="book" size={13}/>{source.title}<Icon name="arrow" size={12}/></button>)}</div>}
                {!user&&['failed','stopped'].includes(message.status)&&<p className="cw-message-status"><Icon name="info" size={13}/>{message.status==='stopped'?'已停止':'回复未完成'} · 积分已退回</p>}
                {(message.reaction||message.favorite)&&<div className="im-message-reactions">{message.reaction&&<button aria-label="取消表情回应" onClick={()=>interaction(message,{reaction:null})}>{message.reaction}</button>}{message.favorite&&<span><Icon name="star" size={12}/>已收藏</span>}</div>}
                {!generating&&edit!==message.id&&<button className="pw-message-more" aria-label="消息操作" aria-expanded={actionMessage===message.id} onClick={event=>openActions(message,event)}><Icon name="more" size={17}/></button>}
                {message.proactive&&<div className="pc-message-note"><span>{timeLabel(message.createdAt)} · 主动联系</span><button onClick={()=>{setProactiveMessage(message.id);setPanel('proactive');}}>为什么提起这件事</button><button onClick={()=>{proactiveAPI('settings'+(currentProfileId?'?profileId='+encodeURIComponent(currentProfileId):'')).then(s=>proactiveAPI('settings',{method:'PATCH',body:{profileId:currentProfileId||null,expectedRevision:s.revision,pause:true}})).then(()=>notify?.('已暂停到下一个可联系时段')).catch(e=>setError(e.message));}}>晚点聊</button></div>}{siblings.length>1&&<div className="cw-versions"><Tool label="上一个版本" icon="back" disabled={isBusy||version<=0} onClick={()=>selectVersion(siblings[version-1].id)}/><span>{version+1} / {siblings.length}</span><Tool label="下一个版本" icon="arrow" disabled={isBusy||version>=siblings.length-1} onClick={()=>selectVersion(siblings[version+1].id)}/></div>}
              </div>
            </article>;})}
        </div>}
        {outbox.map(item=>(!item.threadId||item.threadId===active||(!active&&item.threadId===activeRef.current))?<article key={item.key} className={`cw-message cw-user im-outbox ${item.status==='sending'?'im-outbox-sending':'im-outbox-failed'}`} aria-label={item.status==='sending'?'消息发送中':'消息发送失败'}>
          <div className="im-message-body">{item.images?.length?<div className="im-images im-images-1">{item.images.map(image=><button type="button" key={image.url} className="im-image-thumb" aria-label="查看图片" onClick={()=>setViewer({images:item.images,index:0})}><img src={image.url} alt=""/></button>)}</div>:null}<div className="im-bubble cw-user-text">{item.text}</div>
            {item.status==='sending'?<p className="cw-message-status" role="status"><span className="spinner" aria-hidden="true"/>发送中…</p>:<p className="cw-message-status im-send-failed"><Icon name="info" size={13}/>发送失败，没有发出这条消息<button onClick={()=>retryOutbox(item)} disabled={isBusy}>重试</button><button onClick={()=>discardOutbox(item)} disabled={isBusy}>存回草稿</button></p>}
          </div>
        </article>:null)}
        {queued.length>0&&<div className="im-queued" aria-label="待发送消息">{queued.map((text,index)=><p key={index}>{text}<small>{isBusy?'正在停止上一轮…':'即将发送'}</small></p>)}</div>}
      </div>
      <div className="cw-compose-area">{jump&&<button className="cw-jump" onClick={()=>{nearBottom.current=true;feed.current.scrollTo({top:feed.current.scrollHeight,behavior:'smooth'});setJump(false);}}><Icon name="down" size={16}/>回到最新消息</button>}
        {error&&<div className="cw-error" role="alert"><Icon name="info" size={17}/><span>{error}</span>{pending&&!isBusy&&<button onClick={()=>generate(pending.payload,pending)}>重试本次请求</button>}<button aria-label="关闭错误提示" onClick={()=>setError('')}><Icon name="close" size={16}/></button></div>}
        {!meta?.ai.ready&&meta&&<p className="cw-service-note">陪伴服务尚未开启，请联系管理员。历史记录仍可查看。</p>}
        {archivedThread?<div className="cw-archived-note"><Icon name="archive" size={18}/>这段对话已归档。<button onClick={()=>threadAction('archive')}>恢复并继续聊</button></div>:<form className="cw-composer" onSubmit={event=>{event.preventDefault();enqueue();}}>
          {replyTo&&<div className="im-reply-chip"><Icon name="back" size={13}/><span>{replyTo.excerpt}</span><button type="button" aria-label="取消引用" onClick={()=>setReplyTo(null)}><Icon name="close" size={13}/></button></div>}
          {images.length>0&&<div className="im-attach-tray" aria-label="待发送图片">{images.map(item=><div key={item.id} className={`im-attach im-attach-${item.status}`}>
            <img src={item.preview} alt=""/>{item.status==='uploading'&&<span className="im-attach-note" role="status">上传中…</span>}
            {item.status==='failed'&&<><span className="im-attach-note im-attach-error">{item.error||'上传失败'}</span><button type="button" className="im-attach-retry" onClick={()=>retryImage(item)}>重试</button></>}
            <button type="button" className="im-attach-remove" aria-label="移除图片" onClick={()=>removeImage(item.id)}><Icon name="close" size={12}/></button>
          </div>)}</div>}
          <div className="im-composer-tools"><button type="button" className="cw-tool" aria-label="表情" onClick={()=>setDialog({type:'stickers'})}><Icon name="smile" size={21}/></button><button type="button" className="cw-tool" aria-label="打开语音输入" onClick={()=>setSpeech(true)}><Icon name="mic" size={21}/></button><button type="button" className="cw-tool pw-composer-memory" aria-label="选择家庭记忆" onClick={openMemories}><Icon name="book" size={20}/></button>{api&&<button type="button" className="cw-tool" aria-label="发送图片" onClick={()=>albumInput.current?.click()}><Icon name="grid" size={20}/></button>}<input ref={albumInput} type="file" hidden accept="image/jpeg,image/png,image/webp" multiple onChange={event=>{addImages(event.target.files);event.target.value='';}}/></div>
          <textarea ref={input} aria-label="发送给家伴的消息" placeholder={meta?.ai.ready?`和${displayName}说说话…`:'服务尚未开启'} value={draft} maxLength={8000} rows={1} disabled={!meta?.ai.ready||loading} onChange={event=>setDraft(event.target.value)} onPaste={event=>{const files=[...(event.clipboardData?.files||[])];if(files.some(file=>file.type.startsWith('image/'))){event.preventDefault();addImages(files);}}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();enqueue();}}}/>
          {isBusy&&!draft.trim()&&!images.length?<button type="button" className="cw-send cw-stop" aria-label="停止生成" onClick={stop} disabled={!job||job.status==='committing'}><Icon name="stop" size={18}/></button>:<button type="submit" className="cw-send" aria-label="发送消息" disabled={(!draft.trim()&&!images.length)||!meta?.ai.ready||loading||images.some(entry=>entry.status!=='ready')}><span>发送</span><Icon name="send" size={18}/></button>}
          <div className="cw-compose-note"><span><Icon name="lock" size={11}/>只属于这段聊天</span><span>Enter 发送 · Shift + Enter 换行</span></div>
        </form>}
        <p className="cw-disclaimer">AI 陪伴 · 每轮成功回复 {meta?.price||1} 积分，停止或失败退回</p>
      </div>
    </section>
    {panel==='proactive'?<ProactiveSettings key={currentProfileId||'default'} profileId={currentProfileId||null} name={displayName} mobile={mobile} messageId={proactiveMessage} onClose={closePanel} notify={notify}/>:panel&&<CompanionDetails profile={currentPersona} profileId={currentProfileId||null} type={panel} onClose={closePanel} mobile={mobile} onMemory={()=>{setPanel(null);setPersonalDialog({});}} onPersona={()=>{setPanel(null);onEditPersona?.(currentProfileId||'default');}} onHistory={()=>{setPanel(null);setLeftTab('history');setHistoryOpen(mobile);setSidebar(true);}} onNew={()=>{setPanel(null);if(!isBusy&&!queued.length)newChat();}} onCredits={()=>{setPanel(null);onCredits?.();}} onProactive={()=>{setProactiveMessage(null);setPanel('proactive');}} onTheme={toggleTheme} theme={chatTheme}/>}
    {selectedMessage&&typeof document!=='undefined'&&createPortal(<div data-im-theme={chatTheme} className="im-message-layer"><button className="im-menu-backdrop" aria-label="关闭消息操作" onClick={()=>setActionMessage(null)}/><div className="im-message-popover" role="dialog" aria-modal="true" aria-label="消息操作" style={menuPosition}><div className="im-emoji-reactions">{['❤️','😄','🥹','👏'].map(emoji=><button key={emoji} aria-label={`回应${emoji}`} onClick={()=>interaction(selectedMessage,{reaction:selectedMessage.reaction===emoji?null:emoji})}>{emoji}</button>)}</div><Tool label="复制消息" icon="copy" onClick={()=>{copy(selectedMessage.text);setActionMessage(null);}} disabled={!selectedMessage.text}/><Tool label={selectedMessage.favorite?'取消收藏':'收藏消息'} icon="star" onClick={()=>interaction(selectedMessage,{favorite:!selectedMessage.favorite})}/>{selectedMessage.role==='user'?<><Tool label="引用回复" icon="back" onClick={()=>{setReplyTo({id:selectedMessage.id,excerpt:(selectedMessage.text||'（一条表情）').replace(/\s+/g,' ').slice(0,80)});setActionMessage(null);}}/><Tool label="编辑消息" icon="edit" disabled={isBusy||archivedThread||Boolean(selectedMessage.stickerId)} onClick={()=>{setEdit(selectedMessage.id);setEditText(selectedMessage.text);setActionMessage(null);}}/><Tool label="记住这件事" icon="book" disabled={!selectedMessage.text||Boolean(selectedMessage.stickerId)} onClick={()=>{setPersonalDialog({starter:{text:selectedMessage.text,source:{threadId:active,messageId:selectedMessage.id}}});setActionMessage(null);}}/></>:<><Tool label="引用回复" icon="back" onClick={()=>{setReplyTo({id:selectedMessage.id,excerpt:(selectedMessage.text||'（一条表情）').replace(/\s+/g,' ').slice(0,80)});setActionMessage(null);}}/><Tool label="重新生成" icon="repeat" disabled={isBusy||archivedThread||Boolean(selectedMessage.proactive)} onClick={()=>{setActionMessage(null);generate({action:'regenerate',messageId:selectedMessage.id});}}/><Tool label="换一种方式说" icon="settings" disabled={isBusy||archivedThread||Boolean(selectedMessage.proactive)} onClick={()=>{setDialogText('');setDialog({type:'suggest',message:selectedMessage});setActionMessage(null);}}/><Tool label={speaking===selectedMessage.id?'停止朗读':'朗读回复'} icon={speaking===selectedMessage.id?'stop':'volume'} disabled={!selectedMessage.text} onClick={()=>{readAloud(selectedMessage);setActionMessage(null);}}/><Tool label="有帮助" icon="thumbs-up" pressed={selectedMessage.feedback==='up'} onClick={()=>{feedback(selectedMessage,'up');setActionMessage(null);}}/><Tool label="需要改进" icon="thumbs-down" pressed={selectedMessage.feedback==='down'} onClick={()=>{feedback(selectedMessage,'down');setActionMessage(null);}}/><Tool label="查看与纠正记忆" icon="leaf" onClick={()=>{setPersonalDialog({referenceIds:selectedMessage.personalMemoryIds||[]});setActionMessage(null);}}/>{canEdit&&onSaveMemory&&<Tool label="存为记忆草稿" icon="book" onClick={()=>{onSaveMemory({story:selectedMessage.text.slice(0,6000),title:'',draftId:selectedMessage.id});setActionMessage(null);}}/>}</>}</div></div>,document.body)}
    {dialog?.type==='suggest'&&<Modal title="换一种方式说" onClose={()=>setDialog(null)}><form onSubmit={event=>{event.preventDefault();const message=dialog.message;setDialog(null);generate({action:'suggest',messageId:message.id,suggestion:dialogText});}}><label className="field"><span>这次希望怎样回应</span><textarea aria-label="调整回应方向" rows={3} value={dialogText} maxLength={500} onChange={event=>setDialogText(event.target.value)} placeholder="比如：简短一点，先听我说，不用急着分析。"/></label><p className="fa-dialog-hint">只调整这次回复，保留原版本。成功回复 {meta?.price||1} 积分。</p><div className="modal-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button type="submit" disabled={!dialogText.trim()}>调整回应</Button></div></form></Modal>}
    {dialog?.type==='stickers'&&<Modal title="表情" onClose={()=>setDialog(null)}><div className="im-sticker-picker">{COMPANION_STICKERS.filter(s=>s.group!=='portrait').map(sticker=><button key={sticker.id} aria-label={`发送表情：${sticker.label}`} disabled={isBusy||!meta?.ai.ready||archivedThread} onClick={()=>{setDialog(null);generate({stickerId:sticker.id});}}><img src={sticker.src} alt=""/><span>{sticker.label}</span></button>)}</div><p className="fa-dialog-hint">原创插画表情。发送后，伙伴会按语境回应；成功回复 {meta?.price||1} 积分。</p></Modal>}
    {speech&&!loading&&<SpeechComposer onClose={()=>setSpeech(false)} onUse={text=>{setDraft(text);setSpeech(false);requestAnimationFrame(()=>input.current?.focus());}}/>}
    {viewer&&typeof document!=='undefined'&&createPortal(<div className="im-lightbox" role="dialog" aria-modal="true" aria-label="查看图片" onClick={()=>setViewer(null)}>
      <img src={viewer.images[viewer.index].url} alt="" onClick={event=>event.stopPropagation()}/>
      <div className="im-lightbar" onClick={event=>event.stopPropagation()}><span>{viewer.index+1} / {viewer.images.length}</span><div className="im-lightbar-actions">
        {viewer.images.length>1&&<button type="button" aria-label="上一张" onClick={()=>setViewer(current=>({...current,index:(current.index-1+current.images.length)%current.images.length}))}>‹</button>}
        {viewer.images.length>1&&<button type="button" aria-label="下一张" onClick={()=>setViewer(current=>({...current,index:(current.index+1)%current.images.length}))}>›</button>}
        <a href={viewer.images[viewer.index].url} download target="_blank" rel="noreferrer">保存</a>
        <button type="button" aria-label="关闭大图" onClick={()=>setViewer(null)}>×</button>
      </div></div>
    </div>,document.body)}
    {personalDialog&&<PersonalMemory key={currentProfileId||'default'} profiles={profiles} defaultProfile={defaultProfile} profileId={currentProfileId||null} onClose={()=>setPersonalDialog(null)} notify={notify} {...personalDialog}/>}
    {dialog?.type==='options'&&<Modal title="聊天设置" onClose={()=>setDialog(null)}><p className="fa-dialog-hint">设定会保存在当前对话；每次成功回复 {meta?.price||1} 积分。</p><div className="pw-option-groups"><fieldset><legend>聊天模式</legend>{(meta?.modes||[]).map(item=><button key={item.id} aria-pressed={settings.mode===item.id} disabled={isBusy} onClick={()=>changeSettings({...settings,mode:item.id})}>{item.label}</button>)}</fieldset><fieldset><legend>回复风格</legend>{(meta?.tones||[]).map(item=><button key={item.id} aria-pressed={settings.tone===item.id} disabled={isBusy} onClick={()=>changeSettings({...settings,tone:item.id})}>{item.label}</button>)}</fieldset></div><div className="cw-options"><details className="cw-menu cw-memory-menu"><summary aria-label="家庭记忆选项"><Icon name="book" size={16}/><span>{settings.memoryMode==='off'?'不引用':settings.memoryMode==='selected'?`记忆 ${settings.memoryIds.length}`:'家庭记忆'}</span><Icon name="down" size={13}/></summary><div><small>只参考家人已确认的内容</small><button disabled={isBusy} onClick={()=>changeSettings({...settings,memoryMode:'auto'})}><Icon name={settings.memoryMode==='auto'?'check':'search'} size={16}/>自动查找相关记忆</button><button disabled={isBusy} onClick={openMemories}><Icon name="book" size={16}/>选择家庭记忆…</button><button disabled={isBusy} onClick={()=>changeSettings({...settings,memoryMode:'off'})}><Icon name={settings.memoryMode==='off'?'check':'close'} size={16}/>本轮不引用记忆</button></div></details></div><button className="fa-more-row" type="button" onClick={()=>{setDialog(null);setPersonalDialog({});}}><Icon name="lock" size={18}/>个人记忆与保存方式<Icon name="chevron" size={18}/></button><div className="modal-actions"><Button onClick={()=>setDialog(null)}>完成</Button></div></Modal>}
    {dialog?.type==='rename'&&<Modal title="重命名对话" onClose={()=>setDialog(null)}><form onSubmit={e=>{e.preventDefault();threadAction('rename');}}><label className="field">对话名称<input autoFocus value={dialogText} maxLength={80} onChange={e=>setDialogText(e.target.value)}/></label><div className="modal-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button type="submit" disabled={!dialogText.trim()}>保存</Button></div></form></Modal>}
    {dialog?.type==='delete'&&<Modal title="删除这段对话？" onClose={()=>setDialog(null)}><p>删除后无法恢复聊天记录。单独保存的个人记忆和积分消费记录会保留；个人记忆可在“个人记忆”中删除。</p><div className="modal-actions"><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button onClick={()=>threadAction('delete')}>确认删除</Button></div></Modal>}
    {dialog?.type==='memories'&&<Modal title="选择家庭记忆" description="最多选 6 段已确认的记忆，家伴只会参考所选内容。" onClose={()=>setDialog(null)}><label className="cw-search"><Icon name="search" size={18}/><input aria-label="搜索可引用的记忆" placeholder="搜索标题或年份" value={memoryQuery} onChange={e=>setMemoryQuery(e.target.value)}/></label><div className="cw-memory-picker">{memories.filter(m=>(m.title+String(m.year||'')).includes(memoryQuery)).map(memory=><label key={memory.id}><input type="checkbox" checked={selected.includes(memory.id)} disabled={selected.length>=6&&!selected.includes(memory.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,memory.id]:ids.filter(id=>id!==memory.id))}/><span><strong>{memory.title}</strong><small>{memory.year||'年份待补充'}</small></span></label>)}{!memories.length&&<p>还没有已确认的家庭记忆。家人确认发布后，就能在这里选择。</p>}</div><div className="modal-actions"><span>{selected.length} / 6 段</span><Button variant="ghost" onClick={()=>setDialog(null)}>取消</Button><Button onClick={async()=>{await changeSettings({...settings,memoryMode:'selected',memoryIds:selected});setDialog(null);}}>使用所选记忆</Button></div></Modal>}
  </div>;
}
