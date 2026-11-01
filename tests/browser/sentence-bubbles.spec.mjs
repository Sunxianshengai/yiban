import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 test(`${device}: every sentence/line appears as its own paced bubble with one sticker`,async({page})=>{
  await page.setViewportSize({width,height});await signInAsNewAdmin(page,{prefix:'sentence-bubbles',credits:5});
  async function open(){if(device==='mobile'){await page.locator('.fa-profile-row').filter({hasText:'小满'}).click();await page.locator('.fa-contact-actions').getByRole('button',{name:/聊天/}).click();}else await page.locator('.side-nav').getByRole('button',{name:'陪伴对话',exact:true}).click();}
  await open();await page.getByLabel('发送给家伴的消息').fill('[test:sentence-bubbles]');await page.getByRole('button',{name:'发送消息',exact:true}).click();
  const bubbles=page.locator('.cw-assistant .im-bubble');
  await expect(bubbles).toHaveText(['哦哦，原来这样。','你准备什么时候去？','我刚才理解错了','那就按你说的来'],{timeout:30000});
  await expect(page.locator('.cw-assistant .im-sticker')).toHaveCount(1);
  const before=(await(await page.request.get('/api/credits/balance')).json()).balance;expect(before).toBe(4);
  await page.screenshot({path:`.impeccable/review/sentence-bubbles-${device}.png`,animations:'disabled'});
  await page.reload();await open();
  await expect(bubbles).toHaveText(['哦哦，原来这样。','你准备什么时候去？','我刚才理解错了','那就按你说的来']);
  await expect(page.locator('.cw-assistant .im-sticker')).toHaveCount(1);
  expect((await(await page.request.get('/api/credits/balance')).json()).balance).toBe(before);
 });
}
