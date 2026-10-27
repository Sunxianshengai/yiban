import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
test('multiline input, IME composition and per-account drafts behave like a chat workspace',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'chat-input',credits:5});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  const input=page.getByLabel('发送给家伴的消息');await expect(input).toBeEnabled();await input.fill('第一行');await input.press('Shift+Enter');await input.press('KeyA');await expect(input).toHaveValue('第一行\na');
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await expect(page.locator('.cw-message')).toHaveCount(0);
  await input.press('Enter');await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});await expect(page.locator('.cw-user-text')).toHaveText('第一行\na');
  await input.fill('账号一的未发送草稿');await page.request.post('/api/auth/logout');await signInAsNewAdmin(page,{prefix:'chat-other',credits:0});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();await expect(page.getByLabel('发送给家伴的消息')).toHaveValue('');await expect(page.locator('.cw-history-item')).toHaveCount(0);
});
test('downstream errors refund credits; markdown is readable and unsafe HTML cannot execute',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'chat-errors',credits:5});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  await page.getByLabel('发送给家伴的消息').fill('[test:fail]');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.locator('.cw-message-status')).toContainText('积分已退回');await expect(page.locator('.credits-balance strong')).toHaveText('5');
  await page.getByLabel('发送给家伴的消息').fill('[test:markdown]');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});
  const reply=page.locator('.cw-assistant').last();await expect(reply.locator('h2')).toHaveText('一段故事');await expect(reply.locator('table')).toBeVisible();await expect(reply.locator('pre')).toContainText('console.log');expect(await page.evaluate(()=>window.chatUnsafeExecuted)).toBeUndefined();
});
test('failed sends stay visible with retry and can return to the draft box',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'chat-outbox',credits:5});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  const input=page.getByLabel('发送给家伴的消息');
  // 第一次发送：直接断网，消息应留在失败气泡里，不悄悄回输入框。
  await page.route('**/api/chat/threads/**/generate',route=>route.abort('failed'));
  await input.fill('这条消息网络不太好');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const failed=page.locator('.im-outbox-failed');await expect(failed).toContainText('这条消息网络不太好');await expect(failed).toContainText('发送失败');
  // 存回草稿：文本回到输入框，气泡消失。
  await failed.getByRole('button',{name:'存回草稿'}).click();await expect(input).toHaveValue('这条消息网络不太好');await expect(page.locator('.im-outbox')).toHaveCount(0);
  // 再发一次仍失败，然后恢复网络重试成功：气泡消失，消息成为真正的聊天记录。
  await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.locator('.im-outbox-failed')).toBeVisible();
  await page.unroute('**/api/chat/threads/**/generate');
  await page.locator('.im-send-failed').getByRole('button',{name:'重试'}).click();
  await expect(page.locator('.cw-user-text')).toHaveText('这条消息网络不太好',{timeout:20000});await expect(page.locator('.im-outbox')).toHaveCount(0);
});
test('quote reply keeps the referenced message attached across reloads',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'chat-quote',credits:5});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  await page.getByLabel('发送给家伴的消息').fill('你猜我今天做了什么');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});
  await page.locator('.cw-message').first().locator('.pw-message-more').click();
  await page.getByRole('button',{name:'引用回复'}).click();
  await expect(page.locator('.im-reply-chip')).toContainText('你猜我今天做了什么');
  await page.getByLabel('发送给家伴的消息').fill('就是这件事！');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  await expect(page.locator('.im-reply-chip')).toHaveCount(0);
  const quoted=page.locator('.cw-user').last();await expect(quoted.locator('.im-quote-block')).toContainText('你猜我今天做了什么');
  await page.reload();await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();await expect(page.locator('.im-quote-block').first()).toContainText('你猜我今天做了什么',{timeout:20000});
});
const TINY_PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
test('image messages upload, render in chat and survive a reload',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'chat-image',credits:5});await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  const send=page.getByRole('button',{name:'发送消息',exact:true});
  await page.locator('input[type=file]').first().setInputFiles({name:'cat.png',mimeType:'image/png',buffer:TINY_PNG});
  await expect(page.locator('.im-attach')).toHaveCount(1);await expect(send).toBeEnabled();
  await page.getByLabel('发送给家伴的消息').fill('看看这只猫');await send.click();
  await expect(page.locator('.im-images').first()).toBeVisible({timeout:20000});
  await expect(page.locator('.cw-user-text').last()).toHaveText('看看这只猫');
  await page.reload();await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  await expect(page.locator('.im-images').first()).toBeVisible({timeout:20000});
  await page.locator('.im-image-thumb').first().click();
  await expect(page.locator('.im-lightbox')).toBeVisible();await expect(page.locator('.im-lightbar')).toContainText('1 / 1');
  await page.getByRole('button',{name:'关闭大图'}).click();await expect(page.locator('.im-lightbox')).toHaveCount(0);
});
