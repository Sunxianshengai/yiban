'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Field,Modal} from './UI';
import {PersonaAvatar} from './Familia';
import Icon from './Icon';
import {familiaAPI} from '../lib/familia-client.mjs';

const categories=[['all','全部'],['about','关于我'],['preference','偏好习惯'],['event','近况安排'],['boundary','相处边界']];
const empty={text:'',category:'about',pinned:false};
const initialState={enabled:true,mode:'manual',revision:0,items:[]};
export default function PersonalMemory({profiles=[],defaultProfile=null,profileId=null,onClose,notify,starter=null,referenceIds=[]}){
  const [scope,setScope]=useState(profileId),[data,setData]=useState(initialState),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[editing,setEditing]=useState(starter?{...empty,text:starter.text.slice(0,600),source:starter.source}:null),[deleting,setDeleting]=useState(null),[sourceText,setSourceText]=useState(null);
  const initial=useRef(JSON.stringify(starter?{...empty,text:starter.text.slice(0,600),source:starter.source}:null)),saveKey=useRef(crypto.randomUUID()),live=useRef(true);
  const profile=profiles.find(item=>item.id===scope)||(!scope?defaultProfile:null),name=profile?.name||'小满';
  const dirty=JSON.stringify(editing)!==initial.current;
  const endpoint=`personal-memories`,suffix=scope?'?profileId='+encodeURIComponent(scope):'';
  async function refresh(){const result=await familiaAPI(endpoint+suffix);if(live.current){setData(result);setLoaded(true);}return result;}
  useEffect(()=>{let cancelled=false;live.current=true;setLoading(true);setLoaded(false);setData(initialState);setError('');familiaAPI(endpoint+suffix).then(result=>{if(!cancelled){setData(result);setLoaded(true);}}).catch(failure=>{if(!cancelled)setError(failure.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;live.current=false;};},[scope]);
  function close(){if(!busy&&(!dirty||window.confirm('这条记忆还没有保存，确定离开吗？')))onClose();}
  function select(item){if(busy||(dirty&&!window.confirm('这条记忆还没有保存，放弃修改吗？')))return;setEditing(item);initial.current=JSON.stringify(item);saveKey.current=crypto.randomUUID();setDeleting(null);setSourceText(null);setError('');}
  function switchScope(value){if(dirty&&!window.confirm('这条记忆还没有保存，放弃修改吗？'))return;select(null);setScope(value||null);setQuery('');setCategory('all');}
  async function settings(values){setBusy(true);setError('');try{await familiaAPI(endpoint+suffix,{method:'PATCH',body:{...values,expectedRevision:data.revision}});await refresh();notify?.('记忆设置已保存');}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{
    const existing=Boolean(editing.id),body={text:editing.text,category:editing.category,pinned:editing.pinned,...(existing?{expectedRevision:editing.revision}:{source:editing.source||null})};
    await familiaAPI(endpoint+(existing?'/'+editing.id:'')+suffix,{method:existing?'PATCH':'POST',headers:{'Idempotency-Key':saveKey.current},body});
    // The write already succeeded; a failed refresh must not leave a stale edit to resubmit.
    setEditing(null);initial.current=JSON.stringify(null);setSourceText(null);await refresh();notify?.(existing?'记忆已更新，下一次回复起生效':'已经记住了，仅供你与这位 AI 家人使用');
  }catch(failure){setError(failure.message);}finally{setBusy(false);}}
  async function forget(){setBusy(true);setError('');try{await familiaAPI(endpoint+'/'+deleting.id+suffix,{method:'DELETE',body:{expectedRevision:deleting.revision}});setDeleting(null);setEditing(null);initial.current=JSON.stringify(null);await refresh();notify?.('已从长期记忆中删除');}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  async function showSource(){setSourceText('正在读取原消息…');try{const response=await fetch('/api/chat/threads/'+encodeURIComponent(editing.source.threadId),{cache:'no-store'});const thread=await response.json();const message=thread.allMessages?.find(item=>item.id===editing.source.messageId&&item.role==='user');setSourceText(response.ok&&message?message.text:'原消息已删除或不可用。这条已保存的记忆仍保留，可单独修改或删除。');}catch{setSourceText('暂时无法读取原消息，请稍后重试。');}}
  const visible=data.items.filter(item=>(category==='all'||item.category===category)&&item.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Modal page wide title="个人记忆" backLabel="返回" onClose={close}><div className="pm-workspace">
    <header className="pm-heading"><div><h1>记得你的那些小事</h1><p>在不同的对话里，也能接着了解你。</p></div><span><Icon name="lock" size={15}/>仅自己可见</span></header>
    <div className="pm-scope"><PersonaAvatar profile={profile}/><div><label htmlFor="personal-memory-scope">与谁的个人记忆</label><select id="personal-memory-scope" value={scope||''} disabled={busy||Boolean(starter)} onChange={event=>switchScope(event.target.value)}><option value="">{defaultProfile?.name||'小满'}</option>{profiles.filter(item=>!item.illustrative).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><p>只在你与{name}的对话中使用<br/>不加入家庭记忆库</p></div>
    {loading?<p className="pm-loading" role="status">正在打开个人记忆…</p>:!loaded?<p className="pm-loading">暂时无法打开记忆，请在下方刷新重试。</p>:<>
      <section className="pm-settings" aria-label="个人记忆设置"><div className="pm-enable"><div><strong>在对话中参考个人记忆</strong><p>关闭后保留已存内容，原聊天记录不会清除。</p></div><button type="button" role="switch" aria-label="在对话中参考个人记忆" aria-checked={data.enabled} disabled={busy} onClick={()=>settings({enabled:!data.enabled})}><span/></button></div>
        <div className="pm-modes" role="group" aria-label="记忆保存方式">{[['manual','手动记忆','由你选择，编辑确认后保存','edit'],['auto','自动记忆','从你的自述中，记住值得保留的小事','sparkle']].map(([id,label,hint,icon])=><button type="button" key={id} aria-pressed={data.mode===id} disabled={busy} onClick={()=>data.mode!==id&&settings({mode:id})}><Icon name={icon} size={20}/><span><strong>{label}</strong><small>{hint}</small></span><span className="pm-mode-check"><Icon name="check" size={13}/></span></button>)}</div>
        <p className="pm-mode-note">{data.mode==='auto'?'自动记忆仅处理开启后成功对话中的自述，可能遗漏或记错，可随时修改。可在“对我的了解”中查看；不额外扣积分。':'聊天时，在你发出的消息上选择“记住这件事”；也可以在下方手动添加。保存和管理不扣积分。'}{!data.enabled&&' 当前已暂停参考与自动保存。'}</p>
      </section>
      <div className={`pm-layout ${editing?'pm-is-editing':''}`}><section className="pm-library" aria-label="已保存的个人记忆"><div className="pm-library-title"><h2>关于你的记忆 <span>{data.items.length}</span></h2><Button icon="plus" variant="secondary" disabled={busy||data.items.length>=100} onClick={()=>select({...empty})}>添加记忆</Button></div>
        <label className="pm-search"><Icon name="search" size={18}/><input aria-label="搜索个人记忆" placeholder="找找记住了什么…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <div className="pm-filters" role="group" aria-label="记忆分类">{categories.map(([id,label])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</div>
        <div className="pm-entries">{visible.map(item=><article key={item.id} className={referenceIds.includes(item.id)?'pm-referenced':''}><div className="pm-entry-meta"><span>{categories.find(([id])=>id===item.category)?.[1]}</span>{item.pinned&&<span><Icon name="star" size={13}/>常用</span>}{item.expired&&<span>已过期 · 不再参考</span>}{referenceIds.includes(item.id)&&<span>本次参考</span>}<small>{item.origin==='auto'?'自动记住':item.source?'聊天中保存':'手动添加'}</small></div><p>{item.text}</p><footer><span>{new Date(item.updatedAt).toLocaleDateString('zh-CN',{month:'long',day:'numeric'})} 更新</span><button type="button" aria-label={'编辑记忆：'+item.text} disabled={busy} onClick={()=>select(item)}><Icon name="edit" size={16}/>编辑</button></footer></article>)}</div>
        {!visible.length&&<div className="pm-empty"><Icon name="book" size={32}/><h3>{data.items.length?'没有找到这条记忆':'从一件小事开始记住你'}</h3><p>{data.items.length?'换一个关键词或分类试试。':'比如你的喜好、生活里的新安排，或你喜欢的相处方式。'}</p>{!data.items.length&&<Button variant="secondary" icon="plus" onClick={()=>select({...empty})}>添加第一条记忆</Button>}</div>}
        <p className="pm-library-note">每位 AI 家人分别保存，最多 100 条。{referenceIds.some(id=>!data.items.some(item=>item.id===id))&&'本次参考的部分记忆已删除。'}</p>
      </section><aside className="pm-detail">
        {editing?<form className="pm-edit" onSubmit={save} aria-busy={busy}><header><button type="button" aria-label="返回记忆列表" onClick={()=>select(null)} disabled={busy}><Icon name="back" size={19}/></button><h2>{editing.id?'编辑这条记忆':starter?'记住这件事':'添加一条记忆'}</h2></header><fieldset disabled={busy}><legend className="pe-sr-only">个人记忆内容</legend><Field label="希望记住的内容" hint={`${editing.text.length} / 600 字`}><textarea rows={5} maxLength={600} required value={editing.text} onChange={event=>setEditing({...editing,text:event.target.value})} placeholder="例如：我更喜欢你先听我说完，再给建议。"/></Field><Field label="分类"><select value={editing.category} onChange={event=>setEditing({...editing,category:event.target.value})}>{categories.slice(1).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><label className="pm-pin"><input type="checkbox" checked={editing.pinned} onChange={event=>setEditing({...editing,pinned:event.target.checked})}/><span>设为常用记忆<small>优先参考，最多 6 条</small></span><Icon name="star" size={18}/></label>
          {editing.source&&<div className="pm-source"><button type="button" onClick={showSource}><Icon name="message" size={16}/>查看来源消息<Icon name="down" size={14}/></button>{sourceText&&<blockquote>{sourceText}</blockquote>}</div>}
          <p className="pm-edit-hint">{starter?'请检查内容，只保存你愿意长期保留的信息。':'保存后，从下一次回复起生效。'}{!editing.id&&' 不要保存密码、证件或支付信息。'}</p></fieldset>
          <div className="pm-edit-actions"><Button type="button" variant="ghost" disabled={busy} onClick={()=>select(null)}>取消</Button><Button type="submit" icon="check" busy={busy} disabled={!editing.text.trim()||(Boolean(editing.id)&&!dirty)}>保存记忆</Button></div>
          {editing.id&&<div className="pm-delete">{deleting?.id===editing.id?<><p>从长期记忆中删除这条内容？原聊天记录仍会保留，当前会话也可能包含相同内容。</p><div><Button variant="ghost" disabled={busy} onClick={()=>setDeleting(null)}>保留</Button><Button disabled={busy} onClick={forget}>确认删除</Button></div></>:<button type="button" disabled={busy} onClick={()=>setDeleting(editing)}><Icon name="trash" size={16}/>删除这条记忆</button>}</div>}
        </form>:<div className="pm-guide"><Icon name="heart-handshake" size={30}/><h2>慢慢了解你</h2><p>喜欢什么，正在做什么，什么样的陪伴让你舒服。让值得记住的事，留到下一次聊天。</p><div><Icon name="lock" size={18}/><p>个人记忆与你的账号、这位 AI 家人单独关联，家人看不到。</p></div><div><Icon name="book" size={18}/><p>家庭往事仍以已核对的家庭记忆为准。</p></div><small>你始终可以修改、删除，或暂停参考。</small></div>}
      </aside></div>
    </>}{error&&<div className="pm-error" role="alert"><Icon name="info" size={17}/><span>{error}</span><button type="button" disabled={busy} onClick={async()=>{setLoading(true);try{await refresh();setError('');}catch(failure){setError(failure.message);}finally{setLoading(false);}}}>刷新记忆</button></div>}
  </div></Modal>;
}
