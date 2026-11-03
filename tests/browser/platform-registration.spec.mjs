import {test,expect,request as apiRequest} from '@playwright/test';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: optional invitation creates an isolated family and only the owner sees platform controls`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width,height});
  const root=await apiRequest.newContext({baseURL:BASE});
  const status=await(await root.get('/api/auth/status')).json();expect(['test','development','preview']).toContain(status.environment);
  const credentials={name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'};
  if(status.needsSetup)expect((await root.post('/api/auth/setup',{data:credentials})).status()).toBe(201);
  else expect((await root.post('/api/auth/login',{data:credentials})).status()).toBe(200);
  const owner=(await(await root.get('/api/auth/status')).json()).user;
  await page.goto('/app');await page.getByRole('button',{name:'注册新账号',exact:true}).click();
  const invite=page.getByLabel('家庭邀请码（选填）');expect(await invite.getAttribute('required')).toBeNull();
  const name='独立家庭'+Date.now();await page.getByLabel('你的姓名',{exact:true}).fill(name);await page.getByLabel('邮箱',{exact:true}).fill(`family-${Date.now()}@yiban.test`);await page.getByLabel('密码',{exact:true}).fill('TestPassword123!');
  await page.screenshot({path:`.impeccable/review/optional-invitation-${device}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'注册并进入',exact:true}).click();await expect(page.locator('.app-shell')).toBeVisible();
  const state=await(await page.request.get('/api/state')).json();expect(state.account.role).toBe('admin');expect(state.account.platformRole).toBeNull();expect(state.account.familyId).not.toBe(owner.familyId);expect(state.memories).toEqual([]);
  await page.locator('.fa-home-heading').getByRole('button',{name:'更多功能'}).click();await page.getByRole('dialog').getByRole('button',{name:'我的账号',exact:true}).click();await expect(page.getByRole('button',{name:'平台管理',exact:true})).toHaveCount(0);
  expect((await page.request.post('/api/auth/login',{data:credentials})).status()).toBe(200);await page.reload();
  await page.locator('.fa-home-heading').getByRole('button',{name:'更多功能'}).click();await page.getByRole('dialog').getByRole('button',{name:'我的账号',exact:true}).click();
  if(device==='mobile')await page.getByLabel('更多设置',{exact:true}).click();
  await page.getByRole('button',{name:'平台管理',exact:true}).filter({visible:true}).click();
  const panel=page.getByRole('dialog',{name:'平台管理',exact:true});await expect(panel).toBeVisible();await expect(panel.getByLabel('选择家庭')).toContainText(name+'的家庭');
  await panel.getByLabel('选择账号').selectOption(state.account.id);
  await panel.getByRole('button',{name:'查看该账号积分',exact:true}).click();await expect(panel.getByText(/可用 \d+ 积分 · 冻结/)).toBeVisible();
  await panel.getByRole('button',{name:'查看数据',exact:true}).click();await expect(panel.locator('.platform-record').first()).toBeVisible();
  await panel.getByLabel('选择家庭').selectOption(state.account.familyId);
  await page.screenshot({path:`.impeccable/review/platform-admin-${device}.png`,animations:'disabled'});
  await panel.getByRole('button',{name:'进入家庭管理',exact:true}).click();await expect(panel).not.toBeVisible();
  await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).account.familyId).toBe(state.account.familyId);
  expect((await(await page.request.get('/api/auth/status')).json()).user.platformRole).toBe('owner');
  expect((await root.get('/api/platform')).status()).toBe(200);await root.dispose();
 });
}
