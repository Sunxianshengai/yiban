import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {cleanupTestMemories,clickNavItem,fundTestAccount,openMore,chooseSettingsTab} from './helpers.mjs';

test.beforeEach(async({page,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }else{
    const login=await request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(login.status()).toBe(200);
  }
  await fundTestAccount(request,1000);
  const dropped=await cleanupTestMemories(request);
  if(dropped) console.log(`清掉 ${dropped} 段上一轮遗留的测试记忆`);
  page.on('dialog',dialog=>dialog.accept());
  const cookies=(await request.storageState()).cookies;
  await page.context().addCookies(cookies);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/今天，想和谁聊聊/})).toBeVisible();
});

test('upload, local organization, publishing, elder feedback and deletion work together',async({page,request})=>{
  const marker=`自动测试家庭记忆${Date.now()}`;
  let id;
  try {
    await page.goto('/');
    await expect(page.getByRole('heading',{name:/今天，想和谁聊聊/})).toBeVisible();
    await page.getByRole('button',{name:'记一段回忆',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'family.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0WQAAAAASUVORK5CYII=','base64')});
    await expect(page.locator('.toast')).toContainText('素材上传完成');
    await page.getByLabel('记忆名称').fill(marker);
    // 年份、地点、人物在「补充」折叠区里。
    await page.locator('details.record-details summary').click();
    await page.getByLabel('年份',{exact:true}).fill('2005');
    await page.getByLabel('地点',{exact:true}).fill('老家');
    await page.getByLabel('照片里的家人').fill('林阿姨、小雨');
    await page.getByLabel('这段记忆的故事').fill('2005年，小雨和妈妈回到老家，一起在院子里做桂花糕。');
    // 接了模型按钮叫「AI 整理」，没接模型叫「整理文字」——两种环境都要能跑。
    await page.getByRole('button',{name:/AI 整理|整理文字/}).click();
    await expect(page.getByLabel('记忆标签')).not.toHaveValue('');
    await page.getByRole('checkbox',{name:/我已取得素材使用同意/}).check();
    await page.getByRole('checkbox',{name:/内容已核对/}).check();
    await page.getByRole('button',{name:'保存并发布',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const state=await (await request.get('/api/state')).json();
    const memory=state.memories.find(m=>m.title===marker);id=memory?.id;
    expect(memory.status).toBe('confirmed');expect(memory.cover).toMatch(/^\/api\/media\//);
    const image=await request.get(memory.cover);expect(image.status()).toBe(200);expect(image.headers()['content-type']).toBe('image/png');
    // 互动直接走接口产生；动态流并入记忆详情，这里用 API 确认记录已留痕。
    for(const type of ['remember','like']) expect((await request.post('/api/activity',{data:{type,memoryId:id}})).ok()).toBe(true);
    const active=(await (await request.get('/api/state')).json()).activity;
    expect(active.filter(a=>a.memoryId===id).map(a=>a.text).join(' ')).toContain(marker);
    await page.getByRole('button',{name:/记忆库/}).first().click();
    await page.getByRole('textbox',{name:'搜索记忆'}).fill(marker);
    await expect(page.locator('.memory-card')).toHaveCount(1);
    await page.getByRole('button',{name:marker,exact:true}).click();
    await page.getByRole('textbox',{name:'家人留言'}).fill('期待和妈妈一起重温这个瞬间。');
    // 留言发送后详情弹窗保持打开，留言直接出现在列表里。
    await page.getByRole('button',{name:'发送',exact:true}).click();
    await expect(page.locator('.comment-item')).toContainText('期待和妈妈一起重温这个瞬间。');
    await page.getByRole('button',{name:'编辑记忆',exact:true}).click();
    const wav=Buffer.alloc(44+100);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(100,40);
    await page.locator('input[type=file]').setInputFiles({name:'voice.wav',mimeType:'audio/wav',buffer:wav});
    await expect(page.getByText('家人录音已添加')).toBeVisible();
    await page.locator('details.record-details summary').click();
    await page.getByLabel('地点',{exact:true}).fill('苏州 · 老家');
    await page.getByRole('button',{name:'保存并发布',exact:true}).click();
    const edited=(await (await request.get('/api/state')).json()).memories.find(m=>m.id===id);
    expect(edited.audio).toMatch(/^\/api\/media\//);
    const media=await request.get(edited.audio,{headers:{Range:'bytes=0-43'}});expect(media.status()).toBe(206);expect(media.body()).toBeTruthy();
    await page.reload();
    await page.getByRole('button',{name:/记忆库/}).first().click();
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

test('drafts stay out of search; server validation works',async({request,page})=>{
  const draftResponse=await request.post('/api/memories',{data:{title:'自动测试待确认',year:'1998',story:'尚未核对的故事',status:'draft'}});expect(draftResponse.status()).toBe(201);const draft=await draftResponse.json();
  try{
    const search=await (await request.get('/api/search?q=自动测试待确认')).json();expect(search.memories).toHaveLength(0);
    const invalid=await request.post('/api/memories',{data:{title:'错误年份',year:'abc'}});expect(invalid.status()).toBe(400);
    const upload=await request.post('/api/upload',{multipart:{file:{name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')}}});expect(upload.status()).toBe(400);
    const badFile=await request.get('/api/media/invalid.jpg');expect(badFile.status()).toBe(404);
    // 已删除的接口不再存在
    expect((await request.post('/api/albums',{data:{title:'x',memoryIds:[]}})).status()).toBe(404);
    expect((await request.post('/api/life/start',{data:{memoryId:draft.id}})).status()).toBe(404);
  }finally{await request.delete(`/api/memories/${draft.id}`);}
});

test('desktop and mobile layouts, navigation and dialogs render without errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:/今天，想和谁聊聊/})).toBeVisible();
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/忆伴-桌面端.png',fullPage:true});
  // 每个导航页都要真的渲染出内容，用统一的 .page-heading 校验。
  for(const name of ['陪伴对话','记忆库','家人故事','家庭成员','设置']){
    await clickNavItem(page,name);
    await expect(page.locator('.page-heading h1').or(page.getByRole('region',{name:'聊天工作区'})).first()).toBeVisible();
  }
  await page.getByRole('navigation').getByRole('button',{name:'首页'}).click();
  await page.getByRole('button',{name:'记一段回忆',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  // 账号入口是常驻的：任何页面都能从顶栏打开「我的账号」面板。
  await openMore(page);await page.getByRole('button',{name:'账号、外观与设置',exact:true}).click();await page.locator('.sidebar-bottom').getByRole('button',{name:'我的账号'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('管理登录账号');await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/忆伴-手机端.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await openMore(page);await page.getByRole('button',{name:'账号、外观与设置',exact:true}).click();await chooseSettingsTab(page,'我的账号');await expect(page.getByLabel('我的名字')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
