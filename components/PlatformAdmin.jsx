'use client';
import {useEffect,useState} from 'react';
import {Button,Field} from './UI';

export default function PlatformAdmin({api,notify,onEnter}){
  const [overview,setOverview]=useState(null),[family,setFamily]=useState(''),[accountId,setAccountId]=useState(''),[collection,setCollection]=useState('memories'),[rows,setRows]=useState(null),[offset,setOffset]=useState(0),[wallet,setWallet]=useState(null),[busy,setBusy]=useState(false),[name,setName]=useState('');
  useEffect(()=>{let alive=true;api('/platform').then(result=>{if(alive)setOverview(result);}).catch(e=>notify(e.message,'error'));return()=>{alive=false;};},[api]);
  const selected=overview?.accounts.find(a=>a.id===accountId);
  useEffect(()=>{setName(selected?.name||'');setWallet(null);},[accountId]);
  const personal=['chat_threads','chat_messages','companion_profiles','personal_memory_scopes','mood_checkins'].includes(collection);
  async function act(work){setBusy(true);try{await work();}catch(e){notify(e.message,'error');}finally{setBusy(false);}}
  async function enter(id){await act(async()=>{await api('/platform/family-context',{method:'POST',body:JSON.stringify({familyId:id})});await onEnter();});}
  async function loadData(nextOffset=0){await act(async()=>{const params=new URLSearchParams({collection,offset:String(nextOffset)});if(personal&&accountId)params.set('userId',accountId);if(!personal&&family)params.set('familyId',family);setRows(await api('/platform/data?'+params));setOffset(nextOffset);});}
  async function update(input){await act(async()=>{const updated=await api('/platform/accounts/'+accountId,{method:'PATCH',body:JSON.stringify(input)});setOverview(o=>({...o,accounts:o.accounts.map(a=>a.id===accountId?updated:a)}));notify('账号已更新');});}
  return <div className="platform-admin">
    <p className="inline-notice">平台管理员 · 可跨家庭管理。所有操作使用你自己的管理员身份，访问会留存管理记录。</p>
    <section className="panel"><h3>全部家庭</h3><Field label="选择家庭"><select value={family} onChange={e=>{setFamily(e.target.value);setRows(null);}}><option value="">全部家庭</option>{overview?.families.map(f=><option key={f.id} value={f.id}>{f.name}（{f.members} 位账号）</option>)}</select></Field><div className="modal-actions"><Button disabled={!family||busy} onClick={()=>enter(family)}>进入家庭管理</Button><Button variant="ghost" disabled={busy} onClick={()=>enter(null)}>返回我的家庭</Button></div><p className="muted small">进入后使用现有页面管理该家庭的记忆、人物、纪念日和家庭账号。</p></section>
    <section className="panel"><h3>全站账号与积分</h3><Field label="选择账号"><select value={accountId} onChange={e=>{setAccountId(e.target.value);setRows(null);}}><option value="">全部账号</option>{overview?.accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.email}{a.platformRole==='owner'?' · 平台管理员':a.disabled?' · 已停用':''}</option>)}</select></Field>
      {selected&&<><Field label="账号名字"><input value={name} maxLength={30} onChange={e=>setName(e.target.value)}/></Field><div className="modal-actions"><Button disabled={busy||!name.trim()} onClick={()=>update({name})}>保存账号名字</Button>{selected.platformRole!=='owner'&&<Button variant="secondary" disabled={busy} onClick={()=>update({disabled:!selected.disabled})}>{selected.disabled?'恢复账号':'停用账号'}</Button>}<Button variant="ghost" disabled={busy} onClick={()=>act(async()=>setWallet(await api('/platform/accounts/'+accountId+'/credits')))}>查看该账号积分</Button></div>{wallet&&<p>可用 {wallet.balance} 积分 · 冻结 {wallet.held} 积分 · 共 {wallet.total} 条记录</p>}{wallet?.entries.map(entry=><p key={entry.id} className="muted small">{entry.amount>0?'+':''}{entry.amount} · {entry.note}</p>)}</>}
      <p className="muted small">发放积分请使用“我的积分”中的管理员发放入口，可选择全站账号。</p>
    </section>
    <section className="panel"><h3>全站业务数据</h3><Field label="数据类型"><select value={collection} onChange={e=>{setCollection(e.target.value);setRows(null);}}>{Object.entries(overview?.collections||{}).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><p className="muted small">{personal?'按上方选择的账号筛选；不选择则查看全站账号。':'按上方选择的家庭筛选；不选择则查看全部家庭。'}</p><Button busy={busy} onClick={()=>loadData()}>查看数据</Button>
      {rows?.items.map(item=><details key={item.id} className="platform-record"><summary>{item.title||item.name||String(item.text||'').slice(0,50)||item.id}</summary><pre>{JSON.stringify(item,null,2)}</pre></details>)}{rows&&!rows.items.length&&<p>没有符合条件的数据。</p>}
      {rows&&<div className="modal-actions"><Button variant="ghost" disabled={!offset||busy} onClick={()=>loadData(Math.max(0,offset-50))}>上一页</Button><span>第 {offset/50+1} 页</span><Button variant="ghost" disabled={!rows.hasMore||busy} onClick={()=>loadData(offset+50)}>下一页</Button></div>}
    </section>
  </div>;
}
