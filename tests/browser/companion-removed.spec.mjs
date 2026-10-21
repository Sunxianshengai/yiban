import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE='http://localhost:3711';

test('陪伴时光已整页移除，主端功能完好',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await signInAsNewAdmin(page,{name:'移除测试',prefix:'rm'});

  const navs=await page.locator('.nav-item').allInnerTexts();
  console.log('NAV',JSON.stringify(navs));
  expect(navs.join()).not.toContain('陪伴时光');

  const body=await page.locator('body').innerText();
  expect(body).not.toContain('陪伴时光');
  expect(await page.locator('.elder-app').count()).toBe(0);

  // 主端各页仍可打开
  for(const name of ['家庭记忆库','故事专辑','我的家人','陪伴记录','家庭设置']){
    await page.getByRole('button',{name:new RegExp(name)}).first().click();
    await page.waitForTimeout(350);
    console.log('PAGE',name,'ok');
  }
  await page.getByRole('button',{name:/家庭设置/}).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/settings-after.png',fullPage:true});

  // 记忆详情：不应还有「到陪伴时光看看」
  await page.getByRole('button',{name:'记忆小屋'}).first().click();
  await page.waitForTimeout(500);
  const card=page.locator('.memory-card').first();
  await card.click();
  await page.waitForTimeout(700);
  const modal=await page.locator('.modal').innerText().catch(()=>'');
  console.log('MODAL has companion btn:',modal.includes('陪伴时光'));
  expect(modal).not.toContain('陪伴时光');
  expect(errs).toEqual([]);
  await ctx.close();
});
