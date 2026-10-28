'use client';
import {useEffect,useState} from 'react';
import {familiaAPI} from '../lib/familia-client.mjs';
import {chatAPI} from '../lib/chat-client.mjs';
export default function ChatMemoryAction({message,profileId,threadId,onApplied,onManage,disabled}){
  const proposal=message.memoryProposal,[items,setItems]=useState([]),[target,setTarget]=useState(''),[text,setText]=useState(proposal.proposedText||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let live=true;if(proposal.status!=='pending')return;familiaAPI('personal-memories'+(profileId?'?profileId='+encodeURIComponent(profileId):'')).then(state=>{if(live){const found=state.items.filter(item=>proposal.candidates.some(candidate=>candidate.id===item.id));setItems(found);if(found.length===1)setTarget(found[0].id);}}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[message.id,profileId,proposal.status]);
  if(proposal.status==='applied')return <p className="cw-message-status">{proposal.kind==='forget'?'已忘记这条记忆':proposal.kind==='resolve'?'已结束这件事的回访':'个人记忆已更新'}</p>;
  const labels={correct:'纠正一条记忆',forget:'忘记一条记忆',resolve:'这件事已经结束',boundary:'以后这样相处'};
  async function confirm(){setBusy(true);setError('');try{await chatAPI(`threads/${threadId}/memory-action`,{method:'POST',body:{messageId:message.id,targetId:target,text}});await onApplied();}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  return <div className="im-memory-confirm"><strong>{labels[proposal.kind]}</strong><p>确认后更新个人记忆。</p>{items.length>0&&<label>对应的记忆<select aria-label="要修改的记忆" value={target} onChange={event=>setTarget(event.target.value)}><option value="">请选择一条</option>{items.map(item=><option key={item.id} value={item.id}>{item.text}</option>)}</select></label>}{['correct','boundary'].includes(proposal.kind)&&<label>更新内容<textarea aria-label="记忆更新内容" rows={2} maxLength={600} value={text} onChange={event=>setText(event.target.value)}/></label>}<div><button type="button" disabled={disabled||busy||proposal.kind!=='boundary'&&!target||['correct','boundary'].includes(proposal.kind)&&!text.trim()} onClick={confirm}>{busy?'正在更新…':'确认更新'}</button><button type="button" onClick={onManage}>打开记忆管理</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
