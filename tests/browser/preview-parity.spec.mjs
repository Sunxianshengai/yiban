import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin,openMore,openChatSettings,openCredits,chooseSettingsTab} from './helpers.mjs';

const folder='.impeccable/review/preview-parity';
test('illustrative contacts create only an owned persona and never write household photos or charge on entry',async({page})=>{
  await signInAsNewAdmin(page,{prefix:'illustration',credits:10});
  const before=await(await page.request.get('/api/state')).json();
  await page.locator('.fa-profile-row').filter({hasText:'爸爸'}).click();
  await expect(page.locator('.pw-avatar-label')).toContainText('示意');
  await page.getByRole('button',{name:/^聊天/}).click();
  await expect(page.locator('.cw-header h1')).toHaveText('爸爸');
  const profiles=(await(await page.request.get('/api/familia/profiles')).json()).profiles;
  expect(profiles).toHaveLength(1);expect(profiles[0].role).toBe('father');expect(profiles[0].avatar||'').toBe('');
  await page.reload();await expect(page.locator('.fa-profile-row').filter({hasText:'爸爸'})).toHaveCount(1);
  await page.locator('.fa-profile-row').filter({hasText:'爸爸'}).click();await page.getByRole('button',{name:/^聊天/}).click();
  expect((await(await page.request.get('/api/familia/profiles')).json()).profiles).toHaveLength(1);
  expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(10);
  const after=await(await page.request.get('/api/state')).json();expect(after.memories).toEqual(before.memories);expect(after.members).toEqual(before.members);
});
for(const [device,width,height] of [['desktop',1440,960],['mobile',390,844]]){
  test(`${device}: approved app flows retain real data, secondary controls and persona completion`,async({page})=>{
    test.setTimeout(180000);page.setDefaultTimeout(15000);fs.mkdirSync(folder,{recursive:true});
    await page.setViewportSize({width,height});await signInAsNewAdmin(page,{name:'小雨',prefix:'parity',credits:128});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const shot=async name=>{const dismiss=page.getByRole('button',{name:'关闭提示',exact:true});if(await dismiss.isVisible())await dismiss.click();await expect(page.locator('.fa-inline-error')).toHaveCount(0);await page.waitForFunction(()=>[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete&&img.naturalWidth>0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} should not scroll horizontally`).toBe(true);await page.screenshot({path:`${folder}/${device}-${name}.png`});};
    const nav=async name=>{await page.locator(width>1180?'.side-nav':'.mobile-nav').getByRole('button',{name,exact:true}).click();};
    const more=async name=>{await openMore(page);await page.getByRole('dialog',{name:'更多功能',exact:true}).getByRole('button',{name,exact:true}).click();};
    for(const [name,role,age] of [['爸爸','father',36],['外婆','grandmother',68]]){
      const response=await page.request.post('/api/familia/profiles',{headers:{'Idempotency-Key':`parity-${role}-${Date.now()}`},data:{name,role,age,qualities:['patient']}});expect(response.status()).toBe(201);
    }
    const member=await(await page.request.post('/api/members',{data:{name:'林桂兰',relation:'外婆',birthYear:'1958'}})).json();
    const uploaded=await(await page.request.post('/api/upload',{multipart:{file:{name:'preview.jpg',mimeType:'image/jpeg',buffer:fs.readFileSync('public/auth-bg/hands-photos.jpg')}}})).json();
    expect(uploaded.url).toBeTruthy();
    const memory=await(await page.request.post('/api/memories',{data:{title:'外婆的桂花糕',story:'2008 年，外婆在院子里教我们做桂花糕。',year:'2008',theme:'家人',cover:uploaded.url,status:'confirmed',people:[member.name],tags:['桂花糕']}})).json();
    expect(memory.id).toBeTruthy();
    try{
      await page.request.post('/api/familia/moods',{data:{value:4,note:'今天和家人聊了聊。'}});await page.reload();await expect(page.locator('.fa-profile-row')).toHaveCount(3);await shot('home');
      await openMore(page);await shot('more');await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
      await page.locator('.fa-profile-row').first().click();await expect(page.locator('.fa-contact h1')).toHaveText('家伴');await shot('contact');
      await page.getByRole('button',{name:/^聊天/}).click();await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();await page.getByLabel('发送给家伴的消息').fill('今天想聊聊外婆的桂花糕。');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.getByRole('button',{name:'停止生成'})).toBeVisible();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:20000});await shot('chat');
      if(width<1181){await page.getByRole('button',{name:'展开历史会话',exact:true}).click();await shot('history');await page.keyboard.press('Escape');}else await shot('history');
      await openChatSettings(page);await page.getByRole('button',{name:'温柔',exact:true}).click();await expect(page.getByRole('button',{name:'温柔',exact:true})).toHaveAttribute('aria-pressed','true');await shot('chat-settings');await page.getByRole('button',{name:'完成',exact:true}).click();
      await page.getByRole('button',{name:'语音输入',exact:true}).click();await shot('voice');const speech=page.getByRole('dialog',{name:'语音输入'});await speech.getByLabel('语音识别文字').fill('想聊聊今天。');await speech.getByRole('button',{name:'使用这段文字',exact:true}).click();await expect(page.getByLabel('发送给家伴的消息')).toHaveValue('想聊聊今天。');expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(127);
      await more('家庭记忆');await shot('library');await page.getByRole('button',{name:`查看${memory.title}`,exact:true}).click();await shot('memory-detail');await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
      await page.getByRole('button',{name:'添加记忆',exact:true}).click();await page.locator('.memory-form input[type=file]').setInputFiles('public/auth-bg/hands-photos.jpg');await page.getByLabel('这段记忆的故事').fill('今天和外婆一起做了桂花糕。');await expect(page.locator('.record-preview img[src^="/api/media/"]')).toBeVisible();await shot('record');await page.getByRole('button',{name:'稍后继续',exact:true}).click();
      await nav('家庭成员');await shot('family');await page.getByRole('button',{name:`查看${member.name}的时间轴`,exact:true}).click();await expect(page.locator('.rail-item').filter({hasText:memory.title})).toBeVisible();await shot('timeline');
      await nav('首页');await page.locator('.fa-profile-row').first().click();await page.getByRole('button',{name:/^视频/}).click();await shot('videos');
      await more('我的心情记录');await shot('mood-overview');await page.getByRole('button',{name:'选择心情',exact:true}).click();await page.getByRole('button',{name:'还好',exact:true}).click();await shot('mood-selector');await page.getByRole('button',{name:'记录心情',exact:true}).click();await expect(page.getByRole('heading',{name:'我的心情',exact:true})).toBeVisible();
      await openCredits(page);await shot('credits');await page.getByRole('button',{name:'发放积分',exact:true}).click();await expect(page.getByLabel('发放给',{exact:true})).toBeVisible();await shot('credit-grant');
      await more('账号、外观与设置');await shot('preferences');await page.getByRole('button',{name:'跟随系统',exact:true}).click();await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('.app-shell')).toHaveAttribute('data-theme','night');await page.getByRole('button',{name:'日间',exact:true}).click();await expect(page.locator('.app-shell')).toHaveAttribute('data-theme','day');await chooseSettingsTab(page,'朗读声音');await expect(page.getByLabel('朗读声音',{exact:true})).toBeVisible();await shot('device-voice');
      await chooseSettingsTab(page,'我的账号');await expect(page.getByLabel('我的名字')).toBeVisible();await shot('account');await chooseSettingsTab(page,'账号与权限');await expect(page.getByRole('button',{name:'生成邀请码',exact:true})).toBeVisible();await shot('accounts');
      await nav('首页');await page.getByRole('button',{name:'添加一位 AI 家人',exact:true}).click();const setup=page.getByRole('dialog',{name:'创建 AI 家人'});await setup.getByRole('button',{name:'爸爸',exact:true}).click();
      for(const stage of ['role','age','relation','describe','rating','qualities','voice']){
        await shot(`setup-${stage}`);
        if(stage==='qualities')await setup.getByRole('button',{name:'有耐心',exact:true}).click();
        if(stage==='voice'){await setup.getByLabel('AI 家人称呼').fill('耐心的爸爸');await expect(setup.getByLabel('AI 家人称呼')).toBeFocused();await setup.getByRole('button',{name:'创建 AI 家人',exact:true}).click();}else await setup.getByRole('button',{name:'继续',exact:true}).click();
      }
      await expect(page.getByRole('dialog',{name:'创建完成'})).toBeVisible();await shot('setup-complete');await expect(page.getByRole('button',{name:'开始聊天',exact:true})).toBeInViewport();await page.getByRole('button',{name:'开始聊天',exact:true}).click();await expect(page.locator('.cw-header h1')).toHaveText('耐心的爸爸');await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();
      await more('我的账号');await page.locator('.pw-settings-body').getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();await shot('login');expect(errors).toEqual([]);
    }finally{await page.request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});await page.request.delete(`/api/memories/${memory.id}`);await page.request.delete(`/api/members/${member.id}`);}
  });
}
