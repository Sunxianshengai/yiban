'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button} from './UI';

// 人生模拟 · 文字对话版
//
// 界面上的三条承诺（都要在文案里显式写出来，不能只存在于代码注释里）：
//  1. 剧本来自家庭记忆库：每一段场景都标出它取自哪一年、哪段记忆。
//  2. 选择是「如果」：选项不评优劣，落地后立刻回扣「真实发生的是……」。
//  3. 结尾的倾向小结不是评价谁：它只是把这一路的岔路口数一数。
//
// 对话式呈现：每一次推进都在消息流里追加一条「场景」+ 你的「选择」+ 「真实的那条线」，
// 让人能一路读回自己走过的路。

export default function LifeGame({api,notify,close,onOpenMemory}) {
  const [loading,setLoading]=useState(true);
  const [subjects,setSubjects]=useState([]);
  const [canPlay,setCanPlay]=useState(false);
  const [aiEnabled,setAiEnabled]=useState(false);
  const [game,setGame]=useState(null);
  const [reveals,setReveals]=useState([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const feedRef=useRef(null);

  useEffect(()=>{
    let alive=true;
    api('/game/subjects').then(data=>{
      if(!alive)return;
      setSubjects(data.subjects||[]);setCanPlay(Boolean(data.canPlay));setAiEnabled(Boolean(data.aiEnabled));
    }).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[api]);

  // 新消息进流后滚到底部，让人自然接着读。
  useEffect(()=>{
    const node=feedRef.current;
    if(node)node.scrollTop=node.scrollHeight;
  },[game?.sceneIndex,reveals.length]);

  const start=useCallback(async subjectId=>{
    setBusy(true);setError('');
    try{
      const started=await api('/game/start',{method:'POST',body:JSON.stringify({subjectId})});
      setGame(started);setReveals([]);setText('');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[api]);

  const answer=useCallback(async input=>{
    if(!game||busy)return;
    setBusy(true);setError('');
    try{
      const result=await api('/game/turn',{method:'POST',body:JSON.stringify({gameId:game.id,...input})});
      setReveals(list=>[...list,result.reveal]);
      setGame(result);setText('');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  },[api,game,busy]);

  const restart=()=>{setGame(null);setReveals([]);setText('');setError('');};

  if(loading)return <div className="game-loading"><span className="spinner"/><p>正在翻开家里的记忆…</p></div>;

  // 开局：选一位家人当主角（可以选自己，也可以选别人）
  if(!game) {
    return <div className="life-game">
      <div className="game-intro">
        <h3>用家里的记忆，走一段人生</h3>
        <p>每一段岔路都取自家人已经确认的记忆。你替 TA 做的选择只是「如果」，走完会告诉你真实的模样。</p>
      </div>
      {!canPlay&&<div className="inline-notice"><Icon name="info"/><span>还没有已确认的记忆。先到记忆库发布一段，再来走这条路。</span></div>}
      {error&&<p className="form-error"><Icon name="info" size={15}/>{error}</p>}
      <div className="subject-grid">
        {subjects.map(subject=><button key={subject.id} className="subject-card" disabled={busy||!subject.count} onClick={()=>start(subject.id)}>
          <Avatar name={subject.name} color="sage" size="avatar-lg"/>
          <strong>{subject.name}</strong>
          <small>{subject.relation} · {subject.count} 段记忆</small>
        </button>)}
      </div>
      {subjects.length>0&&<p className="game-footnote">{aiEnabled?'场景由模型润色，事实仍只来自记忆原文。':'当前为本地场景模式，不调用模型，事实只来自记忆原文。'}</p>}
      <div className="modal-actions"><Button variant="ghost" onClick={close}>先不玩</Button></div>
    </div>;
  }

  const finished=game.status==='finished';
  const scene=game.scenes?.[game.sceneIndex]||null;
  const played=game.scenes?.slice(0,game.sceneIndex)||[];

  return <div className="life-game">
    <header className="game-head">
      <div>
        <h3>{game.title}</h3>
        <p>第 {Math.min(game.sceneIndex+1,game.scenes.length)} / {game.scenes.length} 段 · {game.mode==='model'?'模型润色':'本地场景'}</p>
      </div>
      <button className="text-link" onClick={restart}>换一位家人<Icon name="arrow" size={15}/></button>
    </header>

    <div className="game-feed" ref={feedRef}>
      {played.map((item,index)=><div className="game-turn" key={`${item.memoryId}-${index}`}>
        <div className="game-line memory"><span className="game-tag">{item.year||'那年'} · {item.theme}</span><p>{item.narration}</p><em>{item.situation}</em></div>
        <div className="game-line mine"><span className="game-tag">你替 TA 选了</span><p>{game.answers[index]?.label}</p></div>
        {reveals[index]&&<div className="game-line truth"><span className="game-tag"><Icon name="check" size={13}/>真实发生的是</span><p>{reveals[index].truth}</p>{onOpenMemory&&<button className="text-link" onClick={()=>onOpenMemory(reveals[index].memoryId)}>打开这段记忆<Icon name="arrow" size={14}/></button>}</div>}
      </div>)}
      {!finished&&scene&&<div className="game-turn current">
        <div className="game-line memory"><span className="game-tag">{scene.year||'那年'} · {scene.theme} · {scene.title}</span><p>{scene.narration}</p><em>{scene.situation}</em></div>
      </div>}
      {finished&&game.summary&&<div className="game-summary">
        <h4><Icon name="sparkle" size={18}/>这一路走下来</h4>
        <div className="trait-bars">{game.summary.ranked.map(item=><div key={item.trait} className="trait-bar"><span>{item.trait}</span><i><b className={item.color} style={{width:`${Math.min(100,(item.value/Math.max(1,game.summary.ranked[0].value))*100)}%`}}/></i><em>{item.value}</em></div>)}</div>
        <p>{game.summary.text}</p>
      </div>}
    </div>

    {error&&<p className="form-error"><Icon name="info" size={15}/>{error}</p>}

    {!finished&&scene&&<div className="game-choices">
      <p className="game-prompt">如果是你，你会怎么做？</p>
      <div className="choice-list">{scene.choices.map(choice=><button key={choice.id} disabled={busy} onClick={()=>answer({choiceId:choice.id})}>{choice.label}</button>)}</div>
      {scene.allowFreeText&&<div className="free-input">
        <input value={text} onChange={e=>setText(e.target.value)} maxLength={300} placeholder="也可以写一句你会怎么做…" aria-label="说一句你自己的选择" onKeyDown={e=>{if(e.key==='Enter'&&text.trim())answer({text});}}/>
        <Button variant="secondary" busy={busy} disabled={!text.trim()} onClick={()=>answer({text})}>就这样</Button>
      </div>}
    </div>}

    <div className="modal-actions">
      {finished?<><Button variant="secondary" onClick={restart}>再走一遍别人的路</Button><Button onClick={close}>回到记忆小屋</Button></>
        :<Button variant="ghost" onClick={close}>先离开</Button>}
    </div>
  </div>;
}

// 「这段记忆里有什么岔路」在记忆详情页也能直接开一局，所以单独暴露一个入口块。
export function GameEntry({onPlay}) {
  return <section className="game-entry">
    <div><span className="colored-icon"><Icon name="sparkle" size={20}/></span><div><strong>走一段人生模拟</strong><p>用家里的记忆当剧本，站在当年那个人的位置上做选择。</p></div></div>
    <Button variant="secondary" icon="play" onClick={onPlay}>开始模拟</Button>
  </section>;
}
