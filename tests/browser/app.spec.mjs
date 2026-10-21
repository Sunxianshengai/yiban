import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {cleanupTestMemories} from './helpers.mjs';

test.beforeEach(async({page,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }else{
    const login=await request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(login.status()).toBe(200);
  }
  const dropped=await cleanupTestMemories(request);
  if(dropped) console.log(`清掉 ${dropped} 段上一轮遗留的测试记忆`);
  const cookies=(await request.storageState()).cookies;
  await page.context().addCookies(cookies);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
});

test('upload, local organization, publishing, elder feedback and deletion work together',async({page,request})=>{
  const marker=`自动测试家庭记忆${Date.now()}`;
  let id;
  try {
    await page.goto('/');
    await expect(page.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
    await page.getByRole('button',{name:'添加一段记忆',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'family.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0WQAAAAASUVORK5CYII=','base64')});
    await expect(page.getByRole('status')).toContainText('素材上传完成');
    await page.getByLabel('记忆名称 *').fill(marker);
    await page.getByLabel('年份',{exact:true}).fill('2005');
    await page.getByLabel('地点',{exact:true}).fill('老家');
    await page.getByLabel('照片里的家人').fill('林阿姨、小雨');
    await page.getByLabel('这段记忆的故事').fill('2005年，小雨和妈妈回到老家，一起在院子里做桂花糕。');
    await page.getByRole('button',{name:'整理文字',exact:true}).click();
    await expect(page.getByLabel('记忆标签')).not.toHaveValue('');
    await page.getByRole('checkbox',{name:/我已取得素材使用同意/}).check();
    await page.getByRole('checkbox',{name:/内容已核对/}).check();
    await page.getByRole('button',{name:'保存并发布',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const state=await (await request.get('/api/state')).json();
    const memory=state.memories.find(m=>m.title===marker);id=memory?.id;
    expect(memory.status).toBe('confirmed');expect(memory.cover).toMatch(/^\/api\/media\//);
    const image=await request.get(memory.cover);expect(image.status()).toBe(200);expect(image.headers()['content-type']).toBe('image/png');
    // 单端口改造后不再有「进入老人端 / 家属模式」这一层；互动直接走接口产生，
    // 再回到「陪伴记录」页确认它出现在动态流里。
    for(const type of ['remember','like']) expect((await request.post('/api/activity',{data:{type,memoryId:id}})).ok()).toBe(true);
    await page.getByRole('button',{name:'陪伴记录',exact:true}).click();
    await expect(page.locator('.activity-list')).toContainText(marker);
    await page.getByRole('button',{name:/家庭记忆库/}).first().click();
    await page.getByRole('textbox',{name:'搜索记忆'}).fill(marker);
    await expect(page.locator('.memory-card')).toHaveCount(1);
    await page.getByRole('button',{name:marker,exact:true}).click();
    await page.getByRole('textbox',{name:'家人留言'}).fill('期待和妈妈一起重温这个瞬间。');
    await page.getByRole('button',{name:'发送',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:marker,exact:true}).click();
    await expect(page.locator('.comment-item')).toContainText('期待和妈妈一起重温这个瞬间。');
    await page.getByRole('button',{name:'编辑记忆',exact:true}).click();
    const wav=Buffer.alloc(44+100);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(100,40);
    await page.locator('input[type=file]').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav});
    await expect(page.getByText('家人录音已添加')).toBeVisible();
    await page.getByLabel('地点',{exact:true}).fill('苏州 · 老家');
    await page.getByRole('button',{name:'保存并发布',exact:true}).click();
    const edited=(await (await request.get('/api/state')).json()).memories.find(m=>m.id===id);
    expect(edited.audio).toMatch(/^\/api\/media\//);
    const media=await request.get(edited.audio,{headers:{Range:'bytes=0-43'}});expect(media.status()).toBe(206);expect(media.body()).toBeTruthy();
    await page.reload();
    await page.getByRole('button',{name:/家庭记忆库/}).first().click();
    await page.getByRole('textbox',{name:'搜索记忆'}).fill(marker);
    await expect(page.locator('.memory-card')).toContainText('苏州 · 老家');
    await page.getByRole('button',{name:marker,exact:true}).click();
    await page.getByRole('button',{name:'删除记忆',exact:true}).click();
    await page.getByRole('button',{name:'确认删除',exact:true}).click();
    await expect(page.locator('.memory-card')).toHaveCount(0);
    expect((await request.get(memory.cover)).status()).toBe(404);
    const after=await (await request.get('/api/state')).json();expect(after.activity.some(a=>a.memoryId===id)).toBe(false);id=null;
  }finally{if(id)await request.delete(`/api/memories/${id}`);}
});

test('drafts stay out of albums, stories, games and search; server validation works',async({request,page})=>{
  const draftResponse=await request.post('/api/memories',{data:{title:'自动测试待确认',year:'1998',story:'尚未核对的故事',status:'draft'}});expect(draftResponse.status()).toBe(201);const draft=await draftResponse.json();
  let album;
  try{
    const search=await (await request.get('/api/search?q=自动测试待确认')).json();expect(search.memories).toHaveLength(0);
    const invalid=await request.post('/api/memories',{data:{title:'错误年份',year:'abc'}});expect(invalid.status()).toBe(400);
    const upload=await request.post('/api/upload',{multipart:{file:{name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')}}});expect(upload.status()).toBe(400);
    const badFile=await request.get('/api/media/invalid.jpg');expect(badFile.status()).toBe(404);
    const creation=await request.post('/api/albums',{data:{title:'自动测试旅行专辑',description:'测试',memoryIds:['demo-westlake','demo-train',draft.id]}});expect(creation.status()).toBe(201);album=await creation.json();expect(album.memoryIds).toHaveLength(2);
    const generation=await (await request.post('/api/story',{data:{albumId:album.id}})).json();expect(generation.mode).toBe('local');expect(generation.story).toContain('西湖');
    await request.patch(`/api/albums/${album.id}`,{data:{story:generation.story}});
    const state=await (await request.get('/api/state')).json();expect(state.albums.find(a=>a.id===album.id).story).toBe(generation.story);
    // 草稿不进游戏：人生模拟的剧本来只取已确认记忆。
    const game=await request.post('/api/game/start',{data:{subjectId:'family'}});expect(game.status()).toBe(201);
    const played=await game.json();expect(JSON.stringify(played.scenes)).not.toContain(draft.title);
  }finally{await request.delete(`/api/memories/${draft.id}`);if(album)await request.delete(`/api/albums/${album.id}`);}
});

test('desktop and mobile layouts, navigation and dialogs render without errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:/欢迎回家/})).toBeVisible();
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/忆伴-桌面端.png',fullPage:true});
  for(const name of ['家伴','找人说说话','家庭记忆库','故事专辑','人生模拟','我的家人','陪伴记录','家庭设置']){await page.getByRole('navigation').getByRole('button',{name:new RegExp(name)}).click();await expect(page.locator('.page-heading h1')).toBeVisible();}
  await page.getByRole('navigation').getByRole('button',{name:'记忆小屋'}).click();
  await page.getByRole('button',{name:'添加一段记忆',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  // 账号入口是常驻的：任何页面都能从顶栏打开「我的账号」面板。
  await page.getByRole('button',{name:'我的账号'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('管理登录账号');await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/忆伴-手机端.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'我的账号'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
