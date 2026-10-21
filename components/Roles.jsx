'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Modal} from './UI';

/**
 * 换个人陪你说说话。
 *
 * 和家伴的区别写在这里，免得以后有人把它改成一个东西：
 * 家伴是「一个记得这个家的伙伴」，只有一个；这里是「一屋子可以换的人」，
 * 心里堵着什么，就去找哪种人说。角色是身份原型，不是你真实的家人——
 * 选「母亲」得到的是「像母亲那样想事的人」，名字由你自己起。
 */
export default function Roles({api,notify}) {
  const [catalog,setCatalog]=useState(null);
  const [error,setError]=useState('');
  const [concern,setConcern]=useState('');
  const [kind,setKind]=useState('');            // 身边的人 / 书里的人 / 史书里的人
  const [active,setActive]=useState(null);      // 选中的角色 id
  const [setting,setSetting]=useState(null);    // 该角色的语气/称呼/是否借记忆
  const [opening,setOpening]=useState(null);
  const [messages,setMessages]=useState([]);
  const [threadId,setThreadId]=useState(null);
  const [sources,setSources]=useState([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState(false);
  const feedRef=useRef(null);

  const loadCatalog=useCallback(async()=>{
    setError('');
    try{setCatalog(await api('/role'));}catch(e){setError(e.message);}
  },[]);
  useEffect(()=>{loadCatalog();},[loadCatalog]);
  useEffect(()=>{const feed=feedRef.current;if(feed)feed.scrollTop=feed.scrollHeight;},[messages.length,busy]);

  const talkTo=async roleId=>{
    setBusy(true);setError('');setSources([]);setText('');
    try{
      const result=await api(`/role/thread?roleId=${encodeURIComponent(roleId)}`);
      setActive(result.role.id);
      setSetting(result.setting);
      setOpening(result.opening);
      setMessages(result.messages||[]);
      setThreadId(result.threadId);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };

  const back=()=>{setActive(null);setSetting(null);setMessages([]);setSources([]);setOpening(null);loadCatalog();};

  const send=async(input) => {
    const value=String(input??text).trim();
    if(!value||busy||!setting)return;
    const optimistic={role:'user',text:value,at:new Date().toISOString()};
    setMessages(list=>[...list,optimistic]);
    setText('');setBusy(true);setError('');
    try{
      const result=await api('/role/turn',{
        method:'POST',
        body:JSON.stringify({roleId:setting.roleId,toneId:setting.toneId,name:setting.name,useMemories:setting.useMemories,text:value}),
      });
      setThreadId(result.threadId);
      setSources(result.sources||[]);
      setMessages(list=>[...list.filter(item=>item!==optimistic),...(result.messages||[])]);
    }catch(e){
      setMessages(list=>list.filter(item=>item!==optimistic));
      setText(value);
      setError(e.message);
    }finally{setBusy(false);}
  };

  const restart=async()=>{
    if(!setting)return;
    setBusy(true);setError('');
    try{
      await api('/role/reset',{method:'POST',body:JSON.stringify({roleId:setting.roleId})});
      setMessages([]);setSources([]);setThreadId(null);
      notify('这段对话收起来了，随时可以重新开始');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };

  const saveSetting=async()=>{
    // 设定本身在下一句话时随请求带过去，这里只是关掉面板并提示一句。
    setEditing(false);
    notify('换了说话的方式，下一句就是新的口气');
  };

  if(error&&!catalog) return <div className="companion-fallback"><Icon name="info" size={30}/><p>{error}</p><Button variant="secondary" onClick={loadCatalog}>再试一次</Button></div>;
  if(!catalog) return <div className="companion-loading"><span className="spinner"/>正在把这些人请出来…</div>;

  const role=catalog.roles.find(item=>item.id===active)||null;
  const tone=(catalog.tones||[]).find(item=>item.id===setting?.toneId)||null;
  const historyCount=(catalog.threads||[]).length;

  // ── 一、还没选人：先问「你心里堵着什么」，再给人 ───────────────
  if(!role) {
    // 两个筛选是「与」的关系：先挑从哪儿来，再挑堵着什么。
    const list=(catalog.roles||[]).filter(item=>(!kind||item.kind===kind)&&(!concern||item.concerns.includes(concern)));
    const used=new Map((catalog.threads||[]).map(item=>[item.roleId,item]));
    const kinds=catalog.kinds||[];
    return (
      <div className="roles">
        <div className="roles-intro">
          <h2>今天想找谁说说话</h2>
          <p>这些人都不认识你，也不会替你拿主意。你挑一个，用 TA 的性子把事说开——有时候「我妈会怎么说」比「一个 AI 怎么说」管用。</p>
        </div>
        <div className="kind-row">
          <button className={`kind-tab ${kind===''?'active':''}`} onClick={()=>setKind('')}>都在这儿</button>
          {kinds.map(item=>(
            <button key={item.id} className={`kind-tab ${kind===item.id?'active':''}`} onClick={()=>setKind(item.id)} title={item.blurb}>{item.label}</button>
          ))}
        </div>
        <div className="concern-row">
          <button className={`concern-chip ${concern===''?'active':''}`} onClick={()=>setConcern('')}>都能聊</button>
          {(catalog.concerns||[]).map(item=>(
            <button key={item.id} className={`concern-chip ${concern===item.id?'active':''}`} onClick={()=>setConcern(item.id)} title={item.blurb}>{item.label}</button>
          ))}
        </div>
        <p className="roles-hint">
          {concern?(catalog.concerns||[]).find(item=>item.id===concern)?.blurb:(kinds.find(item=>item.id===kind)?.blurb||'按脾气挑，挑错了也能换。')}
          {historyCount>0&&<span> · 已经有 {historyCount} 位在等你接着说</span>}
        </p>
        {(kind==='book'||kind==='history')&&(
          <p className="roles-footnote"><Icon name="info" size={14}/>{kind==='book'?'话是照着书里写定的性子说的——不是原文，也不是作者写的那句话。':'话是照着史书里的记载推出来的——不是本人真说过的话。'}</p>
        )}
        <div className="role-grid">
          {list.map(item=>{
            const thread=used.get(item.id);
            return (
              <button key={item.id} className={`role-card ${thread?'has-thread':''}`} onClick={()=>talkTo(item.id)}>
                <Avatar name={item.name} color={item.color} size="avatar-lg"/>
                <strong>{thread?.name||item.name}</strong>
                <small className="role-who">{item.who}</small>
                <p>{item.blurb}</p>
                {thread&&<span className="role-badge">聊过 {thread.count} 句</span>}
              </button>
            );
          })}
        </div>
        {list.length===0&&<p className="roles-hint">这个组合下暂时没有人。换个分类，或者点「都在这儿」。</p>}
        {!catalog.aiEnabled&&<p className="roles-footnote warn"><Icon name="info" size={14}/>还没接入模型，选得了人但说不了话。在环境变量里填上密钥就能开口——这些人没有预置台词，他们的话全部现写。</p>}
      </div>
    );
  }

  // ── 二、已经在跟某个人聊 ─────────────────────────────────────
  return (
    <div className="roles">
      <div className="companion-head">
        <button className="role-back" onClick={back} aria-label="换个人说话"><Icon name="back" size={18}/></button>
        <Avatar name={setting?.name||role.name} color={role.color}/>
        <div>
          <h2>{setting?.name||role.name}<em>{role.who}</em></h2>
          <p>{role.blurb}{tone?` · ${tone.name}`:''}</p>
        </div>
        <div className="companion-head-actions">
          {setting?.useMemories&&<span className="role-memory-on" title="它能看到你家里已确认的记忆"><Icon name="book" size={13}/>借了家里的记忆</span>}
          <button className="text-link" onClick={()=>setEditing(true)}>换个说法</button>
          {messages.length>0&&<button className="text-link" onClick={restart}>重新开始</button>}
        </div>
      </div>

      {setting?.useMemories&&<p className="companion-note"><Icon name="info" size={15}/>它读得到这个家已确认的记忆，下面提到的事都能点回原文核对。不想让它提旧事，就关掉这个开关。</p>}
      {role.kind!=='life'&&<p className="roles-footnote"><Icon name="info" size={14}/>{role.kind==='book'?`TA 的性子来自《${role.who}》里的这个人`:role.kind==='history'?`TA 的性子照着史书里关于${role.name}的记载推出来`:`TA 的性子来自${role.who}`}，话是照着那个性子说的——不是原文，也不是本人真说过的话。</p>}

      <div className="companion-feed" ref={feedRef} role="log" aria-live="polite">
        {messages.length===0&&opening&&(
          <article className="companion-opening">
            <p>{opening.text}</p>
            <small>TA 先开的口</small>
          </article>
        )}
        {messages.map((message,index)=>(
          <article key={index} className={`companion-line ${message.role==='user'?'user':'companion'}`}>
            <p>{message.text}</p>
          </article>
        ))}
        {busy&&<article className="companion-line companion"><p className="companion-typing"><span/><span/><span/></p></article>}
      </div>

      {sources.length>0&&(
        <div className="companion-sources">
          <span>刚才说到的事：</span>
          {sources.map(source=>(
            <span key={source.id} className="text-link">{source.year?`${source.year}年 · `:''}{source.title}</span>
          ))}
        </div>
      )}

      <div className="companion-input">
        <input
          value={text}
          disabled={!catalog.aiEnabled}
          placeholder={catalog.aiEnabled?`跟${setting?.name||role.name}说点什么…`:'还没有接入模型，暂时说不了话'}
          onChange={event=>setText(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();send();}}}
          maxLength={500}
          aria-label="跟这个角色说一句话"
        />
        <Button onClick={()=>send()} busy={busy} disabled={!catalog.aiEnabled||!text.trim()}>说一句</Button>
      </div>
      {error&&<p className="form-error"><Icon name="info" size={15}/>{error}</p>}

      {editing&&(
        <Modal title="换个说法" description="同一个人，换个脾气，说出来的话就完全不一样。" onClose={()=>setEditing(false)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="role-name">怎么称呼 TA</label>
              <input id="role-name" value={setting?.name||''} maxLength={12}
                onChange={event=>setSetting(current=>({...current,name:event.target.value}))} />
              <small>这是你叫 TA 的名字，不代表真人。</small>
            </div>
          </div>
          <p className="field-label">说话的方式</p>
          <div className="persona-grid">
            {(catalog.tones||[]).map(item=>(
              <button key={item.id} type="button"
                className={`persona-card ${setting?.toneId===item.id?'active':''}`}
                onClick={()=>setSetting(current=>({...current,toneId:item.id}))}>
                <strong>{item.name}</strong>
                <small>{item.blurb}</small>
              </button>
            ))}
          </div>
          <label className="check-row">
            <input type="checkbox" checked={Boolean(setting?.useMemories)}
              onChange={event=>setSetting(current=>({...current,useMemories:event.target.checked}))} />
            <span>允许 TA 借用家里已确认的记忆（默认关闭）</span>
          </label>
          <div className="modal-actions">
            <Button variant="ghost" onClick={()=>setEditing(false)}>取消</Button>
            <Button onClick={saveSetting}>就这样</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function RolesEntry({onOpen}) {
  return (
    <div className="companion-entry">
      <span className="little-leaf"><Icon name="roles" size={21}/></span>
      <div>
        <strong>换个人说说话</strong>
        <p>身边的人、书里的人、史书里的人——心里堵着什么，就找哪种人说。</p>
      </div>
      <Button variant="secondary" onClick={onOpen}>挑一个</Button>
    </div>
  );
}
