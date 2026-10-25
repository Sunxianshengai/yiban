import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin} from './helpers.mjs';

test.beforeEach(async({page})=>{await signInAsNewAdmin(page,{prefix:'modern',credits:0});});
const record=page=>page.getByRole('dialog',{name:'记一段回忆'});
async function openRecord(page){await page.getByRole('button',{name:'记一段回忆',exact:true}).click();await expect(record(page)).toBeVisible();}

test('core navigation is focused and family timelines do not require a birth year',async({page})=>{
  const nav=page.locator('.side-nav');
  await expect(nav.getByRole('button')).toHaveCount(6);
  await expect(nav.getByRole('button',{name:'人生推演'})).toHaveCount(0);
  await nav.getByRole('button',{name:'家人故事',exact:true}).click();
  await expect(page.locator('.rail-item').first()).toBeVisible();
  await expect(page.locator('.growth-tabs>button')).toHaveCount(3);
  await page.getByRole('button',{name:'问问家人',exact:true}).click();
  await page.getByRole('button',{name:'记下回答',exact:true}).first().click();
  await expect(record(page).locator('.record-question')).toBeVisible();
  await expect(record(page).getByLabel('这是谁的记忆')).not.toHaveValue('');
});

test('one sentence publishes without a manually entered title and restores local drafts',async({page})=>{
  const text=`全家一起做了晚饭${Date.now()}。妈妈教了我一道菜。`;
  await openRecord(page);await record(page).getByLabel('这段记忆的故事').fill(text);
  await record(page).getByRole('button',{name:'稍后继续'}).click();
  await openRecord(page);await expect(record(page)).toContainText('已恢复');
  await expect(record(page).getByLabel('这段记忆的故事')).toHaveValue(text);
  await record(page).getByRole('checkbox',{name:/我已取得素材使用同意/}).check();
  await record(page).getByRole('checkbox',{name:/内容已核对/}).check();
  await record(page).getByRole('button',{name:'保存并发布'}).click();
  await expect(record(page)).toHaveCount(0);
  const state=await (await page.request.get('/api/state')).json();
  const memory=state.memories.find(m=>m.story===text);
  expect(memory.title).toBe(text.split('。')[0]);expect(memory.recorderName).toBe('测试家长');
  await openRecord(page);await expect(record(page).getByLabel('这段记忆的故事')).toHaveValue('');
  await record(page).getByRole('button',{name:'稍后继续'}).click();
  await page.request.delete(`/api/memories/${memory.id}`);
});

test('drafts never cross accounts on the same browser',async({page})=>{
  await openRecord(page);await record(page).getByLabel('这段记忆的故事').fill('只有这个账号的草稿');
  await expect(record(page)).toContainText('草稿已保存在此设备');
  await page.request.post('/api/auth/logout');
  await signInAsNewAdmin(page,{prefix:'other',credits:0});
  await openRecord(page);await expect(record(page).getByLabel('这段记忆的故事')).toHaveValue('');
});

test('viewer can respond, failed requests preserve their words, and author is shown',async({page,browser})=>{
  const created=await page.request.post('/api/memories',{data:{title:`家人共读${Date.now()}`,story:'保留下来的一段原话',people:[],tags:[],status:'confirmed'}});
  const memory=await created.json();
  const draft=await (await page.request.post('/api/memories',{data:{title:`尚未发布${Date.now()}`,status:'draft'}})).json();
  await page.request.post('/api/comments',{data:{memoryId:draft.id,text:'这条草稿留言不能下发给查看者'}});
  const invite=await (await page.request.post('/api/auth/invite',{data:{role:'viewer'}})).json();
  const ctx=await browser.newContext();const viewer=await ctx.newPage();
  try{
    const registered=await ctx.request.post('/api/auth/register',{data:{code:invite.code,name:'外婆',email:`elder-${Date.now()}@yiban.test`,password:'TestPassword123!'}});expect(registered.status()).toBe(201);
    const viewerState=await (await ctx.request.get('/api/state')).json();
    expect(viewerState.activity.some(a=>a.memoryId===draft.id)).toBe(false);
    await viewer.goto('/app');await viewer.locator('.side-nav').getByRole('button',{name:/^记忆库/}).click();
    await viewer.getByLabel('搜索记忆').fill(memory.title);await viewer.getByRole('button',{name:memory.title,exact:true}).click();
    const dialog=viewer.getByRole('dialog');await expect(dialog.locator('.story-player')).toContainText('设备合成朗读');
    await expect(dialog.getByRole('button',{name:'编辑记忆'})).toHaveCount(0);
    await dialog.getByLabel('家人留言').fill('这件事我也记得');
    await viewer.route('**/api/comments',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'暂时无法保存留言，请重试'})}));
    await dialog.getByRole('button',{name:'发送',exact:true}).click();
    await expect(viewer.getByRole('status')).toContainText('暂时无法保存留言');
    await expect(dialog.getByLabel('家人留言')).toHaveValue('这件事我也记得');
    await viewer.unroute('**/api/comments');await dialog.getByRole('button',{name:'发送',exact:true}).click();
    await expect(dialog.locator('.comment-item')).toContainText('外婆');await expect(dialog.locator('.comment-item')).toContainText('这件事我也记得');
    await expect(dialog.getByLabel('家人留言')).toHaveValue('');
  }finally{await ctx.close();await page.request.delete(`/api/memories/${memory.id}`);await page.request.delete(`/api/memories/${draft.id}`);}
});

test('companion opens directly without the role catalogue and mobile has no floating duplicate',async({page})=>{
  await page.locator('.side-nav').getByRole('button',{name:'陪伴对话'}).click();
  await expect(page.getByRole('region',{name:'聊天工作区'})).toBeVisible();
  await expect(page.locator('.role-list')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.companion-dock')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('desktop mobile and large text keep essential actions visible',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync('.tmp-modern-product/screens',{recursive:true});
  await page.screenshot({path:'.tmp-modern-product/screens/01-home-desktop.png',fullPage:true});
  await openRecord(page);await page.screenshot({path:'.tmp-modern-product/screens/02-record-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.tmp-modern-product/screens/03-record-mobile.png'});
  expect(await record(page).evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
  await record(page).getByRole('button',{name:'稍后继续'}).click({timeout:5000});
  await page.screenshot({path:'.tmp-modern-product/screens/04-home-mobile.png'});
  await page.evaluate(()=>document.documentElement.style.fontSize='24px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'陪伴对话'}).click();
  await expect(page.getByRole('region',{name:'聊天工作区'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('microphone refusal leaves upload and writing available',async({page})=>{
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new Error('denied'));});
  await openRecord(page);await record(page).getByRole('button',{name:'直接录一段'}).click();
  await expect(page.locator('.toast')).toContainText('未能开启麦克风');
  await expect(record(page).getByRole('button',{name:'直接录一段'})).toBeEnabled();
  await record(page).getByLabel('这段记忆的故事').fill('也可以继续写下来');
  await expect(record(page).getByLabel('这段记忆的故事')).toHaveValue('也可以继续写下来');
});

test('a synthetic microphone recording is uploaded, playable and saved as original audio',async({playwright})=>{
  const browser=await playwright.chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({baseURL:process.env.PW_BASE_URL||'http://localhost:3711',permissions:['microphone']});
  const page=await context.newPage();let id;
  try{
    await signInAsNewAdmin(page,{prefix:'recording',credits:0});await openRecord(page);
    await record(page).getByRole('button',{name:'直接录一段'}).click();
    await expect(record(page).getByRole('button',{name:'结束录音'})).toBeVisible();
    await page.waitForTimeout(1100); // Produce an actual audio chunk from the synthetic device.
    await record(page).getByRole('button',{name:'结束录音'}).click();
    await expect(record(page).locator('audio')).toHaveAttribute('src',/\/api\/media\//);
    await record(page).getByRole('checkbox',{name:/我已取得素材使用同意/}).check();
    await record(page).getByRole('button',{name:'保存待确认'}).click();
    await expect(record(page)).toHaveCount(0);
    const state=await (await page.request.get('/api/state')).json();const memory=state.memories.find(m=>m.title==='一段家人的声音');
    expect(memory?.audio).toMatch(/^\/api\/media\//);id=memory.id;
    expect((await page.request.get(memory.audio)).status()).toBe(200);
  }finally{if(id)await page.request.delete(`/api/memories/${id}`);await context.close();await browser.close();}
});

test('attachment picker is reachable by Tab and works with Enter and Space',async({page})=>{
  await openRecord(page);
  await page.keyboard.press('Tab');
  const upload=record(page).getByRole('button',{name:'添加照片 / 音视频',exact:true});
  await expect(upload).toBeFocused();
  for(const key of ['Enter','Space']){
    await upload.focus();const chooser=page.waitForEvent('filechooser');await upload.press(key);
    await (await chooser).setFiles({name:'keyboard.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0WQAAAAASUVORK5CYII=','base64')});
    await expect(record(page).locator('.record-preview img')).toHaveAttribute('src',/\/api\/media\//);
    await expect(upload).toBeEnabled();
  }
});
