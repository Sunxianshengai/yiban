'use client';
import {useEffect,useRef} from 'react';
import Icon from './Icon';
import NextImage from 'next/image';
import {exampleCover} from '../lib/preview-assets.mjs';
export function Button({children,icon,variant='primary',className='',busy=false,...props}) {
  return <button className={`btn btn-${variant} ${className}`} disabled={busy||props.disabled} {...props}>{busy?<span className="spinner"/>:icon?<Icon name={icon}/>:null}{children}</button>;
}
export function Empty({icon='library',title='还没有内容',description,children}) {
  return <div className="empty"><span className="empty-icon"><Icon name={icon} size={34}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function Modal({title,description,children,onClose,wide=false,page=false,backLabel='返回'}) {
  const ref=useRef(null);const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const old=document.activeElement;
    const panel=ref.current;
    const first=panel?.querySelector('button, input, textarea, select');first?.focus();
    const handle=e=>{
      if(e.key==='Escape')closeRef.current();
      if(e.key==='Tab'){
        const items=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    document.addEventListener('keydown',handle);
    return ()=>{document.removeEventListener('keydown',handle);document.body.style.overflow=overflow;old?.focus();};
  },[title]);
  return <div className={`modal-backdrop ${page?'pw-page-modal':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}><header className="modal-heading">{page?<button className="pw-page-back" aria-label={backLabel} onClick={onClose}><Icon name="back"/><span>{backLabel}</span></button>:<div><h2>{title}</h2>{description&&<p>{description}</p>}</div>}<button className="icon-button" aria-label="关闭窗口" onClick={onClose}><Icon name="close"/></button></header>{children}</section></div>;
}
export function Cover({memory,className=''}) {
  if(memory?.cover&&!memory.isDemo)return <img className={`cover ${className}`} src={memory.cover} alt={memory.title||'记忆封面'}/>;
  return <div className={`cover cover-example ${className}`}><NextImage src={exampleCover(memory)} alt="演示封面，不是真实记忆照片" fill sizes="(max-width:768px) 100vw, (max-width:1180px) 50vw, 40vw"/><span className="pw-example-label">示意封面</span></div>;
}
export function MemoryCard({memory,onOpen,onFavorite,compact=false}) {
  return <article className={`memory-card ${compact?'compact':''}`}><button className="memory-cover-button" onClick={()=>onOpen(memory)} aria-label={`查看${memory.title}`}><Cover memory={memory}/><span className="cover-year">{memory.year?`${memory.year}年`:'年代待补充'}</span>{memory.isDemo&&<span className="demo-mark">示例记忆</span>}</button>{onFavorite&&<button className={`favorite-button ${memory.favorite?'active':''}`} onClick={()=>onFavorite(memory)} aria-label={`${memory.favorite?'取消收藏':'收藏'}${memory.title}`}><Icon name="heart" size={18}/></button>}<div className="memory-body"><div className="card-meta"><span>{memory.theme}</span>{memory.status==='draft'&&<span className="badge amber">待确认</span>}{memory.audio?<Icon name="volume" size={15}/>:memory.video?<Icon name="play" size={15}/>:<Icon name="book" size={15}/>}</div><button className="card-title" onClick={()=>onOpen(memory)}>{memory.title}</button><p className="memory-place"><Icon name="pin" size={13}/>{memory.location||'地点待补充'}</p><div className="memory-footer"><span>{memory.people.slice(0,3).join(' · ')||'家人故事'}</span><Icon name="arrow" size={16}/></div></div></article>;
}
export function Field({label,children,hint}) { return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>; }
export function Avatar({name,color='sage',size='',src,example}) {if(src)return <img className={`avatar ${color} ${size}`} src={src} alt={name?`${name}的头像`:'头像'}/>;if(example)return <span className={`avatar avatar-example ${color} ${size}`}><NextImage src={example} alt="演示头像" width={128} height={128}/><small>示意</small></span>;return <span className={`avatar ${color} ${size}`} aria-hidden="true">{name?.slice(-1)||'忆'}</span>;}
export function formatDate(value){return new Date(value).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});}
