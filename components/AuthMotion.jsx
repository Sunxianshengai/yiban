'use client';
import {useEffect,useId,useRef,useState} from 'react';

export default function AuthMotion(){
  const [inactive,setInactive]=useState(false);
  const stage=useRef(null),id=useId().replace(/:/g,'');
  useEffect(()=>{
    let visible=true;
    const sync=()=>setInactive(document.hidden||!visible);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    observer.observe(stage.current);document.addEventListener('visibilitychange',sync);sync();
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  return <><div className={`am-ambient ${inactive?'am-paused':''}`} aria-hidden="true">
    <div className="am-orb" aria-hidden="true"/><div className="am-rings" aria-hidden="true"/>
    <svg className="am-art" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>
      <linearGradient id={`${id}-color`} x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#b99bdf" stopOpacity=".04"/><stop offset=".45" stopColor="#c7a6e6" stopOpacity=".42"/><stop offset="1" stopColor="#f2b499" stopOpacity=".48"/></linearGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".8"/><stop offset=".7" stopColor="#fff" stopOpacity=".08"/></linearGradient>
    </defs><path className="am-wave" fill={`url(#${id}-color)`} d="M-150 420 C140 650 270 90 540 260 S810 590 1150 180 L1150 650 L-150 650Z"/>
    <path className="am-wave am-wave-two" fill={`url(#${id}-light)`} d="M-150 360 C150 90 220 610 560 390 S880 270 1150 350 L1150 650 L-150 650Z"/>
    <path className="am-wave am-wave-three" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="1.4" d="M-150 420 C160 650 310 110 570 290 S820 570 1150 180"/></svg>
    </div><section ref={stage} className={`auth-stage auth-motion-stage ${inactive?'am-paused':''}`} aria-label="忆伴">
    <div className="am-copy"><h1>忆伴</h1><p>让每一次陪伴，<br/>都有回忆可循。</p></div>
    <div className="am-sound"><span className="am-bars" aria-hidden="true">{[9,18,24,14,8].map((height,i)=><i key={i} style={{'--am-height':`${height}px`,'--am-delay':`${i*-.5}s`}}/>)}</span><span>让回忆，慢慢流动。</span></div>
  </section></>;
}
