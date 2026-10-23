'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icon';
import {Empty} from './UI';

/** Immich 风格照片墙：
 *  - 顶部一条可横向滚动的「年 → 月」时间轴，点击平滑滚到对应分组，滚动时高亮当前分组；
 *  - 照片按 年/月 分组，组内瀑布流排布（CSS columns 实现，无需额外依赖）；
 *  - 悬浮放大：图片轻微放大 + 渐变遮罩浮出标题与日期；
 *  - 不依赖图片真实宽高比——每张照片按原始比例自适应，形成自然的瀑布流。
 *
 *  用法：
 *    <PhotoGallery
 *      photos={[{id, src, title, date:'2024-05-01'}, …]}   // date 需可被 new Date() 解析
 *      onOpen={photo=>…}                                    // 可选，点击照片
 *    />
 *  photos 为空时显示自带的空状态。 */

export default function PhotoGallery({photos=[],onOpen}) {
  const [active,setActive]=useState('');
  const groupsRef=useRef(null);
  const groups=useMemo(()=>{
    const map=new Map();
    for(const photo of photos){
      const date=new Date(photo.date);
      const year=Number.isFinite(date.getTime())?date.getFullYear():'年份待补充';
      const month=Number.isFinite(date.getTime())?date.getMonth()+1:null;
      const key=`${year}`;
      if(!map.has(key))map.set(key,{year,label:`${year} 年`,months:new Map()});
      const group=map.get(key);
      if(month===null){if(!group.months.has(0))group.months.set(0,{month:0,label:'日期待补充',items:[]});group.months.get(0).items.push(photo);continue;}
      if(!group.months.has(month))group.months.set(month,{month,label:`${month} 月`,items:[]});
      group.months.get(month).items.push(photo);
    }
    return [...map.values()]
      .sort((a,b)=>(b.year==='年份待补充'?-1:b.year)-(a.year==='年份待补充'?-1:a.year))
      .map(group=>({...group,months:[...group.months.values()].sort((a,b)=>b.month-a.month)}));
  },[photos]);
  const flatGroups=useMemo(()=>groups.flatMap(g=>g.months.map(m=>({id:`g-${g.year}-${m.month}`,label:`${g.label} · ${m.label}`}))),[groups]);

  // 滚动时把视口里最靠上的分组设为时间轴高亮项
  useEffect(()=>{
    const nodes=[...groupsRef.current?.querySelectorAll('[data-group]')||[]];
    if(!nodes.length)return;
    const observer=new IntersectionObserver(entries=>{
      const first=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
      if(first)setActive(first.target.dataset.group);
    },{rootMargin:'-96px 0px -55% 0px'});
    nodes.forEach(node=>observer.observe(node));
    return()=>observer.disconnect();
  },[groups]);

  if(!photos.length)return <Empty icon="image" title="还没有照片" description="上传照片后，这里会按时间把它们串成一条相册长廊。"/>;

  const scrollTo=id=>{
    const node=groupsRef.current?.querySelector(`[data-group="${id}"]`);
    if(!node)return;
    setActive(id);
    const top=node.getBoundingClientRect().top+window.scrollY-120;
    window.scrollTo({top,behavior:'smooth'});
  };

  return <div className="photo-gallery">
    <nav className="pg-timeline" aria-label="照片时间轴">
      <span className="pg-timeline-label"><Icon name="clock" size={16}/>按时间浏览</span>
      <div className="pg-timeline-track">{flatGroups.map(group=><button key={group.id} className={`pg-time-chip ${active===group.id?'active':''}`} onClick={()=>scrollTo(group.id)}>{group.label}</button>)}</div>
    </nav>
    <div className="pg-groups" ref={groupsRef}>
      {groups.map(group=><section key={group.year} className="pg-year">
        <h2 className="pg-year-title">{group.label}</h2>
        {group.months.map(monthGroup=><div key={monthGroup.month} data-group={`g-${group.year}-${monthGroup.month}`} className="pg-month">
          <h3 className="pg-month-title">{monthGroup.label}<span>{monthGroup.items.length} 张</span></h3>
          <div className="photo-masonry">
            {monthGroup.items.map(photo=><figure key={photo.id} className="photo-cell" onClick={()=>onOpen?.(photo)}>
              <img src={photo.src} alt={photo.title||'家庭照片'} loading="lazy"/>
              <figcaption className="photo-overlay">
                <strong>{photo.title||'未命名照片'}</strong>
                <span>{photo.date?new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(new Date(photo.date)):''}</span>
                <i className="photo-zoom"><Icon name="search" size={16}/></i>
              </figcaption>
            </figure>)}
          </div>
        </div>)}
      </section>)}
    </div>
  </div>;
}
