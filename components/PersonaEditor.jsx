'use client';
import {useRef,useState} from 'react';
import {Button,Field,Modal} from './UI';
import {PersonaAvatar} from './Familia';
import Icon from './Icon';
import {FAMILY_ROLES,RELATIONSHIPS,QUALITIES} from '../lib/familia.mjs';
import {AI_VOICES} from '../lib/ai-voices.mjs';
import {familiaAPI} from '../lib/familia-client.mjs';

const feelings=['很疏远','不太好','一般','不错','很好'];
function values(profile){return {name:profile.name,role:profile.role,age:profile.age,description:profile.description||'',relation:profile.relation||'',rating:profile.rating??'',qualities:[...(profile.qualities||[])],speakingStyle:profile.speakingStyle||'',responseExample:profile.responseExample||'',avoidedExpressions:profile.avoidedExpressions||'',voice:profile.voice??null};}

export default function PersonaEditor({profile,onClose,onSaved}){
  const [form,setForm]=useState(()=>values(profile)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const initial=useRef(JSON.stringify(values(profile)));
  const dirty=JSON.stringify(form)!==initial.current;
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  function close(){if(!busy&&(!dirty||window.confirm('还没有保存这些修改，确定离开吗？')))onClose();}
  async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const updated=await familiaAPI(`profiles/${profile.id}`,{method:'PATCH',body:{...form,age:Number(form.age),relation:form.relation||null,rating:form.rating===''?null:Number(form.rating),expectedUpdatedAt:profile.updatedAt}});initial.current=JSON.stringify(form);await onSaved(updated);}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  return <Modal page wide title="人格与表达" backLabel="返回联系人" onClose={close}><div className="pe-editor">
    <header className="pe-heading"><div><h1>人格与表达</h1><p>让这份陪伴，更合你的心意。</p></div><span><Icon name="lock" size={15}/>仅自己可见</span></header>
    <div className="pe-layout"><form className="pe-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}><legend className="pe-sr-only">AI 家人人格设置</legend>
        <section className="pe-section"><h2>这位 AI 家人</h2><div className="pe-identity-fields"><Field label="称呼"><input value={form.name} onChange={event=>change('name',event.target.value)} required maxLength={30}/></Field><Field label="角色"><select value={form.role} onChange={event=>change('role',event.target.value)}>{FAMILY_ROLES.map(role=><option key={role.id} value={role.id}>{role.label}</option>)}</select></Field><Field label="设定年龄"><input type="number" min={18} max={100} step={1} required value={form.age} onChange={event=>change('age',event.target.value)}/></Field></div>
        <Field label="希望得到怎样的陪伴"><textarea rows={3} maxLength={2000} value={form.description} onChange={event=>change('description',event.target.value)} placeholder="例如：先听我说完，再一起想办法。"/></Field></section>
        <section className="pe-section"><div className="pe-section-heading"><h2>期待的特质</h2><span>{form.qualities.length} / 6</span></div><div className="pe-traits" role="group" aria-label="期待的特质">{QUALITIES.map(quality=><button type="button" key={quality.id} aria-pressed={form.qualities.includes(quality.id)} disabled={form.qualities.length>=6&&!form.qualities.includes(quality.id)} onClick={()=>change('qualities',form.qualities.includes(quality.id)?form.qualities.filter(id=>id!==quality.id):[...form.qualities,quality.id])}>{quality.label}</button>)}</div></section>
        <section className="pe-section"><h2>相处的背景</h2><div className="pe-background-fields"><Field label="你们的相处" hint="选填，用来理解你的期待。"><select value={form.relation} onChange={event=>change('relation',event.target.value)}><option value="">暂不填写</option>{RELATIONSHIPS.map(relation=><option key={relation.id} value={relation.id}>{relation.label}</option>)}</select></Field><Field label="想到这段关系的感受"><select value={form.rating} onChange={event=>change('rating',event.target.value)}><option value="">暂不填写</option>{feelings.map((feeling,index)=><option key={feeling} value={index+1}>{feeling}</option>)}</select></Field></div><p className="pe-note">参考你的经历，陪伴以尊重和体贴为出发点。</p></section>
        <details className="pe-advanced"><summary><span><Icon name="settings" size={19}/><strong>高级表达设置</strong><small>说话习惯、回复示例与避免的表达</small></span><Icon name="down" size={18}/></summary><div className="pe-advanced-fields"><p>选填。留空时，按上面的特质自然交流。</p><Field label="说话习惯" hint="最多 600 字"><textarea rows={3} maxLength={600} value={form.speakingStyle} onChange={event=>change('speakingStyle',event.target.value)} placeholder="例如：短句、自然一点，一次只问一个问题。"/></Field><Field label="专属音色（AI 合成）" hint="你明确说「发语音」时，用它把回复合成语音；不选则始终发文字。"><select value={form.voice??''} onChange={event=>change('voice',event.target.value||null)}><option value="">不使用语音合成</option>{AI_VOICES.map(voice=><option key={voice.id} value={voice.id}>{voice.label}</option>)}</select></Field><Field label="回复示例" hint="仅参考表达方式，示例里的经历不会成为家庭记忆。最多 1200 字。"><textarea rows={4} maxLength={1200} value={form.responseExample} onChange={event=>change('responseExample',event.target.value)} placeholder="例如：听起来今天挺累的。想先说说发生了什么，还是一起歇一会儿？"/></Field><Field label="避免的表达" hint="最多 600 字"><textarea rows={3} maxLength={600} value={form.avoidedExpressions} onChange={event=>change('avoidedExpressions',event.target.value)} placeholder="例如：不要说教，不用‘你应该’，不替我做决定。"/></Field></div></details>
      </fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <footer className="pe-footer"><p>{dirty?'有修改尚未保存':'保存后，从下一条回复开始生效。'}<small>已有聊天记录保持原样 · 保存设置免费</small></p><div><Button type="button" variant="ghost" onClick={close} disabled={busy}>取消</Button><Button type="submit" icon="check" busy={busy} disabled={!dirty||!form.name.trim()}>保存设置</Button></div></footer>
    </form><aside className="pe-companion"><PersonaAvatar profile={{...profile,...form}} large/><h2>{form.name||'这位 AI 家人'}</h2><span className="fa-ai-tag">AI 陪伴</span><p>{form.description||'按你喜欢的方式，听你说说话。'}</p><div className="pe-selected-traits">{form.qualities.map(id=><span key={id}>{QUALITIES.find(quality=>quality.id===id)?.label}</span>)}</div><div className="pe-companion-foot"><Icon name="heart-handshake" size={22}/><strong>你期待的理想陪伴</strong><p>相处背景帮助理解你的感受，AI 始终以自己的身份陪伴。</p></div></aside></div>
  </div></Modal>;
}
