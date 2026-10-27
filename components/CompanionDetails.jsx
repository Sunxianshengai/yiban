'use client';
import {useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {PersonaAvatar} from './Familia';
import {familiaAPI} from '../lib/familia-client.mjs';
import {chatAPI} from '../lib/chat-client.mjs';

function Row({icon,children,hint,onClick}){return <button className="im-detail-row" onClick={onClick}><Icon name={icon} size={18}/><span>{children}</span>{hint&&<small>{hint}</small>}<Icon name="chevron" size={17}/></button>;}
export default function CompanionDetails({profile,profileId,type='details',onClose,onMemory,onPersona,onHistory,onNew,onCredits,onTheme,theme,mobile=false}){
  const [screen,setScreen]=useState(type),[state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const ref=useRef(null);
  const [knock,setKnock]=useState(null);
  const endpoint='personal-memories'+(profileId?'?profileId='+encodeURIComponent(profileId):'');
  useEffect(()=>{let live=true;setState(null);setError('');if(screen==='memory')familiaAPI(endpoint).then(value=>{if(live)setState(value);}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[screen,endpoint]);
  // 它记得的话头：只属于这段私人对话，与家庭记忆无关；可以逐条让它忘掉。
  useEffect(()=>{let alive=true;if(screen!=='memory'){setKnock(null);return;}chatAPI('callbacks').then(value=>{if(alive)setKnock(value);}).catch(()=>{if(alive)setKnock(null);});return()=>{alive=false;};},[screen]);
  async function toggleKnock(){
    if(!knock||busy)return;setBusy(true);setError('');
    try{setKnock({...knock,enabled:!knock.enabled,...await chatAPI('callbacks',{method:'POST',body:{enabled:!knock.enabled}})});}
    catch(failure){setError(failure.message);}
    finally{setBusy(false);}
  }
  async function forget(id){
    setBusy(true);setError('');
    try{await chatAPI(`callbacks/${id}/forget`,{method:'POST'});setKnock(value=>value?{...value,items:value.items.filter(item=>item.id!==id)}:value);}
    catch(failure){setError(failure.message);}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    const previous=document.activeElement,el=ref.current,background=mobile?[...document.querySelectorAll('.im-workspace>.cw-main,.im-workspace>.cw-history')]:[],prior=background.map(item=>item.inert);background.forEach(item=>{item.inert=true;});el.querySelector('button')?.focus();
    const focusables=()=>[...el.querySelectorAll('button:not(:disabled),input,textarea,select')].filter(item=>item.getClientRects().length);
    const key=event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}if(mobile&&event.key==='Tab'){const list=focusables();if(event.shiftKey&&document.activeElement===list[0]){event.preventDefault();list.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===list.at(-1)){event.preventDefault();list[0]?.focus();}}};el.addEventListener('keydown',key);
    return()=>{el.removeEventListener('keydown',key);background.forEach((item,index)=>item.inert=prior[index]);if(previous?.isConnected)previous.focus();};
  },[mobile,onClose]);
  async function toggle(){if(!state||busy)return;setBusy(true);setError('');try{await familiaAPI(endpoint,{method:'PATCH',body:{mode:state.mode==='auto'?'manual':'auto',expectedRevision:state.revision}});setState(await familiaAPI(endpoint));}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  const groups=[['关于你','user',item=>['about','preference'].includes(item.category)],['最近的事','clock',item=>item.category==='event'],['喜欢的相处方式','heart-handshake',item=>item.category==='boundary']];
  return <aside ref={ref} className="im-detail" role={mobile?'dialog':'complementary'} aria-modal={mobile?true:undefined} aria-label={screen==='memory'?'对我的了解':'聊天详情'}>
    <header><button className={`cw-tool im-panel-back ${screen==='memory'?'im-memory-back':''}`} aria-label={screen==='memory'?'返回聊天详情':'返回聊天'} onClick={()=>screen==='memory'?setScreen('details'):onClose()}><Icon name="back"/></button><strong>{screen==='memory'?'对我的了解':'聊天详情'}</strong><button className="cw-tool" aria-label="关闭详情" onClick={onClose}><Icon name="close"/></button></header>
    <div className="im-detail-content">{screen==='memory'?<>
      <h2>一点点，更了解你</h2><p className="im-panel-intro">从日常聊天里，记住值得留到下次的事。</p>
      <div className="im-auto-memory"><Icon name="leaf" size={22}/><div><strong>{!state?'正在读取设置…':!state.enabled?'个人记忆已暂停':state.mode==='auto'?'自动了解，持续更新':'由你选择，确认后记住'}</strong><p>你只管聊天，也能随时纠正或让我忘记。</p></div><button className="im-switch" role="switch" aria-label="自动记忆" aria-checked={Boolean(state?.enabled&&state.mode==='auto')} disabled={!state||busy||!state.enabled} onClick={toggle}><span/></button></div>
      {state&&groups.map(([label,icon,filter])=><section className="im-memory-group" key={label}><h3><Icon name={icon} size={16}/>{label}</h3>{state.items.filter(item=>!item.expired&&filter(item)).slice(0,3).map(item=><p key={item.id}>{item.text}<small>{new Date(item.updatedAt).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})} 更新 · {item.origin==='auto'?'聊天中了解':'由你保存'}</small></p>)}{!state.items.some(item=>!item.expired&&filter(item))&&<p className="im-memory-empty">{label==='最近的事'?'最近的安排，会慢慢记在这里。':'从你愿意分享的小事开始了解。'}</p>}</section>)}
      <button className="im-secondary" onClick={onMemory}>检查、修改与遗忘</button>
      {knock&&<section className="im-memory-group im-knock-group"><h3><Icon name="message" size={16}/>它会主动提起的事</h3>
        <div className="im-auto-memory im-knock-switch"><Icon name="clock" size={22}/><div><strong>{knock.enabled?'会主动开口':'不会主动开口'}</strong><p>隔一阵没说话，它会先问一句；聊过的事，过一两天再提起。</p></div><button className="im-switch" role="switch" aria-label="主动开口" aria-checked={knock.enabled} disabled={busy} onClick={toggleKnock}><span/></button></div>
        {knock.items.slice(0,4).map(item=><p key={item.id}>{item.hook}<small>{item.quote}</small><button type="button" className="im-forget" aria-label={`忘记${item.hook}`} disabled={busy} onClick={()=>forget(item.id)}>忘记</button></p>)}
        {!knock.items.length&&<p className="im-memory-empty">还没有想再问起的事。聊几次就会有。</p>}
        <p className="im-panel-note"><Icon name="lock" size={13}/>只在这段对话里使用，不进家庭记忆，家人看不到。</p>
      </section>}
      <p className="im-panel-note"><Icon name="lock" size={13}/>仅你与{profile.name}使用，不与其他伙伴或家人共享。<br/>自动整理可能遗漏或记错，可随时修改。保存不额外扣积分。</p>
    </>:<>
      <div className="im-profile-intro"><PersonaAvatar profile={profile} large/><h2>{profile.name}</h2><span>AI 伙伴 · 不代表真实人物</span><p>{profile.description||'按你喜欢的方式，听你说说话。'}</p></div>
      <section className="im-detail-section"><Row icon="leaf" hint="个人记忆" onClick={()=>setScreen('memory')}><strong>对我的了解</strong><em>喜好、近况和舒服的相处方式</em></Row><Row icon="settings" onClick={onPersona}>人格与表达</Row></section>
      <section className="im-detail-section"><h3>这段聊天</h3><Row icon="search" onClick={onHistory}>查找聊天记录</Row><Row icon="message" onClick={onNew}>换个话题</Row></section>
      <section className="im-detail-section"><Row icon="moon" hint={theme==='dark'?'深色':'浅色'} onClick={onTheme}>聊天外观</Row><Row icon="coins" onClick={onCredits}>积分与消费</Row></section>
      <p className="im-panel-note">日常回应会按内容分条，一轮成功回复只扣一次积分。停止或失败退回。语音入口使用设备语音输入与朗读。</p>
    </>}{error&&<p className="im-panel-error" role="alert">{error}<button onClick={()=>{setScreen('details');setTimeout(()=>setScreen('memory'),0);}}>重新读取</button></p>}</div>
  </aside>;
}
