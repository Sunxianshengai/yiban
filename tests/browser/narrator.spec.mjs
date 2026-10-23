import {test,expect} from '@playwright/test';
import {cleanupTestMemories} from './helpers.mjs';

// 「让它动起来」这块的可见性。
//
// 这里锁的是一条产品决策，不是样式：视频能力曾经嵌在「已有讲述稿」分支里，
// 没配密钥的人打开详情页只看到一句「先去复刻声音」，根本不知道后面还有视频。
// 现在只要这个账号能改（canEdit），这块就必须出现；缺什么就把缺的那一项写清楚。

test.beforeEach(async({page,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }else{
    const login=await request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(login.status()).toBe(200);
  }
  await cleanupTestMemories(request);
  const cookies=(await request.storageState()).cookies;
  await page.context().addCookies(cookies);
});

async function publishMemory(page,marker){
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
  await page.getByRole('button',{name:'添加一段记忆',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({
    name:'family.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0WQAAAAASUVORK5CYII=','base64'),
  });
  await expect(page.getByRole('status')).toContainText('素材上传完成');
  await page.getByLabel('记忆名称 *').fill(marker);
  await page.getByLabel('年份',{exact:true}).fill('2005');
  await page.getByLabel('地点',{exact:true}).fill('老家');
  await page.getByLabel('照片里的家人').fill('林阿姨');
  await page.getByLabel('这段记忆的故事').fill('2005年，一家人回到老家，在院子里做桂花糕。');
  await page.getByRole('button',{name:/AI 整理|整理文字/}).click();
  await expect(page.getByLabel('记忆标签')).not.toHaveValue('');
  await page.getByRole('checkbox',{name:/我已取得素材使用同意/}).check();
  await page.getByRole('checkbox',{name:/内容已核对/}).check();
  await page.getByRole('button',{name:'保存并发布',exact:true}).click();
  const state=await (await page.request.get('/api/state')).json();
  return state.memories.find(m=>m.title===marker).id;
}

test('没有任何讲述稿时，「让它动起来」这块也要看得见',async({page})=>{
  const marker=`自动测试动起来${Date.now()}`;
  let id;
  try{
    id=await publishMemory(page,marker);
    await page.getByRole('button',{name:/记忆库/}).first().click();
    await page.getByRole('textbox',{name:'搜索记忆'}).fill(marker);
    await page.getByRole('button',{name:marker,exact:true}).click();

    // 讲述区与视频区是两个独立区块：没有稿子，视频区照样在。
    const videoBlock=page.locator('.narrator-video');
    await expect(videoBlock).toBeVisible();
    await expect(videoBlock.getByRole('heading',{name:'让它动起来'})).toBeVisible();

    // 测试环境没配 DASHSCOPE_API_KEY，提示要说清缺的是哪一项，而不是消失。
    await expect(videoBlock).toContainText('DASHSCOPE_API_KEY');

    // 条件没齐：按钮在，但按不下去。
    const make=videoBlock.getByRole('button',{name:/生成 \d+ 秒视频/});
    await expect(make).toBeVisible();
    await expect(make).toBeDisabled();

    // 清晰度/时长/预计费用也要露出来，让人知道这个能力要花钱、花多少。
    await expect(videoBlock.locator('.narrator-options')).toBeVisible();
    await expect(videoBlock.locator('.narrator-cost')).toContainText('元');
  }finally{
    if(id)await page.request.delete(`/api/memories/${id}`);
  }
});

test('视频生成走 editor 权限：viewer 看不到这块',async({page,request})=>{
  const marker=`自动测试动起来权限${Date.now()}`;
  let id;
  try{
    id=await publishMemory(page,marker);

    // 用管理员签一个 viewer 邀请码，再用它注册一个只读账号。
    const invite=await (await request.post('/api/auth/invite',{data:{role:'viewer'}})).json();
    expect(invite.code,'应拿到 viewer 邀请码').toMatch(/^[A-F0-9]{12}$/);
    const created=await request.post('/api/auth/register',{
      data:{code:invite.code,name:'旁观者',email:`viewer-${Date.now()}@yiban.test`,password:'TestPassword123!'},
    });
    expect(created.status()).toBe(201);

    const cookies=(await request.storageState()).cookies;
    await page.context().addCookies(cookies);
    await page.goto('/');
    const state=await (await request.get('/api/state')).json();
    expect(state.canEdit,'viewer 不该有编辑权').toBe(false);

    await page.getByRole('button',{name:/记忆库/}).first().click();
    await page.getByRole('textbox',{name:'搜索记忆'}).fill(marker);
    await page.getByRole('button',{name:marker,exact:true}).click();

    // 讲述区仍在（听是所有人都能听的），视频区不给。
    await expect(page.locator('.narrator-card')).toBeVisible();
    await expect(page.locator('.narrator-video')).toHaveCount(0);
  }finally{
    if(id)await page.request.delete(`/api/memories/${id}`);
  }
});
