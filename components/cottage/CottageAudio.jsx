'use client';

import {useEffect,useRef,useState} from 'react';
import {Disc3,Pause,Play,Volume2} from 'lucide-react';

const clock=value=>{const seconds=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};

export default function CottageAudio({src,name='原始录音'}){
 const element=useRef(null),alive=useRef(true);
 const [playing,setPlaying]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[volume,setVolume]=useState(1),[error,setError]=useState('');
 useEffect(()=>{alive.current=true;const audio=element.current;return()=>{alive.current=false;audio?.pause();};},[]);
 const metadata=()=>{if(Number.isFinite(element.current?.duration))setDuration(element.current.duration);};
 async function toggle(){const audio=element.current;if(!audio)return;if(!audio.paused){audio.pause();return;}setError('');try{if(audio.error)audio.load();await audio.play();}catch{if(alive.current)setError('这段声音暂时没能播放，请再点一次播放重试。');}}
 function started(){document.querySelectorAll('.cottage-audio audio').forEach(other=>{if(other!==element.current)other.pause();});setPlaying(true);setError('');}
 return <section className="cottage-audio" data-playing={playing} aria-label={`${name}播放器`}>
  <div className="cottage-audio-top"><span className="cottage-audio-disc" aria-hidden="true"><Disc3 size={54} strokeWidth={1.1}/></span><div className="cottage-audio-caption"><span>留在这里的原声</span><strong>{name}</strong><small aria-live="polite">{error?'播放遇到一点问题':playing?'正在播放':'随时重听这一刻'}</small></div><button className="cottage-audio-play" type="button" onClick={toggle} aria-label={playing?'暂停原声':'播放原声'}>{playing?<Pause size={22}/>:<Play size={22}/>}</button></div>
  <div className="cottage-audio-seek"><time>{clock(time)}</time><input aria-label="原声进度" type="range" min="0" max={duration||1} step="0.1" value={Math.min(time,duration||0)} disabled={!duration} onChange={event=>{const next=Number(event.target.value);if(element.current&&duration){element.current.currentTime=next;setTime(next);}}}/><time>{duration?clock(duration):'--:--'}</time></div>
  <label className="cottage-audio-volume"><Volume2 size={16}/><span>音量</span><input aria-label="原声音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={event=>{const next=Number(event.target.value);if(element.current){element.current.muted=false;element.current.volume=next;}setVolume(next);}}/></label>
  {error&&<p className="cottage-audio-error" role="alert">{error}</p>}
  <audio ref={element} src={src} preload="metadata" aria-label={name} onLoadedMetadata={metadata} onDurationChange={metadata} onPlay={started} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);if(!duration)setDuration(element.current?.currentTime||0);}} onTimeUpdate={()=>setTime(element.current?.currentTime||0)} onVolumeChange={()=>setVolume(element.current?.muted?0:element.current?.volume??1)} onError={()=>{setPlaying(false);setError('声音未能载入，请点击播放重试。');}}/>
 </section>;
}
