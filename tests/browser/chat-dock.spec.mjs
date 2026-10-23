import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

test.beforeEach(async ({page})=>{await signInAsNewAdmin(page,{name:'测试家长',prefix:'dock'});});

// 常驻聊天框：不请自来地弹出来会挡住内容，所以默认收起；
// 但用户一旦点开，之后就一直在——这是「一直都有对话框」的本意。
// 它跟整页是同一个聊天机器人：同一个接口、同一套会话，只是尺寸不同。
test('右下角一直有对话框：默认收起，点开能聊，换页还在', async ({page})=>{
  // 任何一页都能看到这枚按钮，包括记忆库、设置这些跟对话无关的页面。
  await page.getByRole('button',{name:'记忆库'}).click();
  await expect(page.locator('.companion-dock-toggle')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'聊天框'})).toHaveCount(0);

  await page.getByRole('button',{name:'打开聊天框'}).click();
  const panel=page.getByRole('dialog',{name:'聊天框'});
  await expect(panel).toBeVisible({timeout:15000});
  await expect(panel.locator('.companion-opening')).toBeVisible();

  await panel.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await panel.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(panel.locator('.companion-line.user')).toHaveCount(1,{timeout:15000});
  await expect(panel.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  // 换到另一页，框还开着，刚才说的话也还在（同一个会话线程）。
  await page.getByRole('button',{name:'回忆专辑'}).click();
  await expect(page.getByRole('dialog',{name:'聊天框'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'聊天框'}).locator('.companion-line.user')).toHaveCount(1);

  // 收起之后才消失。
  await page.getByRole('button',{name:'收起聊天框'}).click();
  await expect(page.getByRole('dialog',{name:'聊天框'})).toHaveCount(0);
});

test('浮层里也能换人：一个下拉就能从家伴换到角色卡', async ({page})=>{
  await page.getByRole('button',{name:'记忆库'}).click();
  await page.getByRole('button',{name:'打开聊天框'}).click();
  const panel=page.getByRole('dialog',{name:'聊天框'});
  await expect(panel).toBeVisible({timeout:15000});

  // 下拉里家伴排第一，后面是三十张角色卡。
  const options=panel.getByLabel('换个人').locator('option');
  expect(await options.count()).toBe(31);

  await panel.getByLabel('换个人').selectOption('daiyu');
  await expect(panel.locator('.companion-dock-head')).toContainText('林黛玉',{timeout:15000});
  await expect(panel.locator('.companion-opening')).toBeVisible();

  await panel.getByLabel('跟这个角色说一句话').fill('今天好累');
  await panel.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(panel.locator('.companion-typing')).toHaveCount(0,{timeout:20000});
  await expect(panel.locator('.companion-line.companion')).toHaveCount(1);
});

test('展开状态会记住，陪伴对话自己的页面上不重复出现', async ({page})=>{
  await page.getByRole('button',{name:'打开聊天框'}).click();
  await expect(page.getByRole('dialog',{name:'聊天框'})).toBeVisible({timeout:15000});

  // 刷新后仍按上次的选择保持展开。
  await page.reload();
  await page.waitForSelector('.app-shell');
  await expect(page.getByRole('dialog',{name:'聊天框'})).toBeVisible({timeout:20000});

  // 进到陪伴对话整页时，浮层要让位——同一条对话不能同屏说两遍。
  await page.getByRole('button',{name:'陪伴对话',exact:true}).click();
  await expect(page.locator('.chat-main-panel')).toBeVisible({timeout:15000});
  await expect(page.locator('.companion-dock-toggle')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'聊天框'})).toHaveCount(0);
});

test('点开来历能回到那段记忆；手机上不横向溢出', async ({page})=>{
  await page.getByRole('button',{name:'打开聊天框'}).click();
  const panel=page.getByRole('dialog',{name:'聊天框'});
  await expect(panel).toBeVisible({timeout:15000});

  await panel.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await panel.getByRole('button',{name:'说一句',exact:true}).click();
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
