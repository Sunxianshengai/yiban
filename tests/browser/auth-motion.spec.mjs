import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('login background has no motion controls, follows system preferences and keeps the form usable',async({page})=>{
  await page.goto('/app/');
  await expect(page.getByLabel('邮箱',{exact:true})).toBeVisible();
  await expect(page.locator('.am-controls')).toHaveCount(0);
  await expect(page.locator('.auth-box')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('.auth-box')).toHaveCSS('box-shadow','none');
  mkdirSync('.impeccable/review/login-motion',{recursive:true});
  await page.screenshot({path:'.impeccable/review/login-motion/unified-desktop.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.am-wave').first()).toHaveCSS('animation-name','none');
  await expect(page.locator('.am-orb')).toHaveCSS('animation-name','none');
  for(const width of [800,390,320]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('邮箱',{exact:true})).toBeVisible();
  }
});
