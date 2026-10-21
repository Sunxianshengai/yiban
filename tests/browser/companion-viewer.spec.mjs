import {test,expect} from '@playwright/test';

// 查看者（viewer）看到的世界：能聊天，但改不了家伴的设定，也看不到编辑入口。
test('查看者能跟家伴说话，但改不了它的设定',async({browser})=>{
  const BASE=process.env.PW_BASE_URL||'http://localhost:3711';
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));

  // 先用管理员签一个查看者邀请码。
  const status=await (await page.request.get('/api/auth/status')).json();
  if(status.needsSetup) await page.request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
  else if(!status.user) await page.request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
  const invite=await (await page.request.post('/api/auth/invite',{data:{role:'viewer'}})).json();
  const created=await page.request.post('/api/auth/register',{
    data:{code:invite.code,name:'只看不写',email:`viewer-${Date.now()}@yiban.test`,password:'ViewerPass123!'},
  });
  expect(created.status()).toBe(201);

  await page.goto('/');
  await page.waitForSelector('.app-shell');
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion')).toBeVisible({timeout:15000});

  // 能聊
  await page.getByLabel('跟家伴说一句话').fill('你好');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  // 没有编辑入口
  await expect(page.getByRole('button',{name:'编辑家伴'})).toHaveCount(0);

  expect(errs).toEqual([]);
  await ctx.close();
});
