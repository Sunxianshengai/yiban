'use client';
import {useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Button,Cover,Empty,Avatar} from './UI';
import {searchMemories} from '../lib/core.mjs';

export default function Elder({state,onExit,api,refresh,notify}) {
  const [page,setPage]=useState('home');const [queue,setQueue]=useState([]);const [index,setIndex]=useState(0);const [query,setQuery]=useState('');const [listening,setListening]=useState(false);const [playing,setPlaying]=useState(false);const [auto,setAuto]=useState(state.settings.autoPlay);const [liked,setLiked]=useState(false);const [remembered,setRemembered]=useState(false);
  const audioRef=useRef(null);const videoRef=useRef(null);const recognitionRef=useRef(null);const queueRef=useRef({queue,index,auto});const current=queue[index];const confirmed=state.memories.filter(m=>m.status==='confirmed');const settings=state.settings;
  useEffect(()=>{queueRef.current={queue,index,auto};},[queue,index,auto]);
  const log=(type,memory=current)=>{if(memory)api('/activity',{method:'POST',body:JSON.stringify({type,memoryId:memory.id})}).then(refresh).catch(e=>notify(e.message,'error'));};
  const stop=()=>{window.speechSynthesis?.cancel();audioRef.current?.pause();videoRef.current?.pause();setPlaying(false);};
  useEffect(()=>()=>{window.speechSynthesis?.cancel();recognitionRef.current?.abort();},[]);
  const ended=()=>{setPlaying(false);const q=queueRef.current;if(q.auto&&q.index<q.queue.length-1)setIndex(q.index+1);};
  const play=async()=>{
    if(!current)return;
    window.speechSynthesis?.cancel();
    try{
      if(current.video&&videoRef.current){await videoRef.current.play();}
      else if(current.audio&&audioRef.current){await audioRef.current.play();}
      else{
        if(!window.speechSynthesis){notify('这个浏览器不支持故事朗读，请使用录音播放','error');return;}
        const utterance=new SpeechSynthesisUtterance(current.story||current.title);utterance.lang='zh-CN';utterance.rate=settings.speechRate;
        const voice=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('zh'));if(voice)utterance.voice=voice;
        utterance.onend=ended;utterance.onerror=e=>{setPlaying(false);if(e.error!=='canceled'&&e.error!=='interrupted')notify('朗读失败，请尝试再次播放','error');};window.speechSynthesis.speak(utterance);
      }
      setPlaying(true);log('play');
    }catch{setPlaying(false);notify('音视频无法播放，请检查文件格式','error');}
  };
  useEffect(()=>{stop();setLiked(false);setRemembered(false);},[current?.id]);
  useEffect(()=>{if(auto&&current){const timer=setTimeout(()=>play(),450);return()=>clearTimeout(timer);}},[current?.id,auto]);
  const open=(items,start=0)=>{stop();setQueue(items);setIndex(start);setPage('player');};
  const go=(destination)=>{stop();recognitionRef.current?.abort();setListening(false);setPage(destination);};
  const startVoice=()=>{
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){notify('当前浏览器不支持语音识别，请输入文字寻找回忆');return;}
    const recognition=new Recognition();recognition.lang='zh-CN';recognition.interimResults=false;recognition.continuous=false;recognitionRef.current=recognition;
    recognition.onresult=event=>{setQuery(event.results[0][0].transcript);setListening(false);};recognition.onend=()=>setListening(false);recognition.onerror=event=>{setListening(false);notify(event.error==='not-allowed'?'请允许浏览器使用麦克风；手机访问需要 HTTPS':'语音识别暂时不可用，可以输入文字寻找回忆','error');};
    try{recognition.start();setListening(true);}catch{setListening(false);notify('麦克风无法启动，请使用文字搜索','error');}
  };
  const results=searchMemories(confirmed,query);
  const card=(m,items=confirmed,i=confirmed.indexOf(m))=><button key={m.id} className="elder-memory" onClick={()=>open(items,i)}><Cover memory={m}/><div><span>{m.year?`${m.year}年 · `:''}{m.location}</span><h3>{m.title}</h3><p>{m.isDemo?'示例故事 · 插画素材':'家人保存的回忆'}</p></div><span className="elder-card-play"><Icon name="play" size={24}/></span></button>;
  return <div className={`elder-app ${settings.fontSize==='extra'?'elder-extra':''} ${settings.highContrast?'high-contrast':''}`}><header className="elder-header"><button className="brand elder-brand" onClick={()=>go('home')}><span className="brand-mark"><Icon name="leaf" size={29}/></span><span>忆伴<small>熟悉的声音，温暖的回忆</small></span></button><div className="elder-header-actions">{page!=='home'&&<Button variant="secondary" icon="home" onClick={()=>go('home')}>回到首页</Button>}<Button variant="ghost" icon="logout" onClick={()=>{stop();onExit();}}>家属模式</Button></div></header>
  <main className="elder-main">{page==='home'&&<><div className="elder-greeting"><span className="eyebrow">今天也想陪你聊聊</span><h1>{settings.elderName}，你好呀<span>☀</span></h1><p>一起看看那些熟悉的人，听听我们家的故事。</p></div><div className="elder-menu">{[{id:'photos',icon:'image',title:'看照片',text:'看看熟悉的笑脸',color:'sage'},{id:'stories',icon:'volume',title:'听故事',text:'听听家人的声音',color:'peach'},{id:'search',icon:'mic',title:'找回忆',text:'说出你想看的内容',color:'lavender'},{id:'family',icon:'people',title:'我的家人',text:'看看家人的故事',color:'gold'}].map(item=><button key={item.id} className={`elder-menu-item ${item.color}`} onClick={()=>go(item.id)}><span><Icon name={item.icon} size={40}/></span><h2>{item.title}</h2><p>{item.text}</p><Icon name="arrow" size={25}/></button>)}</div><section className="elder-section"><div className="section-title"><h2>今天，想和你分享</h2><span>慢慢看，不着急</span></div><div className="elder-memory-grid">{confirmed.slice(0,3).map(m=>card(m))}</div></section><div className="elder-note"><Icon name="heart"/>每一段回忆，都有家人的陪伴。示例内容为虚构家庭故事。</div></>}
  {(page==='photos'||page==='stories')&&<><div className="elder-page-heading"><h1>{page==='photos'?'我们家的照片':'听听熟悉的故事'}</h1><p>{page==='photos'?'点击一张照片，就能看到它背后的故事。':'点击一个故事，就能听到讲述。没有录音时使用设备朗读。'}</p></div><div className="elder-memory-grid">{confirmed.map(m=>card(m))}</div>{!confirmed.length&&<Empty title="家人还在准备回忆" description="稍后再来看看吧"/>}</>}
  {page==='search'&&<><div className="elder-page-heading"><h1>你想看看什么？</h1><p>可以说“老家的照片”，也可以在下面输入。</p></div><div className="voice-search-card"><button className={`voice-button ${listening?'listening':''}`} onClick={()=>{if(listening){recognitionRef.current?.stop();setListening(false);}else startVoice();}} aria-label={listening?'停止录音':'开始语音寻找'}><Icon name="mic" size={42}/></button><h2>{listening?'正在听你说…':'点击麦克风，说说看'}</h2><p>语音识别需要网络和麦克风权限，也可以直接打字。</p><div className="elder-search-input"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：老家、女儿小时候、春节" aria-label="寻找回忆"/>{query&&<button onClick={()=>setQuery('')} aria-label="清空搜索"><Icon name="close"/></button>}</div><div className="quick-queries">{['老家','女儿小时候','旅行','春节','年轻的时候'].map(x=><button key={x} onClick={()=>setQuery(x)}>{x}</button>)}</div></div><div className="section-title"><h2>{query?`找到 ${results.length} 段相关回忆`:'你也可以先看看这些回忆'}</h2></div><div className="elder-memory-grid">{results.map((m,i)=>card(m,results,i))}</div>{!results.length&&<Empty title="暂时没有找到" description="换个简单的词，比如“老家”或“春节”试试。"/>}</>}
  {page==='family'&&<><div className="elder-page-heading"><h1>我们一家人</h1><p>每个人，都在你的回忆里。</p></div><div className="elder-family-grid">{state.members.map(member=>{const related=confirmed.filter(m=>m.people.includes(member.name));return <article key={member.id} className="elder-family-card"><Avatar name={member.name} color={member.color} size="avatar-xl"/><h2>{member.name}</h2><p>{member.relation}</p><Button variant="secondary" icon="heart" disabled={!related.length} onClick={()=>open(related)}>看看相关回忆 · {related.length}</Button></article>;})}</div></>}
  {page==='player'&&current&&<><div className="player-topline"><Button variant="ghost" icon="back" onClick={()=>go('photos')}>返回照片</Button><span>第 {index+1} / {queue.length} 段回忆</span><label className="check-row"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>连续播放</label></div><div className="elder-player"><div className="player-visual">{current.video?<video ref={videoRef} src={current.video} controls onEnded={ended} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>:<Cover memory={current}/>}<span className="player-year">{current.year?`${current.year}年`:'我们的回忆'}</span></div><div className="player-copy"><span className="eyebrow">{current.theme} · {current.location||'我们家的故事'}</span><h1>{current.title}</h1><p className="player-story">{current.story||'家人正在补充这段故事。'}</p><p className="player-source"><Icon name="volume" size={17}/>{current.video?'家庭视频':current.audio?'家人上传的真实录音':'设备朗读 · 非家人原声'}{current.isDemo?' · 虚构示例':''}</p>{current.audio&&<audio ref={audioRef} src={current.audio} onEnded={ended} onError={()=>notify('录音加载失败','error')}/>}<div className="player-controls"><Button icon={playing?'pause':'play'} onClick={()=>{if(playing){stop();log('pause');}else play();}}>{playing?'暂停':'听这段故事'}</Button><Button variant="secondary" icon="chevron" disabled={index>=queue.length-1} onClick={()=>{stop();setIndex(i=>i+1);}}>下一段</Button></div><div className="player-reactions"><button className={remembered?'selected':''} disabled={remembered} onClick={()=>{setRemembered(true);log('remember');notify('已记下你的回应');}}><Icon name="check"/>我记得</button><button className={liked?'selected':''} disabled={liked} onClick={()=>{setLiked(true);log('like');notify('家人会看到你的喜欢');}}><Icon name="heart"/>喜欢</button><button onClick={()=>{stop();play();log('replay');}}><Icon name="repeat"/>再听一次</button></div></div></div><div className="related-section"><h2>还有这些熟悉的回忆</h2><div className="related-chips">{confirmed.filter(m=>m.id!==current.id&&(m.theme===current.theme||m.people.some(p=>current.people.includes(p)))).slice(0,4).map(m=><button key={m.id} onClick={()=>open(confirmed,confirmed.findIndex(x=>x.id===m.id))}><Cover memory={m}/><span>{m.title}</span><Icon name="arrow"/></button>)}</div></div></>}
  </main><footer className="elder-footer"><Icon name="leaf" size={16}/>忆伴 · 陪你留住每一个温暖的瞬间</footer></div>;
}
