'use client';
import {useEffect,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Empty,Field,Modal} from './UI';

// I 时间胶囊：写给未来的某个人，到日子才打开。
// 服务端已经做了「没到期又不是本人写的就看不到内容」，这里只负责把状态说清楚。
export default function Capsules({api,notify,members,me}) {
  const [list,setList]=useState([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({title:'',targetMemberId:'',openAt:'',text:''});
  const [busy,setBusy]=useState(false);
  const [filter,setFilter]=useState('all');

  const load=async()=>{setLoading(true);try{setList((await api('/capsules')).capsules||[]);}catch(e){notify(e.message,'error');}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);

  const nameOf=id=>members.find(m=>m.id===id)?.name||'家人';
  const shown=list.filter(c=>filter==='all'?true:filter==='locked'?c.locked:c.locked===false);
  const locked=list.filter(c=>c.locked).length;

  const submit=async(e)=>{
    e.preventDefault();
    if(!form.text.trim()){notify('写一句想留给未来的话','error');return;}
    if(!form.targetMemberId){notify('选一位要收到这段话的家人','error');return;}
    if(!form.openAt){notify('选择开启日期','error');return;}
    setBusy(true);
    try{await api('/capsules',{method:'POST',body:JSON.stringify(form)});setOpen(false);setForm({title:'',targetMemberId:'',openAt:'',text:''});notify('时间胶囊已封存');await load();}
    catch(err){notify(err.message,'error');}finally{setBusy(false);}
  };

  return <div className="capsules-page">
    <div className="page-heading"><div><span className="eyebrow">LETTERS TO THE FUTURE</span><h1>时间胶囊</h1><p>有些话现在说太早，留给未来的某一天。</p></div><Button icon="plus" onClick={()=>setOpen(true)}>写一封</Button></div>

    <div className="capsule-summary">
      <article><strong>{locked}</strong><span>封还没到期</span></article>
      <article><strong>{list.length-locked}</strong><span>封已经可以打开</span></article>
      <article><strong>{members.length}</strong><span>位可以写给的人</span></article>
    </div>

    <div className="filter-row">
      {[['all','全部'],['locked','还没到期'],['opened','已开启']].map(([id,label])=><button key={id} className={filter===id?'selected':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>

    {loading&&<div className="growth-loading"><span className="spinner"/></div>}
    {!loading&&!shown.length&&<Empty icon="calendar" title="还没有时间胶囊" description="给孩子写一段十八岁那天才能看到的话，或者给十年后的自己留一句。"/>}

    <div className="capsule-grid">
      {shown.map(c=>{
        const mine=c.authorId===me?.id;
        return <article className={`capsule-card ${c.locked?'locked':'open'}`} key={c.id}>
          <header>
            <span className="capsule-seal"><Icon name={c.locked?'clock':'sun'} size={20}/></span>
            <div><strong>{c.title||'一封没有标题的信'}</strong><small>写给 {nameOf(c.targetMemberId)}{mine?' · 你写的':''}</small></div>
            <span className="capsule-date">{c.openAt}</span>
          </header>
          {c.locked?<p className="capsule-locked">还有 {c.daysLeft} 天开启。到那天之前，谁也看不到里面的话——包括写它的人。</p>
            :<p className="capsule-text">{c.text}</p>}
          {!c.locked&&mine&&<button className="icon-button" aria-label="删除这封时间胶囊" onClick={async()=>{try{await api(`/capsules/${c.id}`,{method:'DELETE'});notify('已删除');await load();}catch(e){notify(e.message,'error');}}}><Icon name="trash" size={15}/></button>}
        </article>;
      })}
    </div>

    {open&&<Modal title="写一封时间胶囊" description="到指定日期之前，内容对谁都不显示。" onClose={()=>setOpen(false)}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="标题"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：给你十八岁那天" maxLength={60}/></Field>
          <Field label="写给谁 *"><select value={form.targetMemberId} onChange={e=>setForm({...form,targetMemberId:e.target.value})}><option value="">选择一位家人</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <Field label="开启日期 *" hint="到这一天的零点自动开启。"><input type="date" value={form.openAt} onChange={e=>setForm({...form,openAt:e.target.value})}/></Field>
        </div>
        <Field label="想说的话 *"><textarea rows={6} value={form.text} onChange={e=>setForm({...form,text:e.target.value})} maxLength={2000} placeholder="写什么都行。将来读到的人，会知道你此刻是这么想的。"/></Field>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>取消</Button><Button type="submit" icon="calendar" busy={busy}>封存</Button></div>
      </form>
    </Modal>}
  </div>;
}
