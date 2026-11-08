import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {signInAsNewAdmin} from './helpers.mjs';

const output=path.resolve('.impeccable/review/memory-cottage');
const panel=page=>page.getByRole('dialog');
const diagnostics=new WeakMap();
const close=async page=>{await panel(page).getByRole('button',{name:'关闭记忆面板',exact:true}).click();await expect(panel(page)).toHaveCount(0);};
const open=async(page,name)=>{await page.getByRole('button',{name:`打开${name}`,exact:true}).click();await expect(panel(page)).toBeVisible();};
test.use({viewport:{width:1672,height:941},launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['microphone']});
test.beforeEach(async({page})=>{const logs={pageErrors:[],consoleErrors:[]};diagnostics.set(page,logs);page.on('pageerror',error=>logs.pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')logs.consoleErrors.push({text:message.text(),url:message.location().url});});await signInAsNewAdmin(page,{name:'小屋验收',prefix:'cottage',credits:0});mkdirSync(output,{recursive:true});});
test.afterEach(async({page},info)=>{const logs=diagnostics.get(page);writeFileSync(path.join(output,`console-${info.title.split(' ')[0]}.json`),JSON.stringify(logs,null,2));expect(logs.pageErrors).toEqual([]);expect(logs.consoleErrors.filter(message=>!message.text.includes('503 (Service Unavailable)'))).toEqual([]);});

test('desktop cottage stores text, recovers through objects, edits, searches and plays rain',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await expect(page.getByRole('region',{name:'我的记忆小屋'})).toBeVisible();
 await page.getByRole('button',{name:'写一句',exact:true}).click();
 await panel(page).getByRole('textbox',{name:'想留下的话',exact:true}).fill('下雨的晚上，和家人一起煮了热汤。把普通的一天收进小屋。');
 await panel(page).getByLabel('给记忆起个名字',{exact:false}).fill('雨夜的一碗热汤');
 await panel(page).getByRole('button',{name:'收进小屋',exact:true}).click();
 await expect(panel(page).getByRole('heading',{name:'雨夜的一碗热汤'})).toBeVisible();await close(page);
 await page.reload();await expect(page.getByRole('button',{name:'继续上次的故事',exact:true})).toBeVisible();
 await page.screenshot({path:path.join(output,'desktop.png')});
 expect(await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,scrollY}))).toEqual({width:1672,height:941,overflow:false,scrollY:0});
 await open(page,'记忆书架');await panel(page).getByRole('button',{name:/生活随记.*1 段记忆/}).click();await expect(panel(page).getByRole('button',{name:/雨夜的一碗热汤/})).toBeVisible();await close(page);
 await open(page,'时光信匣');await panel(page).getByRole('button',{name:/雨夜的一碗热汤/}).click();await panel(page).getByRole('button',{name:'补充文字'}).click();await panel(page).getByRole('textbox',{name:'想留下的话',exact:true}).fill('窗外下雨，厨房里是热汤的香气。');await panel(page).getByRole('button',{name:'保存补充'}).click();await expect(panel(page).getByText('窗外下雨，厨房里是热汤的香气。',{exact:true})).toBeVisible();await close(page);
 await page.getByRole('button',{name:'搜索记忆',exact:true}).click();await panel(page).getByRole('searchbox').fill('热汤');await expect(panel(page).getByRole('button',{name:/雨夜的一碗热汤/})).toBeVisible();await close(page);
 await page.getByRole('switch',{name:'播放雨声'}).click();await expect(page.getByRole('switch',{name:'播放雨声'})).toHaveAttribute('aria-checked','true');await expect.poll(()=>page.locator('.cottage-home>audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);await page.getByRole('switch',{name:'播放雨声'}).click();
 await page.getByRole('button',{name:'家庭空间',exact:true}).click();await expect(page.getByRole('heading',{name:'记忆库',exact:true})).toBeVisible();await page.locator('.brand').click();await expect(page.getByRole('region',{name:'我的记忆小屋'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('dropping photo and original audio archives once and both objects recover the real media',async({page})=>{
 const before=(await (await page.request.get('/api/state')).json()).memories;
 const files=[{name:'雨窗照片.webp',type:'image/webp',data:readFileSync('public/cottage/room-background.webp').toString('base64')},{name:'雨夜原声.wav',type:'audio/wav',data:readFileSync('public/cottage/rain.wav').toString('base64')}];
 let posts=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/cottage/entries'))posts++;});
 await page.locator('.cottage-home').evaluate((element,incoming)=>{const transfer=new DataTransfer();for(const item of incoming){const bytes=Uint8Array.from(atob(item.data),character=>character.charCodeAt(0));transfer.items.add(new File([bytes],item.name,{type:item.type}));}element.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},files);
 await expect(panel(page).getByText('已经收进你的小屋。',{exact:true})).toBeVisible();await expect(panel(page).locator('figure img')).toHaveCount(1);await expect(panel(page).locator('audio')).toHaveCount(1);expect(posts).toBe(1);
 const result=await (await page.request.get('/api/cottage/entries')).json();expect(result.items).toHaveLength(1);expect(result.items[0].media).toHaveLength(2);expect(result.items[0].kind).toBe('audio');await close(page);
 await open(page,'照片故事');await expect(panel(page).locator('.cottage-photo-grid button')).toHaveCount(1);await panel(page).locator('.cottage-photo-grid button').click();await expect.poll(()=>panel(page).locator('figure img').evaluate(image=>image.complete&&image.naturalWidth)).toBeGreaterThan(0);await page.screenshot({path:path.join(output,'photo-detail.png')});await close(page);
 await open(page,'原声回放');await panel(page).getByRole('button',{name:/雨窗照片/}).click();await expect.poll(()=>panel(page).locator('audio').evaluate(audio=>audio.readyState)).toBeGreaterThanOrEqual(1);await panel(page).locator('audio').evaluate(audio=>audio.play());await expect.poll(()=>panel(page).locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);
 expect((await (await page.request.get('/api/state')).json()).memories).toEqual(before);
});

test('real MediaRecorder captures synthetic microphone, saves and replays the original recording',async({page})=>{
 await page.getByRole('button',{name:'说一段',exact:true}).click();await panel(page).getByRole('button',{name:'直接说一段',exact:true}).click();await expect(panel(page).getByRole('button',{name:'结束录音',exact:true})).toBeVisible();await expect.poll(()=>panel(page).locator('.cottage-recording-status strong').innerText()).toMatch(/0:0[2-9]/);await panel(page).getByRole('button',{name:'结束录音',exact:true}).click();await expect(panel(page).getByRole('button',{name:'收进小屋',exact:true})).toBeEnabled();await expect(panel(page).locator('audio')).toHaveCount(1);
 await panel(page).getByLabel('给记忆起个名字',{exact:false}).fill('留给以后的声音');await panel(page).getByRole('button',{name:'收进小屋',exact:true}).click();await expect(panel(page).getByRole('heading',{name:'留给以后的声音'})).toBeVisible();await close(page);await page.reload();await open(page,'原声回放');await panel(page).getByRole('button',{name:/留给以后的声音/}).click();await panel(page).locator('audio').evaluate(audio=>audio.play());await expect.poll(()=>panel(page).locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);await page.screenshot({path:path.join(output,'audio-detail.png')});
 const saved=await (await page.request.get('/api/cottage/entries')).json();expect(saved.items).toHaveLength(1);expect(saved.items[0].media[0].contentType).toMatch(/^audio\//);expect((await page.request.get(saved.items[0].media[0].url)).status()).toBe(200);
});

test('mobile has four reachable objects, an accessible record panel and preserves text on failed save',async({page})=>{
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.locator('.cottage-room').evaluate(image=>image.currentSrc)).toContain('room-mobile.webp');await expect.poll(()=>page.locator('.cottage-room').evaluate(image=>image.complete&&image.naturalWidth)).toBeGreaterThan(0);await page.screenshot({path:path.join(output,'mobile.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 for(const name of ['记忆书架','照片故事','时光信匣','原声回放']){await open(page,name);await expect(panel(page).getByRole('heading',{name,exact:true})).toBeVisible();await close(page);}
 await page.getByRole('button',{name:'写一句',exact:true}).click();await panel(page).getByRole('textbox',{name:'想留下的话',exact:true}).fill('哪怕只写一句，也想把今天留下。');await page.route('**/api/cottage/entries',async route=>{if(route.request().method()==='POST')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'连接暂时中断，请再试一次。'})});else await route.continue();});await panel(page).getByRole('button',{name:'收进小屋',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('连接暂时中断');await expect(panel(page).getByRole('textbox',{name:'想留下的话',exact:true})).toHaveValue('哪怕只写一句，也想把今天留下。');await page.screenshot({path:path.join(output,'mobile-record.png')});await page.unroute('**/api/cottage/entries');await panel(page).getByRole('button',{name:'收进小屋',exact:true}).click();await expect(panel(page).getByText('已经收进你的小屋。',{exact:true})).toBeVisible();await close(page);
});

test('portrait room retains reachable objects and record controls on small and large phones',async({page})=>{
 for(const [width,height] of [[320,568],[360,780],[430,932]]){
  await page.setViewportSize({width,height});await expect.poll(()=>page.locator('.cottage-room').evaluate(image=>image.currentSrc)).toContain('room-mobile.webp');expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight}))).toEqual({x:false,y:false});
  for(const name of ['记忆书架','照片故事','时光信匣','原声回放']){await open(page,name);await expect(panel(page).getByRole('heading',{name,exact:true})).toBeVisible();await close(page);}
  for(const name of ['放入素材','说一段','写一句']){await page.getByRole('button',{name,exact:true}).click();await expect(panel(page)).toBeVisible();await close(page);}
  await page.screenshot({path:path.join(output,`mobile-${width}.png`)});
 }
});

test('tactile recorder preserves drafts across modes and custom player follows actual audio',async({page})=>{
 await page.getByRole('button',{name:'写一句',exact:true}).click();
 await panel(page).getByRole('textbox',{name:'想留下的话',exact:true}).fill('这是一段值得留下的声音。');
 const kinds=panel(page).getByRole('group',{name:'记录方式'});
 await kinds.getByRole('button',{name:'原声',exact:true}).click();await expect(panel(page).getByRole('heading',{name:'留下一段声音'})).toBeVisible();
 await expect(panel(page).getByRole('textbox',{name:'想留下的话',exact:true})).toHaveValue('这是一段值得留下的声音。');
 await panel(page).locator('input[type=file]').setInputFiles('public/cottage/rain.wav');await expect(panel(page).getByRole('button',{name:'收进小屋',exact:true})).toBeEnabled();
 await panel(page).getByRole('button',{name:'收进小屋',exact:true}).click();await expect(panel(page).getByText('已经收进你的小屋。',{exact:true})).toBeVisible();
 const player=panel(page).locator('.cottage-audio');await player.getByRole('button',{name:'播放原声',exact:true}).click();await expect(player).toHaveAttribute('data-playing','true');await expect.poll(()=>player.locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(0);
 await player.getByRole('slider',{name:'原声音量'}).press('Home');await player.getByRole('slider',{name:'原声音量'}).press('ArrowRight');await expect.poll(()=>player.locator('audio').evaluate(audio=>audio.volume)).toBe(.05);
 await player.getByRole('button',{name:'暂停原声',exact:true}).click();await expect(player).toHaveAttribute('data-playing','false');expect(await player.locator('audio').evaluate(audio=>audio.paused)).toBe(true);
 await player.getByRole('slider',{name:'原声进度'}).press('End');await expect.poll(()=>player.locator('audio').evaluate(audio=>audio.currentTime)).toBeGreaterThan(15);await page.screenshot({path:path.join(output,'tactile-audio.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'tactile-mobile-audio.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await close(page);
 await page.getByRole('switch',{name:'播放雨声'}).click();const rainVolume=page.getByRole('slider',{name:'雨声大小'});await rainVolume.press('Home');await rainVolume.press('ArrowRight');await expect.poll(()=>page.locator('.cottage-home>audio').evaluate(audio=>audio.volume)).toBe(.05);await page.locator('.cottage-home>audio').evaluate(audio=>audio.pause());await expect(page.getByRole('switch',{name:'播放雨声'})).toHaveAttribute('aria-checked','false');
});

test('reduced motion and keyboard closing retain usable controls and restore focus',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});const trigger=page.getByRole('button',{name:'打开时光信匣',exact:true});await trigger.click();await expect(panel(page)).toBeVisible();expect(await panel(page).evaluate(element=>getComputedStyle(element).animationName)).toBe('none');await page.keyboard.press('Escape');await expect(panel(page)).toHaveCount(0);await expect(trigger).toBeFocused();
 await page.getByRole('button',{name:'写一句',exact:true}).click();await panel(page).getByRole('textbox',{name:'想留下的话',exact:true}).fill('写在信纸上的一件小事。');await page.screenshot({path:path.join(output,'tactile-mobile-record.png')});
});
