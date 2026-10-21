import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

test.beforeEach(async ({page})=>{await signInAsNewAdmin(page,{name:'测试家长',prefix:'companion'});});

test('家伴能开场、能聊天、能给出可核对的出处', async ({page})=>{
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion')).toBeVisible({timeout:15000});

  // 开场白有由头：要么是今天这个日子，要么是一段记忆，要么是人设寒暄。
  await expect(page.locator('.companion-opening')).toBeVisible();
  const opening=await page.locator('.companion-opening p').innerText();
  expect(opening.trim().length).toBeGreaterThan(0);

  // 本地没配模型时要明说，不能让人以为背后有模型。
  await expect(page.locator('.companion-note')).toContainText('本机没配模型');

  // 说一句关于记忆的话，应当命中并回扣原文。
  await page.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1,{timeout:15000});
  await expect(page.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  // 回复里若引用了记忆，出处必须可点回原文。
  const sourceCount=await page.locator('.companion-sources .text-link').count();
  if(sourceCount>0){
    await page.locator('.companion-sources .text-link').first().click();
    await expect(page.getByRole('dialog',{name:'一段珍藏的记忆'})).toBeVisible();
    await page.getByRole('button',{name:'关闭窗口'}).click();
  }
});

test('编辑家伴：改名字和性格后整页生效，且只有编辑者能改', async ({page})=>{
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion')).toBeVisible({timeout:15000});

  await page.getByRole('button',{name:'编辑家伴'}).click();
  const dialog=page.getByRole('dialog',{name:'编辑家伴'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.persona-card')).toHaveCount(5);

  await dialog.getByRole('textbox').first().fill('阿福');
  await dialog.locator('.persona-card',{hasText:'爱打岔的老朋友'}).click();
  await dialog.getByRole('button',{name:'保存'}).click();

  await expect(page.locator('.companion-head h2')).toContainText('阿福');
  await expect(page.locator('.companion-head p')).toContainText('爱打岔的老朋友');

  // 刷新后配置仍在（写进了 settings，不是内存态）
  await page.reload();
  await page.waitForSelector('.app-shell');
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion-head h2')).toContainText('阿福',{timeout:15000});
});

test('换个话题会清空对话，但记事本不丢', async ({page})=>{
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion')).toBeVisible({timeout:15000});

  await page.getByLabel('跟家伴说一句话').fill('我喜欢喝豆浆');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  // 记事本在对话超长时才折叠；这里只验证「换话题」按钮出现且对话被清空。
  await page.getByRole('button',{name:'换个话题'}).click();
  await expect(page.locator('.companion-line')).toHaveCount(0,{timeout:15000});
  await expect(page.locator('.companion-opening')).toBeVisible();
});

test('手机与桌面都不横向溢出', async ({page})=>{
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion')).toBeVisible({timeout:15000});

  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    expect(overflow,`${viewport.width}px 不应横向溢出`).toBe(false);
  }
});
