import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin,openChatSettings} from './helpers.mjs';
async function openChat(page){await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();}
async function send(page,text){await page.getByLabel('发送给家伴的消息').fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});}
test.beforeEach(async({page})=>{await signInAsNewAdmin(page,{prefix:'workspace',credits:20});});
test('workspace streams, saves history, preserves edited versions, feedback and memory drafts',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await openChat(page);
  fs.mkdirSync('.impeccable/review',{recursive:true});await page.screenshot({path:'.impeccable/review/chat-desktop-empty.png'});
  await page.getByLabel('发送给家伴的消息').fill('你好');expect(await page.getByLabel('发送给家伴的消息').inputValue()).toBe('你好');
  await send(page,'今天一起做晚饭\n妈妈教我做菜');
  await expect(page.locator('.cw-assistant')).toContainText('听见了');await expect(page.locator('.cw-user-text')).toHaveText('今天一起做晚饭\n妈妈教我做菜');await expect(page.locator('.credits-balance strong')).toHaveText('19');
  await page.locator('.cw-assistant').last().getByRole('button',{name:'消息操作',exact:true}).click();await page.getByRole('button',{name:'有帮助',exact:true}).click();await page.locator('.cw-assistant').last().getByRole('button',{name:'消息操作',exact:true}).click();await expect(page.getByRole('button',{name:'有帮助',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'重新生成',exact:true}).click();await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});await expect(page.locator('.cw-versions')).toContainText('2 / 2');
  await page.getByRole('button',{name:'上一个版本',exact:true}).click();await page.locator('.cw-assistant').last().getByRole('button',{name:'消息操作',exact:true}).click();await expect(page.getByRole('button',{name:'有帮助',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');await page.locator('.cw-user').last().getByRole('button',{name:'消息操作',exact:true}).click();await page.getByRole('button',{name:'编辑消息',exact:true}).click();await page.getByRole('textbox',{name:'编辑消息',exact:true}).fill('爸爸今天讲了一件童年的事');await page.getByRole('button',{name:'保存并重新生成',exact:true}).click();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});await expect(page.locator('.cw-user-text')).toHaveText('爸爸今天讲了一件童年的事');
  await page.screenshot({path:'.impeccable/review/chat-desktop.png'});
  // A general record draft must not overwrite a draft created from chat.
  await page.locator('.cw-assistant').last().getByRole('button',{name:'消息操作',exact:true}).click();await page.getByRole('button',{name:'存为记忆草稿',exact:true}).click();const record=page.getByRole('dialog',{name:'记一段回忆'});await expect(record.getByLabel('这段记忆的故事')).toContainText('爸爸今天');await record.getByRole('button',{name:'稍后继续',exact:true}).click();
  await page.reload();await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();await expect(page.locator('.cw-user-text')).toHaveText('爸爸今天讲了一件童年的事');
  await page.getByLabel('发送给家伴的消息').fill('尚未发送的个人草稿');await page.reload();await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();await expect(page.getByLabel('发送给家伴的消息')).toHaveValue('尚未发送的个人草稿');
  expect(errors).toEqual([]);
});
test('stop refunds, menus persist, history can be searched, renamed, archived and deleted',async({page})=>{
  await openChat(page);await openChatSettings(page);await page.getByRole('button',{name:'聊聊回忆',exact:true}).click();await page.getByRole('button',{name:'简洁',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByLabel('发送给家伴的消息').fill('想聊聊全家的旅行');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.locator('.cw-assistant')).toContainText('听见了');await page.getByRole('button',{name:'停止生成',exact:true}).click();
  await expect(page.locator('.cw-message-status')).toContainText('已停止');await expect(page.locator('.credits-balance strong')).toHaveText('20');
  await openChatSettings(page);await expect(page.getByRole('button',{name:'聊聊回忆',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'简洁',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByLabel('对话菜单',{exact:true}).click();await page.getByRole('button',{name:'重命名',exact:true}).click();const rename=page.getByRole('dialog',{name:'重命名对话'});await rename.getByLabel('对话名称').fill('全家的旅行');await rename.getByRole('button',{name:'保存',exact:true}).click();
  if(!await page.getByLabel('搜索历史会话').isVisible())await page.getByRole('button',{name:'展开历史会话',exact:true}).click();await page.getByLabel('搜索历史会话').fill('全家的旅行');await expect(page.locator('.cw-history-item')).toHaveCount(1);
  await page.getByLabel('对话菜单',{exact:true}).click();await page.getByRole('button',{name:'归档对话',exact:true}).click();await expect(page.getByRole('button',{name:'恢复并继续聊',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'恢复并继续聊',exact:true}).click();await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();
  await page.getByLabel('对话菜单',{exact:true}).click();await page.getByRole('button',{name:'删除对话',exact:true}).click();await page.getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.locator('.cw-message')).toHaveCount(0);
});
test('memory picker exposes confirmed sources and phone keeps composer and history accessible',async({page})=>{
  const title=`夏天的老屋${Date.now()}`;
  const memory=await (await page.request.post('/api/memories',{data:{title,story:'2008 年在院子里一起吃西瓜。',year:'2008',status:'confirmed',people:[],tags:[]}})).json();
  try{
    await openChat(page);await openChatSettings(page);await page.getByLabel('家庭记忆选项').click();await page.getByRole('button',{name:'选择家庭记忆…',exact:true}).click();const dialog=page.getByRole('dialog',{name:'选择家庭记忆'});await dialog.getByRole('checkbox',{name:title}).check();await dialog.getByRole('button',{name:'使用所选记忆',exact:true}).click();
    await send(page,'聊聊老屋里的那个夏天');await expect(page.locator('.cw-sources')).toContainText(title);await page.locator('.cw-sources').getByRole('button',{name:title}).click();await expect(page.getByRole('dialog')).toContainText('2008');await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
    await page.setViewportSize({width:390,height:844});await expect(page.getByLabel('发送给家伴的消息')).toBeInViewport();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.impeccable/review/chat-mobile.png'});
    const toggle=page.locator('.cw-history-toggle');await toggle.click();const history=page.getByRole('dialog',{name:'历史会话',exact:true});await expect(history).toBeVisible();await expect(toggle).toHaveAttribute('aria-expanded','true');const close=history.getByRole('button',{name:'关闭历史会话',exact:true});await expect(close).toBeFocused();
    await close.press('Shift+Tab');await expect(history.getByRole('button',{name:'消费记录',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();await expect(page.locator('.cw-main')).toHaveJSProperty('inert',true);
    await page.screenshot({path:'.impeccable/review/chat-mobile-history.png'});await page.keyboard.press('Escape');await expect(history).not.toBeVisible();await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.locator('.cw-main')).toHaveJSProperty('inert',false);
    await page.evaluate(()=>document.documentElement.style.fontSize='24px');await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeInViewport();await expect(page.getByLabel('发送给家伴的消息')).toBeInViewport();expect(await page.getByLabel('发送给家伴的消息').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBe(24);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.impeccable/review/chat-mobile-large.png'});await page.evaluate(()=>document.documentElement.style.fontSize='');
    await page.setViewportSize({width:820,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await page.locator('.cw-main').boundingBox()).width).toBeGreaterThan(650);await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeInViewport();await page.screenshot({path:'.impeccable/review/chat-tablet.png'});
  }finally{await page.request.delete(`/api/memories/${memory.id}`);}
});
