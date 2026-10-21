import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

test('主题色作用于全站',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'主题测试',prefix:'theme'});

  const probe=async(accent)=>{
    const r=await page.evaluate(async(a)=>{
      await fetch('/api/auth/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accent:a,fontScale:1,highContrast:false})});
      return true;
    },accent);
    await page.reload();
    await page.waitForSelector('.app-shell',{timeout:30000});
    await page.waitForTimeout(400);
    return await page.evaluate(()=>{
      const q=s=>document.querySelector(s);
      const cs=e=>e?getComputedStyle(e):null;
      const shell=q('.app-shell');
      return {accent:shell.dataset.accent,
        sidebarToken:cs(shell).getPropertyValue('--accent').trim(),
        btn:cs(q('.btn-primary'))?.backgroundImage,
        brand:cs(q('.brand-mark'))?.color,
        navActive:cs(q('.nav-item.active'))?.color,
        navActiveBg:cs(q('.nav-item.active'))?.backgroundColor,
        sidebarBg:cs(q('.sidebar'))?.backgroundColor};
    });
  };

  const seen={};
  for(const a of ['sage','peach','lavender','blue','gold']){
    seen[a]=await probe(a);
    console.log(a.toUpperCase(),JSON.stringify(seen[a]));
  }
  // 每个主题下按钮/品牌/导航都应不同
  const sig=Object.values(seen).map(v=>[v.btn,v.brand,v.navActive].join('|'));
  console.log('UNIQUE',new Set(sig).size,'of',sig.length);
  expect(new Set(sig).size).toBe(5);
  await ctx.close();
});
