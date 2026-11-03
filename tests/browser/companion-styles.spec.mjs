import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {signInAsNewAdmin} from './helpers.mjs';
const folder='.impeccable/review/companion-styles';
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: style selection, collapsed expression preferences and free message feedback persist`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'styles',credits:15});fs.mkdirSync(folder,{recursive:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const before=(await(await page.request.get('/api/state')).json()).memories;
  await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.getByRole('button',{name:'人格与表达',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'人格与表达',exact:true});await expect(editor.locator('.pe-advanced')).not.toHaveAttribute('open');
  for(const label of ['俏皮损友','温柔克制','活泼直率']){await editor.getByRole('button',{name:new RegExp(label)}).click();await expect(editor.getByRole('button',{name:new RegExp(label)})).toHaveAttribute('aria-pressed','true');}
  await editor.getByRole('button',{name:/俏皮损友/}).click();await editor.locator('.pe-advanced>summary').click();await editor.getByLabel('语气词频率',{exact:true}).selectOption('low');await editor.getByLabel('不使用的表达',{exact:true}).fill('我完全理解你的感受');await page.screenshot({path:`${folder}/${device}-editor.png`,animations:'disabled'});
  await editor.getByRole('button',{name:'保存设置',exact:true}).click();await expect(editor).not.toBeVisible();
  let saved=(await(await page.request.get('/api/familia/profiles')).json()).defaultProfile;expect(saved.styleId).toBe('banter');expect(saved.verbalTics).toBe('low');expect(saved.blockedExpressions).toEqual(['我完全理解你的感受']);expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(15);
  await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();await page.getByLabel('发送给家伴的消息').fill('我举着手机找手机');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.getByRole('button',{name:'停止生成'})).toBeVisible();await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:30000});
  const reply=page.locator('.cw-assistant').last();await reply.getByRole('button',{name:'消息操作',exact:true}).click();await page.getByRole('button',{name:'少这样说',exact:true}).click();const feedback=page.getByRole('dialog',{name:'少这样说',exact:true});
  const quote=await feedback.locator('blockquote').innerText();await feedback.getByLabel('不再使用这段表达',{exact:true}).fill('不在这条回复里的词');await feedback.getByRole('button',{name:'保存偏好',exact:true}).click();await expect(feedback.getByRole('alert')).toContainText('实际出现');
  const phrase=quote.replace(/\s+/g,' ').slice(0,4);await feedback.getByLabel('不再使用这段表达',{exact:true}).fill(phrase);await page.screenshot({path:`${folder}/${device}-feedback.png`,animations:'disabled'});await feedback.getByRole('button',{name:'保存偏好',exact:true}).click();await expect(feedback).not.toBeVisible();saved=(await(await page.request.get('/api/familia/profiles')).json()).defaultProfile;expect(saved.blockedExpressions).toContain(phrase);expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(14);
  await page.reload();await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.getByRole('button',{name:'人格与表达',exact:true}).click();const reopened=page.getByRole('dialog',{name:'人格与表达',exact:true});await expect(reopened.locator('.pe-advanced')).not.toHaveAttribute('open');await expect(reopened.getByRole('button',{name:/俏皮损友/})).toHaveAttribute('aria-pressed','true');await reopened.locator('.pe-advanced>summary').click();await expect(reopened.getByLabel('不使用的表达',{exact:true})).toHaveValue('我完全理解你的感受\n'+phrase);
  await reopened.getByLabel('不使用的表达',{exact:true}).fill('');await reopened.getByRole('button',{name:'保存设置',exact:true}).click();expect((await(await page.request.get('/api/familia/profiles')).json()).defaultProfile.blockedExpressions).toEqual([]);
  expect((await(await page.request.get('/api/state')).json()).memories).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 });
}
test('new companion can choose an original style during the existing creation flow',async({page})=>{
 await signInAsNewAdmin(page,{prefix:'style-create',credits:0});await page.locator('.fa-add-person').click();
 const setup=page.getByRole('dialog',{name:'创建 AI 家人',exact:true});await setup.getByRole('button',{name:'朋友',exact:true}).click();
 for(let i=0;i<3;i++)await setup.getByRole('button',{name:'继续',exact:true}).click();
 await setup.getByLabel('陪伴风格',{exact:true}).selectOption('bright');await setup.getByLabel('希望得到怎样的陪伴',{exact:true}).fill('直接一点，也尊重我想安静的时候。');
 for(let i=0;i<3;i++)await setup.getByRole('button',{name:'继续',exact:true}).click();
 await setup.getByLabel('AI 家人称呼',{exact:true}).fill('新向晴');await setup.getByRole('button',{name:'创建 AI 家人',exact:true}).click();await expect(page.getByRole('dialog',{name:'创建完成',exact:true})).toBeVisible();
 const profile=(await(await page.request.get('/api/familia/profiles')).json()).profiles.find(p=>p.name==='新向晴');expect(profile.styleId).toBe('bright');expect(profile.description).toContain('尊重');
});
