'use client';
import {useState} from 'react';
import Icon from './Icon';
import {Button,Field} from './UI';
import AuthMotion from './AuthMotion';

// 动效只作用于品牌舞台，认证流程和表单保持独立。
export default function AuthScreen({needsSetup,onComplete,api}) {
  const [mode,setMode]=useState(needsSetup?'setup':'login');
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
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
  return <main className="auth-screen auth-motion-page">
    <AuthMotion/>
    <section className="auth-panel">
      <div className="auth-box">

        <h2>{mode==='setup'||mode==='admin-register'?'创建管理员账号':mode==='register'?'接受家庭邀请':'欢迎回来'}</h2>
        <p>{mode==='setup'?'首次设置平台管理员，建立首个家庭空间。':mode==='admin-register'?'填写管理员邀请码，以管理员身份加入已有家庭。':mode==='register'?'填写邀请码，加入当前家庭空间。':'用自己的账号，继续保存家人的故事。'}</p>
        <form onSubmit={submit}>
          {mode!=='login'&&<Field label="你的姓名"><input name="name" required autoComplete="name" maxLength={30} placeholder="例如：小雨"/></Field>}
          <Field label="邮箱"><input name="email" type="email" required autoComplete="email" placeholder="name@example.com"/></Field>
          <Field label="密码"><input name="password" type={showPassword?'text':'password'} required minLength={8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="至少 8 位"/></Field>
          <button className="pw-password-toggle" type="button" onClick={()=>setShowPassword(value=>!value)} aria-pressed={showPassword}><Icon name="eye" size={16}/>{showPassword?'隐藏密码':'显示密码'}</button>{isInviteMode&&<Field label={mode==='admin-register'?'管理员邀请码':'家庭邀请码'}><input name="code" required maxLength={12} placeholder="12 位邀请码" autoComplete="off"/></Field>}
          {mode==='setup'&&<Field label="初始化口令（正式站必填）"><input type="password" name="setupToken" autoComplete="off" placeholder="由部署管理员提供，本地测试可留空"/></Field>}{error&&<div className="auth-error" role="alert"><Icon name="info" size={16}/>{error}</div>}
          <Button type="submit" busy={busy} className="auth-submit">{mode==='setup'?'创建账号并进入':mode==='admin-register'?'以管理员身份加入':mode==='register'?'加入家庭':'登录'}</Button>
        </form>
        <div className="auth-switch">{mode==='login'?<><button onClick={()=>switchMode(needsSetup?'setup':'admin-register')}>创建管理员账号</button><button onClick={()=>switchMode('register')}>通过邀请码加入</button></>:<button onClick={()=>switchMode('login')}>已有账号？返回登录</button>}</div>
        <div className="auth-note"><Icon name="shield" size={17}/>联系人帮你生成邀请码；管理员邀请码可直接以管理员身份加入家庭。请保管好管理员密码。</div>
      </div>
    </section>
  </main>;
}
