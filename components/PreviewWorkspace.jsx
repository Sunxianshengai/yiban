'use client';
import FamilySpaces from './FamilySpaces';
import {useEffect,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Cover,Empty} from './UI';
import NextImage from 'next/image';
import {examplePortrait} from '../lib/preview-assets.mjs';
import {AccountManager,Personalize,ProfilePanel,Settings} from './Settings';

export function FamilyRoster({state,onTimeline,onLibrary,onVoice,onRemove}){
  const featured=state.memories.find(memory=>memory.cover&&memory.status==='confirmed');
  return <div className="pw-family-layout">
    <div className="pw-family-photo">{featured?<><Cover memory={featured}/><span>{featured.isDemo?'虚构示例 · 请替换为家庭素材':'家人共同留下的回忆'}</span></>:<div className="pw-family-demo"><NextImage src="/demo/preview/family.png" alt="演示家庭合影，不是真实家庭资料" fill sizes="(max-width:768px) 100vw,40vw"/><span>演示合影 · 真实家庭照片单独保存</span></div>}</div>
    <div className="pw-family-list">{state.members.map(member=>{
      const count=state.memories.filter(memory=>memory.people.includes(member.name)).length;
      return <article className="pw-family-member family-card" key={member.id}>
        <button className="pw-member-main" onClick={()=>onTimeline(member.id)} aria-label={`查看${member.name}的时间轴`}><Avatar name={member.name} example={examplePortrait(member.relation)} src={member.avatar} color={member.color} size="avatar-lg"/><span><strong>{member.name}</strong><small>{member.relation||'家人'}</small></span><span className="pw-member-count">{count} 段故事</span><Icon name="chevron"/></button>
        <details className="pw-member-more"><summary aria-label={`${member.name}的更多操作`}><Icon name="more"/></summary><div><button onClick={()=>onLibrary(member.name)}>查看相关记忆</button>{state.canEdit&&<><button onClick={()=>onVoice(member.id)}>声音授权与录入</button>{member.role!=='管理员'&&<button onClick={()=>onRemove(member)}>移除成员</button>}</>}</div></details>
      </article>;
    })}{!state.members.length&&<Empty title="还没有家庭成员" description="添加家人后，可以按人物回看故事。"/>}</div>
  </div>;
}

function DeviceVoice({accountId,notify}){
  const [voices,setVoices]=useState([]),[selected,setSelected]=useState('');
  const key=`yiban:voice:${accountId}`;
  useEffect(()=>{try{setSelected(localStorage.getItem(key)||'');}catch{}const update=()=>setVoices((window.speechSynthesis?.getVoices()||[]).filter(voice=>voice.lang.startsWith('zh')));update();window.speechSynthesis?.addEventListener('voiceschanged',update);return()=>{window.speechSynthesis?.removeEventListener('voiceschanged',update);window.speechSynthesis?.cancel();};},[key]);
  function save(value){setSelected(value);try{localStorage.setItem(key,value);notify('本设备朗读声音已保存');}catch{notify('此设备无法保存声音偏好','error');}}
  return <section className="panel pw-device-voice"><h2>设备朗读声音</h2><p className="muted">选择这台设备上可用的中文声音。个人 AI 家人的声音设定优先。</p><label className="field"><span>朗读声音</span><select aria-label="朗读声音" value={selected} onChange={event=>save(event.target.value)}><option value="">系统默认</option>{voices.map(voice=><option key={voice.name}>{voice.name}</option>)}</select></label><Button variant="secondary" icon="play" onClick={()=>{if(!window.speechSynthesis){notify('此设备暂不支持朗读','error');return;}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance('你好，欢迎回到忆伴。');utterance.lang='zh-CN';utterance.voice=window.speechSynthesis.getVoices().find(voice=>voice.name===selected)||null;utterance.onerror=()=>notify('暂时无法播放，请更换声音重试','error');window.speechSynthesis.speak(utterance);}}>试听</Button></section>;
}

export function SettingsWorkspace({state,api,refresh,notify,savePreferences,applyLocal,onSignOut,onCredits,initialTab='preferences',onBack}){
  const [tab,setTab]=useState(initialTab);
  const items=[['profile','user','我的账号'],['preferences','sun','显示与阅读'],['voice','volume','朗读声音'],['household','home','家庭空间'],...(state.account.role==='admin'?[['accounts','shield','账号与权限']]:[]),['credits','coins','个人积分']];
  const choose=(id,event)=>{event?.currentTarget.closest('details')?.removeAttribute('open');if(id==='credits')onCredits();else setTab(id);};
  return <div className="pw-settings-workspace"><div className="pw-settings-mobile-header"><button className="fa-round" aria-label="返回首页" onClick={onBack}><Icon name="back"/></button><details className="pw-settings-mobile-menu"><summary aria-label="更多设置"><Icon name="more"/></summary><nav>{items.map(([id,icon,label])=><button key={id} onClick={event=>choose(id,event)}><Icon name={icon}/>{label}</button>)}</nav></details></div><nav className="pw-settings-nav" aria-label="设置分类"><h1>设置</h1>{items.map(([id,icon,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={event=>choose(id,event)}><Icon name={icon}/>{label}</button>)}<button className="pw-signout" onClick={onSignOut}><Icon name="logout"/>退出登录</button></nav><div className="pw-settings-body"><header className="page-heading"><h1>{tab==='preferences'?'偏好设置':items.find(item=>item[0]===tab)?.[2]||'设置'}</h1></header>{tab==='profile'&&<><div className="pw-profile-summary"><Avatar name={state.account.name} src={state.account.avatar} size="avatar-xl"/><div><h2>{state.account.name}</h2><p>{state.account.email}</p><small>{state.account.role==='admin'?'管理员':state.account.role==='editor'?'编辑者':'查看者'}</small></div></div><ProfilePanel state={state} request={api} refresh={refresh} notify={notify}/>{state.account.role==='admin'&&<Button variant="secondary" onClick={()=>setTab('accounts')}>邀请家人与管理账号</Button>}</>}{tab==='profile'&&<Button variant="ghost" icon="logout" onClick={onSignOut}>退出登录</Button>}{tab==='preferences'&&<Personalize state={state} save={savePreferences} applyLocal={applyLocal} notify={notify}><div className="pw-prefs-device"><DeviceVoice accountId={state.account.id} notify={notify}/ ></div></Personalize>}{tab==='voice'&&<DeviceVoice accountId={state.account.id} notify={notify}/ >}{tab==='household'&&<><FamilySpaces api={api} notify={notify}/><Settings key={state.account.familyId} state={state} request={api} refresh={refresh} notify={notify}/ ></>}{tab==='accounts'&&state.account.role==='admin'&&<AccountManager api={api} notify={notify}/ >}</div></div>;
}
