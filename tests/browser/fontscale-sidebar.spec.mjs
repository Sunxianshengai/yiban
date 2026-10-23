import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE='http://localhost:3711';

// 回归：字号切档必须真的改变全站文字，且特大档下侧栏文字不能顶出侧栏
test('字号档位生效 + 特大档顶栏不溢出',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'字号测试',prefix:'fs'});
  await page.getByRole('button',{name:/设置/}).first().click();
  await page.waitForTimeout(1200);

  // 注意：用 `.option-pill` 文本定位时「大」会同时匹配「大」和「最大」，取 first 就是「大」
  const expected={标准:14,偏大:16.1,大:18.2,特大:21};
  for(const [label,px] of Object.entries(expected)){
    await page.locator('.option-pill').filter({hasText:new RegExp(`^${label}$`)}).first().click();
    // 字号是「先存偏好、再由 useEffect 写内联样式」，两步之间隔了一次网络往返。
    // 固定等 600ms 在整轮跑（机器忙）时会偶发读到上一档的旧值——用轮询等它真的到位。
    await expect.poll(async()=>await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),
      {timeout:10000,message:`「${label}」档的根字号应当变成 ${px}px`}).toBeCloseTo(px,1);
  }

  // 特大档：顶栏改为横向布局后，导航链接区应自行横向滚动，页面本体不能被撑出横向滚动条
  const overflow=await page.evaluate(()=>({
    pageScrolls:document.documentElement.scrollWidth>window.innerWidth+1,
    topnavScrolls:(()=>{const n=document.querySelector('.topnav-links');return n?n.scrollWidth>n.clientWidth+1:false;})(),
  }));
  console.log('特大档顶栏',JSON.stringify(overflow));
  expect(overflow.pageScrolls).toBe(false);
  await ctx.close();
});
