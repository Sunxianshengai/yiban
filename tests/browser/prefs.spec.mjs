import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE='http://localhost:3711';

test('偏好变更后字号与主题色真正生效',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'prefs'});

  const snap=async()=>await page.evaluate(()=>{
    const s=document.querySelector('.app-shell'),cs=getComputedStyle(s);
    return {accent:s.dataset.accent,contrast:s.dataset.contrast||'',
      green:cs.getPropertyValue('--green').trim(),
      rootSize:getComputedStyle(document.documentElement).fontSize,
      btnHeight:document.querySelector('.btn')?.getBoundingClientRect().height};
  });
  const before=await snap();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/pref-before.png'});

  // 走真实 UI 点选：特大 + 海蓝（年龄档已移除）
  await page.getByRole('button',{name:/设置/}).last().click();
  await page.waitForTimeout(400);
  await page.getByRole('button',{name:'特大',exact:true}).click();
  await page.waitForTimeout(300);
  await page.getByRole('button',{name:/海蓝/}).first().click();
  await page.waitForTimeout(700);

  // 切回首页看实际观感
  await page.getByRole('button',{name:'记忆小屋'}).first().click();
  await page.waitForTimeout(600);
  const after=await snap();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/pref-after.png'});
  console.log('BEFORE',JSON.stringify(before));
  console.log('AFTER ',JSON.stringify(after));

  expect(after.accent).toBe('blue');
  expect(after.rootSize).not.toBe(before.rootSize);
  await ctx.close();
});
