'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Icon from '../../components/Icon';
import {Avatar,Button,Cover,Empty,Field,formatDate,MemoryCard,Modal} from '../../components/UI';
import MemoryForm from '../../components/RecordForm';
import AuthScreen from '../../components/AuthScreen';
import {THEMES,searchMemories} from '../../lib/core.mjs';
import {applyFontScale} from '../../lib/fontscale.mjs';
import {AccountManager,MemoryDetail,Personalize,ProfilePanel,Settings} from '../../components/Settings.jsx';
import VoiceEnroll from '../../components/VoiceEnroll';
import Growth from '../../components/Growth';
import Capsules from '../../components/Capsules';
import MemoryNarrator from '../../components/MemoryNarrator';
import Chat,{ChatEntry} from '../../components/Chat';
import HomePage from '../../components/FamilyHome';
import PhotoGallery from '../../components/PhotoGallery';
import Credits,{CreditBalance} from '../../components/Credits';
import {creditQuote} from '../../lib/credit-prices.mjs';

const NAV=[
  {id:'home',icon:'home',label:'首页'},{id:'library',icon:'library',label:'记忆库'},{id:'growth',icon:'clock',label:'家人故事'},
  {id:'companion',icon:'message',label:'陪伴对话'},{id:'albums',icon:'album',label:'回忆专辑'},{id:'capsules',icon:'calendar',label:'时间胶囊'},
  {id:'game',icon:'sparkle',label:'人生推演'},{id:'family',icon:'people',label:'家庭成员'},{id:'feedback',icon:'activity',label:'互动记录'},
  {id:'settings',icon:'settings',label:'设置'},{id:'credits',icon:'sparkle',label:'我的积分'},
];
// 桌面侧栏分组：四个主要入口在最上面，「回忆与时光」是内容延展，
// 「家庭空间」收家人、互动、设置与积分。全部可见，不再收进「更多」。
const NAV_GROUPS=[
  {items:['home','library','growth','companion','family']},
  {label:'偏好与管理',items:['settings']},
];
// 手机底部导航：首页、记忆、记录（可编辑者）、陪伴、我家；其余入口在「我家」页聚合。
const MOBILE_IDS=['home','library','companion','family'];
const ROLE_LABELS={admin:'管理员',editor:'编辑者',viewer:'查看者'};
const SPACE_ENTRIES=[
  {id:'albums',icon:'album',title:'回忆专辑',desc:'把记忆串成一本可以翻阅的故事'},
  {id:'capsules',icon:'calendar',title:'时间胶囊',desc:'写给未来某个日子的信'},
  {id:'feedback',icon:'activity',title:'互动记录',desc:'家人的回应、留言与重温'},
  {id:'credits',icon:'sparkle',title:'我的积分',desc:'余额、冻结与消费流水'},
  {id:'settings',icon:'settings',title:'设置',desc:'家庭信息、偏好与登录账号'},
];
const initialState={memories:[],albums:[],members:[],anniversaries:[],activity:[],settings:{familyName:'我们的记忆小屋'},aiEnabled:false,account:null,canEdit:false};

const pendingRequests=new Map();
let modelConfigured=false;
async function request(endpoint,options={}) {
  const post=options.method==='POST';
  let payload={};
  if(post&&typeof options.body==='string'){try{payload=JSON.parse(options.body);}catch{}}
  const originalQuote=post?creditQuote(endpoint,payload):null;
  let quote=originalQuote;
  if(['organize','story'].includes(quote?.feature)&&!modelConfigured)quote=null;
  const signature=`${endpoint}:${options.body||''}`;
  const previous=pendingRequests.get(signature);
  const headers=options.body instanceof FormData?undefined:{'Content-Type':'application/json',...options.headers};
  if(originalQuote)headers['X-Credit-Limit']=String(quote?.amount||0);
  if(post&&(originalQuote||endpoint==='/credits/grant')) {
    if(quote&&!previous&&!['companion','role','life_turn'].includes(quote.feature)&&
      !window.confirm(`${quote.label}：本次最多消耗 ${quote.amount} 积分。已有结果命中缓存不扣费；生成或保存失败退回。是否继续？`))throw new Error('已取消，未扣积分');
    const id=headers?.['Idempotency-Key']||previous||crypto.randomUUID();
    headers['Idempotency-Key']=id;pendingRequests.set(signature,id);
  }
  try {
    const response=await fetch(`/api${endpoint}`,{...options,headers});
    let body;try{body=await response.json();}catch{throw new Error(`服务暂时不可用（HTTP ${response.status}），请稍后重试。`);}
    if(body.code!=='CREDIT_PENDING')pendingRequests.delete(signature);
    if(endpoint==='/state'&&response.ok)modelConfigured=Boolean(body.aiEnabled);
    if(!response.ok)throw new Error(body.error||'请求未能完成');return body;
  } finally {
    if(quote||endpoint==='/credits/grant'||endpoint.startsWith('/narrate-video/'))window.dispatchEvent(new Event('credits-changed'));
  }
}

export default function Page() {
  const [state,setState]=useState(initialState);const [loaded,setLoaded]=useState(false);const [needsSetup,setNeedsSetup]=useState(false);const [remoteStorage,setRemoteStorage]=useState(false);const [error,setError]=useState('');const [page,setPage]=useState('home');const [modal,setModal]=useState(null);const [toast,setToast]=useState(null);const [query,setQuery]=useState('');const [filter,setFilter]=useState('全部');const [statusFilter,setStatusFilter]=useState('全部状态');const [view,setView]=useState('grid');const [person,setPerson]=useState('');const [busy,setBusy]=useState(false);const [albumSelection,setAlbumSelection]=useState([]);const [draftStory,setDraftStory]=useState('');const [storyMode,setStoryMode]=useState('');const [calendarTitle,setCalendarTitle]=useState('');const [calendarDate,setCalendarDate]=useState('');const toastTimer=useRef(null);
  const [selectedMemberId,setSelectedMemberId]=useState('');
  const notify=useCallback((message,type='success')=>{clearTimeout(toastTimer.current);setToast({message,type});toastTimer.current=setTimeout(()=>setToast(null),4500);},[]);
  // 偏好版本号：本地乐观写入时 +1；所有服务器回包（PATCH 确认、/state 快照）
  // 都带着发起时的版本，落后即拒收偏好字段——否则晚到的旧账号数据会把
  // 刚点下的字号/主题再盖回旧值。
  const prefVersion=useRef(0);
  const refresh=useCallback(async()=>{const version=prefVersion.current;const data=await request('/state');setState(s=>{if(prefVersion.current!==version&&s.account&&data.account)data.account={...data.account,preferences:s.account.preferences};return data;});setLoaded(true);setError('');return data;},[]);
  const load=useCallback(async()=>{setError('');setLoaded(false);try{const status=await request('/auth/status');setNeedsSetup(status.needsSetup);setRemoteStorage(Boolean(status.remoteStorage));if(status.user)await refresh();else setState(initialState);}catch(e){setError(e.message);}finally{setLoaded(true);}},[refresh]);
  useEffect(()=>{load();return()=>clearTimeout(toastTimer.current);},[load]);
  const close=useCallback(()=>{setModal(null);setBusy(false);window.speechSynthesis?.cancel();},[]);
  const confirmed=state.memories.filter(m=>m.status==='confirmed');
  const navigate=(id,memberId)=>{setPage(id);if(memberId)setSelectedMemberId(memberId);setPerson('');setQuery('');setFilter('全部');setStatusFilter('全部状态');};
  const filtered=useMemo(()=>searchMemories(state.memories,query,state.members).filter(m=>(filter==='全部'||m.theme===filter)&&(statusFilter==='全部状态'||m.status===(statusFilter==='已发布'?'confirmed':'draft'))&&(!person||m.people.includes(person))),[state.memories,state.members,query,filter,statusFilter,person]);
  const update=async(memory,values)=>{await request(`/memories/${memory.id}`,{method:'PATCH',body:JSON.stringify(values)});await refresh();};
  const favorite=async(memory)=>{if(!state.canEdit)return;try{await update(memory,{favorite:!memory.favorite});notify(memory.favorite?'已取消收藏':'已收藏这段记忆');}catch(e){notify(e.message,'error');}};
  const open=(memory)=>setModal({type:'detail',id:memory.id});
  const selectedMemory=state.memories.find(m=>m.id===modal?.id);
  const selectedAlbum=state.albums.find(a=>a.id===modal?.id);
  const handleSave=async(form)=>{await request(form.id?`/memories/${form.id}`:'/memories',{method:form.id?'PATCH':'POST',body:JSON.stringify(form)});await refresh();close();notify(form.status==='confirmed'?'记忆已发布，家人都可以查看':'记忆已保存为待确认');};
  const perform=async(action,message)=>{setBusy(true);try{await action();await refresh();notify(message);close();}catch(e){notify(e.message,'error');}finally{setBusy(false);}};
  const showAlbum=(album)=>{setDraftStory(album.story);setStoryMode('');setModal({type:'album',id:album.id});};
  const openAccounts=()=>setModal({type:'accounts'});
  const playCount=state.activity.filter(a=>a.type==='play').length;
  const signOut=async()=>{try{await request('/auth/logout',{method:'POST',body:'{}'});setState(initialState);setModal(null);setPage('home');setNeedsSetup(false);}catch(e){notify(e.message,'error');}};

  // 全站字号缩放：由 applyFontScale() 直接写 <html> 的内联 font-size。
  // 必须在所有 early return 之前，否则 Hooks 顺序会变。
  // 这里是**唯一**的字号写入源：登录落地、刷新、切页、保存回填都走它。
  // 设置页点击档位的那一下另有一次「立刻写」，两者写的是同一个值，不会打架；
  // 千万不要在别处再加一个「监听本地预览值」的 effect —— 那会让旧值把新值覆盖回去。
  const activePrefs=state.account?.preferences||{fontScale:1,theme:'day',highContrast:false};
  const activeScale=Number(activePrefs.fontScale)||1;
  useEffect(()=>{applyFontScale(activeScale);},[activeScale]);
  // 明暗主题写到 <html> 上：让加载屏、弹窗遮罩这些 app-shell 之外的部分也跟随。
  const activeTheme=activePrefs.theme==='night'?'night':'day';
  useEffect(()=>{
    const root=document.documentElement;
    if(root.dataset.theme!==activeTheme)root.dataset.theme=activeTheme;
    if(activePrefs.highContrast)root.dataset.contrast='high';
    else delete root.dataset.contrast;
  },[activeTheme,activePrefs.highContrast]);

  // 保存个性化偏好：返回更新后的 preferences，由调用方合并进 state.account。
  // 不再走 refresh()：/state 是整份快照，只为改一个偏好把 memories/albums/activity 全换一遍
  // 会让整页重新渲染（上传按钮因 busy 变 disabled 会丢焦点、图片重新校验、布局全失效）。
  const applyLocalPrefs=useCallback(p=>{prefVersion.current+=1;setState(s=>s.account?{...s,account:{...s.account,preferences:p}}:s);},[]);
  const savePreferences=useCallback(async(values)=>{
    applyLocalPrefs(values);
    const version=prefVersion.current;
    const result=await request('/auth/preferences',{method:'PATCH',body:JSON.stringify(values)});
    setState(s=>{if(prefVersion.current!==version)return s;return s.account?{...s,account:{...s.account,preferences:result.preferences}}:s;});
    return result.preferences;
  },[applyLocalPrefs,request]);

  if(!loaded)return <div className="loading-screen"><span className="brand-mark"><Icon name="leaf" size={35}/></span><h1>忆伴</h1><p>正在打开你的记忆小屋…</p><span className="spinner"/></div>;
  if(error)return <div className="loading-screen"><Icon name="info" size={40}/><h2>记忆小屋暂时无法打开</h2><p>{error}</p><Button onClick={load}>重新连接</Button></div>;
  if(!state.account)return <AuthScreen needsSetup={needsSetup} api={request} onComplete={refresh}/>;
  const toastUI=toast&&<div className={`toast ${toast.type}`} role="status"><Icon name={toast.type==='error'?'info':'check'}/>{toast.message}<button aria-label="关闭提示" onClick={()=>setToast(null)}><Icon name="close" size={16}/></button></div>;

  const prefs=activePrefs;
  const pageLabel=NAV.find(item=>item.id===page)?.label||'';
  const navItem=(id)=>{const item=NAV.find(entry=>entry.id===id);return <button key={id} aria-label={item.label} title={item.label} className={`nav-item ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={item.icon} size={20}/><span>{item.label}</span>{id==='library'&&<span className="nav-count">{state.memories.length}</span>}{id==='feedback'&&state.activity.length>0&&<span className="nav-count">{state.activity.length}</span>}</button>;};
  // 手机底部导航：「我家」承载家庭成员页（页内聚合了专辑/胶囊/推演/互动/积分/设置入口）。
  const mobileNavItem=id=>{const item=NAV.find(entry=>entry.id===id);return <button key={id} className={`mobile-nav-item ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={item.icon} size={21}/><span>{id==='family'?'我家':item.label}</span></button>;};
  return <div className={`app-shell ${page==='companion'?'chat-workspace-active':''}`} {...(prefs.theme?{['data-theme']:prefs.theme}:{})} {...(prefs.highContrast?{['data-contrast']:'high'}:{})}>
  <aside className="sidebar">
    <button className="brand" onClick={()=>navigate('home')} aria-label="回到首页"><span className="brand-mark"><Icon name="leaf" size={22}/></span><span>忆伴</span></button>
    <div className="family-switch"><span className="family-house"><Icon name="home" size={16}/></span><div><strong>{state.settings.familyName}</strong></div></div>
    <nav className="side-nav" aria-label="主要导航">{NAV_GROUPS.map(group=><div className="nav-group" key={group.label||'main'}>{group.label&&<span className="sidebar-label">{group.label}</span>}{group.items.map(navItem)}</div>)}</nav>
    <div className="sidebar-bottom"><button className="profile-button" onClick={()=>setModal({type:'account'})}><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} size="avatar-lg" src={state.account.avatar}/><span><strong>{state.account.name}</strong><small>{ROLE_LABELS[state.account.role]}</small></span></button></div>
  </aside>
<div className="workspace">
  <header className="topbar">
    <div className="topbar-crumb"><strong>{state.settings.familyName}</strong><i>/</i><span>{pageLabel}</span></div>
    <div className="topbar-actions"><CreditBalance api={request} onOpen={()=>navigate('credits')}/><button className="notification-button" aria-label="查看互动记录" onClick={()=>navigate('feedback')}><Icon name="bell"/>{state.activity.length>0&&<i/>}</button><button className="topbar-account" aria-label="我的账号" onClick={()=>setModal({type:'account'})}><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} src={state.account.avatar}/><span><strong>{state.account.name}</strong><small>{ROLE_LABELS[state.account.role]}</small></span><Icon name="chevron" size={14}/></button></div>
  </header>
  <main className="main-content" data-role={state.account.role}>
  {page==='credits'&&<Credits api={request} notify={notify} isAdmin={state.account.role==='admin'}/>}
  {page==='home'&&<HomePage state={state} open={open} favorite={favorite} navigate={navigate} setModal={setModal} onPending={()=>{navigate('library');setStatusFilter('待确认');}}/>}

  {page==='companion'&&<>
    <Chat accountId={state.account.id} accountName={state.account.name} notify={notify} canEdit={state.canEdit} onSaveMemory={starter=>setModal({type:'upload',starter})} onOpenMemory={async id=>{try{const fresh=await refresh();const memory=fresh.memories.find(m=>m.id===id&&m.status==='confirmed');if(memory)open(memory);else notify('这段记忆已移除或未发布','error');}catch(e){notify(e.message,'error');}}}/>
  </>}

  {['library','albums'].includes(page)&&<nav className="collection-tabs" aria-label="记忆分类"><button className={page==='library'?'active':''} aria-current={page==='library'?'page':undefined} onClick={()=>navigate('library')}><Icon name="library" size={18}/>全部记忆</button><button className={page==='albums'?'active':''} aria-current={page==='albums'?'page':undefined} onClick={()=>navigate('albums')}><Icon name="album" size={18}/>故事专辑</button></nav>}
  {page==='library'&&<><div className="page-heading"><div><h1>{person?`${person}的相关记忆`:'记忆库'}</h1><p>沿着时间、人物和地点，找到我们共同的故事。</p></div><Button icon="plus" onClick={()=>setModal({type:'upload'})}>添加记忆</Button></div><div className="library-toolbar"><div className="search-box"><Icon name="search"/><input placeholder="搜索人物、地点、年份或故事…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="搜索记忆"/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><Icon name="close" size={16}/></button>}</div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="记忆状态"><option>全部状态</option><option>已发布</option><option>待确认</option></select><div className="view-toggle"><button className={view==='grid'?'selected':''} aria-label="卡片视图" onClick={()=>setView('grid')}><Icon name="grid"/></button><button className={view==='timeline'?'selected':''} aria-label="时间轴视图" onClick={()=>setView('timeline')}><Icon name="list"/></button><button className={view==='photos'?'selected':''} aria-label="照片墙视图" onClick={()=>setView('photos')}><Icon name="image"/></button></div></div><div className="filter-row">{['全部',...THEMES].map(t=><button className={filter===t?'selected':''} key={t} onClick={()=>setFilter(t)}>{t}{t==='全部'&&<span>{state.memories.length}</span>}</button>)}{person&&<button onClick={()=>setPerson('')}><Icon name="close" size={14}/>取消人物筛选</button>}<span className="filter-result">共 {filtered.length} 段记忆</span></div>{view==='photos'?<PhotoGallery photos={filtered.filter(m=>m.cover).map(m=>({id:m.id,src:m.cover,title:m.title,date:m.year?m.year+'-01-01':null}))} onOpen={open}/>:(view==='grid'?<div className="memory-grid library-grid">{filtered.map(m=><MemoryCard memory={m} key={m.id} onOpen={open} onFavorite={favorite}/>)}</div>:<div className="timeline">{Object.entries(Object.groupBy([...filtered].sort((a,b)=>String(a.year||'0').localeCompare(String(b.year||'0'))),m=>m.year?`${m.year.slice(0,3)}0 年代`:'年代待补充')).map(([decade,memories])=><section key={decade} className="timeline-section"><div className="timeline-date"><span/><h2>{decade}</h2><p>{memories.length} 段记忆</p></div><div className="memory-grid">{memories.map(m=><MemoryCard key={m.id} memory={m} onOpen={open} onFavorite={favorite}/>)}</div></section>)}</div>)}{!filtered.length&&<Empty title="没有找到相关记忆" description="换一个关键词，或者添加一段新的家庭故事。"/>}</>}

  {page==='albums'&&<><div className="page-heading"><div><h1>回忆专辑</h1><p>把一张张照片，串成一段温暖的讲述。</p></div><Button icon="plus" onClick={()=>{setAlbumSelection([]);setModal({type:'createAlbum'});}}>创建专辑</Button></div><div className="album-grid">{state.albums.map(album=><article className="album-card" key={album.id}><button className="album-cover" onClick={()=>showAlbum(album)}><Cover memory={album}/><span className="album-stamp"><Icon name="album"/>家庭故事</span></button><div className="album-card-copy"><span className="eyebrow">{album.memoryIds.length} 段记忆</span><h2>{album.title}</h2><p>{album.description||'家人共同保存的温暖片段'}</p><button className="text-link" onClick={()=>showAlbum(album)}>打开专辑<Icon name="arrow" size={17}/></button></div></article>)}<button className="create-album-card" onClick={()=>{setAlbumSelection([]);setModal({type:'createAlbum'});}}><span><Icon name="plus" size={30}/></span><h3>制作一本新专辑</h3><p>选择几段记忆，让故事继续</p></button></div><div className="wide-notice"><Icon name="sparkle" size={24}/><div><strong>让照片连成故事</strong><p>打开专辑，生成讲述草稿。家属核对后保存，之后就可以用设备朗读。</p></div><span className="badge">{state.aiEnabled?'模型已连接':'当前使用本地故事串联'}</span></div></>}

  {page==='growth'&&<Growth api={request} notify={notify} selectedMemberId={selectedMemberId} onRecord={starter=>setModal({type:'upload',starter})} onAlbums={()=>navigate('albums')} members={state.members} canEdit={state.canEdit} onOpenMemory={id=>{const memory=state.memories.find(m=>m.id===id);if(memory)open(memory);}}/>}

  {page==='capsules'&&<Capsules api={request} notify={notify} members={state.members} me={state.account}/>}


  {page==='family'&&<><div className="page-heading"><div><h1>家庭成员</h1><p>每一位家人，都是记忆里重要的名字。</p></div><Button icon="plus" onClick={()=>setModal({type:'member'})}>添加家人</Button></div>
  <section aria-label="家庭空间入口"><div className="space-grid">{SPACE_ENTRIES.map(item=><button key={item.id} className="space-card" aria-label={`前往${item.title}`} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={22}/><span className="space-card-copy"><strong>{item.title}</strong><small>{item.desc}</small></span><Icon name="arrow" size={17}/></button>)}</div></section>
  <div className="family-grid">{state.members.map(member=>{const related=state.memories.filter(m=>m.people.includes(member.name));return <article className="family-card" key={member.id}><span className="badge family-role">{member.role}</span><Avatar name={member.name} color={member.color} size="avatar-xl"/><h2>{member.name}</h2><p>{member.relation}</p>{!member.birthYear&&<p className="muted family-hint">还没填出生年份，成长时间轴暂不能算年龄</p>}{member.voiceStatus==='ready'&&<span className="badge sage voice-badge"><Icon name="volume" size={13}/>已复刻声音</span>}
<div className="family-count"><strong>{related.length}</strong><span>段相关记忆</span></div><div className="family-actions"><Button variant="secondary" icon="library" onClick={()=>{navigate('library');setPerson(member.name);}}>查看相关记忆</Button>{member.role!=='管理员'&&<button className="family-remove" onClick={()=>setModal({type:'delete',collection:'members',id:member.id,title:member.name})}>移除成员</button>}{state.canEdit&&<Button variant="secondary" icon="volume" onClick={()=>setModal({type:'voice',id:member.id})}>复刻我的声音</Button>}</div></article>;})}</div><section className="calendar-section"><div className="section-title"><div><h2>值得记住的日子</h2><p>生日、纪念日，还有想一起重温的瞬间</p></div><Button variant="secondary" icon="plus" onClick={()=>{setCalendarTitle('');setCalendarDate('');setModal({type:'anniversary'});}}>添加纪念日</Button></div><div className="anniversary-grid">{state.anniversaries.map(a=><article className="anniversary" key={a.id}><div className="anniversary-date"><strong>{a.date.split('-')[1]}</strong><span>{Number(a.date.split('-')[0])} 月</span></div><div><h3>{a.title}</h3><p>每年这一天，再回味熟悉的温暖</p></div><button className="icon-button" aria-label={`删除${a.title}`} onClick={()=>setModal({type:'delete',collection:'anniversaries',id:a.id,title:a.title})}><Icon name="trash" size={17}/></button></article>)}</div></section><div className="inline-notice"><Icon name="info"/><span>添加成员用于人物分类和成长时间轴；填上出生年份，就能算出「那一年他几岁」。每位家人用邮箱登录，查看者只能浏览已发布的记忆。</span></div></>}

  {page==='feedback'&&<><div className="page-heading"><div><h1>家庭动态</h1><p>记录被看见的回忆，珍藏家人回应的瞬间。</p></div></div><div className="feedback-stats">{[{label:'故事播放',value:playCount,icon:'play'},{label:'记忆回应',value:state.activity.filter(a=>a.type==='remember').length,icon:'check'},{label:'喜欢的瞬间',value:state.activity.filter(a=>a.type==='like').length,icon:'heart'},{label:'再次聆听',value:state.activity.filter(a=>a.type==='replay').length,icon:'repeat'}].map(item=><div key={item.label} className="feedback-stat"><span><Icon name={item.icon} size={24}/></span><strong>{item.value}</strong><p>{item.label}</p></div>)}</div><ChatEntry onOpen={()=>navigate('companion')}/><div className="feedback-columns"><section className="panel"><div className="section-title"><h2>最近的家庭动态</h2><span className="badge">真实操作记录</span></div>{state.activity.length?<div className="activity-list">{state.activity.slice(0,40).map(a=><div key={a.id} className="activity-item"><span className={`activity-icon ${['like','remember','replay'].includes(a.type)?'peach':'sage'}`}><Icon name={a.type==='like'?'heart':a.type==='remember'?'check':a.type==='play'?'play':a.type==='replay'?'repeat':a.type==='comment'?'message':'library'} size={17}/></span><div><p>{a.text}</p><span>{formatDate(a.createdAt)}</span></div>{a.memoryId&&state.memories.some(m=>m.id===a.memoryId)&&<button className="text-link" onClick={()=>open(state.memories.find(m=>m.id===a.memoryId))}>查看<Icon name="arrow" size={14}/></button>}</div>)}</div>:<Empty icon="heart" title="还没有互动记录" description="在记忆详情里播放一段故事，或点击“我记得”，这里就会留下记录。"/>}</section><aside className="panel feedback-favorites"><h2>家人珍藏的回忆</h2><p className="muted">由家人收藏，方便下次一起重温</p>{state.memories.filter(m=>m.favorite).map(m=><button key={m.id} onClick={()=>open(m)}><Cover memory={m}/><span><strong>{m.title}</strong><small>{m.year}年 · {m.theme}</small></span><Icon name="heart" size={15}/></button>)}<div className="inline-notice"><Icon name="info"/><span>这些数据只表示软件操作，不用于推断认知能力或情绪状态。</span></div></aside></div></>}

  {page==='settings'&&<><div className="page-heading"><div><h1>设置</h1><p>让这个记忆小屋，更适合你的家人。</p></div></div><div className="account-actions"><span><Icon name="people" size={17}/>{state.account.name} · {ROLE_LABELS[state.account.role]}</span>{state.account.role==='admin'&&<Button variant="secondary" icon="plus" onClick={openAccounts}>管理登录账号</Button>}<Button variant="ghost" icon="logout" onClick={signOut}>退出登录</Button></div><div className="inline-notice"><Icon name="shield"/><span>每位受邀家人使用自己的邮箱和密码登录。管理员生成邀请码，编辑者可整理内容，查看者只浏览已发布记忆。</span></div>
  <ProfilePanel state={state} request={request} refresh={refresh} notify={notify}/>
  <Personalize state={state} save={savePreferences} applyLocal={applyLocalPrefs} notify={notify}/>
  <Settings state={state} request={request} refresh={refresh} notify={notify}/></>}
  <footer className="app-footer"><span><Icon name="leaf" size={14}/>忆伴 · 让每一份回忆，都有温度</span><span>家人的故事，由家人共同珍藏</span></footer></main></div>
  <nav className="mobile-nav" aria-label="手机导航">{mobileNavItem('home')}{mobileNavItem('library')}{state.canEdit?<button className="mobile-nav-item" aria-label="记录一段回忆" onClick={()=>setModal({type:'upload'})}><Icon name="plus" size={22}/><span>记录</span></button>:mobileNavItem('growth')}{mobileNavItem('companion')}{mobileNavItem('family')}</nav>

  {modal?.type==='account'&&<Modal title="我的账号" description="登录、切换和家庭成员账号都在这里。" onClose={close}><div className="account-me"><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} size="avatar-xl" src={state.account.avatar}/><div><h3>{state.account.name}</h3><p>{state.account.email}</p><span className={`badge ${state.account.role==='admin'?'peach':'sage'}`}>{ROLE_LABELS[state.account.role]}</span></div></div><div className="account-menu">{state.account.role==='admin'&&<button onClick={()=>setModal({type:'accounts'})}><span className="colored-icon"><Icon name="people" size={20}/></span><span><strong>管理登录账号</strong><small>查看已有账号，生成一次性邀请码</small></span><Icon name="chevron" size={16}/></button>}<button onClick={()=>{close();navigate('settings');}}><span className="colored-icon"><Icon name="sparkle" size={20}/></span><span><strong>个性化偏好</strong><small>文字大小、日间夜间主题、高对比度</small></span><Icon name="chevron" size={16}/></button><button onClick={()=>{close();navigate('family');}}><span className="colored-icon"><Icon name="people" size={20}/></span><span><strong>家庭空间</strong><small>家人、纪念日、互动与积分入口</small></span><Icon name="chevron" size={16}/></button></div><div className="modal-actions"><Button variant="ghost" icon="logout" onClick={signOut}>退出登录</Button><Button variant="secondary" onClick={close}>关闭</Button></div></Modal>}
  {modal?.type==='accounts'&&state.account.role==='admin'&&<Modal title="家庭登录账号" description="通过邀请码，让其他家人拥有自己的登录账号。" onClose={close}><AccountManager api={request} notify={notify}/></Modal>}
  {modal?.type==='upload'&&<Modal title="记一段回忆" description="先留下片刻，再补齐故事。" onClose={close} wide><MemoryForm accountId={state.account.id} starter={modal.starter} onSave={handleSave} onCancel={close} api={request} aiEnabled={state.aiEnabled} remoteStorage={remoteStorage} notify={notify} members={state.members}/></Modal>}
  {modal?.type==='edit'&&selectedMemory&&<Modal title="编辑这段记忆" description="确认每个细节，让回忆真实而温暖。" onClose={close} wide><MemoryForm accountId={state.account.id} remoteStorage={remoteStorage} initial={selectedMemory} onSave={handleSave} onCancel={close} api={request} aiEnabled={state.aiEnabled} notify={notify} members={state.members}/></Modal>}
  {modal?.type==='detail'&&selectedMemory&&<Modal title="一段珍藏的记忆" onClose={close} wide><MemoryDetail memory={selectedMemory} state={state} api={request} notify={notify} favorite={favorite} onEdit={()=>setModal({type:'edit',id:selectedMemory.id})} onDelete={()=>setModal({type:'delete',collection:'memories',id:selectedMemory.id,title:selectedMemory.title})} onConfirm={()=>perform(()=>update(selectedMemory,{status:'confirmed'}),'记忆已发布')} onComment={async text=>{try{await request('/comments',{method:'POST',body:JSON.stringify({memoryId:selectedMemory.id,text})});await refresh();notify('留言已保存，家人会在这段回忆下看到');}catch(e){notify(e.message,'error');throw e;}}}/></Modal>}
  {modal?.type==='createAlbum'&&<Modal title="制作一本回忆专辑" description="选择已经确认的记忆，留住属于我们的故事。" onClose={close} wide><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);perform(()=>request('/albums',{method:'POST',body:JSON.stringify({title:data.get('title'),description:data.get('description'),memoryIds:albumSelection})}),'回忆专辑已创建');}}><div className="form-grid"><Field label="专辑名称 *"><input name="title" required placeholder="例如：妈妈的青春" maxLength={80}/></Field><Field label="一句话介绍"><input name="description" placeholder="给这本专辑写一句介绍" maxLength={200}/></Field></div><h3 className="selection-title">选择记忆 <span>已选 {albumSelection.length} 段</span></h3><div className="album-selection">{confirmed.map(m=><label key={m.id} className={albumSelection.includes(m.id)?'selected':''}><input type="checkbox" checked={albumSelection.includes(m.id)} onChange={e=>setAlbumSelection(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/><Cover memory={m}/><span><strong>{m.title}</strong><small>{m.year}年 · {m.theme}</small></span></label>)}</div>{!confirmed.length&&<p>先确认并发布一段记忆，再创建专辑。</p>}<div className="modal-actions"><Button type="button" variant="ghost" onClick={close}>取消</Button><Button type="submit" icon="album" busy={busy} disabled={!albumSelection.length}>创建专辑</Button></div></form></Modal>}
  {modal?.type==='album'&&selectedAlbum&&<Modal title={selectedAlbum.title} description={selectedAlbum.description} onClose={close} wide><div className="album-detail-memories">{selectedAlbum.memoryIds.map(id=>state.memories.find(m=>m.id===id)).filter(Boolean).map(m=><button key={m.id} onClick={()=>open(m)}><Cover memory={m}/><span>{m.title}</span></button>)}</div><div className="ai-helper"><div><Icon name="sparkle"/><div><strong>把这本专辑，讲成一个故事</strong><p>{state.aiEnabled?'根据已确认记忆生成草稿，请核对后保存。':'依据记忆原文串联故事，不额外编造情节。'}</p></div></div><Button busy={busy} variant="secondary" onClick={async()=>{setBusy(true);try{const result=await request('/story',{method:'POST',body:JSON.stringify({albumId:selectedAlbum.id})});setDraftStory(result.story);setStoryMode(result.mode);notify('草稿已生成，请核对后保存');}catch(e){notify(e.message,'error');}finally{setBusy(false);}}}>生成故事草稿</Button></div>{draftStory&&<><Field label={`讲述草稿${storyMode==='local'?' · 本地串联':''}`}><textarea rows={9} value={draftStory} onChange={e=>setDraftStory(e.target.value)}/></Field><div className="story-actions"><Button variant="secondary" icon="volume" onClick={()=>{if(!window.speechSynthesis){notify('浏览器不支持朗读','error');return;}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(draftStory);utterance.lang='zh-CN';utterance.rate=state.settings.speechRate;window.speechSynthesis.speak(utterance);}}>试听设备朗读</Button><Button icon="check" onClick={()=>perform(()=>request(`/albums/${selectedAlbum.id}`,{method:'PATCH',body:JSON.stringify({story:draftStory})}),'故事已确认并保存')}>确认并保存故事</Button></div></>}<div className="modal-actions"><Button variant="danger" icon="trash" onClick={()=>setModal({type:'delete',collection:'albums',id:selectedAlbum.id,title:selectedAlbum.title})}>删除专辑</Button><Button variant="ghost" onClick={close}>关闭</Button></div></Modal>}
  {modal?.type==='member'&&<Modal title="添加一位家人" description="填写姓名后，就能按人物整理记忆。" onClose={close}><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);perform(()=>request('/members',{method:'POST',body:JSON.stringify({name:data.get('name'),relation:data.get('relation'),birthYear:data.get('birthYear')})}),'家人已添加');}}><Field label="姓名 *"><input name="name" required placeholder="例如：小雨" maxLength={30}/></Field><Field label="和这位家人的关系" hint="全年龄段：孩子、女儿、爷爷、老同学，都可以。"><input name="relation" placeholder="例如：女儿、儿子、爷爷、老同学" maxLength={30}/></Field><Field label="出生年份" hint="选填，用于显示故事发生时的年龄，不影响查看时间轴。"><input name="birthYear" inputMode="numeric" placeholder="例如：1990" maxLength={4} pattern="(19|20)\d{2}"/></Field><div className="modal-actions"><Button variant="ghost" type="button" onClick={close}>取消</Button><Button type="submit" busy={busy}>添加家人</Button></div></form></Modal>}
  {modal?.type==='voice'&&<VoiceEnroll member={state.members.find(m=>m.id===modal.id)} api={request} notify={notify} close={close} refresh={refresh}/>}
  {modal?.type==='anniversary'&&<Modal title="记住一个重要的日子" onClose={close}><form onSubmit={e=>{e.preventDefault();perform(()=>request('/anniversaries',{method:'POST',body:JSON.stringify({title:calendarTitle,date:calendarDate.slice(5)})}),'纪念日已保存');}}><Field label="纪念日名称 *"><input required value={calendarTitle} onChange={e=>setCalendarTitle(e.target.value)} placeholder="例如：爸爸妈妈的结婚纪念日"/></Field><Field label="选择日期 *" hint="将保存月和日，作为每年的纪念日。"><input required type="date" value={calendarDate} onChange={e=>setCalendarDate(e.target.value)}/></Field><div className="modal-actions"><Button type="button" variant="ghost" onClick={close}>取消</Button><Button type="submit" busy={busy}>保存纪念日</Button></div></form></Modal>}
  {modal?.type==='delete'&&<Modal title="确认删除？" description={`将删除「${modal.title}」。${modal.collection==='memories'?'相关互动和专辑关联也会移除。':''}此操作无法撤销。`} onClose={close}><div className="modal-actions"><Button variant="ghost" onClick={close}>保留</Button><Button variant="danger" icon="trash" busy={busy} onClick={()=>perform(()=>request(`/${modal.collection}/${modal.id}`,{method:'DELETE'}),'已删除')}>确认删除</Button></div></Modal>}
  {/* 常驻聊天框：除了说说话自己的整页，任何页面右下角都能随时说一句。 */}
  {toastUI}</div>;
}

/** 字号档位 → 直接写 documentElement 的内联 font-size（见 lib/fontscale.mjs 的说明）。 */
