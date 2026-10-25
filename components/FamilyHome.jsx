'use client';
import Icon from './Icon';
import {Avatar,Button,Cover,Empty,MemoryCard,formatDate} from './UI';

const QUESTIONS=['家里哪一道菜，让你一想起来就觉得亲切？','最近有什么小事，想让家人也知道？','小时候，一家人最喜欢去哪里？'];
export default function FamilyHome({state,open,favorite,navigate,setModal,onPending}){
  const confirmed=state.memories.filter(m=>m.status==='confirmed');
  const featured=confirmed[Math.floor(Date.now()/86400000)%Math.max(confirmed.length,1)];
  const pending=state.memories.filter(m=>m.status==='draft');
  const question=QUESTIONS[Math.floor(Date.now()/86400000)%QUESTIONS.length];
  const recent=state.activity.filter(a=>['comment','remember','created'].includes(a.type)).slice(0,4);
  return <div className="family-home">
    <header className="home-welcome"><div><p className="home-date">{new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</p><h1>欢迎回家，{state.account.name}</h1><p>把平常的日子，留给想念的时候。</p></div>{state.canEdit&&<Button icon="plus" onClick={()=>setModal({type:'upload'})}>记一段回忆</Button>}</header>
    {featured?<section className="home-feature" aria-label="今天重温的记忆"><button className="home-feature-image" onClick={()=>open(featured)} aria-label={`查看${featured.title}`}><Cover memory={featured}/>{featured.isDemo&&<span className="demo-mark">虚构示例 · 原创插画</span>}</button><div className="home-feature-copy"><span className="home-feature-date"><Icon name="clock" size={16}/>{featured.year?`${featured.year} 年`:'一段家里的故事'}{featured.location?` · ${featured.location}`:''}</span><h2>{featured.title}</h2><p>{featured.story||'打开这段记忆，一起聊聊那一天。'}</p><div className="home-feature-people">{featured.people.map(name=><span key={name}><Avatar name={name}/>{name}</span>)}</div><Button variant="secondary" icon={featured.audio?'volume':'book'} onClick={()=>open(featured)}>{featured.audio?'听这段回忆':'打开这段记忆'}</Button></div></section>:<section className="home-start"><Icon name="album" size={36}/><h2>从第一段家庭故事开始</h2><p>一张照片、一句原话，或一段熟悉的声音。</p>{state.canEdit?<Button icon="plus" onClick={()=>setModal({type:'upload'})}>记下第一段</Button>:<p>家人发布后，你就能在这里看见。</p>}</section>}
    <div className="home-editorial-grid"><div><section aria-labelledby="recent-memories"><div className="home-section-heading"><div><h2 id="recent-memories">最近留下的片刻</h2><p>生活的小事，也有值得记住的部分。</p></div><button className="text-link" onClick={()=>navigate('library')}>全部记忆 <Icon name="arrow" size={16}/></button></div><div className="memory-grid home-memory-grid">{state.memories.slice(0,3).map(m=><MemoryCard key={m.id} memory={m} onOpen={open} onFavorite={state.canEdit?favorite:undefined}/>)}{!state.memories.length&&<Empty title="还没有记录" description="不需要一篇完整的故事，从一句话开始就好。"/>}</div></section>
      <section className="home-revisit"><div><h2>沿着一个人的故事，慢慢看</h2><p>从家人出发，把分散的片刻连起来。</p></div><div className="home-person-list">{state.members.map(m=><button key={m.id} onClick={()=>navigate('growth',m.id)}><Avatar name={m.name} color={m.color||'sage'}/><span><strong>{m.name}</strong><small>{m.relation||'家人'}</small></span><Icon name="arrow" size={16}/></button>)}</div></section>
    </div><aside className="home-notes">
      {state.canEdit&&<section className="home-prompt"><Icon name="mic" size={24}/><h2>今天，聊聊这个</h2><p>{question}</p><Button variant="secondary" icon="plus" onClick={()=>setModal({type:'upload',starter:{question}})}>记下我的回答</Button><small>可以写下来，也可以录一段原声。</small></section>}
      {state.canEdit&&pending.length>0&&<button className="home-pending" onClick={onPending}><Icon name="check"/><span><strong>{pending.length} 段记忆等待核对</strong><small>确认后，家人就能看见。</small></span><Icon name="arrow" size={16}/></button>}
      <section className="home-updates"><div className="home-section-heading"><h2>家人的新回应</h2></div>{recent.length?recent.map(a=><button className="home-update" key={a.id} onClick={()=>{const m=state.memories.find(m=>m.id===a.memoryId);if(m)open(m);}}><Avatar name={a.actorName||'家人'}/><span><strong>{a.actorName||'家人'}</strong><p>{a.comment||a.text}</p><small>{formatDate(a.createdAt)}</small></span></button>):<p className="muted">家人留下的回应会出现在这里。打开一段回忆，先说一句“我也记得”。</p>}</section>
      {state.anniversaries.length>0&&<section className="home-days"><h2>值得记住的日子</h2>{state.anniversaries.slice(0,2).map(a=><button key={a.id} onClick={()=>navigate('family')}><Icon name="calendar"/><span>{a.title}<small>{Number(a.date.split('-')[0])} 月 {Number(a.date.split('-')[1])} 日</small></span></button>)}</section>}
    </aside></div>
  </div>;
}
