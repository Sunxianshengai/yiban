'use client';
import Icon from './Icon';
import {Button,Cover,Empty,MemoryCard} from './UI';

// 首页：一段主故事带动浏览，再接最近记忆；入口克制，不摆统计和排行。
const paths=[
  {id:'growth',icon:'clock',title:'成长记录',description:'沿着年份回看：每个人的故事接成一整条线。'},
  {id:'albums',icon:'album',title:'回忆专辑',description:'把零散的照片与讲述，整理成一本家庭故事。'},
  {id:'capsules',icon:'calendar',title:'时间胶囊',description:'留一封信给未来，约好在某一天重新打开。'},
];

export default function HomePage({state,open,favorite,navigate,setModal,onPending}) {
  const confirmed=state.memories.filter(m=>m.status==='confirmed');
  const pending=state.memories.filter(m=>m.status==='draft');
  // 每天轮换一段已发布记忆作为主故事；没有内容时给一个明确的开始入口。
  const featured=confirmed[Math.floor(Date.now()/86400000)%Math.max(confirmed.length,1)];
  const today=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
  const greeting=state.members.find(m=>m.role==='管理员')?.name||state.account.name||'家人';

  return <div className="home-page">
    <header className="home-welcome">
      <div><span className="home-date">{today}</span><h1>欢迎回家，{greeting}<span className="greeting-leaf"><Icon name="leaf" size={24}/></span></h1><p>想起哪一段，就回来看看；想留下什么，现在就可以记。</p></div>
      {state.canEdit&&<Button icon="plus" onClick={()=>setModal({type:'upload'})}>记一段回忆</Button>}
    </header>

    <section className="home-hero" aria-label="今天重温的记忆">
      {featured?<>
        <button className="home-hero-media" onClick={()=>open(featured)} aria-label={`打开${featured.title}`}><Cover memory={featured}/></button>
        <div className="home-hero-copy">
          <span className="home-kicker">今天，重温这一刻</span>
          <h2>{featured.title}</h2>
          <p>{featured.story||'打开这段记忆，和家人一起回想当时的样子。'}</p>
          <div className="home-hero-meta"><span>{featured.year?`${featured.year}年`:''}</span>{featured.location&&<span>{featured.location}</span>}{featured.people.length>0&&<span>{featured.people.slice(0,3).join(' · ')}</span>}</div>
          <div className="home-hero-actions">
            <Button icon="play" onClick={()=>open(featured)}>打开这段记忆</Button>
            <Button variant="secondary" icon="message" onClick={()=>navigate('companion')}>找人说说话</Button>
          </div>
        </div>
      </>:<div className="home-hero-empty">
        <span className="home-kicker">从一个具体的瞬间开始</span>
        <h2>家里的故事，值得一个安放的地方</h2>
        <p>上传一张照片、录一段声音，或只写下一句话。家人随时可以一起补充、核对，然后好好保存。</p>
        {state.canEdit&&<Button icon="plus" onClick={()=>setModal({type:'upload'})}>记下第一段</Button>}
      </div>}
    </section>

    <section aria-labelledby="home-recent-title">
      <div className="home-section-heading"><div><h2 id="home-recent-title">最近珍藏的记忆</h2><p>按时间排下来的家庭片段</p></div>{state.memories.length>0&&<button className="text-link" onClick={()=>navigate('library')}>查看全部 <Icon name="arrow" size={16}/></button>}</div>
      <div className="memory-grid home-memory-grid">{state.memories.slice(0,3).map(m=><MemoryCard key={m.id} memory={m} onOpen={open} onFavorite={state.canEdit?favorite:undefined}/>)}{!state.memories.length&&<Empty title="从第一段故事开始" description="上传一张照片，或写下此刻想记住的话。">{state.canEdit&&<Button onClick={()=>setModal({type:'upload'})}>添加记忆</Button>}</Empty>}</div>
    </section>

    <section aria-labelledby="home-paths-title">
      <div className="home-section-heading"><div><h2 id="home-paths-title">换个方式，重温这个家</h2></div></div>
      <div className="home-path-grid">{paths.map(item=><button key={item.id} className="home-path-card" onClick={()=>navigate(item.id)}><span className="home-path-top"><span>{item.title}</span><Icon name={item.icon} size={22}/></span><small>{item.description}</small><span className="home-path-link">进入看看 <Icon name="arrow" size={16}/></span></button>)}</div>
    </section>

    {state.canEdit&&pending.length>0&&<button className="home-pending" onClick={onPending}><span><Icon name="check" size={19}/></span><strong>还有 {pending.length} 段记忆待确认</strong><small>核对后，再与家人分享</small><Icon name="arrow" size={18}/></button>}

    <section className="home-family-strip" aria-label="家庭概况">
      <div><Icon name="people" size={22}/><span><strong>{state.members.length} 位家人</strong>在这里留下故事</span></div>
      <div><Icon name="image" size={22}/><span><strong>{confirmed.length} 段记忆</strong>已经与家人分享</span></div>
      <div><Icon name="shield" size={22}/><span>发布前由家人核对，<strong>故事由你们决定</strong></span></div>
    </section>
    <p className="home-demo-note"><Icon name="info" size={15}/>当前预置内容是虚构家庭故事与原创示例插画，可替换为已获授权的家庭素材。</p>
  </div>;
}
