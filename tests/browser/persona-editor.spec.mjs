import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin} from './helpers.mjs';
const folder='.impeccable/review/persona-editor';

for(const [device,width,height] of [['desktop',1440,1080],['mobile',390,844]]){
  test(`${device}: persona editor keeps advanced fields collapsed, saves privately for free and preserves failed edits`,async({page})=>{
    test.setTimeout(90000);await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'persona',credits:10});fs.mkdirSync(folder,{recursive:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const created=await page.request.post('/api/familia/profiles',{headers:{'Idempotency-Key':`persona-editor-${device}-${Date.now()}`},data:{role:'father',name:'爸爸',age:56,relation:'absent',rating:3,qualities:['patient','empathetic','encouraging'],description:'先听我说完，再一起想办法。愿意聊日常，也能安静地陪一会儿。',speakingStyle:'自然一些，多用短句，一次只问一个问题。',responseExample:'今天过得怎么样？想聊聊发生的事，还是先歇一会儿？',avoidedExpressions:'不说教，不用“你应该”，不替我做决定。'}});expect(created.status()).toBe(201);const profile=await created.json();
    const open=async()=>{await page.locator('.fa-profile-row').filter({hasText:'爸爸'}).filter({hasText:'AI 家人'}).click();await page.getByRole('button',{name:'人格与表达',exact:true}).click();await expect(page.getByRole('dialog',{name:'人格与表达',exact:true})).toBeVisible();};
    const shot=async name=>{const dismiss=page.getByRole('button',{name:'关闭提示',exact:true});if(await dismiss.isVisible())await dismiss.click();await page.waitForFunction(()=>[...document.images].filter(img=>{const r=img.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(img=>img.complete&&img.naturalWidth));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({animations:'disabled',path:`${folder}/${device}-${name}.png`});};
    await page.reload();await open();const editor=page.getByRole('dialog',{name:'人格与表达',exact:true});await expect(editor.locator('.pe-advanced')).not.toHaveAttribute('open');await expect(editor.getByLabel(/说话习惯/)).not.toBeVisible();await shot('basic');if(device==='mobile'){await editor.locator('.pe-advanced').scrollIntoViewIfNeeded();await shot('collapsed');}
    await editor.locator('.pe-advanced>summary').click();await editor.locator('.pe-advanced').evaluate(el=>el.scrollIntoView({block:'start'}));await expect(editor.getByLabel(/说话习惯/)).toBeVisible();await shot('advanced');
    await editor.getByLabel('称呼',{exact:true}).fill('温和的爸爸');await editor.getByLabel('你们的相处').selectOption('distant');await editor.getByLabel('想到这段关系的感受').selectOption('2');await editor.getByLabel(/说话习惯/).fill('少一点追问，多给我一点回应的时间。');
    await page.route('**/api/familia/profiles/*',route=>route.request().method()==='PATCH'?route.fulfill({status:503,json:{error:'暂时无法保存，请再试一次'}}):route.continue());
    await editor.getByRole('button',{name:'保存设置',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('暂时无法保存');await expect(editor.getByLabel('称呼',{exact:true})).toHaveValue('温和的爸爸');await page.unroute('**/api/familia/profiles/*');
    await editor.getByRole('button',{name:'保存设置',exact:true}).click();await expect(page.locator('.fa-contact h1')).toHaveText('温和的爸爸');expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(10);
    const saved=(await(await page.request.get('/api/familia/profiles')).json()).profiles.find(item=>item.id===profile.id);expect(saved.relation).toBe('distant');expect(saved.rating).toBe(2);expect(saved.speakingStyle).toBe('少一点追问，多给我一点回应的时间。');expect(saved.responseExample).toBe(profile.responseExample);
    await page.reload();await open();await expect(editor.getByLabel('称呼',{exact:true})).toHaveValue('温和的爸爸');await expect(editor.locator('.pe-advanced')).not.toHaveAttribute('open');
    if(device==='mobile'){await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});await editor.locator('.pe-advanced>summary').click();await editor.getByRole('button',{name:'取消',exact:true}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot('large-text');}
    await editor.getByRole('button',{name:'取消',exact:true}).click();expect(errors).toEqual([]);
  });
}
