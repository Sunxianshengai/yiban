import {test,expect} from '@playwright/test';
import {signInAsNewAdmin,openChatSettings} from './helpers.mjs';
test('viewers have private conversations and preferences but cannot publish AI drafts',async({page,browser})=>{
  await signInAsNewAdmin(page,{prefix:'chat-owner',credits:5});const privateThread=await (await page.request.post('/api/chat/threads',{data:{title:'管理员的私人对话'}})).json();
  const invite=await (await page.request.post('/api/auth/invite',{data:{role:'viewer'}})).json();const context=await browser.newContext({baseURL:process.env.PW_BASE_URL||'http://localhost:3711'});
  try{
    const joined=await context.request.post('/api/auth/register',{data:{code:invite.code,name:'爸爸',email:`chat-viewer-${Date.now()}@yiban.test`,password:'TestPassword123!'}});expect(joined.status()).toBe(201);const user=(await (await context.request.get('/api/auth/status')).json()).user;
    expect((await page.request.post('/api/credits/grant',{data:{userId:user.id,amount:5,note:'查看者聊天测试'}})).status()).toBe(201);expect((await context.request.get(`/api/chat/threads/${privateThread.id}`)).status()).toBe(404);
    const viewer=await context.newPage();await viewer.goto('/');await viewer.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();await expect(viewer.getByLabel('发送给家伴的消息')).toBeEnabled();await openChatSettings(viewer);await viewer.getByRole('button',{name:'温柔',exact:true}).click();await viewer.getByRole('button',{name:'完成',exact:true}).click();await viewer.getByLabel('发送给家伴的消息').fill('今天过得很好');await viewer.getByRole('button',{name:'发送消息',exact:true}).click();await expect(viewer.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});
    await expect(viewer.locator('.cw-assistant')).toContainText('听见了');await expect(viewer.getByRole('button',{name:'存为记忆草稿'})).toHaveCount(0);await openChatSettings(viewer);await expect(viewer.getByRole('button',{name:'温柔',exact:true})).toHaveAttribute('aria-pressed','true');await viewer.getByRole('button',{name:'完成',exact:true}).click();await expect(viewer.getByRole('button',{name:'编辑消息',exact:true})).toBeVisible();
  }finally{await context.close();}
});
