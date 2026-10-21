import {test,expect} from '@playwright/test';

// 人生模拟：从选人到走完一局，全程只依赖本地记忆，不调用模型。
test.beforeEach(async({page,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }else{
    const login=await request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(login.status()).toBe(200);
  }
  const cookies=(await request.storageState()).cookies;
  await page.context().addCookies(cookies);
});

test('人生模拟能从选人一路走到小结，并把真实记忆回扣出来',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'人生模拟'}).click();
  await expect(page.getByRole('heading',{name:'人生模拟'})).toBeVisible();
  await expect(page.getByText('事实只来自记忆原文')).toBeVisible();

  await page.getByRole('button',{name:'开始一段模拟'}).click();
  const modal=page.locator('.modal');
  await expect(modal.getByRole('heading',{name:'人生模拟'})).toBeVisible();

  // 选一位家人当主角（选别人，而不是自己）
  const subject=modal.locator('.subject-card').filter({hasText:'林阿姨'}).first();
  await expect(subject).toBeVisible();
  await subject.click();

  // 逐回合推进：每个路口三个选项 + 自由输入的兜底
  await expect(modal.getByText(/段 · 本地场景|模型润色/)).toBeVisible();
  await expect(modal.getByText('如果是你，你会怎么做？')).toBeVisible();

  let rounds=0;
  while(rounds<7&&await modal.locator('.choice-list button').first().isVisible().catch(()=>false)){
    await modal.locator('.choice-list button').first().click();
    rounds+=1;
    await expect(modal.locator('.game-line.truth')).toHaveCount(rounds);
    await expect(modal.locator('.game-line.truth').last().getByText('真实发生的是')).toBeVisible();
  }
  expect(rounds).toBeGreaterThan(0);

  // 走完：出现倾向小结，且明确写明它不是 TA 的真实答案
  await expect(modal.locator('.game-summary')).toBeVisible();
  await expect(modal.locator('.trait-bar')).toHaveCount(4);
  await expect(modal.locator('.game-summary')).toContainText('真实答案');

  // 小结不是心理测评：页面上写死了这层边界
  await expect(modal.locator('.game-summary')).toContainText('岔路口');
});

test('自由输入也能推进回合，空输入不提交',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'人生模拟'}).click();
  await page.getByRole('button',{name:'开始一段模拟'}).click();
  const modal=page.locator('.modal');
  await modal.locator('.subject-card').first().click();
  await expect(modal.getByText('如果是你，你会怎么做？')).toBeVisible();

  const submit=modal.getByRole('button',{name:'就这样'});
  await expect(submit).toBeDisabled();

  await modal.getByLabel('说一句你自己的选择').fill('我先回家看看，别的事往后放');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(modal.locator('.game-line.truth')).toHaveCount(1);
  await expect(modal.getByText('我先回家看看，别的事往后放')).toBeVisible();
});
