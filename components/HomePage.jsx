'use client';
import Icon from './Icon';
import {Button,Cover,Empty,MemoryCard} from './UI';

const paths=[
  {id:'growth',icon:'clock',number:'01',title:'沿着成长回看',description:'从童年到今天，把每一个阶段的故事接起来。',tone:'sage'},
  {id:'albums',icon:'album',number:'02',title:'把故事整理成册',description:'让零散的照片与讲述，成为一本家人的故事。',tone:'peach'},
  {id:'capsules',icon:'calendar',number:'03',title:'写给未来的家人',description:'留一封信，约好在某一天重新打开。',tone:'lavender'},
];

export default function HomePage({state,open,favorite,navigate,setModal,onPending}) {
  const confirmed=state.memories.filter(m=>m.status==='confirmed');
  const pending=state.memories.filter(m=>m.status==='draft');
  const recommendation=confirmed[Math.floor(Date.now()/86400000)%Math.max(confirmed.length,1)];
  const today=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
  const greeting=state.members.find(m=>m.role==='管理员')?.name||state.account.name||'家人';

  return <div className="home-page">
    <header className="home-welcome">
      <div><span className="home-date">{today} · 这里有每一代人的故事</span><h1>欢迎回家，{greeting}<span className="greeting-leaf"><Icon name="leaf" size={26}/></span></h1><p>不论正处在人生哪一程，都可以在这里记录、回望，或找人说说话。</p></div>
      <span className="home-welcome-mark"><Icon name="heart" size={20}/> 家人在一起，故事就会继续</span>
    </header>

    <section className="home-hero" aria-label="开始使用忆伴">
      <div className="home-hero-copy">
        <span className="home-kicker">留住此刻 · 陪伴当下</span>
        <h2>每一段人生，<br/>都值得被好好记得。</h2>
        <p>从一张照片、一句话开始，让家人的故事有地方安放，也让想说的话有人倾听。</p>
        <div className="home-hero-actions">
          {state.canEdit&&<Button icon="plus" onClick={()=>setModal({type:'upload'})}>添加一段记忆</Button>}
          <Button variant="secondary" icon="message" onClick={()=>navigate('companion')}>找人说说话</Button>
        </div>
      </div>
      <div className="home-hero-visual" aria-hidden="true">
        <div className="home-hero-sun"/>
        <div className="home-photo home-photo-back"><img src="/demo/childhood.svg" alt=""/><span>那些小时候的事</span></div>
        <div className="home-photo home-photo-front"><img src="/demo/westlake.svg" alt=""/><span>一起走过的日子</span></div>
        <span className="home-visual-note">故事，从此刻继续 · 2026</span>
      </div>
    </section>

    <section className="home-start" aria-labelledby="home-start-title">
      <div className="home-section-heading"><div><span className="home-section-index">从这里开始</span><h2 id="home-start-title">今天想做什么？</h2><p>选择一件小事，就能把回忆与陪伴带进日常。</p></div></div>
      <div className="home-action-grid">
        <button className="home-action-card home-action-memory" onClick={()=>navigate('library')}><span className="home-action-icon"><Icon name="library" size={28}/></span><span className="home-action-copy"><strong>翻看家人的记忆</strong><small>按人物、时间和故事慢慢找</small></span><Icon name="arrow" size={21}/></button>
        <button className="home-action-card home-action-talk" onClick={()=>navigate('companion')}><span className="home-action-icon"><Icon name="message" size={28}/></span><span className="home-action-copy"><strong>找人说说话</strong><small>聊聊今天，也聊聊过去</small></span><Icon name="arrow" size={21}/></button>
      </div>
    </section>

    <section className="home-paths" aria-labelledby="home-paths-title">
      <div className="home-section-heading"><div><span className="home-section-index">让故事继续</span><h2 id="home-paths-title">用不同方式，保存每一程</h2></div></div>
      <div className="home-path-grid">{paths.map(item=><button key={item.id} className={`home-path-card ${item.tone}`} onClick={()=>navigate(item.id)}><span className="home-path-top"><span>{item.number} / 探索更多</span><Icon name={item.icon} size={25}/></span><strong>{item.title}</strong><small>{item.description}</small><span className="home-path-link">进入看看 <Icon name="arrow" size={17}/></span></button>)}</div>
    </section>

    <div className="home-lower-grid">
      <section className="home-recent" aria-labelledby="home-recent-title"><div className="home-section-heading"><div><span className="home-section-index">家庭记忆</span><h2 id="home-recent-title">最近珍藏的记忆</h2></div><button className="text-link" onClick={()=>navigate('library')}>查看全部 <Icon name="arrow" size={17}/></button></div><div className="memory-grid home-memory-grid">{state.memories.slice(0,3).map(m=><MemoryCard key={m.id} memory={m} onOpen={open} onFavorite={state.canEdit?favorite:undefined}/>)}{!state.memories.length&&<Empty title="从第一段故事开始" description="上传一张照片，或写下此刻想记住的话。">{state.canEdit&&<Button onClick={()=>setModal({type:'upload'})}>添加记忆</Button>}</Empty>}</div></section>
      <aside className="home-aside"><section className="home-today-card"><div className="home-aside-heading"><Icon name="sun" size={21}/><span>今天，重温这一刻</span></div>{recommendation?<><Cover memory={recommendation}/><h3>{recommendation.title}</h3><p>{recommendation.story?.slice(0,65)||'一起打开，听听这段记忆。'}</p><button className="home-today-link" onClick={()=>open(recommendation)}>一起看看 <Icon name="arrow" size={17}/></button></>:<p>确认并发布一段记忆后，这里会出现每日推荐。</p>}</section>{state.canEdit&&pending.length>0&&<button className="home-pending" onClick={onPending}><span><Icon name="check" size={19}/></span><strong>还有 {pending.length} 段记忆待确认</strong><small>核对后，再与家人分享</small><Icon name="arrow" size={18}/></button>}</aside>
    </div>

    <section className="home-family-strip"><div><Icon name="people" size={23}/><span><strong>{state.members.length} 位家人</strong>在这里留下故事</span></div><div><Icon name="image" size={23}/><span><strong>{confirmed.length} 段记忆</strong>已经与家人分享</span></div><div><Icon name="shield" size={23}/><span>发布前由家人核对，<strong>故事由你们决定</strong></span></div></section>
    <p className="home-demo-note"><Icon name="info" size={16}/>当前预置内容是虚构家庭故事与原创示例插画，可替换为已获授权的家庭素材。</p>
  </div>;
}
