'use client';
import {useEffect,useRef,useState} from 'react';
import {Modal,Button} from './UI';
import Icon from './Icon';
import {chatAPI} from '../lib/chat-client.mjs';

export default function ChatLibrary({mode,onClose,onLocate,source,active}){
  const[query,setQuery]=useState(''),[items,setItems]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);const sequence=useRef(0),keys=useRef({});
  const forwarding=mode==='forward',title=forwarding?'转发到对话':mode==='favorites'?'收藏的消息':'查找聊天记录';
  async function load(append=false){
    const ticket=++sequence.current;setLoading(true);setError('');
    try{const result=await chatAPI(forwarding?`threads?q=${encodeURIComponent(query)}&offset=${append?items.length:0}`:`messages?q=${encodeURIComponent(query)}&favorites=${mode==='favorites'}&offset=${append?items.length:0}`);if(ticket===sequence.current){const list=forwarding?result.threads:result.messages;setItems(previous=>append?[...previous,...list]:list);setMore(result.hasMore);}}
    catch(failure){if(ticket===sequence.current)setError(failure.message);}finally{if(ticket===sequence.current)setLoading(false);}
  }
  useEffect(()=>{const timer=setTimeout(()=>load(),180);return()=>{clearTimeout(timer);sequence.current++;};},[query,mode]);
  async function forward(thread){
    if(busy)return;setBusy(true);setError('');keys.current[thread.id]??=crypto.randomUUID();
    try{const message=await chatAPI(`threads/${active}/forward`,{method:'POST',headers:{'Idempotency-Key':keys.current[thread.id]},body:{messageId:source.id,targetThreadId:thread.id}});onLocate(thread.id,message.id);onClose();}catch(failure){setError(failure.message);}finally{setBusy(false);}
  }
  return <Modal title={title} onClose={onClose}><div className="im-library"><label className="cw-search"><Icon name="search" size={17}/><input autoFocus aria-label={title} placeholder={forwarding?'搜索对话名称':'搜索文字或语音转写'} value={query} onChange={event=>setQuery(event.target.value)}/></label>{forwarding&&<p className="muted small">转发后保留为一条消息，不自动请求 AI，也不扣积分。</p>}<div className="im-library-results" aria-busy={loading}>{items.map(item=><button type="button" key={item.id} disabled={busy||forwarding&&Boolean(item.activeJobId)} onClick={()=>forwarding?forward(item):(onLocate(item.threadId,item.id),onClose())}><span><strong>{forwarding?(item.pinned?'置顶 · ':'')+item.title:item.title}</strong><small>{forwarding?item.preview:item.text}</small><em>{forwarding?'转发到这里':`${item.role==='assistant'?'伙伴':'我'} · ${new Date(item.createdAt).toLocaleString('zh-CN')}${item.archived?' · 已归档':''}`}</em></span><Icon name={forwarding?'send':'chevron'} size={17}/></button>)}{!loading&&!items.length&&<p className="cw-history-empty">{forwarding?'先创建一段对话，就能转发到这里。':mode==='favorites'?'还没有匹配的收藏。长按消息可以收藏。':'没有找到匹配的消息。'}</p>}</div>{loading&&<p role="status" className="muted">正在查找…</p>}{error&&<p role="alert">{error}<Button variant="ghost" onClick={()=>load()}>重试</Button></p>}{more&&<Button variant="ghost" disabled={loading} onClick={()=>load(true)}>加载更多</Button>}</div></Modal>;
}
