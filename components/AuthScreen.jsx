'use client';
import {useEffect,useState} from 'react';
import Icon from './Icon';
import {Button,Field} from './UI';

// 左侧舞台的轮播句：几秒换一句，让登录页像有人在跟你说话。
const QUOTES=[
  '把爷爷奶奶的故事，讲给孩子听。',
  '每一张老照片，都值得被好好安放。',
  '记忆会褪色，陪它的人不会。',
  '一家人共用的记忆库，谁都能添一段。',
];
// 拍立得：两张真实照片 + 一张预置插画，混排出「家里的相册摊开了」的感觉。
const POLAROIDS=[
  {src:'/auth-bg/family-album.jpg',caption:'2024 · 三代人翻相册'},
  {src:'/demo/newyear.svg',caption:'1999 · 老家的年夜饭'},
  {src:'/auth-bg/album-warm.jpg',caption:'昨晚 · 床边的故事'},
];

export default function AuthScreen({needsSetup,onComplete,api}) {
  const [mode,setMode]=useState(needsSetup?'setup':'login');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [quote,setQuote]=useState(0);
  const [drift,setDrift]=useState({x:0,y:0});
  useEffect(()=>{
    const timer=setInterval(()=>setQuote(q=>(q+1)%QUOTES.length),4200);
    return ()=>clearInterval(timer);
  },[]);
  // 鼠标视差：光标在舞台上移动时，拍立得按各自深度轻微漂移。
  const trackDrift=event=>{
    const rect=event.currentTarget.getBoundingClientRect();
    setDrift({x:(event.clientX-rect.left)/rect.width-.5,y:(event.clientY-rect.top)/rect.height-.5});
  };
  const submit=async event=>{
    event.preventDefault();setError('');setBusy(true);
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    const endpoint=mode==='admin-register'||mode==='register'?'register':mode;
    try{await api(`/auth/${endpoint}`,{method:'POST',body:JSON.stringify(payload)});await onComplete();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const switchMode=next=>{setError('');setMode(next);};
  const isInviteMode=mode==='register'||mode==='admin-register';
  return <main className="auth-screen">
    <section className="auth-stage" aria-hidden="true" onMouseMove={trackDrift} onMouseLeave={()=>setDrift({x:0,y:0})}>
      <div className="auth-brand"><span className="brand-mark"><Icon name="leaf" size={30}/></span><span>忆伴</span></div>
      <p className="auth-quote" key={quote}>{QUOTES[quote]}</p>
      <div className="auth-polaroids">
        {POLAROIDS.map((photo,index)=><figure key={photo.src} style={{'--px':`${drift.x*[26,-18,34][index]}px`,'--py':`${drift.y*[18,-12,26][index]}px`}} className={`auth-polaroid auth-polaroid-${index}`}><img src={photo.src} alt=""/><figcaption>{photo.caption}</figcaption></figure>)}
      </div>
      <small className="auth-stage-note">比赛演示版 · 预置家庭内容为虚构示例</small>
    </section>
    <section className="auth-panel">
      <div className="auth-box">
        <span className="eyebrow">欢迎来到记忆小屋</span>
        <h2>{mode==='setup'||mode==='admin-register'?'创建管理员账号':mode==='register'?'接受家庭邀请':'登录家庭空间'}</h2>
        <p>{mode==='setup'?'首次设置后，原有记忆会保留。':mode==='admin-register'?'填写管理员邀请码，以管理员身份加入已有家庭。':mode==='register'?'填写邀请码，加入当前家庭空间。':'用自己的账号，继续保存家人的故事。'}</p>
        <form onSubmit={submit}>
          {mode!=='login'&&<Field label="你的姓名"><input name="name" required autoComplete="name" maxLength={30} placeholder="例如：小雨"/></Field>}
          <Field label="邮箱"><input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></Field>
          <Field label="密码"><input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="至少 8 位"/></Field>
          {isInviteMode&&<Field label={mode==='admin-register'?'管理员邀请码':'家庭邀请码'}><input name="code" required maxLength={12} placeholder="12 位邀请码" autoComplete="off"/></Field>}
          {error&&<div className="auth-error" role="alert"><Icon name="info" size={16}/>{error}</div>}
          <Button type="submit" busy={busy} className="auth-submit">{mode==='setup'?'创建账号并进入':mode==='admin-register'?'以管理员身份加入':mode==='register'?'加入家庭':'登录'}</Button>
        </form>
        <div className="auth-switch">{mode==='login'?<><button onClick={()=>switchMode(needsSetup?'setup':'admin-register')}>创建管理员账号</button><button onClick={()=>switchMode('register')}>通过邀请码加入</button></>:<button onClick={()=>switchMode('login')}>已有账号？返回登录</button>}</div>
        <div className="auth-note"><Icon name="shield" size={17}/>联系人帮你生成邀请码；管理员邀请码可直接以管理员身份加入家庭。请保管好管理员密码。</div>
      </div>
    </section>
  </main>;
}
