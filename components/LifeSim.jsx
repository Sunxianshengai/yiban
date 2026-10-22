'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icon';
import {Button,Cover,Empty} from './UI';

// 人生推演 · L3 对话式
//
// 和旧版「七段线性选择题」的区别，写在界面上给人看：
//  1. 起点是一段真实的、已确认的记忆，从这里往后走「如果」。
//  2. 每一幕都由模型现写；除了三个预设选项，你还可以自己写「我想……」。
//  3. 属性会随选择漂移，也反过来影响后面能走的路，所以同一段记忆两遍不一样。
//
// 这一版不提供本地兜底：模型没接上就直接说没接上，不拿模板冒充一个人的一生。

const AXIS_HINT={往外走:'你更敢走出去',往里收:'你更愿意留下来',停在中间:'两头都放不下'};

export default function LifeSim({api,onBack,onOpenMemory,aiReady}) {
  const [loading,setLoading]=useState(true);
  const [origins,setOrigins]=useState([]);
  const [meta,setMeta]=useState({});
  const [run,setRun]=useState(null);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [pick,setPick]=useState('');
  // 能不能玩，以服务端为准：state.aiEnabled 只看 AI_API_URL/AI_API_KEY/AI_MODEL，
  // 而模型也可以用 AI_PROVIDER 预设（DEEPSEEK_API_KEY / DASHSCOPE_API_KEY）配好，
  // 那种情况下 /state 会说没配置、实际却能跑。所以以 /life/subjects 的 aiReady 覆盖它。
  const [ready,setReady]=useState(Boolean(aiReady));
  const feedRef=useRef(null);

  useEffect(()=>{
    let alive=true;
    api('/life/subjects',{method:'POST',body:JSON.stringify({})})
      .then(data=>{
        if(!alive)return;
        setOrigins(data.origins||[]);
        setMeta(data.stats||{});
        if(typeof data.aiReady==='boolean')setReady(data.aiReady);
      })
      .catch(e=>{if(alive)setError(e.message);})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[api]);

  useEffect(()=>{
    const node=feedRef.current;
    if(node)node.scrollTop=node.scrollHeight;
  },[run?.stageIndex,run?.status]);

  const start=useCallback(async memoryId=>{
    if(busy)return;
    setBusy(true);setError('');setText('');
    try{
      const started=await api('/life/start',{method:'POST',body:JSON.stringify({memoryId})});
      setRun(started);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[api,busy]);

  const answer=useCallback(async input=>{
    if(!run||busy)return;
    setBusy(true);setError('');
    try{
      const result=await api('/life/turn',{method:'POST',body:JSON.stringify({runId:run.id,...input})});
      setRun(result);
      setText('');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[api,busy,run]);

  const reset=()=>{setRun(null);setText('');setError('');setPick('');};

  const stage=useMemo(()=>{
    if(!run)return null;
    const list=run.stages||[];
    return list[list.length-1]||null;
  },[run]);

  const finished=run?.status==='finished';

  if(loading) {
    return <div className="life-loading"><Icon name="sparkle" size={26}/><p>正在看看家里有哪些可以出发的地方…</p></div>;
  }

  // ── 开场：选一段记忆当起点 ────────────────────────────────
  if(!run) {
    return (
      <div className="life-shell">
        <header className="life-top">
          <button className="life-back" onClick={onBack} aria-label="回到记忆小屋"><Icon name="back" size={18}/></button>
          <div>
            <span className="eyebrow">A LIFE, REIMAGINED</span>
            <h1>从一段记忆，往后走一生</h1>
            <p>挑一段家里真实发生过的记忆当起点。从那一刻起，往后的每一步都是「如果」。</p>
          </div>
        </header>

        {!ready&&<div className="life-notice warn"><Icon name="info" size={18}/><span>还没有配置模型。这个模拟完全由模型现写，配好 AI_API_KEY 之后才能开始。</span></div>}

        {error&&<div className="life-notice warn"><Icon name="info" size={18}/><span>{error}</span></div>}

        {origins.length?<>
          <div className="life-origin-filter">
            <input value={pick} onChange={e=>setPick(e.target.value)} placeholder="搜年份、地点或一句话…" aria-label="筛选起点记忆"/>
            <span>{possibles(origins,pick).length} 段可以出发</span>
          </div>
          <div className="life-origin-grid">
            {possibles(origins,pick).map(memory=>(
              <button key={memory.id} className="life-origin" disabled={busy} onClick={()=>start(memory.id)}>
                <span className="life-origin-cover"><Cover memory={memory}/></span>
                <span className="life-origin-body">
                  <span className="life-origin-year">{memory.year||'年代不详'}{memory.location?` · ${memory.location}`:''}</span>
                  <strong>{memory.title||'没有标题的记忆'}</strong>
                  <span className="life-origin-excerpt">{memory.excerpt||'这段记忆还没有正文。'}</span>
                </span>
                <span className="life-origin-go"><Icon name="arrow" size={16}/></span>
              </button>
            ))}
          </div>
        </>:<Empty icon="sparkle" title="还没有可以出发的记忆" description="人生推演只从「已确认」的记忆开始。先去记忆库确认一段，再回来走这一生。"/>}

        <p className="life-footnote">推演出来的事都不是真的发生过的事。真实的那一段，一直在记忆库里等你回去。</p>
      </div>
    );
  }

  // ── 推演中 ───────────────────────────────────────────────
  return (
    <div className="life-shell">
      <header className="life-top">
        <button className="life-back" onClick={reset} aria-label="重新选一段记忆"><Icon name="back" size={18}/></button>
        <div>
          <span className="eyebrow">{run.origin?.year||'某一年'}{run.origin?.location?` · ${run.origin.location}`:''}</span>
          <h1>{run.subjectName}的另一种人生</h1>
          <p>起点是「{run.origin?.title||'那段记忆'}」。往后每一步都是如果，不是他/她真的走过的路。</p>
        </div>
        <span className="life-counter">第 {(run.stageIndex||0)+ (finished?0:1)} 幕</span>
      </header>

      <div className="life-grid">
        <aside className="life-side">
          <h2><Icon name="sparkle" size={17}/>此刻的属性</h2>
          <p className="life-axis">{AXIS_HINT[run.axes?.label]||'正在成形'}<span>{run.axes?.balance ?? 50}%</span></p>
          <div className="life-axis-bar"><span style={{width:`${run.axes?.balance ?? 50}%`}}/></div>
          <ul className="life-stats">
            {Object.keys(run.stats||{}).map(key=>{
              const info=meta[key]||{};
              const value=run.stats?.[key]??0;
              return (
                <li key={key} title={info.hint||''}>
                  <span className={`life-stat-dot ${info.color||'sage'}`}/>
                  <span className="life-stat-name">{info.label||key}</span>
                  <span className="life-stat-bar"><span style={{width:`${Math.min(100,(value/20)*100)}%`}}/></span>
                  <span className="life-stat-value">{value}</span>
                </li>
              );
            })}
          </ul>
          <p className="life-side-note">属性不是分数，是这个人在这一局里慢慢偏向哪一边。</p>
          {onOpenMemory&&run.origin?.memoryId&&<Button variant="secondary" icon="library" onClick={()=>onOpenMemory(run.origin.memoryId)}>看真实的那一段</Button>}
        </aside>

        <section className="life-main">
          <div className="life-feed" ref={feedRef}>
            {(run.stages||[]).map(item=>(
              <div className="life-turn" key={item.index}>
                <div className="life-narration">
                  <span className="life-tag">第 {item.index+1} 幕</span>
                  <p>{item.narration}</p>
                </div>
                {item.answer&&(
                  <div className="life-mine">
                    <span className="life-tag">你选了</span>
                    <p>{item.answer.label}{item.answer.freeText?'（自己写的）':''}</p>
                  </div>
                )}
              </div>
            ))}

            {finished&&run.ending&&(
              <div className="life-ending">
                <h3><Icon name="leaf" size={18}/>这一生走到了这里</h3>
                <p>{run.ending.text}</p>
                <p className="life-disclaimer">{run.ending.disclaimer}</p>
                <div className="life-ending-actions">
                  <Button icon="repeat" onClick={reset}>再走一生</Button>
                  {onOpenMemory&&run.origin?.memoryId&&<Button variant="secondary" icon="library" onClick={()=>onOpenMemory(run.origin.memoryId)}>回到真实的那一段</Button>}
                </div>
              </div>
            )}
          </div>

          {error&&<div className="life-notice warn"><Icon name="info" size={18}/><span>{error}</span></div>}

          {!finished&&stage&&(
            <div className="life-choices">
              <p className="life-prompt">{busy?'正在写下一幕…':'此刻你会怎么做？'}</p>
              <div className="life-choice-row">
                {(stage.choices||[]).map(choice=>(
                  <button key={choice.id} className="life-choice" disabled={busy} onClick={()=>answer({choiceId:choice.id})}>
                    <strong>{choice.label}</strong>
                    {choice.hint&&<span>{choice.hint}</span>}
                  </button>
                ))}
              </div>
              <div className="life-free">
                <input value={text} maxLength={200} disabled={busy}
                  onChange={e=>setText(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&text.trim())answer({text:text.trim()});}}
                  placeholder="或者，写一句你此刻真正想做 / 想说的话…"/>
                {/* Button 会把 disabled 透传到原生按钮上，所以把两种禁用条件都写在这里：
                    正在等模型时不能重复提交，没写字时也没东西可提交。 */}
                <Button icon="arrow" busy={busy} disabled={busy||!text.trim()} onClick={()=>{if(text.trim())answer({text:text.trim()});}}>就这样做</Button>
              </div>
              <p className="life-footnote">幕数不设死，模型会在这个人的人生该收尾的时候收住。所有推演都不是事实。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function possibles(list,query) {
  const word=String(query||'').trim().toLowerCase();
  if(!word)return list;
  return list.filter(memory=>`${memory.year||''} ${memory.location||''} ${memory.title||''} ${memory.excerpt||''} ${(memory.people||[]).join(' ')}`.toLowerCase().includes(word));
}
