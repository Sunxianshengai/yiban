import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

test('日间/夜间主题作用于全站',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'主题测试',prefix:'theme'});

  const probe=async(theme)=>{
    await page.evaluate(async t=>{
      await fetch('/api/auth/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:t,fontScale:1,highContrast:false})});
      return true;
    },theme);
    await page.reload();
    await page.waitForSelector('.app-shell',{timeout:30000});
    await page.waitForTimeout(400);
    return await page.evaluate(()=>{
      const q=s=>document.querySelector(s);
      const cs=e=>e?getComputedStyle(e):null;
      const shell=q('.app-shell');
      return {theme:shell.dataset.theme,
        htmlTheme:document.documentElement.dataset.theme||'',
        brand:cs(shell).getPropertyValue('--brand').trim(),
        brandMark:cs(q('.brand-mark'))?.backgroundColor,
        navActive:cs(q('.nav-item.active'))?.color,
        navActiveBg:cs(q('.nav-item.active'))?.backgroundColor,
        sidebarBg:cs(q('.sidebar'))?.backgroundColor,
        bodyBg:cs(document.body)?.backgroundColor};
    });
  };

  const day=await probe('day');
  const night=await probe('night');
  console.log('DAY',JSON.stringify(day));
  console.log('NIGHT',JSON.stringify(night));
  expect(day.theme).toBe('day');
  expect(night.theme).toBe('night');
  expect(night.htmlTheme).toBe('night');
  // 两个主题的整体观感必须不同：侧栏、正文底色、品牌色全部换掉
  expect(day.sidebarBg).not.toBe(night.sidebarBg);
  expect(day.bodyBg).not.toBe(night.bodyBg);
  expect(day.brand).not.toBe(night.brand);
  // 日间品牌是深松绿 #2E5147（rgb(46,81,71)）；夜间主操作是浅薄荷 #A5C7B4
  expect(day.brand.toLowerCase()).toBe('#2e5147');
  expect(night.brand.toLowerCase()).toBe('#a5c7b4');
  // 品牌徽标的底色也跟着换：日间深绿底，夜间浅薄荷底
  const lum=s=>{const [r,g,b]=s.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number)||[0,0,0];return 0.2126*r+0.7152*g+0.0722*b;};
  expect(lum(day.brandMark)).toBeLessThan(lum(night.brandMark));
  await ctx.close();
});
