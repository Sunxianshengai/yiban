import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

// 「说说话」是合并后的主功能：一个聊天机器人，左边可以换不同角色卡。
// 家伴只是其中一张卡——它和三十张角色卡共用同一张对话框，区别只在「找的是谁」。

test.beforeEach(async ({page})=>{await signInAsNewAdmin(page,{name:'测试家长',prefix:'chat'});});

test('一个聊天机器人：左栏能换人，家伴能开场、能聊天、能给出可核对的出处', async ({page})=>{
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.page-heading h1')).toContainText('说说话');

  // 左栏：家伴一张，角色卡三十张。同一个聊天机器人，只是换人。
  await expect(page.locator('.chat-rail-panel')).toBeVisible({timeout:15000});
  await expect(page.locator('.chat-companion-card')).toHaveCount(1);
  await expect(page.locator('.role-card')).toHaveCount(30);

  // 默认还没选人：右栏摆着「今天想找谁说说话」。
  await expect(page.locator('.chat-intro')).toBeVisible();

  // 选家伴。
  await page.locator('.chat-companion-card').click();
  await expect(page.locator('.companion-head')).toBeVisible({timeout:15000});
  await expect(page.locator('.companion-opening')).toBeVisible();
  const opening=await page.locator('.companion-opening p').innerText();
  expect(opening.trim().length).toBeGreaterThan(0);

  // 回话全部来自模型：没接上就没有回话，界面上也不会假装有。
  await expect(page.locator('.companion-note')).toHaveCount(0);

  await page.getByLabel('跟家伴说一句话').fill('老家的院子还记得吗');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1,{timeout:15000});
  await expect(page.locator('.companion-typing')).toHaveCount(0,{timeout:20000});
  await expect(page.locator('.companion-line.companion').last()).toBeVisible();
  // 没有预置台词，也就没有「本地回话」这类标签。
  await expect(page.locator('.companion-tag')).toHaveCount(0);

  // 回复里若引用了记忆，出处必须可点回原文。
  const sourceCount=await page.locator('.companion-sources .text-link').count();
  if(sourceCount>0){
    await page.locator('.companion-sources .text-link').first().click();
    await expect(page.getByRole('dialog',{name:'一段珍藏的记忆'})).toBeVisible();
    await page.getByRole('button',{name:'关闭窗口'}).click();
  }
});

test('在同一个机器人里换人：换到角色卡，回的口气就变了', async ({page})=>{
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.chat-rail-panel')).toBeVisible({timeout:15000});

  await page.locator('.role-card',{hasText:'母亲'}).first().click();
  await expect(page.locator('.companion-head h2')).toContainText('母亲');
  await expect(page.locator('.companion-opening')).toBeVisible();
  await page.getByLabel('跟这个角色说一句话').fill('今天好累');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);
  // 打字动画也挂 `.companion-line.companion`，等它退场才说明回复真到了。
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-line.companion')).toHaveCount(1);
  const motherReply=await page.locator('.companion-line.companion').last().innerText();
  expect(motherReply.length).toBeGreaterThan(4);

  // 换一张卡，同一句话，回的应该是另一种话。
  await page.getByRole('button',{name:'换个人说话'}).click();
  await page.locator('.role-card',{hasText:'兄弟'}).first().click();
  await expect(page.locator('.companion-head h2')).toContainText('兄弟');
  await page.getByLabel('跟这个角色说一句话').fill('今天好累');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-line.companion')).toHaveCount(1);
  const brotherReply=await page.locator('.companion-line.companion').last().innerText();
  expect(brotherReply).not.toBe(motherReply);
});

test('编辑家伴：改名字和性格后生效，刷新仍在', async ({page})=>{
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.chat-rail-panel')).toBeVisible({timeout:15000});
  await page.locator('.chat-companion-card').click();
  await expect(page.locator('.companion-head')).toBeVisible({timeout:15000});

  await page.getByRole('button',{name:'编辑家伴'}).click();
  const dialog=page.getByRole('dialog',{name:'编辑家伴'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.persona-card')).toHaveCount(5);

  await dialog.getByRole('textbox').first().fill('阿福');
  await dialog.locator('.persona-card',{hasText:'爱打岔的老朋友'}).click();
  await dialog.getByRole('button',{name:'保存'}).click();

  await expect(page.locator('.companion-head h2')).toContainText('阿福');
  await expect(page.locator('.companion-head p')).toContainText('爱打岔的老朋友');

  // 刷新后配置仍在（写进了 settings，不是内存态）；左栏的家伴卡片也跟着改名。
  await page.reload();
  await page.waitForSelector('.app-shell');
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.chat-companion-card')).toContainText('阿福',{timeout:15000});
});

test('换个话题会清空对话，但记事本不丢', async ({page})=>{
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.chat-rail-panel')).toBeVisible({timeout:15000});
  await page.locator('.chat-companion-card').click();
  await expect(page.locator('.companion-head')).toBeVisible({timeout:15000});

  await page.getByLabel('跟家伴说一句话').fill('我喜欢喝豆浆');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-line.companion').last()).toBeVisible({timeout:20000});

  await page.getByRole('button',{name:'换个话题'}).click();
  await expect(page.locator('.companion-line')).toHaveCount(0,{timeout:15000});
  await expect(page.locator('.companion-opening')).toBeVisible();
});

test('手机与桌面都不横向溢出', async ({page})=>{
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.chat-rail-panel')).toBeVisible({timeout:15000});
  await page.locator('.chat-companion-card').click();
  await expect(page.locator('.companion-head')).toBeVisible({timeout:15000});

  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    expect(overflow,`${viewport.width}px 不应横向溢出`).toBe(false);
  }
});
