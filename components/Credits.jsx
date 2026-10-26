'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button,Field} from './UI';
import {CREDIT_PRICES} from '../lib/credit-prices.mjs';

const LABELS={grant:'管理员发放',reserve:'冻结',settle:'消费完成',refund:'积分退回'};
const featureLabel=feature=>CREDIT_PRICES[feature]?.label||'管理员发放';
const when=value=>new Date(value).toLocaleString('zh-CN');

export function CreditBalance({api,onOpen}) {
  const [wallet,setWallet]=useState(null);
  useEffect(()=>{
    let alive=true,version=0;
    const load=()=>{const current=++version;api('/credits/balance').then(data=>{if(alive&&current===version)setWallet(data);}).catch(()=>{if(alive&&current===version)setWallet(null);});};
    load();
    window.addEventListener('credits-changed',load);
    window.addEventListener('focus',load);
    return()=>{alive=false;window.removeEventListener('credits-changed',load);window.removeEventListener('focus',load);};
  },[api]);
  return <button className="credits-balance" onClick={onOpen} aria-label="积分余额"><span>积分</span><strong>{wallet?wallet.balance:'—'}</strong>{wallet?.held>0&&<small>冻结 {wallet.held}</small>}</button>;
}

export default function Credits({api,notify,isAdmin}) {
  const [showGrant,setShowGrant]=useState(false);
  const [wallet,setWallet]=useState(null);
  const [error,setError]=useState('');
  const [offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(false);
  const [accounts,setAccounts]=useState([]);
  const [target,setTarget]=useState('');
  const [amount,setAmount]=useState('100');
  const [note,setNote]=useState('家庭体验积分');
  const [grantResult,setGrantResult]=useState('');
  const grantRequest=useRef(null);
  const load=useCallback(async()=>{
    try {setWallet(await api(`/credits?offset=${offset}`));setError('');window.dispatchEvent(new Event('credits-changed'));}
    catch(e){setError(e.message);}
  },[api,offset]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    if(isAdmin)api('/auth/accounts').then(data=>setAccounts(data.accounts)).catch(e=>setError(e.message));
  },[api,isAdmin]);
  const grant=async e=>{
    e.preventDefault();if(busy)return;
    setBusy(true);setGrantResult('');
    const body={userId:target,amount:Number(amount),note:note.trim()};
    const signature=JSON.stringify(body);
    if(grantRequest.current?.signature!==signature)grantRequest.current={signature,key:crypto.randomUUID()};
    try {
      const result=await api('/credits/grant',{method:'POST',headers:{'Idempotency-Key':grantRequest.current.key},body:signature});
      setGrantResult(`已发放 ${body.amount} 积分，收款账号当前可用 ${result.balance} 积分。`);
      grantRequest.current=null;
      window.dispatchEvent(new Event('credits-changed'));await load();notify('积分已发放');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const checkTask=async pollKey=>{
    setBusy(true);
    try {
      const task=await api(`/narrate-video/${pollKey}`);
      notify(task.status==='ready'?'视频已保存，积分已结算':task.status==='failed'?'生成失败，积分已退回':'视频仍在生成，积分保持冻结');
      await load();window.dispatchEvent(new Event('credits-changed'));
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  return <div className="credits-page">
    <div className="page-heading"><div><h1>我的积分</h1><p>积分用于 AI 创作，由管理员发放。新账号从 0 积分开始，管理员使用功能也同样扣费。</p></div><div className="pw-credits-heading">{isAdmin&&<Button variant="secondary" onClick={()=>setShowGrant(value=>!value)}>{showGrant?'返回消费记录':'发放积分'}</Button>}<Button variant="ghost" onClick={load}>刷新余额</Button></div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="pw-credit-layout"><div className="pw-credit-summary"><div className="credits-totals"><section className="panel"><span>可用积分</span><strong>{wallet?.balance??'—'}</strong></section><section className="panel"><span>冻结积分</span><strong>{wallet?.held??'—'}</strong><small>正在执行的任务，成功结算，失败退回。</small></section></div>
    <div className="pw-credit-inline"><span>可用 {wallet?.balance??'—'}</span><span>预留 {wallet?.held??'—'}</span></div><p className="inline-notice">上传、浏览、本地处理及已有结果回放不扣积分。只有新的 AI 生成才计费；系统重试不重复扣费。当前积分不与人民币换算。</p>
    <p className="pw-credit-rule">陪伴对话：成功回复 1 积分，失败或停止退回。</p></div><div className="pw-credit-content">    {isAdmin&&showGrant&&<section className="panel credits-grant"><h2>发放积分</h2><p className="muted">可给自己或其他账号发放；每笔记录发放人、数量和说明。</p><form onSubmit={grant}>
      <div className="form-grid"><Field label="发放给"><select aria-label="发放给" required value={target} onChange={e=>setTarget(e.target.value)}><option value="">请选择账号</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}</select></Field>
      <Field label="积分数量"><input type="number" min="1" max="1000000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></Field></div>
      <Field label="发放说明"><input maxLength={200} required value={note} onChange={e=>setNote(e.target.value)}/></Field>
      <Button type="submit" busy={busy} disabled={!target}>确认发放</Button>{grantResult&&<p role="status">{grantResult}</p>}
    </form></section>}
    {wallet?.pending.length>0&&<section className="panel"><h2>处理中</h2><p className="muted">视频不会因页面关闭而退费。可在这里查询结果；临时断网保持冻结。其他中断请求超过 30 分钟后，在打开积分页面时自动退回。</p>{wallet.pending.map(p=><div className="credit-pending" key={p.id}><span>{featureLabel(p.feature)} · 冻结 {p.amount} 积分<br/><small>{when(p.createdAt)}</small></span>{p.pollKey?<Button variant="secondary" busy={busy} onClick={()=>checkTask(p.pollKey)}>更新视频任务</Button>:<span>处理中</span>}</div>)}</section>}
    <section className="panel"><h2>积分记录</h2><p className="muted">冻结时从可用余额扣除；消费完成只结算冻结额度，不会再次扣除。仅显示当前账号的记录。</p>
      <div className="credits-table-wrap"><table className="credits-table"><thead><tr><th>时间</th><th>类型 / 功能</th><th>可用积分变化</th><th>说明</th></tr></thead><tbody>{wallet?.entries.map(e=><tr key={e.id}><td>{when(e.createdAt)}</td><td>{LABELS[e.kind]}<br/><small>{featureLabel(e.feature)}</small></td><td>{e.amount>0?'+':''}{e.amount}</td><td>{e.kind==='reserve'?`预留额度 · ${featureLabel(e.feature)}`:e.note}<br/><small title={e.operationId}>单号 {e.operationId.slice(0,8)}</small></td></tr>)}</tbody></table></div>
      {wallet&&!wallet.entries.length&&<p>还没有积分记录，请联系管理员发放。</p>}
      <div className="credits-pagination"><Button variant="ghost" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>上一页</Button><span>共 {wallet?.total??0} 条</span><Button variant="ghost" disabled={!wallet||offset+50>=wallet.total} onClick={()=>setOffset(offset+50)}>下一页</Button></div>
    </section>
    <details className="panel pw-credit-prices"><summary>功能扣费说明</summary><div className="credits-price-list">{Object.entries(wallet?.prices||CREDIT_PRICES).map(([key,p])=><div key={key}><span>{p.label}</span><strong>{p.points} 积分 / {p.unit}</strong></div>)}</div><p className="muted">讲述稿与配音组合按次计费。调用失败或结果无法保存时退回；缓存命中免费。</p></details>
  </div></div></div>;
}
