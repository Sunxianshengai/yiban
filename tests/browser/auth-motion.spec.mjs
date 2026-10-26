import {test,expect} from '@playwright/test';

test('login motion can be paused by keyboard and reduced without disabling the form',async({page})=>{
  await page.goto('/app/');
  await expect(page.getByRole('button',{name:'暂停动效',exact:true})).toBeVisible();
  const pause=page.getByRole('button',{name:'暂停动效',exact:true});
  await pause.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'播放动效',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.am-wave').first()).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'播放动效',exact:true}).click();
  await page.getByRole('button',{name:'减少动态',exact:true}).click();
  await expect(page.locator('.am-wave').first()).toHaveCSS('animation-name','none');
  await expect(page.getByLabel('邮箱',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'恢复动态',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.am-wave').first()).toHaveCSS('animation-name','none');
  await expect(page.locator('.am-orb')).toHaveCSS('animation-name','none');
  for(const width of [800,390,320]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('邮箱',{exact:true})).toBeVisible();
  }
});
