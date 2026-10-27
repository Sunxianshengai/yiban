// Design proposal only: no AI, notification permission, scheduler or account calls.
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
const avatar='<span class="avatar xiaoman"><img src="/companions/xiaoman/greeting.png" alt="小满演示头像"></span>';
const svg=name=>window.previewIcons[name]||window.previewIcons.Circle;
const icon=name=>`<i>${svg(name)}</i>`;
const defaults={enabled:true,frequency:'natural',start:'22:00',end:'08:00',notifications:false,content:false,paused:false,directive:''};
let saved={...defaults},draft={...saved},screen=params.get('screen')||'chat',variant=params.get('case')||'interview',lastFocus=null;
if(params.get('frequency')==='often')saved.frequency=draft.frequency='often';
function icons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));}
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('.toast').hidden=true,2800);}
const assistant=(text,extra='',cls='')=>`<article class="message ${cls}">${avatar}<div class="message-body"><div class="bubble">${text}</div>${extra}</div></article>`;
const user=text=>`<article class="message user-message"><span class="avatar me">我</span><div class="message-body"><div class="bubble">${text}</div></div></article>`;
function feed(){
 let html='<div class="date-divider">昨天 21:18</div>'+user('明天下午面试。开场白练了好几遍，还是有点紧张。')+assistant('练过就留一点余地给现场。今晚先睡好，明天慢慢来。');
 if(variant==='tea')html='<div class="date-divider">昨天 20:42</div>'+user('我喜欢茉莉花茶。忙完泡一杯，整个人就慢下来了。')+assistant('那就把这杯茶留给下班后的自己。');
 const message=variant==='tea'?'下班了吗？要不要给自己留一杯茉莉花茶的时间。':'下午的面试，结束了吗？';
 html+='<div class="unread-divider">以下是新消息</div>'+assistant(message,`<span class="msg-meta">今天 16:40 · 主动联系 <button class="message-link" data-go="reason">为什么提起这件事</button></span>`,'proactive');
 html+=`<div class="quick-replies"><button data-action="reply">刚结束，比想象中顺利</button><button data-action="later">晚点聊</button></div>`;
 if(variant==='paused')html+='<div class="pause-hint">'+icon('Moon')+'<span>已暂停到明天 08:00。聊天照常，期间不会主动联系你。<button data-action="resume">恢复</button></span></div>';
 $('.chat-feed').innerHTML=html;
 $('.contact.selected .contact-text>span').textContent=message;
}
function toggle(label,key,desc){return `<div class="switch-row"><div><strong>${label}</strong><p>${desc}</p></div><button class="switch" role="switch" aria-label="${label}" aria-checked="${draft[key]}" data-toggle="${key}"><span></span></button></div>`;}
function row(label,action,sub='',hint=''){return `<button class="setting-line" data-action="${action}">${icon('Bell')}<span>${label}${sub?`<small>${sub}</small>`:''}</span>${hint?`<em>${hint}</em>`:''}${icon('ChevronRight')}</button>`;}
function settings(){return `<h2>有话，也想先找你</h2><p class="intro">记得聊过的小事，在合适的时候问一句。<br>只属于你和小满的聊天。</p>${toggle('允许小满主动联系','enabled','有想接着聊的事，再来找你。')}
 <div ${draft.enabled?'':'inert style="opacity:.45"'}><section class="form-section"><h3>联系节奏</h3><div class="choice-row"><button aria-pressed="${draft.frequency==='natural'}" data-frequency="natural"><strong>自然一点</strong><span>每天最多 1 次</span></button><button aria-pressed="${draft.frequency==='often'}" data-frequency="often"><strong>多聊一点</strong><span>每天最多 3 次</span></button></div><small>有合适的话题才联系；连续两次没有回应，就先等你。</small></section>
 <section class="form-section"><h3>免打扰时段</h3><div class="time-range"><input type="time" aria-label="免打扰开始时间" value="${draft.start}" data-setting="start"><span>至</span><input type="time" aria-label="免打扰结束时间" value="${draft.end}" data-setting="end"></div><small>按设备时区；这段时间不发送主动消息或通知。</small></section>
 <section class="form-section"><h3>适合聊些什么</h3><p class="help">还没聊完的小事、你提过的安排、熟悉的兴趣。不会反复追问已经结束的事。</p>${row('这台设备的通知','device','应用内消息始终保留',saved.notifications?'已开启':'未开启')}</section>
 <details><summary>更细的相处偏好 ${icon('ChevronDown')}</summary><textarea aria-label="主动联系偏好" placeholder="比如：面试结束后可以问问我，工作日白天少联系。" maxlength="500"></textarea><small class="help">这些偏好只影响主动联系，不会改写人格。明确的免打扰和次数限制始终优先。</small></details>
 <button class="text-action" data-action="pause">今天先安静一会儿</button></div>`;}
function content(type){
 if(type==='settings')return settings();
 if(type==='details')return `<div class="profile-pro">${avatar}<h2>小满</h2><p>AI 伙伴 · 原创演示角色</p></div><div class="link-list"><button data-go="settings">${icon('Bell')}主动联系${icon('ChevronRight')}</button><button data-go="reason">${icon('Leaf')}对我的了解${icon('ChevronRight')}</button><button data-action="persona">${icon('SlidersHorizontal')}人格与表达${icon('ChevronRight')}</button></div><p class="example-note">主动联系放在聊天详情里。聊天主界面保留熟悉的消息、表情和输入框。</p>`;
 if(type==='reason')return `<h2>接着你说过的小事</h2><p class="intro">这条消息参考了你与小满的私人聊天。这里只说明依据，不展示或编造 AI 内心独白。</p><div class="why-context"><p>${variant==='tea'?'我喜欢茉莉花茶。忙完泡一杯，整个人就慢下来了。':'明天下午面试。开场白练了好几遍，还是有点紧张。'}</p><small>昨天 21:18 · 你的消息 · 演示资料</small></div><p class="help">${variant==='tea'?'来自你愿意分享的偏好。':'原话中的“明天”按当时的日期理解。'}如果这件事已经过去，或你不想再聊，可以告诉小满。</p><div class="link-list"><button data-action="finished">${icon('Check')}这件事结束了，不再问起${icon('ChevronRight')}</button><button data-go="settings">${icon('Bell')}调整主动联系${icon('ChevronRight')}</button></div><p class="example-note">关闭主动联系不会删除聊天和长期记忆。删除来源或记忆后，未发送的相关联系也应取消。</p>`;
 if(type==='device')return `<h2>有消息时，轻轻提醒</h2><p class="intro">应用内消息和设备通知分开设置。不开通知，也能在下次回来时看到未读。</p><div class="pacing-state">${icon('Bell')}<span>${saved.notifications?'此设备已开启通知（演示状态）。':'此设备尚未开启通知。正式版本仅在你点击后请求浏览器权限。'}</span></div><button class="primary" data-action="grant">${saved.notifications?'通知已开启 · 查看演示':'开启此设备通知 · 演示'}</button><section class="form-section" style="margin-top:24px"><div class="setting-line"><span>通知中显示消息正文<small>默认仅显示“小满发来一条消息”</small></span><button class="switch" role="switch" aria-label="通知中显示消息正文" aria-checked="${saved.content}" data-action="content"><span></span></button></div></section><p class="help">iPhone / iPad 需先把忆伴添加到主屏幕，并使用支持 Web Push 的系统版本。不支持或拒绝通知时，仍保留应用内未读。</p><button class="text-action" data-action="denied">查看权限被拒绝时的样子</button><br><button class="text-action" data-go="notification">查看通知效果</button><p class="example-note">当前为独立交互预览，不会弹出真实权限框、订阅设备或发送通知。</p>`;
 if(type==='denied')return `<h2>消息会在这里等你</h2><p class="intro">浏览器没有允许通知，不影响你和小满聊天。</p><div class="pacing-state">${icon('BellOff')}<span>此设备通知已被阻止（演示）。可在浏览器的网站设置中手动调整。</span></div><p class="help">我们不会反复弹权限请求。你仍能在会话列表看到未读消息。</p><button class="secondary" data-go="contacts">看看应用内未读</button>`;
 if(type==='quiet')return `<h2>这会儿，先不打扰</h2><p class="intro">免打扰时段 · 22:00 — 08:00</p><div class="pacing-state">${icon('Moon')}<span>主动消息和设备通知都暂停。早晨重新判断话题是否还合适，不会把夜里积压的消息一口气发给你。</span></div><p class="help">你主动发消息时，小满仍会正常回复。不会把你的未回应当成冷落，也不会催你回来。</p><button class="secondary" data-go="settings">调整免打扰时段</button>`;
 return '';
}
function go(type){
 if(type==='notification'){notice();return;}
 screen=type;$('.app-frame').classList.toggle('contacts-screen',type==='contacts');
 const open=!['chat','contacts','paused'].includes(type);$('.app-frame').classList.toggle('panel-open',open);$('.pro-panel').hidden=!open;
 $('.conversation').inert=open&&innerWidth<=900;$('.contacts').inert=open&&innerWidth<=900;
 if(open){lastFocus=document.activeElement;$('.pro-panel').setAttribute('role',innerWidth<=900?'dialog':'complementary');$('.pro-panel').setAttribute('aria-modal',innerWidth<=900?'true':'false');$('.pro-panel').setAttribute('aria-label',({settings:'主动联系设置',reason:'这条消息的依据',device:'设备通知',details:'聊天详情',denied:'通知权限',quiet:'免打扰'})[type]||'主动联系');$('.pro-panel>header').innerHTML=`<button class="icon-button" data-go="${['settings','details'].includes(type)?'chat':'settings'}" aria-label="返回">${icon('ChevronLeft')}</button><strong>${({settings:'主动联系',reason:'为什么提起',device:'设备通知',details:'聊天详情',denied:'设备通知',quiet:'免打扰'})[type]}</strong><button class="icon-button close-panel" data-go="chat" aria-label="关闭详情">${icon('X')}</button>`;$('.pro-panel-content').innerHTML=content(type);$('.pro-panel>footer').hidden=type!=='settings';$('.pro-panel>footer').innerHTML='<p>主动消息免费。你回复后，按现有积分规则计费。</p><button class="primary" data-action="save">保存设置</button>';if(type==='settings')$('.pro-panel textarea').value=draft.directive;$('.pro-panel>header button')?.focus();}
 else{if(type==='paused'){variant='paused';feed();}if(lastFocus?.isConnected)lastFocus.focus();}
 const url=new URL(location.href);url.searchParams.set('screen',type);history.replaceState(null,'',url);
}
function notice(){const el=$('.notification-demo');$('.notice-backdrop').hidden=false;el.hidden=false;el.innerHTML=`<header>${icon('Bell')}浏览器通知效果预览<button class="icon-button" data-action="close-notice" aria-label="关闭通知预览">${icon('X')}</button></header><div class="notice-preview"><h2>忆伴 · 小满</h2><p>${saved.content?'下午的面试，结束了吗？':'小满发来一条消息'}</p><button class="text-action" data-action="open-notice">打开聊天</button></div><div class="notification-controls"><button class="secondary" data-action="preview-content">${saved.content?'隐藏正文':'预览显示正文'}</button><button class="primary" data-action="snooze">今天安静一会儿</button></div><small>这是网页内的视觉示意，真实通知外观由系统决定。默认隐藏正文。</small>`;el.querySelector('button')?.focus();}
function closeNotice(){$('.notification-demo').hidden=true;$('.notice-backdrop').hidden=true;}
document.addEventListener('click',event=>{const el=event.target.closest('button,[data-go]');if(!el)return;if(el.dataset.go){go(el.dataset.go);return;}if(el.dataset.frequency){draft.frequency=el.dataset.frequency;go('settings');return;}if(el.dataset.toggle){draft[el.dataset.toggle]=!draft[el.dataset.toggle];go('settings');return;}const action=el.dataset.action;
 if(action==='save'){saved={...draft};go('chat');toast(saved.enabled?'主动联系设置已保存（预览）':'已关闭主动联系（预览）');}
 else if(action==='device')go('device');else if(action==='denied')go('denied');else if(action==='grant'){saved.notifications=true;go('device');toast('演示：设备通知已开启，不会真的请求权限');}
 else if(action==='content'){saved.content=!saved.content;go('device');}
 else if(action==='preview-content'){saved.content=!saved.content;notice();}
 else if(['pause','snooze','later'].includes(action)){closeNotice();saved.paused=true;go('paused');}
 else if(action==='resume'){saved.paused=false;variant='interview';feed();toast('演示：主动联系已恢复');}
 else if(action==='reply'){$('.compose-line textarea').value='刚结束，比想象中顺利。';$('.compose-line textarea').focus();}
 else if(action==='finished'){go('chat');toast('演示：这件事已结束，不会再主动问起');}
 else if(action==='open-notice'){closeNotice();go('chat');$('.chat-feed').scrollTop=$('.chat-feed').scrollHeight;}
 else if(action==='close-notice')closeNotice();
 else if(action==='voice')toast('沿用现有语音输入，这里只预览主动联系。');
 else if(action==='persona')toast('沿用现有的人格与表达设置。');
 else if(el.matches('.contact'))go('chat');
 else if(el.matches('.rail-bottom button[aria-label="设置"]'))go('settings');
 else if(el.matches('.rail-bottom button[aria-label="切换主题"]')){go('quiet');}
 else if(el.matches('.contact-tabs button')){document.querySelectorAll('.contact-tabs button').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-selected',b===el?'true':'false');});toast('预览只展示本次主动联系的演示会话');}
 else if(el.matches('.rail-links button,.add-contact,.tool'))toast('独立预览，现有功能保持原样。');
});
document.addEventListener('change',event=>{if(event.target.dataset.setting)draft[event.target.dataset.setting]=event.target.value;});
document.addEventListener('input',event=>{if(event.target.matches('[aria-label="主动联系偏好"]'))draft.directive=event.target.value;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('.notification-demo').hidden)closeNotice();else go('chat');}if(event.key==='Tab'&&(!$('.notification-demo').hidden||(!$('.pro-panel').hidden&&innerWidth<=900))){const parent=!$('.notification-demo').hidden?$('.notification-demo'):$('.pro-panel'),items=[...parent.querySelectorAll('button:not(:disabled),input,textarea,summary')].filter(e=>!e.closest('[inert]')&&e.getClientRects().length);if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}}});
$('.notice-backdrop').addEventListener('click',closeNotice);
$('.composer').addEventListener('submit',event=>{event.preventDefault();const ta=$('.compose-line textarea'),text=ta.value.trim();if(!text)return;const article=document.createElement('article');article.className='message user-message';article.innerHTML='<span class="avatar me">我</span><div class="message-body"><div class="bubble"></div></div>';article.querySelector('.bubble').textContent=text;$('.chat-feed').appendChild(article);ta.value='';$('.contact.selected .unread-label').textContent='AI 伙伴';$('.chat-feed').scrollTop=$('.chat-feed').scrollHeight;toast('演示回复，不会发送或扣积分');});
$('.compose-line textarea').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('.composer').requestSubmit();}});
$('.contacts footer .preview-tag').textContent='主动联系 · 独立交互预览 · 演示资料';
$('.contacts footer').insertAdjacentHTML('afterbegin','<div class="mini-banner">'+icon('Bell')+'想聊的时候，小满会先找你。<button data-go="settings">设置</button></div>');
$('.contacts header').insertAdjacentHTML('beforeend','<button class="icon-button demo-contact-badge" data-go="chat" aria-label="返回聊天">'+icon('X')+'</button>');
icons();feed();go(screen);if(params.get('screen')==='notification')notice();
