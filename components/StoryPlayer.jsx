'use client';
import {useEffect,useState} from 'react';
import {Button} from './UI';
import Icon from './Icon';
export default function StoryPlayer({memory,rate=0.85}){
  const [playing,setPlaying]=useState(false);const [error,setError]=useState('');
  useEffect(()=>()=>{window.speechSynthesis?.cancel();},[memory.id]);
  const speak=()=>{
    if(playing){window.speechSynthesis?.cancel();setPlaying(false);return;}
    if(!window.speechSynthesis){setError('此浏览器暂不支持设备朗读，请阅读正文或播放家人录音。');return;}
    const text=memory.story||memory.title;const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=rate;
    utterance.onend=()=>setPlaying(false);utterance.onerror=()=>{setPlaying(false);setError('设备朗读未能完成，可以再试一次。');};
    window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);setPlaying(true);setError('');
  };
  return <section className="story-player"><div className="story-player-title"><span><Icon name="volume"/></span><div><strong>{memory.audio?'听听家人的原声':'听这段故事'}</strong><small>{memory.audio?'真实录音 · 已有内容回放不消耗积分':'设备合成朗读 · 免费，不模仿家人声音'}</small></div></div>{memory.audio?<audio controls src={memory.audio} preload="metadata"/>:<Button variant="secondary" icon={playing?'pause':'play'} onClick={speak}>{playing?'停止朗读':'开始朗读'}</Button>}{error&&<p role="status" className="form-error">{error}</p>}</section>;
}
