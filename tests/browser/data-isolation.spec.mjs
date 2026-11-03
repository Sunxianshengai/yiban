import {test,expect} from '@playwright/test';
import {signInAsNewAdmin,openSettings,chooseSettingsTab} from './helpers.mjs';
import fs from 'node:fs';
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: independent family UI switches data without changing private companion or credits`,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'family-isolation',credits:12});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const before=await(await page.request.get('/api/state')).json(),name='独立验收家庭-'+Date.now();
  const companion=await page.request.post('/api/familia/profiles',{headers:{'Idempotency-Key':'isolation-persona-'+Date.now()},data:{name:'只属于我的伙伴',role:'friend',age:25,qualities:['friendly']}});expect(companion.status()).toBe(201);const profile=await companion.json();
  await openSettings(page);await chooseSettingsTab(page,'家庭空间');await page.getByLabel('新家庭名称',{exact:true}).fill(name);await page.getByRole('button',{name:'创建独立家庭',exact:true}).click();await expect(page.locator('.app-shell')).toBeVisible();
  await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).account.familyId).not.toBe(before.account.familyId);
  const fresh=await(await page.request.get('/api/state')).json();expect(fresh.memories).toEqual([]);expect(fresh.members).toEqual([]);expect(fresh.settings.familyName).toBe(name);expect(fresh.account.platformRole).not.toBe('owner');
  const created=await page.request.post('/api/memories',{data:{title:'独立家庭的记忆',story:'只属于这个家庭的测试记录。',status:'confirmed'}});expect(created.status()).toBe(201);const memory=await created.json();
  expect((await(await page.request.get('/api/familia/profiles')).json()).profiles.some(item=>item.id===profile.id)).toBe(true);expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(12);
  await openSettings(page);await chooseSettingsTab(page,'家庭空间');await expect(page.locator('.family-spaces-list>div')).toHaveCount(2);await expect(page.locator('.family-spaces')).toContainText(name);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);fs.mkdirSync('.impeccable/review/data-isolation',{recursive:true});await page.screenshot({path:`.impeccable/review/data-isolation/${device}-family-spaces.png`,fullPage:true});
  await page.locator('.family-spaces').getByRole('button',{name:'切换',exact:true}).click();await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).account.familyId).toBe(before.account.familyId);
  const restored=await(await page.request.get('/api/state')).json();expect(restored.memories.some(item=>item.id===memory.id)).toBe(false);expect(restored.members).toEqual(before.members);
  expect((await page.request.patch('/api/memories/'+memory.id,{data:{title:'不能跨家庭编辑'}})).status()).toBe(404);expect(errors).toEqual([]);
 });
}
