'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from './UI';
import Icon from './Icon';

// 让回忆主人「自己讲」这一段记忆。
//
// 三个层次，用户按自己的意愿往上走，每一步都明码标价：
//   1. 点一下 → 模型写第一人称口述稿，用复刻音色念出来（几分钱）。
//   2. 照片 Ken Burns 缓慢推拉，配着声音播（不要钱，纯 CSS）。
//   3. 想要「真的动起来」再点一次 → 万相图生视频（按秒计费，明说是多少钱）。
//
// 一个诚实的约束：这是 AI 合成的声音，画面上必须一直挂着这句话。

const KEN_BURNS=['life-portrait-zoom-in','life-portrait-zoom-out','life-portrait-drift'];

function formatCost(resolution,seconds){
  // 与官方价目表一致：480P 0.3 元/秒，720P 0.6 元/秒。只用来给用户一个心理预期。
  const per={ '480P':0.3,'720P':0.6 }[resolution]||0.3;
  return (per*seconds).toFixed(seconds*per%1===0?0:1);
}

export default function MemoryNarrator({memory,api,notify,canEdit}){
  const [info,setInfo]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [script,setScript]=useState('');
  const [audioUrl,setAudioUrl]=useState('');
  const [playing,setPlaying]=useState(false);
  const [video,setVideo]=useState(null);       // {status,url,resolution,duration,taskId}
  const [resolution,setResolution]=useState('480P');
  const [seconds,setSeconds]=useState(5);
  const audioRef=useRef(null);
  const pollRef=useRef(null);
  const stillMounted=useRef(true);

  useEffect(()=>{stillMounted.current=true;return()=>{stillMounted.current=false;if(pollRef.current)clearTimeout(pollRef.current);};},[]);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const data=await api(`/narrate/${memory.id}`);
      if(!stillMounted.current)return;
      setInfo(data);
      setScript(data.script||'');
      setAudioUrl(data.audioUrl||'');
      setVideo(data.video||null);
    }catch(e){if(stillMounted.current)setError(e.message);}
    finally{if(stillMounted.current)setLoading(false);}
  },[api,memory.id]);

  useEffect(()=>{load();},[load]);

  const narrate=async(force=false)=>{
    setBusy(true);setError('');
    try{
      const data=await api('/narrate/script',{method:'POST',body:JSON.stringify({memoryId:memory.id,force})});
      if(!stillMounted.current)return;
      setScript(data.script);setAudioUrl(data.audioUrl||'');
      if(data.warning)notify?.(data.warning,'error');
      else if(data.cached)notify?.('用的是上次讲好的版本');
      else notify?.('TA 开口了');
    }catch(e){if(stillMounted.current)setError(e.message);}
    finally{if(stillMounted.current)setBusy(false);}
  };

  // 轮询视频任务。DashScope 那边通常 1~3 分钟，这里 5 秒问一次，连续失败三次就停。
  const pollVideo=useCallback(async key=>{
    let misses=0;
    const tick=async()=>{
      if(!stillMounted.current)return;
      try{
        const data=await api(`/narrate-video/${key}`);
        if(!stillMounted.current)return;
        misses=0;
        if(data.status==='ready'){setVideo({status:'ready',url:data.url,resolution:data.resolution,duration:data.duration});notify?.('动起来了');return;}
        if(data.status==='failed'){setError(data.message||'生成失败了');setVideo(null);notify?.(data.message||'生成失败了','error');return;}
        pollRef.current=setTimeout(tick,5000);
      }catch(e){
        misses+=1;
        if(misses>=3){setError(e.message);return;}
        pollRef.current=setTimeout(tick,8000);
      }
    };
    pollRef.current=setTimeout(tick,3000);
  },[api,notify]);

  const makeVideo=async()=>{
    setBusy(true);setError('');
    try{
      const data=await api('/narrate/video',{method:'POST',body:JSON.stringify({memoryId:memory.id,resolution,duration:seconds})});
      if(!stillMounted.current)return;
      if(data.status==='ready'){
        setVideo({status:'ready',url:data.url,resolution:data.resolution,duration:data.duration});
        notify?.('动起来了');
      }else{
        setVideo({status:'pending',taskId:data.taskId,resolution:data.resolution,duration:data.duration});
        notify?.('正在生成，大概要一两分钟');
        pollVideo(data.taskId);
      }
    }catch(e){if(stillMounted.current)setError(e.message);}
    finally{if(stillMounted.current)setBusy(false);}
  };

  // 播放：优先用已生成的视频；否则播声音，同时给照片上 Ken Burns。
  const togglePlay=()=>{
    const audio=audioRef.current;
    if(!audio)return;
    if(playing){audio.pause();setPlaying(false);}
    else{audio.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));}
  };

  if(loading)return <div className="narrator-card narrator-loading"><span className="spinner"/><p>正在看看这段回忆有没有准备好…</p></div>;

  const narrator=info?.narrator;
  const canListen=Boolean(script&&audioUrl);
  const cover=memory.cover||'';
  const ken=KEN_BURNS[String(memory.id||'').length%KEN_BURNS.length];

  // 视频这块永远看得见（只要这个账号能改），缺什么就把缺的那一项说出来，
  // 说的顺序就是实际该走的顺序：先配服务 → 再复刻声音 → 再生成讲述 → 最后才轮到动起来。
  // 之前它嵌在 script 分支里，没配密钥的人连这个功能存在都不知道。
  const canMake=Boolean(info?.videoEnabled&&script&&cover);
  const videoHint=!info?.videoEnabled
    ? '视频生成服务还没配置（需要管理员在环境变量里填 DASHSCOPE_API_KEY），配好后这里就能把照片动起来。'
    : !narrator
    ? '动起来要配一段讲述，得先有家人的复刻声音（见上方提示）。'
    : !script
    ? '先用上面的「让 TA 讲这段」生成一段讲述，再来让它动起来——动起来要配着那段声音看。'
    : !cover
    ? '这段记忆还没有封面照片，动起来需要一张。'
    : '让这张照片缓慢动起来，配上刚才那段声音。按秒计费，生成后长期保存，同一个版本不会重复收费。';

  return <section className="narrator-card">
    <header className="narrator-head">
      <h3><Icon name="volume" size={18}/>让 TA 自己讲</h3>
      {narrator?<span className="narrator-who">由 {narrator.name}{narrator.relation?`（${narrator.relation}）`:''} 讲述</span>:null}
    </header>

    {error?<p className="form-error">{error}</p>:null}

    {!info?.voiceEnabled&&!info?.aiEnabled&&!loading?<p className="narrator-hint">还没配置模型与声音服务，这个功能需要管理员先把密钥填上。</p>:null}

    {!narrator&&!loading?<p className="narrator-hint">还没有家人复刻过声音。先到「家庭成员」里给一位家人复刻声音，才能让 TA 来讲这段回忆。</p>:null}

    {narrator&&!script?<div className="narrator-empty">
      <p>可以让 {narrator.name} 用自己的声音，把这段回忆讲一遍。声音是 AI 合成的，不是真人录音。</p>
      <Button icon="volume" busy={busy} onClick={()=>narrate(false)}>{busy?'正在准备…':'让 TA 讲这段'}</Button>
    </div>:null}

    {narrator&&!script&&!info?.voiceEnabled&&!loading?<p className="narrator-hint">目前只写了稿、没有合成声音：声音服务未配置。配好后同一个按钮会连声音一起生成。</p>:null}

    {script?<>
      <div className="narrator-stage">
        {video?.status==='ready'&&video.url
          ? <video className="narrator-portrait is-video" src={video.url} controls playsInline/>
          : cover?<div className="narrator-portrait"><img className={`narrator-photo ${playing?ken:''}`} src={cover} alt="这段回忆的照片"/></div>:null}
        {audioUrl?<audio ref={audioRef} src={audioUrl} preload="metadata" onEnded={()=>setPlaying(false)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>:null}
        {audioUrl?<div className="narrator-controls"><Button variant="secondary" icon={playing?'pause':'play'} onClick={togglePlay}>{playing?'暂停':'播放'}</Button></div>:null}
      </div>

      <blockquote className="narrator-script">{script}</blockquote>

      <p className="narrator-disclaimer"><Icon name="info" size={14}/>这段声音由 AI 根据 {narrator?.name||'家人'} 的音色合成，不是真人录音；内容来自这段记忆的原文。</p>

      <div className="narrator-actions">
        <Button variant="ghost" icon="repeat" busy={busy} disabled={busy} onClick={()=>narrate(true)}>换一种说法重讲</Button>
      </div>
    </>:null}

    {canEdit?<div className={`narrator-video${canMake?'':' is-locked'}`}>
      <h4><Icon name="sparkle" size={16}/>让它动起来</h4>

      {video?.status==='pending'
        ? <p className="narrator-hint"><span className="spinner"/>正在生成，大约要一两分钟。可以先去看别的，回来自动能播。</p>
        : video?.status==='ready'&&video.url
        ? <p className="narrator-hint">这版已经生成好并长期保存，再看不会重复计费。想换个时长可以重新生成。</p>
        : <p className="narrator-hint">{videoHint}</p>}

      {video?.status!=='pending'?<div className="narrator-options">
        <label>清晰度
          <select value={resolution} onChange={e=>setResolution(e.target.value)} disabled={busy}>
            {(info?.resolutions||['480P','720P']).map(item=><option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>时长
          <select value={seconds} onChange={e=>setSeconds(Number(e.target.value))} disabled={busy}>
            {[3,5,8,10].map(item=><option key={item} value={item}>{item} 秒</option>)}
          </select>
        </label>
        <span className="narrator-cost">预计约 {formatCost(resolution,seconds)} 元</span>
      </div>:null}

      {video?.status==='ready'&&video.url
        ? <Button variant="ghost" icon="sparkle" busy={busy} disabled={busy||!canMake} onClick={makeVideo}>
            {busy?'正在提交…':'按这个设置重新生成一版'}
          </Button>
        : <Button variant="secondary" icon="sparkle" busy={busy} disabled={busy||!canMake} onClick={makeVideo}>
            {busy?'正在提交…':`生成 ${seconds} 秒视频`}
          </Button>}
    </div>:null}
  </section>;
}
