'use client';
import {useEffect,useRef,useState} from 'react';
import Icon from './Icon';
import {Avatar,Button,Cover,Field,formatDate} from './UI';
import MemoryNarrator from './MemoryNarrator';
import {APPEARANCES,FONT_SCALES} from '../lib/core.mjs';
import {applyFontScale} from '../lib/fontscale.mjs';

// 已有登录账号的管理视图：列表 + 生成一次性邀请码。
// 从 app/page.jsx 拆出，行为与拆分前完全一致（同一批接口、同一批文案）。
export function AccountManager({api,notify}) {
  const [accounts,setAccounts]=useState([]);const [role,setRole]=useState('editor');const [invite,setInvite]=useState(null);const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState(null);const [editName,setEditName]=useState('');const [renameBusy,setRenameBusy]=useState(false);
  useEffect(()=>{api('/auth/accounts').then(data=>setAccounts(data.accounts)).catch(e=>notify(e.message,'error'));},[]);
  const startRename=account=>{setEditing(account.id);setEditName(account.name);};
  const saveRename=async account=>{
    const name=editName.trim();
    if(!name||name===account.name){setEditing(null);return;}
    setRenameBusy(true);
    try{const result=await api(`/auth/accounts/${account.id}`,{method:'PATCH',body:JSON.stringify({name})});setAccounts(list=>list.map(item=>item.id===account.id?result.user:item));notify('名字已更新');setEditing(null);}
    catch(e){notify(e.message,'error');}
    finally{setRenameBusy(false);}
  };
  const create=async()=>{setBusy(true);try{setInvite(await api('/auth/invite',{method:'POST',body:JSON.stringify({role})}));}catch(e){notify(e.message,'error');}finally{setBusy(false);}};
  const drop=async account=>{if(!window.confirm(`删除 ${account.name} 的登录账号？该账号会立即退出，家庭记忆仍保留。`))return;setBusy(true);try{await api(`/auth/accounts/${account.id}`,{method:'DELETE'});setAccounts(list=>list.filter(item=>item.id!==account.id));notify('账号已移除');}catch(e){notify(e.message,'error');}finally{setBusy(false);}};
  return <div className="account-manager"><h3>已有账号</h3><div className="account-list">{accounts.map(account=><div key={account.id}><Avatar name={account.name} color={account.role==='admin'?'peach':'sage'} src={account.avatar}/><span>{editing===account.id?<input value={editName} onChange={e=>setEditName(e.target.value)} maxLength={30} aria-label="新的名字" autoFocus onKeyDown={e=>{if(e.key==='Enter')saveRename(account);if(e.key==='Escape')setEditing(null);}}/>:<><strong>{account.name}</strong><small>{account.email}</small></>}</span><em>{account.role==='admin'?'管理员':account.role==='editor'?'编辑者':'查看者'}</em>{editing===account.id?<><button className="text-link" disabled={renameBusy||!editName.trim()} onClick={()=>saveRename(account)}>保存</button><button className="text-link" onClick={()=>setEditing(null)}>取消</button></>:<><button className="text-link" onClick={()=>startRename(account)}>改名</button>{account.role!=='admin'&&<button className="icon-button" aria-label={`移除${account.name}的账号`} disabled={busy} onClick={()=>drop(account)}><Icon name="trash" size={16}/></button>}</>}</div>)}</div><h3>生成邀请码</h3><p>邀请码仅供一个人使用，24 小时后过期。管理员邀请码可以创建新的管理员账号。</p><Field label="新账号权限"><select value={role} onChange={e=>setRole(e.target.value)}><option value="admin">管理员 · 可管理账号和全部内容</option><option value="editor">编辑者 · 可整理和修改记忆</option><option value="viewer">查看者 · 只能浏览和体验</option></select></Field><Button icon="plus" busy={busy} onClick={create}>生成邀请码</Button>{invite&&<div className="invite-code"><span>一次性邀请码</span><strong>{invite.code}</strong><button onClick={()=>navigator.clipboard?.writeText(invite.code).then(()=>notify('邀请码已复制')).catch(()=>notify('请手动记录邀请码','error'))}>复制邀请码</button></div>}</div>;
}

// 个人资料：本人改名字 + 上传头像。非管理员只能改自己；管理员的「改名所有人」
// 在 AccountManager 里逐行操作。头像存为 shared 素材，全家人都能看见。
export function ProfilePanel({state,request,refresh,notify}) {
  const account=state.account;
  const [name,setName]=useState(account.name);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{setName(account.name);},[account.name]);
  const pickAvatar=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setBusy(true);
    try{const form=new FormData();form.append('file',file);await request('/auth/avatar',{method:'POST',body:form});await refresh();notify('头像已更新');}
    catch(err){notify(err.message,'error');}
    finally{setBusy(false);e.target.value='';}
  };
  const saveName=async()=>{
    const trimmed=name.trim();
    if(!trimmed||trimmed===account.name)return;
    setBusy(true);
    try{await request('/auth/profile',{method:'PATCH',body:JSON.stringify({name:trimmed})});await refresh();notify('名字已更新');}
    catch(e){notify(e.message,'error');}
    finally{setBusy(false);}
  };
  return <section className="panel profile-panel">
    <h2><Icon name="people"/>个人资料</h2>
    <div className="profile-row">
      <Avatar name={account.name} color={account.role==='admin'?'peach':'sage'} size="avatar-lg" src={account.avatar}/>
      <label className={`upload-avatar-btn ${busy?'disabled':''}`}>更换头像<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickAvatar} disabled={busy}/></label>
      <p className="muted small">JPG / PNG / WebP，2 MB 以内，全家人可见。</p>
    </div>
    <Field label="名字"><input value={name} onChange={e=>setName(e.target.value)} maxLength={30} aria-label="我的名字"/></Field>
    <p className="muted small">{account.email} · 改名后顶栏与账号面板立即生效。</p>
    <Button icon="check" busy={busy} disabled={!name.trim()||name===account.name} onClick={saveName}>保存名字</Button>
  </section>;
}

// 记忆详情弹窗：封面、元信息、故事、家人留言、记忆讲述（MemoryNarrator）。
// 从 app/page.jsx 拆出，行为与拆分前完全一致。
export function MemoryDetail({memory,state,api,notify,onEdit,onDelete,onConfirm,onComment,favorite}) {
  const [comment,setComment]=useState('');
  const comments=state.activity.filter(a=>a.type==='comment'&&a.memoryId===memory.id);
  const THEMECOLORS={'家人':'peach','老家':'sage','旅行':'blue','青春':'lavender','节日':'gold','日常':'sage'};
  return <div className="memory-detail"><Cover memory={memory}/><div className="detail-meta"><span className={`badge ${THEMECOLORS[memory.theme]}`}>{memory.theme}</span><span>{memory.year?`${memory.year}年`:''}</span><span><Icon name="pin" size={14}/>{memory.location||'地点待补充'}</span><span className={`badge ${memory.status==='draft'?'amber':'sage'}`}>{memory.status==='draft'?'待家属确认':'已确认 · 家人可见'}</span></div><h1>{memory.title}</h1><div className="detail-people"><Icon name="people" size={17}/>{memory.people.join(' · ')||'人物待补充'}</div><p className="detail-story">{memory.story||'还没有故事，点击编辑补充这张照片背后的记忆。'}</p>{memory.audio&&<div className="detail-media"><h3><Icon name="volume"/>家人的声音</h3><audio controls src={memory.audio}/></div>}{memory.video&&<video className="detail-video" src={memory.video} controls/>}<MemoryNarrator memory={memory} api={api} notify={notify} canEdit={state.canEdit}/><div className="tag-row">{memory.tags.map(tag=><span key={tag}>#{tag}</span>)}</div>{memory.isDemo&&<div className="inline-notice"><Icon name="info"/><span>这是一段虚构示例故事，封面为原创插画，请用自己的家庭素材替换。</span></div>}<div className="detail-action-row"><Button icon="edit" variant="secondary" onClick={onEdit}>编辑记忆</Button><Button variant="secondary" icon="heart" onClick={()=>favorite(memory)}>{memory.favorite?'取消收藏':'收藏记忆'}</Button>{memory.status==='draft'?<Button icon="check" onClick={onConfirm}>核对完成，发布</Button>:null}<button className="icon-button danger-text" aria-label="删除记忆" onClick={onDelete}><Icon name="trash"/></button></div><section className="comment-section"><h3><Icon name="message" size={18}/>家人的留言</h3>{comments.map(a=><div key={a.id} className="comment-item"><Avatar name="小雨" color="peach"/><div><strong>家人<span>{formatDate(a.createdAt)}</span></strong><p>{a.comment}</p></div></div>)}<form onSubmit={e=>{e.preventDefault();if(!comment.trim())return;onComment(comment);setComment('');}} className="comment-form"><input placeholder="留下一句温暖的话…" value={comment} onChange={e=>setComment(e.target.value)} maxLength={1000} aria-label="家人留言"/><Button type="submit" variant="secondary" disabled={!comment.trim()}>发送</Button></form></section></div>;
}

// 个性化偏好：即时预览 + 700ms 防抖自动保存。
// 从 app/page.jsx 拆出。这里有三段写死的历史教训，**改动前必读**：
// 1) 字号预览走 requestAnimationFrame 直写根字号，不能放进 useEffect（会双次全量布局）；
// 2) 不能再监听本地预览值去写字号（旧字号会把新值覆盖回去，就是「又跳回上一个字号」）；
// 3) 唯一的权威字号写入源在 Page 组件（监听 activePrefs.fontScale）。
export function Personalize({state,save,applyLocal,notify}) {
  const saved=state.account?.preferences||{fontScale:1,theme:'day',highContrast:false};
  const [pending,setPending]=useState(null);const [busy,setBusy]=useState(false);
  // 点选即通过 applyLocal 乐观写入父 state（版本号随之 +1），展示只认父 state——
  // pending 只负责「还有哪些键没存到服务器」，不再参与展示，杜绝旧值闪回。
  const prefs=saved;
  const set=(key,value)=>{const next={...prefs,...pendingRef.current,[key]:value};applyLocal(next);setPending(p=>({...p,[key]:value}));};
  const pendingRef=useRef(pending);pendingRef.current=pending;
  const saveRef=useRef(save);saveRef.current=save;
  const flushRef=useRef(async()=>{});
  const savedRef=useRef(saved);savedRef.current=saved;
  const scaleRef=useRef(0);
  const pick=(key,value)=>{
    set(key,value);
    if(key==='fontScale'){scaleRef.current=value;requestAnimationFrame(()=>applyFontScale(scaleRef.current));}
  };
  useEffect(()=>{
    if(!pending)return;
    const t=setTimeout(()=>{if(pendingRef.current===pending)flushRef.current();},700);
    return ()=>clearTimeout(t);
  },[pending]);
  const flush=async()=>{
    const values=pendingRef.current;
    if(!values){notify('个性化偏好已保存，已即时应用到本端');return;}
    pendingRef.current=null;setPending(null);
    try{await saveRef.current({...savedRef.current,...values});}
    catch(e){setPending(values);notify(e.message,'error');}
  };
  flushRef.current=flush;
  const manual=async()=>{setBusy(true);try{await flush();notify('个性化偏好已保存，已即时应用到本端');}finally{setBusy(false);}};
  return <section className="panel personalize-panel"><h2><Icon name="sparkle"/>我的个性化偏好</h2><p className="muted">这是属于「你」的体验设置，其他家人看到的是他们自己的偏好，互不影响。修改后立即生效并自动保存。</p>
  <div className="field"><span>文字大小</span><div className="option-row">{FONT_SCALES.map(f=><button type="button" key={f.id} className={`option-pill ${prefs.fontScale===f.id?'selected':''}`} onClick={()=>pick('fontScale',f.id)}>{f.label}</button>)}</div></div>
  <div className="field"><span>外观主题</span><div className="option-row">{APPEARANCES.map(a=><button type="button" key={a.id} className={`option-pill ${prefs.theme===a.id?'selected':''}`} onClick={()=>set('theme',a.id)}>{a.label}</button>)}</div><small className="field-hint">日间是暖白画布配深松绿；夜间单独校准过对比度，不是日间的简单反相。</small></div>
  <div className="setting-toggle"><span><strong>高对比度</strong><small>提高文字与背景对比，更护眼</small></span><input type="checkbox" checked={prefs.highContrast} onChange={e=>set('highContrast',e.target.checked)} aria-label="高对比度"/></div>
  <div className="modal-actions"><Button type="button" icon="check" busy={busy} onClick={manual}>保存我的偏好</Button></div>
  </section>;
}

// 家庭设置：空间名称、朗读默认值、能力说明、数据导出。
// 从 app/page.jsx 拆出，行为与拆分前完全一致。
export function Settings({state,request,refresh,notify}) {
  const [settings,setSettings]=useState(state.settings);const [busy,setBusy]=useState(false);
  const change=(key,value)=>setSettings(s=>({...s,[key]:value}));
  return <div className="settings-grid"><form className="panel settings-panel" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await request('/settings',{method:'PATCH',body:JSON.stringify(settings)});await refresh();notify('设置已保存');}catch(e){notify(e.message,'error');}finally{setBusy(false);}}}><h2><Icon name="home"/>家庭空间</h2><Field label="家庭空间名称"><input value={settings.familyName} onChange={e=>change('familyName',e.target.value)} required maxLength={60}/></Field><h2 className="settings-section-title"><Icon name="sparkle"/>阅读与朗读</h2><p className="settings-hint">这些是全家人共用的默认值；每位家人还能在「我的个性化偏好」里单独调整字号与主题色。</p><div className="setting-toggle"><span><strong>默认连续播放</strong><small>播放完一段故事后继续下一段</small></span><input type="checkbox" checked={settings.autoPlay} onChange={e=>change('autoPlay',e.target.checked)} aria-label="默认连续播放"/></div><Field label={`故事朗读速度 · ${settings.speechRate}`}><input type="range" min="0.5" max="1.2" step="0.05" value={settings.speechRate} onChange={e=>change('speechRate',Number(e.target.value))}/></Field><Button type="submit" icon="check" busy={busy}>保存设置</Button></form><div><section className="panel settings-info"><h2><Icon name="sparkle"/>辅助整理能力</h2><span className={`badge ${state.aiEnabled?'sage':'amber'}`}>{state.aiEnabled?'模型接口已配置':'本地整理模式'}</span><p>{state.aiEnabled?'照片理解与故事生成将调用你配置的服务，生成结果必须经过家属核对。':'文字标签、关键词搜索和故事串联可以直接使用。当前没有连接云端模型，不会假装完成照片识别。'}</p><div className="capability-list"><span><Icon name="check"/>记忆上传与持久保存</span><span><Icon name="check"/>关键词检索与关联</span><span><Icon name="check"/>设备故事朗读</span><span><Icon name="info"/>语音识别取决于浏览器支持和网络</span><span><Icon name="info"/>模型通过部署环境变量配置</span></div></section><section className="panel settings-info"><h2><Icon name="shield"/>数据与使用说明</h2><p>本机版使用本地数据库，云端版使用云数据库和私有素材存储。登录账号可在本页管理；请使用经过授权、适合展示的素材。</p><p>声音克隆、数字人、医学评估及自动情绪识别未实现。设备朗读会明确显示为合成声音。</p><Button variant="secondary" icon="download" onClick={()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='忆伴-记忆数据.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('记忆元数据已导出，照片和音视频请另行保存');}}>导出记忆元数据</Button><p className="small muted">导出内容包含故事和记录，不包含照片、录音及视频文件。</p></section></div></div>;
}
