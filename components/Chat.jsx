'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Modal} from './UI';

/**
 * 一个聊天机器人：左边一列角色卡，右边一张对话框。
 *
 * 以前「家伴」和「找人说说话」是两个功能、两个入口。现在合成一个——
 * 因为它们本来就是同一件事：找个人说说话。区别只在「找的是谁」。
 *
 * 卡分两种：
 *   家伴    记得这个家的那一个。它读 confirmed 记忆，提到的事能点回原文核对。
 *   角色卡  身份原型（身边的人 / 书里的人 / 史书里的人）。默认不碰家里的记忆，
 *           用户主动打开开关才借。借的是脾气与看事情的角度，不是某个真人。
 *
 * 对话内容全部由模型现写，这里没有任何预置对白。
 * 视觉上不用气泡尾巴：这是围坐说话，不是跟陌生人聊天。
 */

const DOCK_KEY = 'yiban-companion-dock';
const COMPANION = 'companion';
const COMPANION_SUGGESTIONS = ['今天有点累', '讲讲家里的事', '你还记得那年夏天吗'];

/** 拉「这一屋子都有谁」：家伴一位，角色卡三十张。两个接口一次并行取回。 */
function useDirectory(api) {
  const [directory, setDirectory] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [companion, roles] = await Promise.all([api('/companion'), api('/role')]);
      setDirectory({
        companion: companion.companion || { name: '家伴', personaId: 'gentle', relation: '家里人' },
        companionOpening: companion.opening || null,
        companionMessages: companion.messages || [],
        companionNotes: companion.notes || [],
        companionThreadId: companion.threadId || null,
        companionThreadCount: companion.threadCount || 0,
        personas: companion.personas || [],
        relations: companion.relations || [],
        voiceMembers: companion.voiceMembers || [],
        aiEnabled: Boolean(companion.aiEnabled),
        ai: companion.ai || null,
        concerns: roles.concerns || [],
        tones: roles.tones || [],
        kinds: roles.kinds || [],
        roles: roles.roles || [],
        threads: roles.threads || [],
      });
      setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  // 角色各自聊过几句，卡片角上要标出来。
  const used = useMemo(() => new Map((directory?.threads || []).map(item => [item.roleId, item])), [directory]);
  return { directory, error, reload: () => setReloadKey(key => key + 1), used };
}

/**
 * 一段对话的状态。家伴与角色卡共用：同一套发送、同一套乐观插入、同一条红线。
 * who 是 'companion' 或某张角色卡的 id。
 */
function useConversation(api, onChanged) {
  const [active, setActive] = useState(null);
  const [setting, setSetting] = useState(null);
  const [opening, setOpening] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [sources, setSources] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const feedRef = useRef(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length, busy]);

  const open = useCallback(async who => {
    setBusy(true); setError(''); setSources([]); setText('');
    try {
      if (who === COMPANION) {
        // 每次都重新取一次：家伴的对话按用户名下最新那条走，可能与首屏那份已经不同。
        const result = await api('/companion');
        setActive(COMPANION);
        setSetting(result.companion || { name: '家伴', personaId: 'gentle', relation: '家里人' });
        setOpening(result.opening || null);
        setMessages(result.messages || []);
        setNotes(result.notes || []);
        setThreadId(result.threadId || null);
      } else {
        const result = await api(`/role/thread?roleId=${encodeURIComponent(who)}`);
        setActive(who);
        setSetting(result.setting || null);
        setOpening(result.opening || null);
        setMessages(result.messages || []);
        setNotes([]);
        setThreadId(result.threadId || null);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, []);

  const leave = useCallback(() => {
    setActive(null); setSetting(null); setOpening(null);
    setMessages([]); setNotes([]); setSources([]); setThreadId(null); setText(''); setError('');
  }, []);

  const send = async input => {
    const value = String(input ?? text).trim();
    if (!value || busy || !active) return;
    const optimistic = { role: 'user', text: value, at: new Date().toISOString() };
    setMessages(list => [...list, optimistic]);
    setText(''); setBusy(true); setError('');
    try {
      const result = active === COMPANION
        ? await api('/companion/turn', { method: 'POST', body: JSON.stringify({ threadId, text: value }) })
        : await api('/role/turn', {
            method: 'POST',
            body: JSON.stringify({
              roleId: setting?.roleId, toneId: setting?.toneId,
              name: setting?.name, useMemories: setting?.useMemories, text: value,
            }),
          });
      setThreadId(result.threadId || null);
      setSources(result.sources || []);
      if (active === COMPANION) setNotes(result.notes || []);
      // 服务端把我们这句话原样回了一份，替换掉乐观插入那条，否则同一句显示两遍。
      setMessages(list => [...list.filter(item => item !== optimistic), ...(result.messages || [])]);
      // 聊过几句要标在卡片角上，所以这一轮结束后让左栏重取一次名单。
      onChanged?.();
    } catch (e) {
      setMessages(list => list.filter(item => item !== optimistic));
      setText(value);
      setError(e.message);
    } finally { setBusy(false); }
  };

  const restart = async () => {
    if (!active) return null;
    setBusy(true); setError('');
    try {
      if (active === COMPANION) await api('/companion/reset', { method: 'POST', body: JSON.stringify({ threadId }) });
      else await api('/role/reset', { method: 'POST', body: JSON.stringify({ roleId: setting?.roleId }) });
      setMessages([]); setSources([]); setThreadId(null);
      onChanged?.();
      return true;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  /** 改家伴的名字/性格/关系：写进 settings，整家人共用同一个。 */
  const saveCompanion = async form => {
    setBusy(true); setError('');
    try {
      const result = await api('/companion/config', { method: 'POST', body: JSON.stringify(form) });
      setSetting(current => ({ ...current, ...result.companion }));
      return result.companion;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  return {
    active, setting, setSetting, opening, messages, notes, threadId, sources,
    text, setText, busy, error, setError, feedRef,
    open, leave, send, restart, saveCompanion,
  };
}

function Line({ message }) {
  return <article className={`companion-line ${message.role === 'user' ? 'user' : 'companion'}`}>
    <p>{message.text}</p>
  </article>;
}

function Feed({ c }) {
  return <div className="companion-feed" ref={c.feedRef} role="log" aria-live="polite">
    {c.messages.length === 0 && c.opening && <article className="companion-opening">
      <p>{c.opening.text}</p>
      {c.opening.source === 'memory' && <small>由一段记忆起的头</small>}
      {c.opening.source === 'anniversary' && <small>今天的日子</small>}
      {c.opening.source === 'role' && <small>TA 先开的口</small>}
    </article>}
    {c.messages.map((message, index) => <Line key={`${message.at || ''}-${index}`} message={message} />)}
    {c.busy && <article className="companion-line companion"><p className="companion-typing"><span/><span/><span/></p></article>}
  </div>;
}

function Composer({ c, name, ready, suggestions = [], label }) {
  // 没接模型时把输入框关掉：能打字却永远等不到回话，比直接说「还没接上」更伤。
  const placeholder = ready ? `跟${name}说点什么…` : '还没有接入模型，暂时说不了话';
  return <>
    {ready && c.messages.length === 0 && suggestions.length > 0 && <div className="companion-suggest">
      {suggestions.map(item => <button key={item} className="companion-chip" disabled={c.busy} onClick={() => c.send(item)}>{item}</button>)}
    </div>}
    <div className="companion-input">
      <input value={c.text} disabled={!ready}
        onChange={event => c.setText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); c.send(); } }}
        maxLength={500} placeholder={placeholder} aria-label={label} />
      <Button onClick={() => c.send()} busy={c.busy} disabled={!ready || !c.text.trim()}>说一句</Button>
    </div>
    {c.error && <p className="form-error"><Icon name="info" size={15}/>{c.error}</p>}
  </>;
}

function sourcesBlock(sources, onOpenMemory) {
  if (!sources.length) return null;
  return <div className="companion-sources">
    <span>刚才说到的事：</span>
    {sources.map(source => <button key={source.id} className="text-link" onClick={() => onOpenMemory?.(source.id)}>
      {source.year ? `${source.year}年 · ` : ''}{source.title}
    </button>)}
  </div>;
}

/** 左栏：家伴 + 三十张角色卡。同一份筛选逻辑给整页版和浮层版共用。 */
function Rail({ d, active, onPick, compact = false }) {
  const [kind, setKind] = useState('');
  const [concern, setConcern] = useState('');
  const [query, setQuery] = useState('');
  const directory = d.directory;
  const companion = directory.companion;
  const persona = (directory.personas || []).find(item => item.id === companion.personaId);

  const keyword = query.trim().toLowerCase();
  const list = (directory.roles || []).filter(item => {
    if (kind && item.kind !== kind) return false;
    if (concern && !(item.concerns || []).includes(concern)) return false;
    if (keyword && !`${item.name}${item.who}${item.blurb}`.toLowerCase().includes(keyword)) return false;
    return true;
  });

  return <div className={`chat-rail ${compact ? 'compact' : ''}`}>
    {!compact && <div className="chat-rail-head">
      <h2>跟谁说说话</h2>
      <p>家伴记得这个家的事；下面那些人是身份原型，借的是脾气，不是某个真人。</p>
    </div>}

    {!compact && <input className="rail-search" value={query} onChange={event => setQuery(event.target.value)}
      placeholder="找谁说话…" aria-label="找谁说话" maxLength={24} />}

    <button className={`chat-companion-card ${active === COMPANION ? 'active' : ''}`} onClick={() => onPick(COMPANION)}>
      <Avatar name={companion.name} color={companion.color || 'sage'} size="avatar-lg" />
      <span className="chat-companion-text">
        <strong>{companion.name}</strong>
        <small>{persona ? persona.name : '记得这个家的人'}{companion.relation ? ` · ${companion.relation}` : ''}</small>
      </span>
      {directory.companionThreadCount > 0 && <span className="role-badge">聊过</span>}
    </button>

    <div className="kind-row">
      <button className={`kind-tab ${kind === '' ? 'active' : ''}`} onClick={() => setKind('')}>都在这儿</button>
      {(directory.kinds || []).map(item => (
        <button key={item.id} className={`kind-tab ${kind === item.id ? 'active' : ''}`} onClick={() => setKind(item.id)} title={item.blurb}>{item.label}</button>
      ))}
    </div>
    <div className="concern-row">
      <button className={`concern-chip ${concern === '' ? 'active' : ''}`} onClick={() => setConcern('')}>都能聊</button>
      {(directory.concerns || []).map(item => (
        <button key={item.id} className={`concern-chip ${concern === item.id ? 'active' : ''}`} onClick={() => setConcern(item.id)} title={item.blurb}>{item.label}</button>
      ))}
    </div>

    <div className="role-list">
      {list.map(item => {
        const thread = d.used.get(item.id);
        return <button key={item.id} className={`role-card ${thread ? 'has-thread' : ''} ${active === item.id ? 'active' : ''}`} onClick={() => onPick(item.id)}>
          <Avatar name={item.name} color={item.color} />
          <span className="role-card-text">
            <strong>{thread?.name || item.name}</strong>
            <small className="role-who">{item.who}</small>
            <small className="role-blurb">{item.blurb}</small>
          </span>
          {thread && <span className="role-badge">聊过 {thread.count} 句</span>}
        </button>;
      })}
    </div>
    {list.length === 0 && <p className="roles-hint">这个组合下暂时没有人。换个分类，或者点「都在这儿」。</p>}
    {(kind === 'book' || kind === 'history') && <p className="roles-footnote"><Icon name="info" size={14}/>
      {kind === 'book' ? '话是照着书里写定的性子说的——不是原文，也不是作者写的那句话。' : '话是照着史书里的记载推出来的——不是本人真说过的话。'}
    </p>}
    {!directory.aiEnabled && <p className="roles-footnote warn"><Icon name="info" size={14}/>还没接模型，选得了人但说不了话。</p>}
  </div>;
}

/** 右栏：跟选中的这个人说话。 */
function Conversation({ c, d, notify, onOpenMemory, canEdit }) {
  const directory = d.directory;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const isCompanion = c.active === COMPANION;
  const role = isCompanion ? null : (directory.roles || []).find(item => item.id === c.active) || null;
  const persona = (directory.personas || []).find(item => item.id === c.setting?.personaId) || null;
  const tone = (directory.tones || []).find(item => item.id === c.setting?.toneId) || null;
  const name = c.setting?.name || role?.name || directory.companion.name;

  const openEditor = () => {
    setForm(isCompanion
      ? { name: c.setting?.name || '', personaId: c.setting?.personaId || 'gentle', relation: c.setting?.relation || '家里人', voiceMemberId: c.setting?.voiceMemberId || null }
      : { name: c.setting?.name || role?.name || '', toneId: c.setting?.toneId || role?.defaultTone || 'warm', useMemories: Boolean(c.setting?.useMemories) });
    setEditing(true);
  };

  const save = async () => {
    if (isCompanion) {
      const saved = await c.saveCompanion(form);
      if (!saved) return;
      setEditing(false);
      notify(`你好，我是${saved.name}`);
      return;
    }
    // 角色设定跟着下一句话一起带过去，这里只落本地并收起面板。
    c.setSetting(current => ({ ...current, name: form.name, toneId: form.toneId, useMemories: form.useMemories }));
    setEditing(false);
    notify('换了说话的方式，下一句就是新的口气');
  };

  const restart = async () => {
    const done = await c.restart();
    if (done) notify(isCompanion ? '换了个话题，记事本我还留着' : '这段对话收起来了，随时可以重新开始');
  };

  return <div className="chat-main">
    {c.error && !c.setting && <p className="form-error"><Icon name="info" size={15}/>{c.error}</p>}

    <header className="companion-head">
      <button className="role-back" onClick={c.leave} aria-label="换个人说话"><Icon name="back" size={18}/></button>
      <Avatar name={name} color={c.setting?.color || role?.color || 'sage'} />
      <div>
        <h2>{name}<em>{isCompanion ? (c.setting?.relation || '家里人') : (role?.who || '')}</em></h2>
        <p>{isCompanion
          ? `${persona ? persona.name : '记得这个家的人'}${persona?.blurb ? ` · ${persona.blurb}` : ''}`
          : `${role?.blurb || ''}${tone ? ` · ${tone.name}` : ''}`}</p>
      </div>
      <div className="companion-head-actions">
        {!isCompanion && c.setting?.useMemories && <span className="role-memory-on" title="它能看到你家里已确认的记忆"><Icon name="book" size={13}/>借了家里的记忆</span>}
        {/* 家伴的人设写进全家的 settings，改它等于替全家决定——只有编辑者以上能碰。
            角色卡的称呼和脾气只存在自己名下，谁都能改。 */}
        {(canEdit || !isCompanion) && <button className="text-link" onClick={openEditor}>{isCompanion ? '编辑家伴' : '换个说法'}</button>}
        {c.messages.length > 0 && <button className="text-link" onClick={restart} disabled={c.busy}>{isCompanion ? '换个话题' : '重新开始'}</button>}
      </div>
    </header>

    {!directory.aiEnabled && <p className="companion-note"><Icon name="info" size={15}/>
      {isCompanion
        ? '还没有接入模型，家伴暂时说不了话。在环境变量里填上模型密钥就能开口——它没有预置台词，每句话都是现写的。'
        : '还没有接入模型，这些人暂时说不了话。在环境变量里填上密钥就能开口——他们没有预置台词，话全部现写。'}
    </p>}
    {isCompanion && c.setting?.useMemories && <p className="companion-note"><Icon name="info" size={15}/>它读得到这个家已确认的记忆，下面提到的事都能点回原文核对。</p>}
    {!isCompanion && c.setting?.useMemories && <p className="companion-note"><Icon name="info" size={15}/>它读得到这个家已确认的记忆，下面提到的事都能点回原文核对。不想让它提旧事，就关掉这个开关。</p>}
    {!isCompanion && role?.kind && role.kind !== 'life' && <p className="roles-footnote"><Icon name="info" size={14}/>
      {role.kind === 'book' ? `TA 的性子来自《${role.who}》里的这个人` : `TA 的性子照着史书里关于${role.name}的记载推出来`}
      ，话是照着那个性子说的——不是原文，也不是本人真说过的话。
    </p>}

    <Feed c={c} />
    {sourcesBlock(c.sources, onOpenMemory)}
    <Composer c={c} name={name} ready={directory.aiEnabled}
      suggestions={isCompanion ? COMPANION_SUGGESTIONS : []}
      label={isCompanion ? '跟家伴说一句话' : '跟这个角色说一句话'} />

    {isCompanion && c.notes.length > 0 && <details className="companion-notes">
      <summary>它记得的 {c.notes.length} 件事</summary>
      <ul>{c.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
    </details>}

    {editing && isCompanion && <Modal title="编辑家伴" description="名字、性格和关系由你来定。它是这个家共有的一位。" onClose={() => setEditing(false)}>
      <div className="form-grid">
        <label className="field"><span>名字</span><input value={form.name} maxLength={20} onChange={event => setForm(f => ({ ...f, name: event.target.value }))} placeholder="家伴" /></label>
        <label className="field"><span>它是谁</span><select value={form.relation} onChange={event => setForm(f => ({ ...f, relation: event.target.value }))}>{(directory.relations || []).map(relation => <option key={relation} value={relation}>{relation}</option>)}</select></label>
      </div>
      <p className="field-label">性格</p>
      <div className="persona-grid">
        {(directory.personas || []).map(item => <button key={item.id} className={`persona-card ${form.personaId === item.id ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, personaId: item.id }))}>
          <strong>{item.name}</strong><small>{item.blurb}</small>
        </button>)}
      </div>
      {(directory.voiceMembers || []).length > 0 && <>
        <p className="field-label">声音</p>
        <label className="field"><select value={form.voiceMemberId || ''} onChange={event => setForm(f => ({ ...f, voiceMemberId: event.target.value || null }))}>
          <option value="">默认的合成声音</option>
          {(directory.voiceMembers || []).map(member => <option key={member.id} value={member.id}>用{member.name}复刻的声音</option>)}
        </select><small>声音来自家人本人授权复刻；朗读时会标注「AI 合成」。</small></label>
      </>}
      <div className="modal-actions"><Button variant="secondary" onClick={() => setEditing(false)}>取消</Button><Button onClick={save} busy={c.busy}>保存</Button></div>
    </Modal>}

    {editing && !isCompanion && <Modal title="换个说法" description="同一个人，换个脾气，说出来的话就完全不一样。" onClose={() => setEditing(false)}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="role-name">怎么称呼 TA</label>
          <input id="role-name" value={form.name} maxLength={12} onChange={event => setForm(f => ({ ...f, name: event.target.value }))} />
          <small>这是你叫 TA 的名字，不代表真人。</small>
        </div>
      </div>
      <p className="field-label">说话的方式</p>
      <div className="persona-grid">
        {(directory.tones || []).map(item => <button key={item.id} type="button" className={`persona-card ${form.toneId === item.id ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, toneId: item.id }))}>
          <strong>{item.name}</strong><small>{item.blurb}</small>
        </button>)}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={Boolean(form.useMemories)} onChange={event => setForm(f => ({ ...f, useMemories: event.target.checked }))} />
        <span>允许 TA 借用家里已确认的记忆（默认关闭）</span>
      </label>
      <div className="modal-actions"><Button variant="ghost" onClick={() => setEditing(false)}>取消</Button><Button onClick={save}>就这样</Button></div>
    </Modal>}
  </div>;
}

/** 还没选人的时候，右栏说什么。 */
function Placeholder({ d }) {
  const directory = d.directory;
  const companion = directory.companion;
  const persona = (directory.personas || []).find(item => item.id === companion.personaId);
  return <div className="chat-intro">
    <h2>今天想找谁说说话</h2>
    <p>这些人都不认识你，也不会替你拿主意。左边挑一个，用 TA 的性子把事说开——有时候「我妈会怎么说」比「一个 AI 怎么说」管用。</p>
    <div className="chat-intro-cards">
      <div className="chat-intro-card">
        <span className="little-leaf"><Icon name="message" size={18}/></span>
        <strong>{companion.name}：记得这个家的那一个</strong>
        <small>{persona ? persona.name : '记得这个家的人'}。它读这个家已确认的记忆，提到的事都能点回原文核对。</small>
      </div>
      <div className="chat-intro-card">
        <span className="little-leaf"><Icon name="roles" size={18}/></span>
        <strong>三十张角色卡：借的是脾气，不是真人</strong>
        <small>身边的人、书里的人、史书里的人。默认不碰你家的记忆，需要时自己打开开关。</small>
      </div>
    </div>
    <p className="roles-footnote"><Icon name="info" size={14}/>家伴和角色卡是两个入口、同一张对话框——它们都不是真人，也不会替你做决定。</p>
  </div>;
}

export default function Chat({ api, notify, onOpenMemory, canEdit = false }) {
  const d = useDirectory(api);
  const c = useConversation(api, d.reload);

  if (d.error && !d.directory) return <div className="companion-fallback"><Icon name="info" size={30}/><p>{d.error}</p><Button onClick={d.reload}>再试一次</Button></div>;
  if (!d.directory) return <div className="companion-loading"><span className="spinner"/><p>正在把这些人请出来…</p></div>;

  return <div className="chat-shell">
    <aside className="chat-rail-panel">
      <Rail d={d} active={c.active} onPick={c.open} />
    </aside>
    <section className="chat-main-panel">
      {c.active
        ? <Conversation c={c} d={d} notify={notify} onOpenMemory={onOpenMemory} canEdit={canEdit} />
        : <Placeholder d={d} />}
    </section>
  </div>;
}

/** 右下角常驻的聊天框：任何页面都能随时说一句。 */
export function ChatDock({ api, hidden = false, onExpand, onOpenMemory }) {
  const [open, setOpen] = useState(false);
  const d = useDirectory(api);
  const c = useConversation(api, d.reload);
  const inputWrap = useRef(null);

  // 默认收起：不请自来的面板会挡住页面内容。展开过一次就记住。
  useEffect(() => { try { if (localStorage.getItem(DOCK_KEY) === 'open') setOpen(true); } catch {} }, []);
  const write = next => { try { localStorage.setItem(DOCK_KEY, next ? 'open' : 'closed'); } catch {} };
  const toggle = () => setOpen(value => { const next = !value; write(next); return next; });

  useEffect(() => {
    if (!open) return;
    const handle = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  // 展开时默认落在「家伴」上：浮层是「刚才那句话想跟它说一声」，不是来挑角色的。
  useEffect(() => { if (open && !c.active) c.open(COMPANION); }, [open]);
  useEffect(() => { if (open) inputWrap.current?.querySelector('input')?.focus(); }, [open, c.active]);

  if (hidden) return null;

  const directory = d.directory;
  const isCompanion = c.active === COMPANION;
  const role = !isCompanion && directory ? (directory.roles || []).find(item => item.id === c.active) || null : null;
  const name = c.setting?.name || role?.name || directory?.companion?.name || '家伴';

  return <div className={`companion-dock ${open ? 'open' : ''}`}>
    {open && <section className="companion-dock-panel" role="dialog" aria-label="聊天框" ref={inputWrap}>
      <header className="companion-dock-head">
        <Avatar name={name} color={c.setting?.color || role?.color || 'sage'} />
        <div><strong>{name}</strong><small>{isCompanion ? '记得这个家的人' : (role?.who || '')}</small></div>
        <div className="companion-dock-actions">
          {onExpand && <button className="icon-button" aria-label="展开到整页" onClick={onExpand}><Icon name="arrow" size={18}/></button>}
          <button className="icon-button" aria-label="关闭聊天框" onClick={toggle}><Icon name="close" size={18}/></button>
        </div>
      </header>

      {d.error && !directory && <div className="companion-fallback"><Icon name="info" size={26}/><p>{d.error}</p><Button onClick={d.reload}>再试一次</Button></div>}
      {!directory && !d.error && <div className="companion-loading"><span className="spinner"/><p>正在把这些人请出来…</p></div>}
      {directory && <>
        <label className="dock-switch">
          <span>跟谁说</span>
          <select value={c.active || COMPANION} onChange={event => c.open(event.target.value)} aria-label="换个人">
            <option value={COMPANION}>{directory.companion.name}（记得这个家）</option>
            {(directory.roles || []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.who}</option>)}
          </select>
        </label>
        {!directory.aiEnabled && <p className="companion-dock-note">还没有接入模型，暂时说不了话。</p>}
        <Feed c={c} />
        {sourcesBlock(c.sources, onOpenMemory)}
        <Composer c={c} name={name} ready={directory.aiEnabled}
          suggestions={isCompanion ? COMPANION_SUGGESTIONS : []}
          label={isCompanion ? '跟家伴说一句话' : '跟这个角色说一句话'} />
        {isCompanion && c.notes.length > 0 && <details className="companion-notes"><summary>它记得的 {c.notes.length} 件事</summary><ul>{c.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
      </>}
    </section>}
    <button className="companion-dock-toggle" onClick={toggle} aria-label={open ? '收起聊天框' : '打开聊天框'} aria-expanded={open}>
      {open ? <Icon name="close" size={20}/> : <><Icon name="message" size={18}/><span>说说话</span></>}
    </button>
  </div>;
}

export function ChatEntry({ onOpen }) {
  return <div className="companion-entry">
    <span className="little-leaf"><Icon name="message" size={21}/></span>
    <div>
      <strong>找个人说说话</strong>
      <p>家伴记得这个家的事；也可以换成母亲、林黛玉、苏轼——借他们的脾气说开。</p>
    </div>
    <Button variant="secondary" onClick={onOpen}>去聊聊</Button>
  </div>;
}
