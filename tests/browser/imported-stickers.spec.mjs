import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: imported GIF picker searches, decodes and sends a real sticker`,async({page})=>{
  await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'imported-stickers',credits:5});
  if(device==='mobile'){await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();}
  else await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();
  await expect(page.getByLabel('发送给家伴的消息')).toBeEnabled();
  await page.getByRole('button',{name:'表情',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'表情',exact:true});
  await dialog.getByLabel('搜索表情').fill('小猫摇摆');
  const button=dialog.getByRole('button',{name:'发送表情：小猫摇摆',exact:true});
  await expect(button).toBeVisible();
  const image=button.locator('img');await image.scrollIntoViewIfNeeded();
  await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await expect(image).toHaveAttribute('src',/\/companions\/imported\/.+\.gif$/);
  await dialog.getByLabel('搜索表情').fill('不存在的表情xyz');await expect(dialog.getByRole('status')).toHaveText('没有找到对应表情，换个词试试。');
  await dialog.getByLabel('搜索表情').fill('小猫摇摆');
  await page.screenshot({path:`.impeccable/review/imported-stickers-${device}.png`,animations:'disabled'});
  await button.click();
  await expect(page.locator('.cw-user .im-sticker img').last()).toHaveAttribute('src',/\/companions\/imported\/.+\.gif$/);
  await expect(page.getByRole('button',{name:'发送消息',exact:true})).toBeVisible({timeout:30000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();
  if(device==='mobile'){await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();}
  else await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();
  await expect(page.locator('.cw-user .im-sticker img').last()).toHaveAttribute('src',/\/companions\/imported\/.+\.gif$/);
 });
}
