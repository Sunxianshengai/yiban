'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {BookOpen,Image as ImageIcon,Mail,Mic,Music2,PenLine,Search,UserRound,Volume2} from 'lucide-react';
import CottagePanel from './CottagePanel';
import './cottage.css';

const OBJECTS=[
 {id:'books',label:'记忆书架',icon:BookOpen},
 {id:'letters',label:'时光信匣',icon:Mail},
 {id:'audio',label:'原声回放',icon:Volume2},
 {id:'photos',label:'照片故事',icon:ImageIcon},
];
const IDLE={phase:'idle',text:'今天，想留下什么？'};

export default function CottageHome({accountId,accountName,onOpenFamily,onOpenAccount,onOpenSettings,onOpenMore}){
 const [panel,setPanel]=useState(null),[menu,setMenu]=useState(false),[dragging,setDragging]=useState(false),[rain,setRain]=useState(false),[rainVolume,setRainVolume]=useState(.24),[soundError,setSoundError]=useState(''),[status,setStatus]=useState(IDLE),[latest,setLatest]=useState(null);
 const audio=useRef(null),dragDepth=useRef(0),statusTimer=useRef(null),closeTimer=useRef(null),returnFocus=useRef(null),menuRef=useRef(null),overview=useRef(null);
 const refresh=useCallback(async()=>{overview.current?.abort();const controller=new AbortController();overview.current=controller;try{const response=await fetch('/api/cottage/entries?limit=1',{cache:'no-store',signal:controller.signal});if(response.ok){const result=await response.json();setLatest(result.items?.[0]||null);}}catch{}},[]);
 useEffect(()=>{void refresh();return()=>{overview.current?.abort();clearTimeout(statusTimer.current);clearTimeout(closeTimer.current);};},[refresh,accountId]);
 useEffect(()=>{if(!menu)return;const close=event=>{if(!menuRef.current?.contains(event.target))setMenu(false);};const escape=event=>{if(event.key==='Escape')setMenu(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[menu]);
 useEffect(()=>()=>{audio.current?.pause();},[]);
 const open=useCallback((section,files=[],autoSaveFiles=false)=>{returnFocus.current=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:document.querySelector('.cottage-capture-primary');setMenu(false);setPanel({section,files,autoSaveFiles,id:crypto.randomUUID()});},[]);
 useEffect(()=>{if(panel||!returnFocus.current)return;const target=returnFocus.current;returnFocus.current=null;const frame=requestAnimationFrame(()=>{if(target.isConnected)target.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[panel]);
 const close=useCallback(()=>{if(closeTimer.current)return;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce){setPanel(null);setStatus(current=>current.phase==='saved'?current:IDLE);return;}setPanel(current=>current?{...current,closing:true}:null);closeTimer.current=setTimeout(()=>{setPanel(null);setStatus(current=>current.phase==='saved'?current:IDLE);closeTimer.current=null;},150);},[]);
 const captureChange=useCallback(value=>{clearTimeout(statusTimer.current);setStatus(value);if(value.phase==='saved')statusTimer.current=setTimeout(()=>setStatus(IDLE),6500);},[]);
 async function toggleRain(){setSoundError('');if(rain){audio.current?.pause();setRain(false);return;}try{audio.current.volume=rainVolume;await audio.current.play();setRain(true);}catch{setSoundError('雨声没有播放成功，请再试一次。');}}
 function filesDragged(event){return Array.from(event.dataTransfer?.types||[]).includes('Files');}
 function dragEnter(event){if(!filesDragged(event))return;event.preventDefault();dragDepth.current+=1;setDragging(true);}
 function dragLeave(event){if(!filesDragged(event))return;event.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}
 function drop(event){if(!filesDragged(event))return;event.preventDefault();dragDepth.current=0;setDragging(false);const files=Array.from(event.dataTransfer.files||[]);if(files.length)open('capture-photo',files,true);}
 function menuAction(action){setMenu(false);action?.();}

 return <>
  <section className={`cottage-home ${dragging?'is-dragging':''} cottage-phase-${status.phase}`} aria-label="我的记忆小屋" inert={Boolean(panel)} onDragEnter={dragEnter} onDragLeave={dragLeave} onDragOver={event=>{if(filesDragged(event)){event.preventDefault();event.dataTransfer.dropEffect='copy';}}} onDrop={drop}>
   <div className="cottage-stage">
    <picture><source media="(max-width:600px) and (orientation:portrait)" srcSet="/cottage/room-mobile.webp"/><img className="cottage-room" src="/cottage/room-background.webp" alt="雨夜里亮着暖灯的木质小屋，桌上有相册、信匣、留声机和相框" fetchPriority="high" draggable="false"/></picture>
    <nav className="cottage-objects" aria-label="小屋里的记忆物件">{OBJECTS.map(({id,label,icon:Glyph})=><button key={id} className={`cottage-object cottage-object-${id}`} onClick={()=>open(id)} aria-expanded={panel?.section===id} aria-label={`打开${label}`}><span className="cottage-object-label"><Glyph size={17}/>{label}</span></button>)}</nav>
    <button className="cottage-story" onClick={()=>open(latest?'continue':'capture-text')} aria-label={latest?'继续上次的故事':'开始第一段故事'}><span>{latest?'继续上次的故事':'开始第一段故事'}</span></button>
    <button className="cottage-sheep" onClick={()=>open('capture-photo')} aria-label="把照片、录音或文字交给小羊"><img src="/cottage/sheep-seated.webp" alt="瞌睡小羊抱着一本记忆书坐在桌边" draggable="false"/></button>
    <button className="cottage-sheep-bubble" onClick={()=>open('capture-text')} aria-label="和小羊记录一段记忆"><span role="status" aria-live="polite">{status.text}</span></button>
   </div>
   <header className="cottage-header">
    <button className="cottage-brand" onClick={()=>{setMenu(false);setPanel(null);}} aria-label="忆伴，回到我的小屋"><strong>忆伴</strong><span>记忆小屋</span></button>
    <nav className="cottage-header-nav" aria-label="小屋导航"><button className="cottage-current" aria-current="page" onClick={()=>setMenu(false)}>我的小屋</button><button onClick={onOpenFamily}>家庭空间</button><button className="cottage-header-icon" aria-label="搜索记忆" onClick={()=>open('search')}><Search size={27}/></button><div className="cottage-account" ref={menuRef}><button className="cottage-header-icon" aria-label="我的账号与设置" aria-expanded={menu} aria-controls="cottage-account-menu" onClick={()=>setMenu(value=>!value)}><UserRound size={28}/></button>{menu&&<div className="cottage-account-menu" id="cottage-account-menu"><p>{accountName||'我的小屋'}</p><button onClick={()=>menuAction(onOpenAccount)}>我的账号</button><button onClick={()=>menuAction(onOpenSettings)}>外观与设置</button><button onClick={()=>menuAction(onOpenMore)}>更多功能</button></div>}</div></nav>
   </header>
   <div className="cottage-ambience"><button className="cottage-rain" role="switch" aria-checked={rain} onClick={toggleRain} aria-label="播放雨声"><Music2 size={20}/><span>{rain?'雨声已开':'雨声'}</span><span className="cottage-switch" aria-hidden="true"><i/></span></button>{rain&&<label className="cottage-rain-volume"><span>雨声大小</span><input aria-label="雨声大小" type="range" min="0" max="1" step="0.05" value={rainVolume} onChange={event=>{const value=Number(event.target.value);setRainVolume(value);if(audio.current)audio.current.volume=value;}}/></label>}{soundError&&<p role="alert">{soundError}</p>}</div>
   <div className="cottage-capture"><div className="cottage-capture-dock" role="group" aria-label="留下一段记忆"><button className="cottage-capture-primary" onClick={()=>open('capture-photo')}><ImageIcon/><span>放入素材</span></button><button onClick={()=>open('capture-audio')}><Mic/><span>说一段</span></button><button onClick={()=>open('capture-text')}><PenLine/><span>写一句</span></button></div><p>照片、录音、文字，都可以放进来</p></div>
   {dragging&&<div className="cottage-drop-hint" role="status"><ImageIcon size={32}/><strong>交给小羊，收进记忆小屋</strong><span>松开即可自动存档 · 仅自己可见</span></div>}
   <audio ref={audio} src="/cottage/rain.wav" preload="none" loop aria-hidden="true" onPause={()=>setRain(false)} onError={()=>{setRain(false);setSoundError('雨声没有载入，请再点一次重试。');}}/>
  </section>
  {panel&&<CottagePanel key={`${accountId}:${panel.id}`} section={panel.section} closing={panel.closing} initialFiles={panel.files} autoSaveFiles={panel.autoSaveFiles} onClose={close} onSaved={refresh} onCaptureChange={captureChange}/>}
 </>;
}
