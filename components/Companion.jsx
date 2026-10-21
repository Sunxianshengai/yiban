'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Modal} from './UI';

// 家伴。故意做成「围坐说话」而不是聊天气泡加头像：
// 这个产品里它不是一个陌生人设在等你调戏，而是这个家的一个成员。
// 所以不使用「发送」按钮的聊天软件视觉，用「说一句」的输入区 + 纸条式的对话记录。

// 常驻浮层的展开状态存在本机：打开过一次，之后走到哪一页都还开着。
const DOCK_KEY='yiban-companion-dock';
const DOCK_SUGGESTIONS=['今天有点累','讲讲家里的事','你还记得那年夏天吗'];

/** 对话内核。整页版和右下角常驻浮层共用同一份逻辑：
 *  同一套接口、同一份本地降级、同一条「记不住就说记不住」的红线。 */
function useCompanion(api) {
  const [data,setData]=useState(null);
  const [messages,setMessages]=useState([]);
  const [notes,setNotes]=useState([]);
  const [threadId,setThreadId]=useState(null);
  const [sources,setSources]=useState([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [form,setForm]=useState({name:'',personaId:'gentle',relation:'家里人',voiceMemberId:null});
  const feedRef=useRef(null);

  const load=useCallback(async()=>{
    setError('');
    try{
      const result=await api('/companion');
      setData(result);
      setMessages(result.messages||[]);
      setNotes(result.notes||[]);
      setThreadId(result.threadId||null);
      setForm({name:result.companion?.name||'',personaId:result.companion?.personaId||'gentle',relation:result.companion?.relation||'家里人',voiceMemberId:result.companion?.voiceMemberId||null});
    }catch(e){setError(e.message);}
  },[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{const feed=feedRef.current;if(feed)feed.scrollTop=feed.scrollHeight;},[messages.length,busy]);

  const send=async(input)=>{
    const value=String(input??text).trim();
    if(!value||busy)return;
    setBusy(true);setError('');
    // 先把用户这句放上去：等模型的两三秒里屏幕不能没有反应。
    const optimistic={role:'user',text:value,at:new Date().toISOString()};
    setMessages(list=>[...list,optimistic]);
    setText('');
    try{
      const result=await api('/companion/turn',{method:'POST',body:JSON.stringify({threadId,text:value})});
      setThreadId(result.threadId);
      setNotes(result.notes||[]);
      setSources(result.sources||[]);
      // 服务端把我们这句话原样回了一份，用它替换掉刚才乐观插入的那条，
      // 否则同一句会显示两遍。
      setMessages(list=>[...list.filter(item=>item!==optimistic),...(result.messages||[])]);
    }catch(e){
      setError(e.message);
      setMessages(list=>list.filter(m=>m!==optimistic));
      setText(value);
    }finally{setBusy(false);}
  };

  const reset=async()=>{
    setBusy(true);
    try{await api('/companion/reset',{method:'POST',body:JSON.stringify({threadId})});setMessages([]);setSources([]);}
    catch(e){setError(e.message);}
    finally{setBusy(false);}
  };

  const saveConfig=async()=>{
    setBusy(true);
    try{
      const result=await api('/companion/config',{method:'POST',body:JSON.stringify(form)});
      setData(d=>({...d,companion:result.companion}));
      return result.companion;
    }catch(e){setError(e.message);return null;}
    finally{setBusy(false);}
  };

  return {data,setData,messages,setMessages,notes,threadId,sources,text,setText,busy,error,setError,form,setForm,feedRef,load,send,reset,saveConfig};
}

/** 一条对话记录：纸条式，不用气泡。 */
function Line({message}) {
  return <article className={`companion-line ${message.role}`}>
    <p>{message.text}</p>
  </article>;
}

/** 对话流。整页版和浮层版共用，只有高度由外层决定。 */
function Feed({c,opening}) {
  return <div className="companion-feed" ref={c.feedRef} role="log" aria-live="polite">
    {c.messages.length===0&&<article className="companion-opening">
      <p>{opening?.text}</p>
      {opening?.source==='memory'&&<small>由一段记忆起的头</small>}
      {opening?.source==='anniversary'&&<small>今天的日子</small>}
    </article>}
    {c.messages.map((message,index)=><Line key={`${message.at}-${index}`} message={message}/>)}
    {c.busy&&<article className="companion-line companion"><p className="companion-typing"><span/><span/><span/></p></article>}
  </div>;
}

/** 说一句的输入区。 */
function Composer({c,name,suggestions=[],ready=true}) {
  // 没配模型时把输入框关掉：能打字却永远得不到回话，比直接说「还没接上」更伤。
  const placeholder=ready?`跟${name}说点什么…`:'还没有接入模型，暂时说不了话';
  return <>
    {ready&&c.messages.length===0&&suggestions.length>0&&<div className="companion-suggest">
      {suggestions.map(item=><button key={item} className="companion-chip" disabled={c.busy} onClick={()=>c.send(item)}>{item}</button>)}
    </div>}
    <div className="companion-input">
      <input value={c.text} disabled={!ready} onChange={event=>c.setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();c.send();}}} maxLength={500} placeholder={placeholder} aria-label="跟家伴说一句话"/>
      <Button onClick={()=>c.send()} busy={c.busy} disabled={!ready||!c.text.trim()}>说一句</Button>
    </div>
    {c.error&&<p className="form-error"><Icon name="info" size={15}/>{c.error}</p>}
  </>;
}

function sourcesBlock(sources,onOpenMemory) {
  if(!sources.length)return null;
  return <div className="companion-sources">
    <span>刚才说到的事：</span>
    {sources.map(source=><button key={source.id} className="text-link" onClick={()=>onOpenMemory?.(source.id)}>{source.year?`${source.year}年 · `:''}{source.title}</button>)}
  </div>;
}

export default function Companion({api,notify,onOpenMemory,canEdit=false}) {
  const c=useCompanion(api);
  const [editing,setEditing]=useState(false);
  const {data,error,load}=c;

  if(error&&!data)return <div className="companion-fallback"><Icon name="info" size={30}/><p>{error}</p><Button onClick={load}>再试一次</Button></div>;
  if(!data)return <div className="companion-loading"><span className="spinner"/><p>家伴正在想起一些事…</p></div>;

  const companion=data.companion||{name:'家伴',personaId:'gentle',relation:'家里人'};
  const persona=(data.personas||[]).find(p=>p.id===companion.personaId)||{name:'温柔的倾听者',blurb:''};

  const saveConfig=async()=>{
    const saved=await c.saveConfig();
    if(!saved)return;
    setEditing(false);
    notify(`你好，我是${saved.name}`);
  };
  const reset=async()=>{await c.reset();notify('换了个话题，记事本我还留着');};

  return <div className="companion">
    <header className="companion-head">
      <Avatar name={companion.name} color={companion.color||'sage'}/>
      <div>
        <h2>{companion.name}<em>{companion.relation}</em></h2>
        <p>{persona.name} · {persona.blurb}</p>
      </div>
      <div className="companion-head-actions">
        {c.messages.length>0&&<button className="text-link" onClick={reset} disabled={c.busy}>换个话题</button>}
        {canEdit&&<button className="text-link" onClick={()=>setEditing(true)}>编辑家伴</button>}
      </div>
    </header>

    {!data.aiEnabled&&<p className="companion-note"><Icon name="info" size={15}/>还没有接入模型，家伴暂时说不了话。在环境变量里填上模型密钥就能开口——它没有预置台词，每句话都是现写的。</p>}

    <Feed c={c} opening={data.opening}/>
    {sourcesBlock(c.sources,onOpenMemory)}
    <Composer c={c} name={companion.name} ready={Boolean(data.aiEnabled)}/>

    {c.notes.length>0&&<details className="companion-notes"><summary>它记得的 {c.notes.length} 件事</summary><ul>{c.notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>}

    {editing&&<Modal title="编辑家伴" description="名字、性格和关系由你来定。它是这个家共有的一位。" onClose={()=>setEditing(false)}>
      <div className="form-grid">
        <label className="field"><span>名字</span><input value={c.form.name} maxLength={20} onChange={event=>c.setForm(f=>({...f,name:event.target.value}))} placeholder="家伴"/></label>
        <label className="field"><span>它是谁</span><select value={c.form.relation} onChange={event=>c.setForm(f=>({...f,relation:event.target.value}))}>{(data.relations||[]).map(relation=><option key={relation} value={relation}>{relation}</option>)}</select></label>
      </div>
      <p className="field-label">性格</p>
      <div className="persona-grid">
        {(data.personas||[]).map(item=><button key={item.id} className={`persona-card ${c.form.personaId===item.id?'active':''}`} onClick={()=>c.setForm(f=>({...f,personaId:item.id}))}>
          <strong>{item.name}</strong><small>{item.blurb}</small>
        </button>)}
      </div>
      {(data.voiceMembers||[]).length>0&&<>
        <p className="field-label">声音</p>
        <label className="field"><select value={c.form.voiceMemberId||''} onChange={event=>c.setForm(f=>({...f,voiceMemberId:event.target.value||null}))}>
          <option value="">默认的合成声音</option>
          {(data.voiceMembers||[]).map(member=><option key={member.id} value={member.id}>用{member.name}复刻的声音</option>)}
        </select><small>声音来自家人本人授权复刻；朗读时会标注「AI 合成」。</small></label>
      </>}
      <div className="modal-actions"><Button variant="secondary" onClick={()=>setEditing(false)}>取消</Button><Button onClick={saveConfig} busy={c.busy}>保存</Button></div>
    </Modal>}
  </div>;
}

/** 右下角常驻的对话框。整页版是「专门来找它说话」，
 *  浮层是「刚才那句话想跟它说一声」——所以浮层只在别的页面上出现，
 *  到了家伴自己的页面就收起来，免得同一条对话在两处各说一遍。 */
export function CompanionDock({api,hidden=false,onExpand,onOpenMemory}) {
  const [open,setOpen]=useState(false);
  // 默认收起：不请自来的面板会挡住页面内容。
  // 但用户一旦展开过，就记住这个选择，之后每一页都还开着。
  useEffect(()=>{try{if(localStorage.getItem(DOCK_KEY)==='open')setOpen(true);}catch{}},[]);
  const write=(next)=>{try{localStorage.setItem(DOCK_KEY,next?'open':'closed');}catch{}};
  const toggle=()=>setOpen(value=>{const next=!value;write(next);return next;});
  useEffect(()=>{
    if(!open)return;
    const handle=event=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('keydown',handle);
    return ()=>document.removeEventListener('keydown',handle);
  },[open]);
  if(hidden)return null;
  return <div className={`companion-dock ${open?'open':''}`}>
    {open&&<DockPanel api={api} onExpand={onExpand} onOpenMemory={onOpenMemory} onClose={toggle}/>}
    <button className="companion-dock-toggle" onClick={toggle} aria-label={open?'收起聊天框':'打开聊天框'} aria-expanded={open}>
      {open?<Icon name="close" size={20}/>:<><Icon name="message" size={18}/><span>家伴</span></>}
    </button>
  </div>;
}

function DockPanel({api,onExpand,onOpenMemory,onClose}) {
  const c=useCompanion(api);
  const inputWrap=useRef(null);
  useEffect(()=>{inputWrap.current?.querySelector('input')?.focus();},[]);
  const {data,error,load}=c;
  const companion=data?.companion||{name:'家伴',personaId:'gentle'};
  const persona=(data?.personas||[]).find(p=>p.id===companion.personaId);
  const head=<header className="companion-dock-head">
    <Avatar name={companion.name} color={companion.color||'sage'}/>
    <div><strong>{companion.name}</strong><small>{persona?persona.name:'记得这个家的人'}</small></div>
    <div className="companion-dock-actions">
      {onExpand&&<button className="icon-button" aria-label="展开到整页" onClick={onExpand}><Icon name="arrow" size={18}/></button>}
      <button className="icon-button" aria-label="关闭聊天框" onClick={onClose}><Icon name="close" size={18}/></button>
    </div>
  </header>;

  if(error&&!data)return <section className="companion-dock-panel" role="dialog" aria-label="家伴对话">
    {head}
    <div className="companion-fallback"><Icon name="info" size={26}/><p>{error}</p><Button onClick={load}>再试一次</Button></div>
  </section>;

  return <section className="companion-dock-panel" role="dialog" aria-label="家伴对话" ref={inputWrap}>
    {head}
    {!data?<div className="companion-loading"><span className="spinner"/><p>家伴正在想起一些事…</p></div>:<>
      {!data.aiEnabled&&<p className="companion-dock-note">还没有接入模型，暂时说不了话。</p>}
      <Feed c={c} opening={data.opening}/>
      {sourcesBlock(c.sources,onOpenMemory)}
      <Composer c={c} name={companion.name} suggestions={DOCK_SUGGESTIONS} ready={Boolean(data.aiEnabled)}/>
      {c.notes.length>0&&<details className="companion-notes"><summary>它记得的 {c.notes.length} 件事</summary><ul>{c.notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>}
    </>}
  </section>;
}

// 记忆小屋侧栏与陪伴记录页用的入口块。
export function CompanionEntry({onOpen}) {
  return <div className="companion-entry">
    <span className="little-leaf"><Icon name="message" size={21}/></span>
    <div>
      <strong>跟家伴说说话</strong>
      <p>它记得这个家的事，也记得你上次说过的。</p>
    </div>
    <Button variant="secondary" onClick={onOpen}>去聊聊</Button>
  </div>;
}
