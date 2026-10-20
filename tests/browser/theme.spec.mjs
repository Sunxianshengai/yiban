import {test,expect} from '@playwright/test';
const BASE='http://localhost:3711';

test('主题色作用于全站 + 陪伴时光首页无菜单卡',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await page.goto('/');
  await page.waitForSelector('.auth-screen',{timeout:30000});
  await page.getByRole('button',{name:'创建管理员账号'}).click();
  await page.fill('input[name=name]','主题测试');
  await page.fill('input[name=email]',`theme-${Date.now()}@yiban.test`);
  await page.fill('input[name=password]','TestPassword123!');
  await page.getByRole('button',{name:'创建管理员并进入'}).click();
  await page.waitForSelector('.app-shell',{timeout:30000});

  const probe=async(accent)=>{
    const r=await page.evaluate(async(a)=>{
      await fetch('/api/auth/preferences',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accent:a,ageGroup:'adult',fontScale:1,highContrast:false})});
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

  // 陪伴时光首页：不应再有 4 个菜单卡
  await page.getByRole('button',{name:'陪伴时光'}).first().click();
  await page.waitForSelector('.elder-app',{timeout:30000});
  await page.waitForTimeout(500);
  const menu=await page.locator('.elder-menu-item').count();
  console.log('elder-menu-item count =',menu);
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/companion-home.png',fullPage:true});
  expect(menu).toBe(0);
  await ctx.close();
});
