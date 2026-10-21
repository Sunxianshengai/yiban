'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Modal} from './UI';

// 家伴。故意做成「围坐说话」而不是聊天气泡加头像：
// 这个产品里它不是一个陌生人设在等你调戏，而是这个家的一个成员。
// 所以不使用「发送」按钮的聊天软件视觉，用「说一句」的输入区 + 纸条式的对话记录。

const MODE_LABEL={model:'家伴',local:'本地回话'};

export default function Companion({api,notify,onOpenMemory,canEdit=false}) {
  const [data,setData]=useState(null);
  const [messages,setMessages]=useState([]);
  const [notes,setNotes]=useState([]);
  const [threadId,setThreadId]=useState(null);
  const [sources,setSources]=useState([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({name:'',personaId:'gentle',relation:'家里人',voiceMemberId:null});
  const feedRef=useRef(null);

  const load=useCallback(async()=>{
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
    try{await api('/companion/reset',{method:'POST',body:JSON.stringify({threadId})});setMessages([]);setSources([]);notify('换了个话题，记事本我还留着');}
    catch(e){notify(e.message,'error');}
    finally{setBusy(false);}
  };

  const saveConfig=async()=>{
    setBusy(true);
    try{
      const result=await api('/companion/config',{method:'POST',body:JSON.stringify(form)});
      setData(d=>({...d,companion:result.companion}));
      setEditing(false);notify(`你好，我是${result.companion.name}`);
    }catch(e){notify(e.message,'error');}
    finally{setBusy(false);}
  };

  if(error&&!data)return <div className="companion-fallback"><Icon name="info" size={30}/><p>{error}</p><Button onClick={load}>再试一次</Button></div>;
  if(!data)return <div className="companion-loading"><span className="spinner"/><p>家伴正在想起一些事…</p></div>;

  const companion=data.companion||{name:'家伴',personaId:'gentle',relation:'家里人'};
  const persona=(data.personas||[]).find(p=>p.id===companion.personaId)||{name:'温柔的倾听者',blurb:''};
  const opening=data.opening;

  return <div className="companion">
    <header className="companion-head">
      <Avatar name={companion.name} color={companion.color||'sage'}/>
      <div>
        <h2>{companion.name}<em>{companion.relation}</em></h2>
        <p>{persona.name} · {persona.blurb}</p>
      </div>
      <div className="companion-head-actions">
        {messages.length>0&&<button className="text-link" onClick={reset} disabled={busy}>换个话题</button>}
        {canEdit&&<button className="text-link" onClick={()=>setEditing(true)}>编辑家伴</button>}
      </div>
    </header>

    {!data.aiEnabled&&<p className="companion-note"><Icon name="info" size={15}/>本机没配模型，家伴会用记忆库里的原文回你——话是笨一点，但它说的每句都查得到出处。</p>}

    <div className="companion-feed" ref={feedRef} role="log" aria-live="polite">
      {messages.length===0&&<article className="companion-opening">
        <p>{opening?.text}</p>
        {opening?.source==='memory'&&<small>由一段记忆起的头</small>}
        {opening?.source==='anniversary'&&<small>今天的日子</small>}
      </article>}
      {messages.map((message,index)=><article key={`${message.at}-${index}`} className={`companion-line ${message.role}`}>
        {message.role==='companion'&&message.mode==='local'&&<small className="companion-tag">本地回话</small>}
        <p>{message.text}</p>
      </article>)}
      {busy&&<article className="companion-line companion"><p className="companion-typing"><span/><span/><span/></p></article>}
    </div>

    {sources.length>0&&<div className="companion-sources">
      <span>刚才说到的事：</span>
      {sources.map(source=><button key={source.id} className="text-link" onClick={()=>onOpenMemory?.(source.id)}>{source.year?`${source.year}年 · `:''}{source.title}</button>)}
    </div>}

    <div className="companion-input">
      <input value={text} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();send();}}} maxLength={500} placeholder={`跟${companion.name}说点什么…`} aria-label="跟家伴说一句话"/>
      <Button onClick={()=>send()} busy={busy} disabled={!text.trim()}>说一句</Button>
    </div>
    {error&&<p className="form-error"><Icon name="info" size={15}/>{error}</p>}

    {notes.length>0&&<details className="companion-notes"><summary>它记得的 {notes.length} 件事</summary><ul>{notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>}

    {editing&&<Modal title="编辑家伴" description="名字、性格和关系由你来定。它是这个家共有的一位。" onClose={()=>setEditing(false)}>
      <div className="form-grid">
        <label className="field"><span>名字</span><input value={form.name} maxLength={20} onChange={event=>setForm(f=>({...f,name:event.target.value}))} placeholder="家伴"/></label>
        <label className="field"><span>它是谁</span><select value={form.relation} onChange={event=>setForm(f=>({...f,relation:event.target.value}))}>{(data.relations||[]).map(relation=><option key={relation} value={relation}>{relation}</option>)}</select></label>
      </div>
      <p className="field-label">性格</p>
      <div className="persona-grid">
        {(data.personas||[]).map(item=><button key={item.id} className={`persona-card ${form.personaId===item.id?'active':''}`} onClick={()=>setForm(f=>({...f,personaId:item.id}))}>
          <strong>{item.name}</strong><small>{item.blurb}</small>
        </button>)}
      </div>
      {(data.voiceMembers||[]).length>0&&<>
        <p className="field-label">声音</p>
        <label className="field"><select value={form.voiceMemberId||''} onChange={event=>setForm(f=>({...f,voiceMemberId:event.target.value||null}))}>
          <option value="">默认的合成声音</option>
          {(data.voiceMembers||[]).map(member=><option key={member.id} value={member.id}>用{member.name}复刻的声音</option>)}
        </select><small>声音来自家人本人授权复刻；朗读时会标注「AI 合成」。</small></label>
      </>}
      <div className="modal-actions"><Button variant="secondary" onClick={()=>setEditing(false)}>取消</Button><Button onClick={saveConfig} busy={busy}>保存</Button></div>
    </Modal>}
  </div>;
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
