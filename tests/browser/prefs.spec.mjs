import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

test('偏好变更后字号与主题真正生效',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'prefs'});

  const snap=async()=>await page.evaluate(()=>{
    const s=document.querySelector('.app-shell'),cs=getComputedStyle(s);
    return {theme:s.dataset.theme,contrast:s.dataset.contrast||'',
      brand:cs.getPropertyValue('--brand').trim(),
      rootSize:getComputedStyle(document.documentElement).fontSize,
      btnHeight:document.querySelector('.btn')?.getBoundingClientRect().height};
  });
  const before=await snap();

  // 走真实 UI 点选：先夜间主题（等 data-theme 真的翻过来），再特大字号。
  // 特大会让整页以 24px 根字号重排，紧接着的点击必须等重排结束，否则会点偏。
  await page.getByRole('button',{name:/设置/}).last().click();
  await page.waitForTimeout(600);
  await page.getByRole('button',{name:/夜间/}).first().click();
  await expect.poll(async()=>await page.evaluate(()=>document.querySelector('.app-shell')?.dataset.theme),
    {timeout:10000,message:'夜间主题应当立即生效'}).toBe('night');
  await page.getByRole('button',{name:'特大',exact:true}).click();
  await expect.poll(async()=>await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),
    {timeout:10000,message:'特大档根字号应为 24px'}).toBeCloseTo(24,1);
  await page.waitForTimeout(600);

  // 切回首页看实际观感
  await page.getByRole('button',{name:'首页'}).first().click();
  await page.waitForTimeout(600);
  const after=await snap();
  console.log('BEFORE',JSON.stringify(before));
  console.log('AFTER ',JSON.stringify(after));

  expect(after.theme).toBe('night');
  expect(after.brand).not.toBe(before.brand);
  expect(after.rootSize).not.toBe(before.rootSize);
  await ctx.close();
});
