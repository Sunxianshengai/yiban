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
import Chat from '../../components/Chat';
import {FamilyRoster,SettingsWorkspace} from '../../components/PreviewWorkspace';
import {useFamilia,FamiliaHome,CompanionSetup,ProfileContact,MoodPage} from '../../components/Familia';
import PersonaEditor from '../../components/PersonaEditor';
import PersonalMemory from '../../components/PersonalMemory';
import {DEFAULT_COMPANION} from '../../lib/companion-chat.mjs';
import {familiaAPI} from '../../lib/familia-client.mjs';
import {EXAMPLE_PEOPLE} from '../../lib/preview-assets.mjs';
import PhotoGallery from '../../components/PhotoGallery';
import Credits,{CreditBalance} from '../../components/Credits';
import {creditQuote} from '../../lib/credit-prices.mjs';

// 功能只保留核心三条线：记忆库（记录/核对）、家人故事（回望）、陪伴对话（日常聊天）。
// 设置页收纳账号、偏好与积分。
const NAV=[
  {id:'home',icon:'home',label:'首页'},{id:'library',icon:'library',label:'记忆库'},{id:'growth',icon:'clock',label:'家人故事'},
  {id:'companion',icon:'message',label:'陪伴对话'},{id:'family',icon:'people',label:'家庭成员'},{id:'settings',icon:'settings',label:'设置'},
];
const NAV_GROUPS=[
  {items:['home','library','companion','family']},
];
// 手机底部导航：首页、记忆、记录（可编辑者）、陪伴、我家；设置在「我家」页聚合。
const MOBILE_IDS=['home','library','companion','family'];
const ROLE_LABELS={admin:'管理员',editor:'编辑者',viewer:'查看者'};
const SPACE_ENTRIES=[
  {id:'settings',icon:'settings',title:'设置',desc:'家庭信息、偏好、积分与登录账号'},
];
const initialState={memories:[],members:[],anniversaries:[],activity:[],settings:{familyName:'我们的记忆小屋'},aiEnabled:false,account:null,canEdit:false};

const pendingRequests=new Map();
let modelConfigured=false;
async function request(endpoint,options={}) {
  const post=options.method==='POST';
  let payload={};
  if(post&&typeof options.body==='string'){try{payload=JSON.parse(options.body);}catch{}}
  const originalQuote=post?creditQuote(endpoint,payload):null;
  let quote=originalQuote;
  if(['organize'].includes(quote?.feature)&&!modelConfigured)quote=null;
  const signature=`${endpoint}:${options.body||''}`;
  const previous=pendingRequests.get(signature);
  const headers=options.body instanceof FormData?undefined:{'Content-Type':'application/json',...options.headers};
  if(originalQuote)headers['X-Credit-Limit']=String(quote?.amount||0);
  if(post&&(originalQuote||endpoint==='/credits/grant')) {
    if(quote&&!previous&&!['companion','role'].includes(quote.feature)&&
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
  const [state,setState]=useState(initialState);const [loaded,setLoaded]=useState(false);const [needsSetup,setNeedsSetup]=useState(false);const [remoteStorage,setRemoteStorage]=useState(false);const [error,setError]=useState('');const [page,setPage]=useState('home');const [modal,setModal]=useState(null);const [toast,setToast]=useState(null);const [query,setQuery]=useState('');const [filter,setFilter]=useState('全部');const [statusFilter,setStatusFilter]=useState('全部状态');const [view,setView]=useState('grid');const [person,setPerson]=useState('');const [busy,setBusy]=useState(false);const [calendarTitle,setCalendarTitle]=useState('');const [calendarDate,setCalendarDate]=useState('');const toastTimer=useRef(null);
  const [selectedMemberId,setSelectedMemberId]=useState('');
  const [compact,setCompact]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(max-width:768px)');const update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const [assetFilter,setAssetFilter]=useState('all');
  const [settingsTab,setSettingsTab]=useState('preferences');
  const [explicitCompanion,setExplicitCompanion]=useState(false);
  const [profileId,setProfileId]=useState(null),[voiceEntry,setVoiceEntry]=useState(false),[mediaFilter,setMediaFilter]=useState('all');
  const familia=useFamilia(state.account?.id);
  const activeProfile=[...familia.profiles,...EXAMPLE_PEOPLE].find(profile=>profile.id===profileId)||null;
  const openProfile=profile=>{setProfileId(profile?.id||null);setVoiceEntry(false);setPage('contact');};
  const openMore=(profile=activeProfile)=>{setModal({type:'more',profileId:profile?.illustrative?null:profile?.id||null});};
  async function editPersona(id){try{await familia.reload();setModal({type:'persona-edit',profileId:id});}catch(failure){notify(failure.message,'error');}}
  async function beginConversation(voice=false){
    try{if(activeProfile?.illustrative){const {role,name,age,qualities}=activeProfile;const profile=await familiaAPI('profiles',{method:'POST',headers:{'Idempotency-Key':activeProfile.id},body:{role,name,age,qualities}});await familia.reload();setProfileId(profile.id);}setVoiceEntry(voice);navigate('companion');setExplicitCompanion(true);}catch(error){notify(error.message,'error');}
  }
  const notify=useCallback((message,type='success')=>{clearTimeout(toastTimer.current);setToast({message,type});toastTimer.current=setTimeout(()=>setToast(null),4500);},[]);
  // 偏好版本号：本地乐观写入时 +1；所有服务器回包（PATCH 确认、/state 快照）
  // 都带着发起时的版本，落后即拒收偏好字段——否则晚到的旧账号数据会把
  // 刚点下的字号/主题再盖回旧值。
  const prefVersion=useRef(0);
  const refresh=useCallback(async()=>{const version=prefVersion.current;const data=await request('/state');setState(s=>{if(prefVersion.current!==version&&s.account&&data.account)data.account={...data.account,preferences:s.account.preferences};return data;});setLoaded(true);setError('');return data;},[]);
  const load=useCallback(async()=>{setError('');setLoaded(false);try{const status=await request('/auth/status');setNeedsSetup(status.needsSetup);setRemoteStorage(Boolean(status.remoteStorage));if(status.user)await refresh();else setState(initialState);}catch(e){setError(e.message);}finally{setLoaded(true);}},[refresh]);
  useEffect(()=>{load();return()=>clearTimeout(toastTimer.current);},[load]);
  const close=useCallback(()=>{setModal(null);setBusy(false);window.speechSynthesis?.cancel();},[]);
  const navigate=(id,memberId)=>{if(id==='companion')setExplicitCompanion(false);setPage(id);setModal(null);setMediaFilter('all');setAssetFilter('all');if(memberId)setSelectedMemberId(memberId);setPerson('');setQuery('');setFilter('全部');setStatusFilter('全部状态');};
  const filtered=useMemo(()=>searchMemories(state.memories,query,state.members).filter(m=>(assetFilter==='all'||Boolean(m[assetFilter]))&&(mediaFilter!=='video'||Boolean(m.video))&&(filter==='全部'||m.theme===filter)&&(statusFilter==='全部状态'||m.status===(statusFilter==='已发布'?'confirmed':'draft'))&&(!person||m.people.includes(person))),[state.memories,state.members,query,filter,statusFilter,person,mediaFilter,assetFilter]);
  const update=async(memory,values)=>{await request(`/memories/${memory.id}`,{method:'PATCH',body:JSON.stringify(values)});await refresh();};
  const favorite=async(memory)=>{if(!state.canEdit)return;try{await update(memory,{favorite:!memory.favorite});notify(memory.favorite?'已取消收藏':'已收藏这段记忆');}catch(e){notify(e.message,'error');}};
  const open=(memory)=>setModal({type:'detail',id:memory.id});
  const selectedMemory=state.memories.find(m=>m.id===modal?.id);
  const handleSave=async(form)=>{await request(form.id?`/memories/${form.id}`:'/memories',{method:form.id?'PATCH':'POST',body:JSON.stringify(form)});await refresh();close();notify(form.status==='confirmed'?'记忆已发布，家人都可以查看':'记忆已保存为待确认');};
  const perform=async(action,message)=>{setBusy(true);try{await action();await refresh();notify(message);close();}catch(e){notify(e.message,'error');}finally{setBusy(false);}};
  const openAccounts=()=>setModal({type:'accounts'});
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
  const [systemNight,setSystemNight]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const change=()=>setSystemNight(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const activeTheme=activePrefs.theme==='night'||activePrefs.theme==='system'&&systemNight?'night':'day';
  useEffect(()=>{
    const root=document.documentElement;
    if(root.dataset.theme!==activeTheme)root.dataset.theme=activeTheme;
    if(activePrefs.highContrast)root.dataset.contrast='high';
    else delete root.dataset.contrast;
  },[activeTheme,activePrefs.highContrast]);

  // 保存个性化偏好：返回更新后的 preferences，由调用方合并进 state.account。
  // 不再走 refresh()：/state 是整份快照，只为改一个偏好把 memories/activity 全换一遍
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
  const pageLabel=NAV.find(item=>item.id===page)?.label||({contact:'AI 家人',mood:'我的心情',credits:'个人积分'}[page])||'';
  const navItem=(id)=>{const item=NAV.find(entry=>entry.id===id);return <button key={id} aria-label={item.label} title={item.label} className={`nav-item ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={item.icon} size={20}/><span>{{library:'记忆',companion:'陪伴',family:'我家'}[id]||item.label}</span>{id==='library'&&<span className="nav-count">{state.memories.length}</span>}</button>;};
  // 手机底部导航：「我家」承载家庭成员页（页内聚合了设置等入口）。
  const mobileNavItem=id=>{const item=NAV.find(entry=>entry.id===id);return <button key={id} aria-label={item.label} className={`mobile-nav-item ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon name={item.icon} size={21}/><span>{{library:'记忆',companion:'陪伴',family:'我家'}[id]||item.label}</span></button>;};
  return <div data-page={page} className={`app-shell familia-app ${page==='companion'?'chat-workspace-active':''} ${['contact','mood'].includes(page)?'fa-focus-page':''}`} data-theme={activeTheme} {...(prefs.highContrast?{['data-contrast']:'high'}:{})}>
  <aside className="sidebar">
    <button className="brand" onClick={()=>navigate('home')} aria-label="回到首页"><span className="brand-mark"><Icon name="leaf" size={22}/></span><span>忆伴</span></button>
    <div className="family-switch"><span className="family-house"><Icon name="home" size={16}/></span><div><strong>{state.settings.familyName}</strong></div></div>
    <nav className="side-nav" aria-label="主要导航">{NAV_GROUPS.map(group=><div className="nav-group" key={group.label||'main'}>{group.label&&<span className="sidebar-label">{group.label}</span>}{group.items.map(navItem)}</div>)}</nav>
    <div className="sidebar-bottom"><button className="fa-sidebar-more" aria-label="更多功能" title="更多功能" onClick={()=>openMore()}><Icon name="more"/></button><button className="profile-button" aria-label="我的账号" onClick={()=>setModal({type:'account'})}><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} size="avatar-lg" src={state.account.avatar}/><span><strong>{state.account.name}</strong><small>{ROLE_LABELS[state.account.role]}</small></span></button></div>
  </aside>
<div className="workspace">
  <header className="topbar">
    <div className="topbar-crumb"><strong>{state.settings.familyName}</strong><i>/</i><span>{pageLabel}</span></div>
    <div className="topbar-actions">{page!=='companion'&&<CreditBalance api={request} onOpen={()=>navigate('credits')}/ >}<button className="topbar-account" aria-label="我的账号" onClick={()=>setModal({type:'account'})}><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} src={state.account.avatar}/><span><strong>{state.account.name}</strong><small>{ROLE_LABELS[state.account.role]}</small></span><Icon name="chevron" size={14}/></button></div>
  </header>
  <main className="main-content" data-role={state.account.role}>
  {page==='home'&&<FamiliaHome state={state} profiles={familia.profiles} defaultProfile={familia.defaultProfile||DEFAULT_COMPANION} moods={familia.moods} error={familia.error} onRetry={()=>familia.reload().catch(e=>notify(e.message,'error'))} onProfile={openProfile} onCreate={()=>setModal({type:'persona'})} onMood={()=>navigate('mood')} onRecord={()=>setModal({type:'upload'})} onLibrary={()=>navigate('library')} onMore={()=>openMore()}/>}

  {page==='contact'&&<ProfileContact profile={activeProfile||familia.defaultProfile||DEFAULT_COMPANION} onBack={()=>navigate('home')} onChat={()=>beginConversation(false)} onVoice={()=>beginConversation(true)} onVideo={()=>{navigate('library');setMediaFilter('video');}} onSettings={()=>openMore()} onEdit={()=>editPersona(activeProfile?.id||'default')} onCreate={()=>setModal({type:'persona',preset:activeProfile?.illustrative?activeProfile:null})}/>}
  {page==='mood'&&<MoodPage data={familia.moods} onSave={familia.reload} onBack={()=>navigate('home')} notify={notify}/>}
  {page==='credits'&&<Credits api={request} notify={notify} isAdmin={state.account.role==='admin'}/>}
  {page==='companion'&&<>
    <Chat defaultProfile={familia.defaultProfile||DEFAULT_COMPANION} forceProfile={explicitCompanion} accountAvatar={state.account.avatar} onEditPersona={editPersona} onCreate={()=>setModal({type:'persona',preset:DEFAULT_COMPANION})} key={`${state.account.id}:${profileId||'default'}`} profiles={familia.profiles} profileId={profileId} openSpeech={voiceEntry} onBack={openProfile} onRecord={()=>setModal({type:'upload'})} accountId={state.account.id} accountName={state.account.name} notify={notify} onCredits={()=>navigate('credits')} canEdit={state.canEdit} onSaveMemory={starter=>setModal({type:'upload',starter})} onOpenMemory={async id=>{try{const fresh=await refresh();const memory=fresh.memories.find(m=>m.id===id&&m.status==='confirmed');if(memory)open(memory);else notify('这段记忆已移除或未发布','error');}catch(e){notify(e.message,'error');}}}/>
  </>}

  {page==='library'&&<>{mediaFilter==='video'&&<div className="fa-video-filter"><Icon name="video"/>家庭影像<button onClick={()=>setMediaFilter('all')}>查看全部记忆</button></div>}<div className="page-heading"><div><h1>{mediaFilter==='video'?'家庭影像':person?`${person}的相关记忆`:'记忆库'}</h1><p>沿着时间、人物和地点，找到我们共同的故事。</p></div>{state.canEdit&&<Button icon="plus" onClick={()=>setModal({type:'upload'})}>添加记忆</Button>}</div><div className="library-toolbar"><div className="search-box"><Icon name="search"/><input placeholder="搜索人物、地点、年份或故事…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="搜索记忆"/>{query&&<button aria-label="清空搜索" onClick={()=>setQuery('')}><Icon name="close" size={16}/></button>}</div><details className="pw-library-tools" open={compact?undefined:true}><summary aria-label="筛选与视图"><Icon name="more"/></summary><div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="记忆状态"><option>全部状态</option><option>已发布</option><option>待确认</option></select><div className="view-toggle"><button className={view==='grid'?'selected':''} aria-label="卡片视图" onClick={()=>setView('grid')}><Icon name="grid"/></button><button className={view==='timeline'?'selected':''} aria-label="时间轴视图" onClick={()=>setView('timeline')}><Icon name="list"/></button><button className={view==='photos'?'selected':''} aria-label="照片墙视图" onClick={()=>setView('photos')}><Icon name="image"/></button></div><label className="pw-mobile-theme">主题<select aria-label="主题筛选" value={filter} onChange={event=>setFilter(event.target.value)}>{['全部',...THEMES].map(theme=><option key={theme}>{theme}</option>)}</select></label></div></details></div><div className="pw-memory-tabs" aria-label="素材类型">{[['all','全部'],['cover','照片'],['audio','原声'],['video','视频']].map(([id,label])=><button key={id} aria-pressed={assetFilter===id} onClick={()=>setAssetFilter(id)}>{label}</button>)}<details className="pw-memory-categories"><summary>按主题筛选</summary><div className="filter-row">{['全部',...THEMES].map(t=><button className={filter===t?'selected':''} key={t} onClick={()=>setFilter(t)}>{t}{t==='全部'&&<span>{state.memories.length}</span>}</button>)}{person&&<button onClick={()=>setPerson('')}><Icon name="close" size={14}/>取消人物筛选</button>}<span className="filter-result">共 {filtered.length} 段记忆</span></div></details></div>{view==='photos'?<PhotoGallery photos={filtered.filter(m=>m.cover).map(m=>({id:m.id,src:m.cover,title:m.title,date:m.year?m.year+'-01-01':null}))} onOpen={open}/>:(view==='grid'?<div className="memory-grid library-grid">{filtered.map(m=><MemoryCard memory={m} key={m.id} onOpen={open} onFavorite={favorite}/>)}</div>:<div className="timeline">{Object.entries(Object.groupBy([...filtered].sort((a,b)=>String(a.year||'0').localeCompare(String(b.year||'0'))),m=>m.year?`${m.year.slice(0,3)}0 年代`:'年代待补充')).map(([decade,memories])=><section key={decade} className="timeline-section"><div className="timeline-date"><span/><h2>{decade}</h2><p>{memories.length} 段记忆</p></div><div className="memory-grid">{memories.map(m=><MemoryCard key={m.id} memory={m} onOpen={open} onFavorite={favorite}/>)}</div></section>)}</div>)}{!filtered.length&&<Empty title="没有找到相关记忆" description="换一个关键词，或者添加一段新的家庭故事。"/>}</>}


  {page==='growth'&&<Growth memories={state.memories} api={request} notify={notify} selectedMemberId={selectedMemberId} onRecord={starter=>setModal({type:'upload',starter})} members={state.members} canEdit={state.canEdit} onOpenMemory={id=>{const memory=state.memories.find(m=>m.id===id);if(memory)open(memory);}}/>}



  {page==='family'&&<><div className="page-heading"><div><h1>家庭成员</h1><p>每一位家人，都是记忆里重要的名字。</p></div><Button icon="plus" onClick={()=>setModal({type:'member'})}>添加家人</Button></div>
  <section aria-label="家庭空间入口"><div className="space-grid">{SPACE_ENTRIES.map(item=><button key={item.id} className="space-card" aria-label={`前往${item.title}`} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={22}/><span className="space-card-copy"><strong>{item.title}</strong><small>{item.desc}</small></span><Icon name="arrow" size={17}/></button>)}</div></section>
  <FamilyRoster state={state} onTimeline={id=>navigate('growth',id)} onLibrary={name=>{navigate('library');setPerson(name);}} onVoice={id=>setModal({type:'voice',id})} onRemove={member=>setModal({type:'delete',collection:'members',id:member.id,title:member.name})}/ ><details className="pw-family-extras"><summary>纪念日与更多</summary><section className="calendar-section"><div className="section-title"><div><h2>值得记住的日子</h2><p>生日、纪念日，还有想一起重温的瞬间</p></div><Button variant="secondary" icon="plus" onClick={()=>{setCalendarTitle('');setCalendarDate('');setModal({type:'anniversary'});}}>添加纪念日</Button></div><div className="anniversary-grid">{state.anniversaries.map(a=><article className="anniversary" key={a.id}><div className="anniversary-date"><strong>{a.date.split('-')[1]}</strong><span>{Number(a.date.split('-')[0])} 月</span></div><div><h3>{a.title}</h3><p>每年这一天，再回味熟悉的温暖</p></div><button className="icon-button" aria-label={`删除${a.title}`} onClick={()=>setModal({type:'delete',collection:'anniversaries',id:a.id,title:a.title})}><Icon name="trash" size={17}/></button></article>)}</div></section></details><div className="inline-notice"><Icon name="info"/><span>添加成员用于人物分类和成长时间轴；填上出生年份，就能算出「那一年他几岁」。每位家人用邮箱登录，查看者只能浏览已发布的记忆。</span></div></>}


  {page==='settings'&&<SettingsWorkspace key={settingsTab} initialTab={settingsTab} state={state} api={request} refresh={refresh} notify={notify} savePreferences={savePreferences} applyLocal={applyLocalPrefs} onSignOut={signOut} onBack={()=>navigate('home')} onCredits={()=>navigate('credits')}/ >}
  <footer className="app-footer"><span><Icon name="leaf" size={14}/>忆伴 · 让每一份回忆，都有温度</span><span>家人的故事，由家人共同珍藏</span></footer></main></div>
  <nav className="mobile-nav" aria-label="手机导航">{MOBILE_IDS.map(mobileNavItem)}</nav>

  {modal?.type==='persona'&&<CompanionSetup preset={modal.preset} notify={notify} onClose={close} onCreated={async(profile,chat=false,entry)=>{await familia.reload();setModal(null);openProfile(profile);if(chat||entry==='voice'){setVoiceEntry(entry==='voice');navigate('companion');}if(entry==='video'){navigate('library');setMediaFilter('video');}notify('AI 家人已创建，设定仅自己可见');}}/>}
  {modal?.type==='personal-memories'&&<PersonalMemory defaultProfile={familia.defaultProfile||DEFAULT_COMPANION} profiles={familia.profiles} profileId={modal.profileId||null} onClose={close} notify={notify}/>}
  {modal?.type==='persona-edit'&&(modal.profileId==='default'||familia.profiles.some(profile=>profile.id===modal.profileId))&&<PersonaEditor key={modal.profileId} profile={modal.profileId==='default'?(familia.defaultProfile||{...DEFAULT_COMPANION,id:'default'}):familia.profiles.find(profile=>profile.id===modal.profileId)} onClose={close} onSaved={updated=>{familia.rememberProfile(updated);setModal(null);notify('人格设置已保存，将用于下一条回复');}}/>}
  {modal?.type==='more'&&<Modal title="更多功能" onClose={close}><div className="fa-more-menu"><button className="fa-more-row" onClick={()=>setModal({type:'personal-memories',profileId:modal.profileId})}><Icon name="lock"/>个人记忆<Icon name="chevron" size={18}/></button>{modal.profileId&&<button className="fa-more-row" aria-label="人格与表达" onClick={()=>editPersona(modal.profileId)}><Icon name="settings"/>人格与表达<Icon name="chevron" size={18}/></button>}{[{id:'library',icon:'book',title:'家庭记忆'},{id:'family',icon:'people',title:'真实家人档案'},{id:'growth',icon:'clock',title:'家人故事时间轴'},{id:'companion',icon:'message',title:'历史会话与对话'},{id:'mood',icon:'smile',title:'我的心情记录'},{id:'credits',icon:'coins',title:'积分余额与消费'},{id:'settings',icon:'settings',title:'账号、外观与设置'},{id:'account-profile',icon:'user',title:'我的账号'}].map(item=><button className="fa-more-row" key={item.id} onClick={()=>{close();if(item.id==='account-profile'){setSettingsTab('profile');navigate('settings');}else{setSettingsTab('preferences');navigate(item.id);}}}><Icon name={item.icon}/>{item.title}<Icon name="chevron" size={18}/></button>)}</div></Modal>}
  {modal?.type==='account'&&<Modal title="我的账号" description="登录、切换和家庭成员账号都在这里。" onClose={close}><div className="account-me"><Avatar name={state.account.name} color={state.account.role==='admin'?'peach':'sage'} size="avatar-xl" src={state.account.avatar}/><div><h3>{state.account.name}</h3><p>{state.account.email}</p><span className={`badge ${state.account.role==='admin'?'peach':'sage'}`}>{ROLE_LABELS[state.account.role]}</span></div></div><ProfilePanel state={state} request={request} refresh={refresh} notify={notify}/><div className="account-menu">{state.account.role==='admin'&&<button onClick={()=>setModal({type:'accounts'})}><span className="colored-icon"><Icon name="people" size={20}/></span><span><strong>管理登录账号</strong><small>查看已有账号，生成一次性邀请码</small></span><Icon name="chevron" size={16}/></button>}<button onClick={()=>{close();navigate('settings');}}><span className="colored-icon"><Icon name="sparkle" size={20}/></span><span><strong>个性化偏好</strong><small>文字大小、日间夜间主题、高对比度</small></span><Icon name="chevron" size={16}/></button><button onClick={()=>{close();navigate('family');}}><span className="colored-icon"><Icon name="people" size={20}/></span><span><strong>家庭空间</strong><small>家人、纪念日与偏好设置</small></span><Icon name="chevron" size={16}/></button></div><div className="modal-actions"><Button variant="ghost" icon="logout" onClick={signOut}>退出登录</Button><Button variant="secondary" onClick={close}>关闭</Button></div></Modal>}
  {modal?.type==='accounts'&&state.account.role==='admin'&&<Modal title="家庭登录账号" description="通过邀请码，让其他家人拥有自己的登录账号。" onClose={close}><AccountManager api={request} notify={notify}/></Modal>}
  {modal?.type==='upload'&&<Modal title="记一段回忆" description="先留下片刻，再补齐故事。" onClose={close} wide><MemoryForm accountId={state.account.id} starter={modal.starter} onSave={handleSave} onCancel={close} api={request} aiEnabled={state.aiEnabled} remoteStorage={remoteStorage} notify={notify} members={state.members}/></Modal>}
  {modal?.type==='edit'&&selectedMemory&&<Modal title="编辑这段记忆" description="确认每个细节，让回忆真实而温暖。" onClose={close} wide><MemoryForm accountId={state.account.id} remoteStorage={remoteStorage} initial={selectedMemory} onSave={handleSave} onCancel={close} api={request} aiEnabled={state.aiEnabled} notify={notify} members={state.members}/></Modal>}
  {modal?.type==='detail'&&selectedMemory&&<Modal page backLabel="家庭记忆" title="一段珍藏的记忆" onClose={close} wide><MemoryDetail memory={selectedMemory} state={state} api={request} notify={notify} favorite={favorite} onEdit={()=>setModal({type:'edit',id:selectedMemory.id})} onDelete={()=>setModal({type:'delete',collection:'memories',id:selectedMemory.id,title:selectedMemory.title})} onConfirm={()=>perform(()=>update(selectedMemory,{status:'confirmed'}),'记忆已发布')} onComment={async text=>{try{await request('/comments',{method:'POST',body:JSON.stringify({memoryId:selectedMemory.id,text})});await refresh();notify('留言已保存，家人会在这段回忆下看到');}catch(e){notify(e.message,'error');throw e;}}}/></Modal>}
  {modal?.type==='member'&&<Modal title="添加一位家人" description="填写姓名后，就能按人物整理记忆。" onClose={close}><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);perform(()=>request('/members',{method:'POST',body:JSON.stringify({name:data.get('name'),relation:data.get('relation'),birthYear:data.get('birthYear')})}),'家人已添加');}}><Field label="姓名 *"><input name="name" required placeholder="例如：小雨" maxLength={30}/></Field><Field label="和这位家人的关系" hint="全年龄段：孩子、女儿、爷爷、老同学，都可以。"><input name="relation" placeholder="例如：女儿、儿子、爷爷、老同学" maxLength={30}/></Field><Field label="出生年份" hint="选填，用于显示故事发生时的年龄，不影响查看时间轴。"><input name="birthYear" inputMode="numeric" placeholder="例如：1990" maxLength={4} pattern="(19|20)\d{2}"/></Field><div className="modal-actions"><Button variant="ghost" type="button" onClick={close}>取消</Button><Button type="submit" busy={busy}>添加家人</Button></div></form></Modal>}
  {modal?.type==='voice'&&<VoiceEnroll member={state.members.find(m=>m.id===modal.id)} api={request} notify={notify} close={close} refresh={refresh}/>}
  {modal?.type==='anniversary'&&<Modal title="记住一个重要的日子" onClose={close}><form onSubmit={e=>{e.preventDefault();perform(()=>request('/anniversaries',{method:'POST',body:JSON.stringify({title:calendarTitle,date:calendarDate.slice(5)})}),'纪念日已保存');}}><Field label="纪念日名称 *"><input required value={calendarTitle} onChange={e=>setCalendarTitle(e.target.value)} placeholder="例如：爸爸妈妈的结婚纪念日"/></Field><Field label="选择日期 *" hint="将保存月和日，作为每年的纪念日。"><input required type="date" value={calendarDate} onChange={e=>setCalendarDate(e.target.value)}/></Field><div className="modal-actions"><Button type="button" variant="ghost" onClick={close}>取消</Button><Button type="submit" busy={busy}>保存纪念日</Button></div></form></Modal>}
  {modal?.type==='delete'&&<Modal title="确认删除？" description={`将删除「${modal.title}」。${modal.collection==='memories'?'相关互动也会移除。':''}此操作无法撤销。`} onClose={close}><div className="modal-actions"><Button variant="ghost" onClick={close}>保留</Button><Button variant="danger" icon="trash" busy={busy} onClick={()=>perform(()=>request(`/${modal.collection}/${modal.id}`,{method:'DELETE'}),'已删除')}>确认删除</Button></div></Modal>}
  {/* 常驻聊天框：除了说说话自己的整页，任何页面右下角都能随时说一句。 */}
  {toastUI}</div>;
}

/** 字号档位 → 直接写 documentElement 的内联 font-size（见 lib/fontscale.mjs 的说明）。 */
