import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

test.beforeEach(async ({page})=>{await signInAsNewAdmin(page,{name:'测试家长',prefix:'dock'});});

// 常驻聊天框：不请自来地弹出来会挡住内容，所以默认收起；
// 但用户一旦点开，之后就一直在——这是「一直都有对话框」的本意。
test('右下角一直有家伴：默认收起，点开能聊，换页还在', async ({page})=>{
  // 任何一页都能看到这枚按钮，包括记忆库、设置这些跟对话无关的页面。
  await page.getByRole('button',{name:'家庭记忆库'}).click();
  await expect(page.locator('.companion-dock-toggle')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toHaveCount(0);

  await page.getByRole('button',{name:'打开聊天框'}).click();
  const panel=page.getByRole('dialog',{name:'家伴对话'});
  await expect(panel).toBeVisible({timeout:15000});
  await expect(panel.locator('.companion-opening')).toBeVisible();

  await panel.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await panel.getByRole('button',{name:'说一句'}).click();
  await expect(panel.locator('.companion-line.user')).toHaveCount(1,{timeout:15000});
  await expect(panel.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  // 换到另一页，框还开着，刚才说的话也还在（同一个会话线程）。
  await page.getByRole('button',{name:'故事专辑'}).click();
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'家伴对话'}).locator('.companion-line.user')).toHaveCount(1);

  // 收起之后才消失。
  await page.getByRole('button',{name:'收起聊天框'}).click();
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toHaveCount(0);
});

test('展开状态会记住，家伴自己的页面上不重复出现', async ({page})=>{
  await page.getByRole('button',{name:'打开聊天框'}).click();
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toBeVisible({timeout:15000});

  // 刷新后仍按上次的选择保持展开。
  await page.reload();
  await page.waitForSelector('.app-shell');
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toBeVisible({timeout:20000});

  // 进到家伴整页时，浮层要让位——同一条对话不能同屏说两遍。
  await page.getByRole('button',{name:'家伴'}).click();
  await expect(page.locator('.companion-page-main .companion')).toBeVisible({timeout:15000});
  await expect(page.locator('.companion-dock-toggle')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'家伴对话'})).toHaveCount(0);
});

test('点开来历能回到那段记忆；手机上不横向溢出', async ({page})=>{
  await page.getByRole('button',{name:'打开聊天框'}).click();
  const panel=page.getByRole('dialog',{name:'家伴对话'});
  await expect(panel).toBeVisible({timeout:15000});

  await panel.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await panel.getByRole('button',{name:'说一句'}).click();
  await expect(panel.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  const sources=panel.locator('.companion-sources .text-link');
  if(await sources.count()>0){
    await sources.first().click();
    await expect(page.getByRole('dialog',{name:'一段珍藏的记忆'})).toBeVisible();
    await page.getByRole('button',{name:'关闭窗口'}).click();
  }

  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    expect(overflow,`${viewport.width}px 不应横向溢出`).toBe(false);
  }
});
