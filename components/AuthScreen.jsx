'use client';
import {useState} from 'react';
import Icon from './Icon';
import {Button,Field} from './UI';

export default function AuthScreen({needsSetup,onComplete,api}) {
  const [mode,setMode]=useState(needsSetup?'setup':'login');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const submit=async event=>{
    event.preventDefault();setError('');setBusy(true);
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    try{await api(`/auth/${mode}`,{method:'POST',body:JSON.stringify(payload)});await onComplete();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <main className="auth-screen"><section className="auth-intro"><span className="brand-mark"><Icon name="leaf" size={31}/></span><h1>忆伴</h1><p>家人的故事，留在家人的空间里。</p><div className="auth-art"><img src="/demo/westlake.svg" alt="虚构家庭旅行示例插画"/></div><small>本机比赛演示版 · 预置家庭内容为虚构示例</small></section><section className="auth-panel"><div className="auth-box"><span className="eyebrow">欢迎来到记忆小屋</span><h2>{mode==='setup'?'创建管理员账号':mode==='register'?'接受家庭邀请':'登录家庭空间'}</h2><p>{mode==='setup'?'首次设置后，原有记忆会保留。':mode==='register'?'填写邀请码，加入当前家庭空间。':'用自己的账号，继续保存家人的故事。'}</p><form onSubmit={submit}>
    {mode!=='login'&&<Field label="你的姓名"><input name="name" required autoComplete="name" maxLength={30} placeholder="例如：小雨"/></Field>}
    <Field label="邮箱"><input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></Field>
    <Field label="密码"><input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="至少 8 位"/></Field>
    {mode==='register'&&<Field label="家庭邀请码"><input name="code" required maxLength={12} placeholder="12 位邀请码" autoComplete="off"/></Field>}
    {error&&<div className="auth-error" role="alert"><Icon name="info" size={16}/>{error}</div>}
    <Button type="submit" busy={busy} className="auth-submit">{mode==='setup'?'创建账号并进入':mode==='register'?'加入家庭':'登录'}</Button>
  </form>{!needsSetup&&<div className="auth-switch">{mode==='login'?<button onClick={()=>{setError('');setMode('register');}}>有邀请码？加入家庭</button>:<button onClick={()=>{setError('');setMode('login');}}>已有账号？返回登录</button>}</div>}<div className="auth-note"><Icon name="shield" size={17}/>账号只在这台比赛电脑上使用。请保管好管理员密码。</div></div></section></main>;
}
