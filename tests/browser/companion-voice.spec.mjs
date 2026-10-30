import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
import {encodePcmWav} from '../../lib/chat-audio-client.mjs';
import fs from 'node:fs';
const wav=Buffer.from(encodePcmWav(Float32Array.from({length:24000*4},(_,i)=>Math.sin(i/20)*.08),24000));
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  test(`${device}: companion voice creation, preview, both modes, persistence and failed-save recovery`,async({page})=>{
    test.setTimeout(120000);await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'voices',credits:20});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const before=(await(await page.request.get('/api/state')).json()).members;
    const nav=width>768?page.locator('.side-nav'):page.locator('.mobile-nav');await nav.getByRole('button',{name:/陪伴/}).click();
    if(!await page.getByLabel('对话菜单',{exact:true}).isVisible())await page.getByRole('button',{name:'聊天',exact:true}).first().click();
    async function open(){await page.getByLabel('对话菜单',{exact:true}).click();await page.getByRole('button',{name:'声音',exact:true}).click();await expect(page.getByRole('dialog',{name:'声音',exact:true})).toBeVisible();await expect(page.locator('.vs-person')).toBeVisible();}
    await open();let dialog=page.getByRole('dialog',{name:'声音',exact:true});
    await expect(dialog.getByRole('radio')).toHaveCount(2);await expect(dialog.getByRole('radio',{name:/文字模式/})).toBeChecked();
    await dialog.getByRole('button',{name:'创建专属音色',exact:true}).click();dialog=page.getByRole('dialog',{name:'创建专属音色',exact:true});
    let materials=0;page.on('request',request=>{if(request.url().endsWith('/api/companion-voices/material'))materials++;});
    await dialog.locator('input[type=file]').setInputFiles({name:'本地合成测试.wav',mimeType:'audio/wav',buffer:wav});
    await expect(dialog.locator('.vs-material')).toContainText('4.0 秒');expect(materials).toBe(0);
    fs.mkdirSync('.impeccable/review/companion-voice',{recursive:true});
    await page.screenshot({path:`.impeccable/review/companion-voice/${device}-create.png`,fullPage:true});
    await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'创建音色',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'试听与应用',exact:true});await expect(dialog.getByRole('heading',{name:'音色已创建',exact:true})).toBeVisible({timeout:20000});expect(materials).toBe(1);
    await dialog.getByRole('button',{name:'生成试听',exact:true}).click();await expect(dialog.locator('audio')).toHaveAttribute('src',/\/api\/media\/companion-/);
    await expect(dialog.getByRole('radio')).toHaveCount(2);await expect(dialog.getByRole('radio',{name:/语音回复模式/})).toBeChecked();
    await page.screenshot({path:`.impeccable/review/companion-voice/${device}-review.png`,fullPage:true});
    await dialog.getByRole('button',{name:/^用于/}).click();await expect(dialog).not.toBeVisible();
    const saved=(await(await page.request.get('/api/familia/profiles')).json()).defaultProfile;expect(saved.voice).toMatch(/^custom-/);expect(saved.voiceMode).toBe('voice');
    await page.getByLabel('发送给家伴的消息').fill('刚忙完，聊聊今天吧');await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await expect(page.locator('.cw-assistant .im-voice audio')).toHaveCount(1,{timeout:30000});
    await expect(page.locator('.cw-assistant details.im-transcript summary')).toHaveText('查看文字');
    await expect(page.locator('.cw-assistant details.im-transcript')).not.toHaveAttribute('open');
    await page.waitForFunction(()=>[...document.querySelectorAll('.cw-assistant audio')].every(audio=>Number.isFinite(audio.duration)&&audio.duration>0));
    await open();dialog=page.getByRole('dialog',{name:'声音',exact:true});await expect(dialog.getByRole('radio',{name:/语音回复模式/})).toBeChecked();
    await page.screenshot({path:`.impeccable/review/companion-voice/${device}-settings.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await dialog.getByRole('radio',{name:/文字模式/}).check();
    await page.route('**/api/familia/profiles/default',route=>route.request().method()==='PATCH'?route.fulfill({status:503,json:{error:'模拟保存失败，请再试一次'}}):route.continue());
    await dialog.getByRole('button',{name:'保存设置',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('模拟保存失败');await expect(dialog.getByRole('radio',{name:/文字模式/})).toBeChecked();
    await page.unroute('**/api/familia/profiles/default');await dialog.getByRole('button',{name:'保存设置',exact:true}).click();await expect(dialog).not.toBeVisible();
    expect((await(await page.request.get('/api/familia/profiles')).json()).defaultProfile.voiceMode).toBe('text');
    await page.getByLabel('发送给家伴的消息').fill('明天再聊');await page.getByRole('button',{name:'发送消息',exact:true}).click();
    await expect(page.locator('.cw-assistant')).toHaveCount(2,{timeout:30000});await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:30000});
    await expect(page.locator('.cw-assistant').last().locator('audio')).toHaveCount(0);
    await page.reload();await nav.getByRole('button',{name:/陪伴/}).click();await open();await expect(page.getByRole('radio',{name:/文字模式/})).toBeChecked();
    expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(18);
    expect((await(await page.request.get('/api/state')).json()).members).toEqual(before);expect(errors).toEqual([]);
  });
}
