// Isolated design prototype. All people, memories and replies below are illustrative.
// No account, storage, upload, microphone or AI requests are made.
const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const query=new URLSearchParams(location.search),app=$('.app-frame');
const svg=name=>window.previewIcons[name]||window.previewIcons.Circle;
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=svg(el.dataset.icon);});}
let screen=query.get('screen')||'chat',theme=query.get('theme')||'dark',memoryOn=true,selectedMessage=null,toastTimer;
document.documentElement.dataset.theme=theme;
function toast(text){$('.toast').textContent=text;$('.toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').hidden=true,3200);}
const profilePanel=()=>`<div class="profile-intro"><span class="avatar xiaoman-avatar"><img src="assets/xiaoman-sticker.png" alt="小满演示头像"></span><h2>小满</h2><span>AI 伙伴 · 原创演示角色</span><p>不急着给答案。<br>想陪你把普通的日子，聊得有意思一点。</p><div class="profile-traits"><span>温和</span><span>有点俏皮</span><span>愿意倾听</span></div></div><section class="detail-section"><button class="detail-row" data-go="memory"><i data-icon="Leaf"></i><span><strong>对我的了解</strong><small>喜好、近况和舒服的相处方式</small></span><em>自动记忆</em><i data-icon="ChevronRight"></i></button><button class="detail-row" data-go="persona"><i data-icon="SlidersHorizontal"></i><span>人格与表达</span><i data-icon="ChevronRight"></i></button></section><section class="detail-section"><h3>这段聊天</h3><button class="detail-row" data-go="history"><i data-icon="Search"></i><span>查找聊天记录</span><i data-icon="ChevronRight"></i></button><button class="detail-row" data-action="favorite"><i data-icon="Bookmark"></i><span>收藏的消息</span><i data-icon="ChevronRight"></i></button><button class="detail-row" data-action="new-topic"><i data-icon="MessageCirclePlus"></i><span>换个话题</span><i data-icon="ChevronRight"></i></button></section><section class="detail-section"><button class="detail-row" data-action="theme"><i data-icon="SunMoon"></i><span>聊天外观</span><em>${theme==='dark'?'深色':'浅色'}</em><i data-icon="ChevronRight"></i></button><button class="detail-row" data-action="credits"><i data-icon="Coins"></i><span>积分与消费</span><i data-icon="ChevronRight"></i></button></section><p class="memory-description">这里是独立交互预览，人物与聊天均为演示内容。家庭记忆保持现状。</p>`;
const memoryPanel=()=>`<div class="memory-head"><h2 class="memory-subtitle">一点点，更了解你</h2><p>从日常聊天里，记住值得留到下次的事。</p></div><div class="memory-automatic"><i data-icon="Leaf"></i><div><strong>${memoryOn?'自动了解，持续更新':'自动记忆已暂停'}</strong><p>${memoryOn?'你只管聊天，也能随时纠正或让我忘记。':'已存内容保留，可随时重新开启。'}</p></div><button role="switch" class="switch" aria-label="自动记忆" aria-checked="${memoryOn}" data-action="memory-toggle"><span></span></button></div><section class="memory-block"><h3><i data-icon="UserRound"></i>关于你</h3><p>喜欢茉莉花茶，不太喝咖啡。<small>来自聊天 · 演示记忆</small></p></section><section class="memory-block"><h3><i data-icon="Clock3"></i>最近的事</h3><p>今天结束了面试，过程比预想顺利。<small>今天更新 · 已替换“正在准备面试”</small></p></section><section class="memory-block"><h3><i data-icon="HeartHandshake"></i>喜欢的相处方式</h3><p>想倾诉时，希望先被听见，不急着分析。<small>来自你的明确表达 · 演示记忆</small></p></section><button class="secondary-link" data-go="memory-edit">检查、修改与遗忘</button><p class="memory-description"><i data-icon="LockKeyhole"></i> 仅你与小满使用，不与其他伙伴或家人共享。<br>示例展示的是拟议体验，尚未连接实际记忆服务。</p>`;
function panelContent(type){
  if(type==='memory')return memoryPanel();
  if(type==='memory-edit')return `<h2 class="memory-subtitle">修改这份了解</h2><p class="memory-description" style="margin:0 0 20px">你说的，始终优先。</p><label class="memory-block"><h3>喜欢的相处方式</h3><textarea class="memory-edit" aria-label="修改演示记忆">想倾诉时，希望先被听见，不急着分析。</textarea></label><div class="panel-save"><button data-go="memory">取消</button><button data-action="save-memory">保存</button></div><button class="detail-row" style="margin-top:24px" data-action="forget"><i data-icon="Trash2"></i><span>忘记这件事</span></button><p class="memory-description">删除长期记忆不会一并清除原聊天记录。</p>`;
  if(type==='history')return `<h2 class="memory-subtitle">聊过的话</h2><label class="contact-search" style="margin:20px 0"><i data-icon="Search"></i><input aria-label="搜索演示历史" placeholder="搜索关键词或日期"></label><div class="history-item"><small>今天 · 20:42</small><button data-action="history-jump">面试完回来了。比我想的顺利。</button></div><div class="history-item"><small>昨天 · 21:16</small><button data-action="history-jump">明天面试有点紧张，陪我练一遍吧。</button></div><div class="history-item"><small>周日 · 19:30</small><button data-action="history-jump">最近想给自己留一点慢下来的时间。</button></div><p class="memory-description">演示历史，不读取你的实际聊天。</p>`;
  if(type==='persona')return `<div class="profile-intro"><span class="avatar xiaoman-avatar"><img src="assets/xiaoman-sticker.png" alt=""></span><h2>小满</h2><span>人格与表达 · 演示设定</span></div><section class="memory-block"><h3>这份陪伴</h3><p>温和、自然，有一点俏皮。愿意听日常的小事，不急着给建议。</p></section><section class="memory-block"><h3>怎么说话</h3><p>日常交流以短句为主，按语义分条。适度使用表情，避免每次结尾都追问。</p></section><section class="memory-block"><h3>高级设置</h3><p>回复示例、重要背景和表达边界放在这里，需要时再调整。</p></section><p class="memory-description">设计预览，不修改已保存的人格。</p>`;
  return profilePanel();
}
function go(target,update=true){
  screen=target;app.dataset.screen=screen;const isPanel=!['chat','contacts','actions'].includes(screen);app.classList.toggle('panel-open',isPanel);
  if(isPanel){$('.panel-title').textContent=({memory:'对我的了解','memory-edit':'管理个人记忆',history:'聊天记录',persona:'人格与表达'})[screen]||'聊天详情';$('.panel-content').innerHTML=panelContent(screen);icons($('.detail-panel'));$('.panel-content').scrollTop=0;}
  if(update){const url=new URL(location.href);url.searchParams.set('screen',screen);url.searchParams.set('theme',theme);history.replaceState(null,'',url);}
  if(screen==='actions')setTimeout(()=>openMessage($('.last-message')),100);
}
function closeOverlays(){$('.message-popover').hidden=true;$('.bottom-sheet').hidden=true;$('.action-backdrop').hidden=true;$$('.is-selected').forEach(el=>el.classList.remove('is-selected'));}
function openMessage(target){
  closeOverlays();selectedMessage=target;const user=target.closest('.user-message'),sticker=target.classList.contains('sticker-message');
  const rows=user?[['Copy','复制','copy'],['SquarePen','编辑这条消息','edit'],['Bookmark','收藏','favorite'],['Star','这件事请记住','remember']]:sticker?[['Bookmark','收藏表情','favorite'],['MessageSquareQuote','回复','reply']]:[['Copy','复制','copy'],['MessageSquareQuote','回复','reply'],['RotateCw','换个回复','regenerate'],['SlidersHorizontal','换一种方式说','suggest'],['Bookmark','收藏','favorite'],['MessageCircleWarning','这里记错了','correction']];
  $('.message-popover').innerHTML='<div class="emoji-reactions" aria-label="演示表情回应">'+['🤍','😄','🥹','👏'].map(x=>`<button data-reaction="${x}" aria-label="回应${x}">${x}</button>`).join('')+'</div>'+rows.map(([icon,label,action])=>`<button data-action="${action}"><i data-icon="${icon}"></i>${label}</button>`).join('');icons($('.message-popover'));$('.message-popover').hidden=false;$('.action-backdrop').hidden=false;
  target.closest('.message').classList.add('is-selected');
  const rect=target.getBoundingClientRect(),pop=$('.message-popover'),width=pop.offsetWidth,height=pop.offsetHeight;
  pop.style.left=Math.min(innerWidth-width-15,Math.max(15,rect.left))+'px';pop.style.top=Math.max(15,rect.bottom+height+25>innerHeight?rect.top-height-9:rect.bottom+9)+'px';
}
function sheet(title,body){closeOverlays();$('.bottom-sheet').innerHTML=`<header><strong>${title}</strong><button class="icon-button" data-action="close-sheet" aria-label="关闭面板"><i data-icon="X"></i></button></header>${body}`;icons($('.bottom-sheet'));$('.bottom-sheet').hidden=false;$('.action-backdrop').hidden=false;}
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-go]');if(nav){closeOverlays();go(nav.dataset.go);return;}
  if(event.target.closest('.action-backdrop')){closeOverlays();return;}
  const reaction=event.target.closest('[data-reaction]');if(reaction){closeOverlays();toast('已添加演示回应 '+reaction.dataset.reaction);return;}
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='theme'){theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;go(screen);return;}
  if(action==='memory-toggle'){memoryOn=!memoryOn;go('memory');toast('演示开关已切换，不影响实际记忆设置');return;}
  if(action==='save-memory'){go('memory');toast('演示修改完成，未写入实际账号');return;}
  if(action==='forget'){sheet('忘记这件事？','<p class="sheet-note">这是交互演示。正式应用中删除长期记忆，原聊天记录仍会保留。</p><div class="panel-save"><button data-action="close-sheet">取消</button><button data-action="forget-demo">确认遗忘</button></div>');return;}
  if(action==='forget-demo'){closeOverlays();go('memory');toast('已演示遗忘操作，真实数据未改变');return;}
  if(action==='voice'){sheet('语音互动','<div class="sheet-actions"><button data-action="voice-demo"><i data-icon="Mic"></i>语音消息</button><button data-action="voice-demo"><i data-icon="Phone"></i>语音通话</button></div><p class="sheet-note">入口设计预览。未开启麦克风、未连接通话服务；正式能力需另行接入。</p>');return;}
  if(action==='attach'){sheet('分享这一刻','<div class="sheet-actions"><button data-action="media-demo"><i data-icon="Image"></i>照片</button><button data-action="media-demo"><i data-icon="Camera"></i>拍摄</button><button data-action="emoji"><i data-icon="Smile"></i>表情</button></div><p class="sheet-note">交互预览，不读取相册或上传文件。</p>');return;}
  if(action==='emoji'){sheet('给这句话一点表情','<div class="sheet-actions"><button class="sticker-choice" data-action="send-sticker"><img src="assets/xiaoman-sticker.png" alt="小满捧着热茶的演示表情"></button></div><p class="sheet-note">原创角色表情 · 演示素材</p>');return;}
  if(action==='send-sticker'){closeOverlays();toast('已预览表情发送方式');return;}
  if(action==='reply'){closeOverlays();$('.reply-preview').hidden=false;$('.compose-line textarea').focus();return;}
  if(action==='cancel-reply'){$('.reply-preview').hidden=true;return;}
  if(action==='copy'){closeOverlays();navigator.clipboard?.writeText(selectedMessage?.textContent||'').then(()=>toast('已复制')).catch(()=>toast('可直接选择消息文字复制'));return;}
  if(action==='suggest'||action==='correction'){closeOverlays();sheet(action==='correction'?'告诉我哪里记错了':'你更喜欢怎样的回应？',`<textarea class="memory-edit" aria-label="调整演示回应" placeholder="${action==='correction'?'比如：面试已经结束了。':'比如：先听我说，暂时不用给建议。'}"></textarea><div class="panel-save"><button data-action="close-sheet">取消</button><button data-action="suggest-demo">${action==='correction'?'纠正这份了解':'调整回应'}</button></div><p class="sheet-note">演示操作，不调用模型，不保存偏好。</p>`);return;}
  if(action==='close-sheet'){closeOverlays();return;}
  if(action==='history-jump'){go('chat');$('.chat-feed').scrollTop=0;toast('已返回对应的演示聊天');return;}
  if(action==='edit'){closeOverlays();$('.compose-line textarea').value=selectedMessage.textContent;$('.composer-area').classList.add('has-draft');$('.compose-line textarea').focus();toast('编辑演示，不更改原消息');return;}
  if(action==='remember'){closeOverlays();go('memory-edit');$('.memory-edit').value=selectedMessage.textContent;return;}
  if(action==='new-topic'){go('chat');toast('换话题保留个人了解，此处仅演示入口');return;}
  const hints={family:'家庭模块保持现状，本预览不修改。',new:'角色创建沿用已有流程，此处展示入口。',other:'此处为演示联系人，当前预览小满的聊天。',favorite:'已演示收藏操作，不写入真实记录。',recent:'当前显示最近聊天。',credits:'正式积分机制保持，预览不消耗积分。',regenerate:'正式版保留回复版本，预览不调用模型。','suggest-demo':'调整已演示，不影响实际人格。','media-demo':'图片入口预览，未读取或上传素材。','voice-demo':'语音入口预览，未请求麦克风。'};
  if(hints[action]){closeOverlays();toast(hints[action]);}
});
let pressTimer;
document.addEventListener('pointerdown',event=>{const target=event.target.closest('[data-message]');if(!target)return;pressTimer=setTimeout(()=>openMessage(target),450);});
for(const name of ['pointerup','pointercancel','pointermove'])document.addEventListener(name,()=>clearTimeout(pressTimer));
document.addEventListener('contextmenu',event=>{const target=event.target.closest('[data-message]');if(target){event.preventDefault();openMessage(target);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeOverlays();if(event.key==='F10'&&event.shiftKey&&event.target.matches('[data-message]')){event.preventDefault();openMessage(event.target);}});
$('.compose-line textarea').addEventListener('input',event=>$('.composer-area').classList.toggle('has-draft',Boolean(event.target.value.trim())));
$('.contact-search input').addEventListener('input',event=>{const text=event.target.value.trim();$$('.contact').forEach(item=>item.hidden=!item.textContent.includes(text));});
$('.composer').addEventListener('submit',event=>{event.preventDefault();const input=$('.compose-line textarea'),text=input.value.trim();if(!text)return;const article=document.createElement('article');article.className='message user-message';article.innerHTML='<span class="avatar me-avatar">我</span><div class="message-body"><button class="bubble" data-message="user"></button></div>';article.querySelector('.bubble').textContent=text;$('.chat-feed').append(article);input.value='';$('.composer-area').classList.remove('has-draft');$('.reply-preview').hidden=true;$('.chat-feed').scrollTop=$('.chat-feed').scrollHeight;toast('已演示发送，未调用模型或消耗积分。');});
$('.compose-line textarea').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('.composer').requestSubmit();}});
icons();go(screen,false);
