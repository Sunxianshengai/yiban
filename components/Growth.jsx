'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Cover,Empty,Field} from './UI';

// 全年龄段的核心页：一个人的一辈子怎么排、家里人在同一年各几岁。
// 六个页签对应方案里的 A(时间轴) E(平行时间轴) B(里程碑) C(童言童语) H(成长对比) D(分龄采访) J(纪念册)。
const TABS=[{id:'timeline',label:'成长时间轴',icon:'clock'},{id:'parallel',label:'那一年',icon:'people'},{id:'milestones',label:'人生里程碑',icon:'check'},{id:'quotes',label:'童言童语',icon:'message'},{id:'growth',label:'成长对比',icon:'arrow'},{id:'interview',label:'分龄采访',icon:'mic'},{id:'yearbook',label:'成长纪念册',icon:'book'}];

export default function Growth({api,notify,members,canEdit,onOpenMemory}) {
  const [tab,setTab]=useState('timeline');
  const [meta,setMeta]=useState(null);
  const [memberId,setMemberId]=useState('');
  const [timeline,setTimeline]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{api('/stage/meta').then(setMeta).catch(e=>notify(e.message,'error'));},[]);
  useEffect(()=>{if(!memberId&&members.length)setMemberId(members[0].id);},[members]);
  useEffect(()=>{
    if(tab!=='timeline'||!memberId)return;
    setLoading(true);
    api(`/stage/timeline?memberId=${encodeURIComponent(memberId)}`).then(setTimeline).catch(e=>notify(e.message,'error')).finally(()=>setLoading(false));
  },[tab,memberId]);

  const member=members.find(m=>m.id===memberId);
  const stageOf=(id)=>meta?.stages?.find(s=>s.id===id);

  return <div className="growth-page">
    <div className="page-heading"><div><span className="eyebrow">GROWING UP, TOGETHER</span><h1>成长时光</h1><p>家里每个人，从出生到现在，一条自己的时间线。</p></div></div>
    <div className="growth-tabs">{TABS.map(t=><button key={t.id} className={tab===t.id?'selected':''} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={17}/>{t.label}</button>)}</div>
    <div className="growth-picker">
      <span>看谁的人生</span>
      <div className="person-chips">
        {members.map(m=><button key={m.id} className={memberId===m.id?'selected':''} onClick={()=>setMemberId(m.id)}><Avatar name={m.name} color={m.color||'sage'}/>{m.name}<small>{m.birthYear?`${m.birthYear}年生`:'未填出生年'}</small></button>)}
        {!members.length&&<Empty icon="people" title="还没有家人" description="先到「我的家人」里添加一位，才能排时间轴。"/>}
      </div>
    </div>

    {tab==='timeline'&&<TimelineView member={member} timeline={timeline} loading={loading} stageOf={stageOf} onOpenMemory={onOpenMemory} canEdit={canEdit} api={api} notify={notify}/>}
    {tab==='parallel'&&<ParallelView api={api} notify={notify} members={members} stageOf={stageOf} onOpenMemory={onOpenMemory}/>}
    {tab==='milestones'&&<MilestonesView api={api} notify={notify} member={member} meta={meta} canEdit={canEdit}/>}
    {tab==='quotes'&&<QuotesView api={api} notify={notify} member={member} members={members} canEdit={canEdit}/>}
    {tab==='growth'&&<GrowthAnswers api={api} notify={notify} member={member} meta={meta} canEdit={canEdit}/>}
    {tab==='interview'&&<InterviewView api={api} notify={notify} member={member} meta={meta}/>}
    {tab==='yearbook'&&<YearbookView member={member} timeline={timeline} api={api} notify={notify} stageOf={stageOf}/>}
  </div>;
}

function TimelineView({member,timeline,loading,stageOf,onOpenMemory,canEdit,api,notify}) {
  if(loading)return <div className="growth-loading"><span className="spinner"/></div>;
  if(!member)return <Empty icon="people" title="先选一位家人" description="选了人才能排出他的人生时间线。"/>;
  if(!member.birthYear)return <Empty icon="info" title={`${member.name} 还没有出生年份`} description="填上出生年份，系统才能算出「那一年他几岁、属于哪个人生阶段」。" ><HintBirthYear member={member} api={api} notify={notify} canEdit={canEdit}/></Empty>;
  const items=timeline?.items||[];
  if(!items.length)return <Empty icon="clock" title="还没有能排进时间轴的记忆" description="给这段记忆填上年份，并确认发布，它就会出现在这里。"/>;

  let lastStage=null;
  return <div className="timeline-rail">
    <div className="timeline-summary">
      <strong>{items.length}</strong><span>段记忆 · 从 {items[0].year} 到 {items.at(-1).year}</span>
      {timeline?.missingStages?.length>0&&<em>还缺 {timeline.missingStages.map(id=>stageOf(id)?.label).filter(Boolean).join('、')}</em>}
    </div>
    {items.map(item=>{
      const stage=stageOf(item.stage);
      const heading=stage&&stage.id!==lastStage?stage:null;
      lastStage=stage?.id||lastStage;
      return <div className="rail-row" key={item.memoryId}>
        {heading&&<div className="rail-stage" data-color={heading.color}><span/><strong>{heading.label}</strong><small>{heading.hint}</small></div>}
        <button className="rail-item" onClick={()=>onOpenMemory(item.memoryId)}>
          <span className="rail-year">{item.year}</span>
          <span className="rail-dot" data-color={stage?.color||'sage'}/>
          <span className="rail-cover"><Cover memory={{cover:item.cover,title:item.title}}/></span>
          <span className="rail-copy"><strong>{item.title}</strong><small>{item.age!==null?`${item.age} 岁 · `:''}{item.theme}</small></span>
          <Icon name="arrow" size={16}/>
        </button>
      </div>;
    })}
  </div>;
}

function HintBirthYear({member,api,notify,canEdit}) {
  const [year,setYear]=useState('');
  if(!canEdit)return <p className="muted">需要编辑者权限才能补填。</p>;
  const save=async()=>{
    if(!/^(19|20)\d{2}$/.test(year)){notify('请填四位出生年份，例如 1990','error');return;}
    try{await api('/members/'+member.id,{method:'PATCH',body:JSON.stringify({birthYear:year})});notify('已记下出生年份');}catch(e){notify(e.message,'error');}
  };
  return <div className="inline-form"><input value={year} onChange={e=>setYear(e.target.value)} placeholder="例如 1990" maxLength={4}/><Button onClick={save}>记下</Button></div>;
}

function ParallelView({api,notify,members,stageOf,onOpenMemory}) {
  const [year,setYear]=useState(String(new Date().getFullYear()-10));
  const [data,setData]=useState(null);
  const [busy,setBusy]=useState(false);
  const load=async()=>{
    if(!/^\d{4}$/.test(year)){notify('请输入四位年份','error');return;}
    setBusy(true);try{setData(await api(`/stage/parallel?year=${year}`));}catch(e){notify(e.message,'error');}finally{setBusy(false);}
  };
  useEffect(()=>{load();},[]);
  const rows=data?.rows||[];
  const withBirth=members.filter(m=>m.birthYear).length;
  return <div>
    <div className="parallel-bar"><Field label="选一个年份"><input value={year} onChange={e=>setYear(e.target.value)} maxLength={4} placeholder="例如 1998"/></Field><Button icon="search" busy={busy} onClick={load}>看那一年</Button></div>
    {withBirth<2&&<div className="inline-notice"><Icon name="info"/><span>家庭平行时间轴需要至少两位家人填了出生年份，现在只有 {withBirth} 位。去「我的家人」补上，这张表才有意义。</span></div>}
    {data&&!rows.length&&<Empty icon="people" title={`${data.year} 年，家里还没有人`} description="选一个家人已经出生的年份试试。"/>}
    {rows.length>0&&<div className="parallel-grid">
      {rows.map(row=>{
        const stage=stageOf(row.stage);
        return <article className="parallel-card" key={row.memberId} data-color={stage?.color||'sage'}>
          <header><Avatar name={row.name} color="sage"/><div><strong>{row.name}</strong><small>{row.relation}</small></div><span className="parallel-age">{row.age}<em>岁</em></span></header>
          <p className="parallel-stage">{stage?.label||''}</p>
          {row.memories.length?<div className="parallel-memories">{row.memories.map(m=><button key={m.id} onClick={()=>onOpenMemory(m.id)}><Cover memory={{cover:m.cover,title:m.title}}/><span>{m.title}</span></button>)}</div>:<p className="muted">这一年还没有记下的事</p>}
        </article>;
      })}
      <p className="parallel-read">{data.year} 年：{rows.map(r=>`${r.name} ${r.age} 岁`).join('，')}。</p>
    </div>}
  </div>;
}

function MilestonesView({api,notify,member,meta,canEdit}) {
  const [progress,setProgress]=useState(null);
  useEffect(()=>{
    if(!member)return;
    api(`/stage/milestones?memberId=${encodeURIComponent(member.id)}`).then(setProgress).catch(e=>notify(e.message,'error'));
  },[member]);
  if(!member)return <Empty icon="people" title="先选一位家人" description="里程碑是记在人身上的。"/>;
  if(!progress)return <div className="growth-loading"><span className="spinner"/></div>;
  const toggle=async(m)=>{
    if(!canEdit){notify('需要编辑者权限才能勾选里程碑','error');return;}
    try{setProgress(await api('/stage/milestones',{method:'POST',body:JSON.stringify({memberId:member.id,key:m.key,done:!m.done})}));}
    catch(e){notify(e.message,'error');}
  };
  const byStage=(meta?.stages||[]).map(s=>({stage:s,list:progress.list.filter(m=>m.stage===s.id)})).filter(g=>g.list.length);
  return <div>
    <div className="milestone-head"><div><strong>{progress.done} / {progress.total}</strong><span>已经记下的人生节点</span></div><div className="milestone-bar"><i style={{width:`${Math.round(progress.done/progress.total*100)}%`}}/></div></div>
    {byStage.map(group=><section className="milestone-group" key={group.stage.id} data-color={group.stage.color}>
      <h3><Icon name="check" size={16}/>{group.stage.label}<small>{group.stage.hint}</small></h3>
      <div className="milestone-list">{group.list.map(m=><button key={m.key} className={m.done?'done':''} onClick={()=>toggle(m)} disabled={!canEdit}><span className="milestone-box"><Icon name="check" size={13}/></span>{m.label}</button>)}</div>
    </section>)}
  </div>;
}

function QuotesView({api,notify,member,members,canEdit}) {
  const [quotes,setQuotes]=useState([]);
  const [text,setText]=useState('');
  const [age,setAge]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>{if(!member)return;api(`/stage/quotes?memberId=${encodeURIComponent(member.id)}`).then(d=>setQuotes(d.quotes||[])).catch(e=>notify(e.message,'error'));};
  useEffect(load,[member]);
  if(!member)return <Empty icon="people" title="先选一位家人" description="童言童语是记在人身上的。"/>;
  const save=async()=>{
    if(!canEdit){notify('需要编辑者权限','error');return;}
    if(!text.trim())return;
    setBusy(true);
    try{await api('/stage/quotes',{method:'POST',body:JSON.stringify({text,memberId:member.id,age:age?Number(age):null})});setText('');setAge('');notify('记下了这句话');load();}
    catch(e){notify(e.message,'error');}finally{setBusy(false);}
  };
  return <div className="quotes-view">
    {/* 录入成本必须 ≤3 秒：一句话 + 年龄，别的都不要填。 */}
    <div className="quote-capture"><Field label={`${member.name} 说了什么`} hint="三秒记下来就好，不必讲究句子好不好看。"><textarea rows={2} value={text} onChange={e=>setText(e.target.value)} maxLength={300} placeholder="例如：妈妈是世界上最好看的人"/></Field><Field label="当时几岁"><input value={age} onChange={e=>setAge(e.target.value)} maxLength={3} placeholder="选填"/></Field><Button icon="plus" busy={busy} onClick={save}>记下这一句</Button></div>
    <div className="quote-list">{quotes.map(q=><article className="quote-card" key={q.id}><Icon name="message" size={18}/><p>{q.text}</p><footer><span>{q.age!==null?`${q.age} 岁 · `:''}{q.year} 年</span>{canEdit&&<button className="icon-button" aria-label="删除这句话" onClick={async()=>{try{await api(`/quotes/${q.id}`,{method:'DELETE'});load();}catch(e){notify(e.message,'error');}}}><Icon name="trash" size={15}/></button>}</footer></article>)}
    {!quotes.length&&<Empty icon="message" title="还没有记下什么话" description="孩子随口说的一句，过两年就再也想不起来了。"/>}</div>
  </div>;
}

function GrowthAnswers({api,notify,member,meta,canEdit}) {
  const [answers,setAnswers]=useState([]);
  const [key,setKey]=useState('place');
  const [answer,setAnswer]=useState('');
  const [busy,setBusy]=useState(false);
  const load=()=>{if(!member)return;api(`/stage/answers?memberId=${encodeURIComponent(member.id)}`).then(d=>setAnswers(d.answers||[])).catch(e=>notify(e.message,'error'));};
  useEffect(load,[member]);
  if(!member)return <Empty icon="people" title="先选一位家人" description="同一个问题，不同年份问同一个人。"/>;
  const questions=meta?.growthQuestions||[];
  const save=async()=>{
    if(!canEdit){notify('需要编辑者权限','error');return;}
    if(!answer.trim())return;
    setBusy(true);
    try{await api('/stage/answers',{method:'POST',body:JSON.stringify({memberId:member.id,key,answer})});setAnswer('');notify('答案已记下');load();}
    catch(e){notify(e.message,'error');}finally{setBusy(false);}
  };
  const grouped=questions.map(q=>({q,rows:answers.filter(a=>a.key===q.key)}));
  return <div>
    <div className="growth-ask"><Field label="问哪一个问题"><select value={key} onChange={e=>setKey(e.target.value)}>{questions.map(q=><option key={q.key} value={q.key}>{q.label}</option>)}</select></Field><Field label={`${member.name} 现在的答案`}><input value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={300} placeholder="写下他现在怎么回答"/></Field><Button icon="check" busy={busy} onClick={save}>记下这一年的答案</Button></div>
    {grouped.filter(g=>g.rows.length).map(g=><section className="growth-compare" key={g.q.key}>
      <h3>{g.q.label}</h3>
      <div className="compare-row">{g.rows.map(a=><article key={a.id}><span className="compare-year">{a.year}</span><p>{a.answer}</p></article>)}</div>
    </section>)}
    {!answers.length&&<Empty icon="arrow" title="还没有对比" description="同一个问题隔几年再问一次，答案并排放在一起，就是成长。"/>}
  </div>;
}

function InterviewView({api,notify,member,meta}) {
  const [stageId,setStageId]=useState('');
  const [questions,setQuestions]=useState([]);
  const [copied,setCopied]=useState(null);
  useEffect(()=>{
    const id=stageId||meta?.stages?.find(s=>s.id==='elder')?.id||'';
    if(!id)return;
    api(`/stage/interview?stage=${encodeURIComponent(id)}`).then(d=>setQuestions(d.questions||[])).catch(e=>notify(e.message,'error'));
  },[stageId,meta]);
  const copy=async(text,index)=>{
    try{await navigator.clipboard.writeText(`${member?.name?`${member.name}，`:''}${text}`);setCopied(index);setTimeout(()=>setCopied(null),2000);}
    catch{notify('浏览器不让复制，手动选中文字即可','error');}
  };
  return <div className="interview-view">
    <div className="inline-notice"><Icon name="mic"/><span>问什么样的问题，决定了能听到什么样的故事。按他现在的人生阶段挑，别用同一套问所有人。</span></div>
    <Field label="他在哪个人生阶段"><select value={stageId} onChange={e=>setStageId(e.target.value)}>{(meta?.stages||[]).map(s=><option key={s.id} value={s.id}>{s.label}{s.hint?` · ${s.hint}`:''}</option>)}</select></Field>
    <div className="interview-list">{questions.map((q,i)=><article className="interview-card" key={i}><p>{q}</p><button className="text-link" onClick={()=>copy(q,i)}><Icon name={copied===i?'check':'edit'} size={14}/>{copied===i?'已复制':'复制这一问'}</button></article>)}</div>
  </div>;
}

function YearbookView({member,timeline,api,notify,stageOf}) {
  const [pick,setPick]=useState([]);
  const [making,setMaking]=useState(false);
  const [story,setStory]=useState('');
  const items=(timeline?.items||[]).filter(i=>pick.includes(i.memoryId));
  const make=async()=>{
    if(!items.length){notify('先挑几段记忆','error');return;}
    setMaking(true);
    try{
      const result=await api('/story',{method:'POST',body:JSON.stringify({memoryIds:items.map(i=>i.memoryId),title:`${member?.name}的成长纪念册`})});
      setStory(result.story||'');
    }catch(e){notify(e.message,'error');}finally{setMaking(false);}
  };
  return <div className="yearbook">
    <div className="inline-notice"><Icon name="book"/><span>挑几段记忆，串成一本可以打印的成长纪念册。写完用浏览器「打印 → 存为 PDF」就能带走或付印。</span></div>
    <div className="yearbook-pick">{(timeline?.items||[]).map(item=>{
      const stage=stageOf(item.stage);
      return <button key={item.memoryId} className={pick.includes(item.memoryId)?'selected':''} onClick={()=>setPick(ids=>ids.includes(item.memoryId)?ids.filter(x=>x!==item.memoryId):[...ids,item.memoryId])}>
        <Cover memory={{cover:item.cover,title:item.title}}/><span><strong>{item.title}</strong><small>{item.year}{item.age!==null?` · ${item.age} 岁`:''}{stage?` · ${stage.label}`:''}</small></span>
      </button>;})}
      {!(timeline?.items||[]).length&&<Empty icon="clock" title="这个人还没有能排进纪念册的记忆" description="先到时间轴页签里确认几段带年份的记忆。"/>}
    </div>
    <div className="yearbook-actions"><Button variant="secondary" icon="book" busy={making} onClick={make}>串成纪念册（已选 {pick.length} 段）</Button>{story&&<Button icon="download" onClick={()=>window.print()}>打印 / 存为 PDF</Button>}</div>
    {story&&<article className="yearbook-paper"><h1>{member?.name}的成长纪念册</h1><p className="yearbook-sub">{timeline?.items?.length?`${items[0]?.year} — ${items.at(-1)?.year}`:''}</p><div className="yearbook-body">{story.split(/\n+/).filter(Boolean).map((p,i)=><p key={i}>{p}</p>)}</div><footer>这些片段由家人保存并核对，是真实发生过的事。</footer></article>}
  </div>;
}
