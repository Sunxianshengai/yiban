import {expect} from '@playwright/test';

// 统一的测试登录口径。
//
// 曾经每个 spec 都走「创建管理员账号 → 邀请码留空 → 创建新的家庭空间」。
// 那条路其实是个后门：任何匿名访客都能自己注册成管理员（首个管理员本该只走
// /auth/setup）。后端已经堵上，这里改成正规做法——先用已有管理员签一个
// admin 邀请码，再用码注册一个干净的、独立的账号（偏好互不影响）。
export const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

const ROOT_ADMIN={name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'};

// 清掉上一轮遗留的测试数据。
//
// 搜索是「按词命中」的：一条叫「自动测试家庭记忆1792…」的记忆会被拆成
// 「自动测试家庭 / 时间戳」两个词，于是新造的同名前缀记忆会顺带命中所有历史
// 残留，`.memory-card` 就数出 2 张。用例本身还有 try/finally 兜底，但被中断
// 的那次跑会留下垃圾——先扫一遍，让用例从干净状态开始。
export async function cleanupTestMemories(request,prefix='自动测试'){
  const state=await (await request.get('/api/state')).json();
  const stale=(state.memories||[]).filter(m=>String(m.title||'').startsWith(prefix));
  for(const memory of stale) await request.delete(`/api/memories/${memory.id}`);
  return stale.length;
}

// 对话功能全部依赖模型。E2E 跑在 `tests/mock-model.mjs` 起的假服务上，
// 这里只负责问一句「这次跑的环境里模型通没通」，让用例能给出准确的失败原因。
export async function modelReady(request){
  const status=await (await request.get('/api/auth/status')).json();
  if(!status.user)return false;
  const data=await (await request.get('/api/companion')).json();
  return Boolean(data.aiEnabled);
}

export async function signInAsNewAdmin(page,{name='测试家长',prefix='u',credits=1000}={}){
  const req=page.request;
  const status=await (await req.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await req.post('/api/auth/setup',{data:ROOT_ADMIN});
    expect(setup.status(),'首次 setup 应成功').toBe(201);
  } else if(!status.user){
    const login=await req.post('/api/auth/login',{data:{email:ROOT_ADMIN.email,password:ROOT_ADMIN.password}});
    expect(login.status(),'根管理员应能登录').toBe(200);
  }
  const invite=await (await req.post('/api/auth/invite',{data:{role:'admin'}})).json();
  expect(invite.code,'应拿到管理员邀请码').toMatch(/^[A-F0-9]{12}$/);
  const email=`${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}@yiban.test`;
  const created=await req.post('/api/auth/register',{
    data:{code:invite.code,name,email,password:'TestPassword123!'},
  });
  expect(created.status(),'用邀请码注册应成功').toBe(201);
  if(credits)await fundTestAccount(req,credits);
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  await page.waitForSelector('.app-shell',{timeout:30000});
  return email;
}

// Explicit test funding; production signup never grants credits automatically.
export async function fundTestAccount(request,amount=1000) {
  const status=await (await request.get('/api/auth/status')).json();
  const result=await request.post('/api/credits/grant',{data:{userId:status.user.id,amount,note:'隔离浏览器测试额度'}});
  expect(result.status(),'管理员为测试账号发放积分').toBe(201);
}

// Primary navigation stays focused; auxiliary tools live in the real More menu.
export async function openMore(page){
  const homeBack=page.getByRole('button',{name:'返回首页',exact:true});
  if(await homeBack.isVisible())await homeBack.click();
  const desktop=page.locator('.sidebar-bottom').getByRole('button',{name:'更多功能',exact:true});
  if(await desktop.isVisible())await desktop.click();
  else{const back=page.getByRole('button',{name:'返回联系页',exact:true});if(await back.isVisible())await back.click();const contact=page.locator('.fa-contact').getByRole('button',{name:'更多功能',exact:true});if(await contact.isVisible())await contact.click();else{const home=page.locator('.fa-home').getByRole('button',{name:'更多功能',exact:true});if(!await home.isVisible())await page.locator('.mobile-nav').getByRole('button',{name:'首页',exact:true}).click();await page.locator('.fa-home').getByRole('button',{name:'更多功能',exact:true}).click();}}
  await expect(page.getByRole('dialog',{name:'更多功能',exact:true})).toBeVisible();
}
export async function openChatSettings(page){const direct=page.locator('.pw-chat-settings');if(await direct.isVisible()){await direct.click();}else{await page.getByLabel('对话菜单',{exact:true}).click();await page.getByRole('button',{name:'聊天设置',exact:true}).click();}await expect(page.getByRole('dialog',{name:'聊天设置',exact:true})).toBeVisible();}
export async function openCredits(page){await openMore(page);await page.getByRole('dialog',{name:'更多功能',exact:true}).getByRole('button',{name:'积分余额与消费',exact:true}).click();await expect(page.getByRole('heading',{name:'我的积分',exact:true})).toBeVisible();}
export async function clickNavItem(page,name){
  const button=page.locator('.side-nav').getByRole('button',{name:new RegExp('^'+name)});
  if(await button.count()){await button.click();return;}
  await openMore(page);await page.getByRole('dialog',{name:'更多功能',exact:true}).getByRole('button',{name:name==='家人故事'?'家人故事时间轴':name==='设置'?'账号、外观与设置':name,exact:true}).click();
}


export async function chooseSettingsTab(page,label){
  const desktop=page.locator('.pw-settings-nav');
  if(await desktop.isVisible())await desktop.getByRole('button',{name:label,exact:true}).click();
  else{const menu=page.locator('.pw-settings-mobile-menu');await menu.locator('summary').click();await menu.getByRole('button',{name:label,exact:true}).click();}
}
