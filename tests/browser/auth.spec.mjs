import {test,expect,request as apiRequest} from '@playwright/test';
import {clickNavItem} from './helpers.mjs';

// 不再硬编码 :3100 —— 之前它要求另起一个 3100 端口的服务，本机没起就 ECONNREFUSED。
// 统一跟随 PW_BASE_URL（默认与 playwright.config.mjs 的 3711 一致）。
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

test('first run, invitations, roles, media authorization and sign out',async({browser,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }
  const anonymous=await apiRequest.newContext({baseURL:BASE});
  expect((await anonymous.get('/api/state')).status()).toBe(401);
  expect((await anonymous.get('/api/search?q=老家')).status()).toBe(401);
  expect((await anonymous.get('/api/media/00000000-0000-0000-0000-000000000000.png')).status()).toBe(401);
  const secondSetup=await anonymous.post('/api/auth/setup',{data:{name:'越权',email:'bad@yiban.test',password:'TestPassword123!'}});
  expect(secondSetup.status()).toBe(403);
  const wrong=await anonymous.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'wrong-password'}});
  expect(wrong.status()).toBe(400);

  const admin=await apiRequest.newContext({baseURL:BASE});
  expect((await admin.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}})).status()).toBe(200);
  const invite=await (await admin.post('/api/auth/invite',{data:{role:'viewer'}})).json();
  expect(invite.code).toMatch(/^[A-F0-9]{12}$/);
  const viewer=await apiRequest.newContext({baseURL:BASE});
  const email=`viewer-${Date.now()}@yiban.test`;
  expect((await viewer.post('/api/auth/register',{data:{code:invite.code,name:'小林',email,password:'ViewerPassword123!'}})).status()).toBe(201);
  expect((await anonymous.post('/api/auth/register',{data:{code:invite.code,name:'重复',email:'repeat@yiban.test',password:'ViewerPassword123!'}})).status()).toBe(400);
  const state=await (await viewer.get('/api/state')).json();expect(state.account.role).toBe('viewer');expect(state.memories.length).toBeGreaterThan(0);
  expect((await viewer.post('/api/memories',{data:{title:'不允许编辑'}})).status()).toBe(403);
  expect((await viewer.patch('/api/memories/demo-home',{data:{title:'不允许修改'}})).status()).toBe(403);
  expect((await viewer.delete('/api/memories/demo-home')).status()).toBe(403);
  expect((await viewer.post('/api/auth/invite',{data:{role:'editor'}})).status()).toBe(403);
  const code2=(await (await admin.post('/api/auth/invite',{data:{role:'editor'}})).json()).code;
  const editor=await apiRequest.newContext({baseURL:BASE});
  expect((await editor.post('/api/auth/register',{data:{code:code2,name:'小陈',email:`editor-${Date.now()}@yiban.test`,password:'EditorPassword123!'}})).status()).toBe(201);
  expect((await editor.post('/api/memories',{data:{title:'编辑者的记忆',status:'draft'}})).status()).toBe(201);
  expect((await editor.post('/api/auth/invite',{data:{role:'viewer'}})).status()).toBe(403);
  expect((await editor.delete('/api/auth/accounts/no-such-user')).status()).toBe(403);
  const upload=await editor.post('/api/upload',{multipart:{file:{name:'family.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0WQAAAAASUVORK5CYII=','base64')}}});
  expect(upload.status()).toBe(200);const media=(await upload.json()).url;
  expect((await anonymous.get(media)).status()).toBe(401);
  expect((await viewer.get(media)).status()).toBe(404);
  expect((await editor.get(media)).status()).toBe(200);

  const page=await browser.newPage();await page.goto('/app');
  await expect(page.getByRole('heading',{name:'登录家庭空间'})).toBeVisible();
  await page.getByLabel('邮箱').fill('admin@yiban.test');await page.getByLabel('密码').fill('TestPassword123!');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
  await clickNavItem(page,'设置');
  await page.getByRole('button',{name:'管理登录账号'}).click();
  await expect(page.getByRole('dialog')).toContainText('小林');
  await page.getByRole('button',{name:'关闭窗口'}).click();
  await page.getByRole('button',{name:'退出登录'}).click();
  await expect(page.getByRole('heading',{name:'登录家庭空间'})).toBeVisible();
  expect((await page.request.get('/api/state')).status()).toBe(401);
  const viewerContext=await browser.newContext({storageState:await viewer.storageState()});
  const viewerPage=await viewerContext.newPage();await viewerPage.goto('/');
  await expect(viewerPage.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
  await expect(viewerPage.getByRole('button',{name:'添加一段记忆',exact:true})).toBeHidden();
  await viewerPage.getByRole('navigation').getByRole('button',{name:'记忆库'}).click();
  await expect(viewerPage.locator('.memory-card')).not.toHaveCount(0);
  await expect(viewerPage.getByRole('button',{name:'添加记忆',exact:true})).toBeHidden();
  await viewerContext.close();
  const viewerId=(await (await admin.get('/api/auth/accounts')).json()).accounts.find(a=>a.email===email).id;
  expect((await admin.delete(`/api/auth/accounts/${viewerId}`)).status()).toBe(200);
  expect((await viewer.get('/api/state')).status()).toBe(401);
  await page.close();
  await Promise.all([anonymous.dispose(),admin.dispose(),viewer.dispose(),editor.dispose()]);
});
