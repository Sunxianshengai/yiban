import {test,expect} from '@playwright/test';
const BASE='http://localhost:3711';

// 回归：字号切档必须真的改变全站文字，且特大档下侧栏文字不能顶出侧栏
test('字号档位生效 + 特大档侧栏不溢出',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await page.goto('/');
  await page.waitForSelector('.auth-screen',{timeout:30000});
  await page.getByRole('button',{name:'创建管理员账号'}).click();
  await page.fill('input[name=name]','字号测试');
  await page.fill('input[name=email]',`fs-${Date.now()}@yiban.test`);
  await page.fill('input[name=password]','TestPassword123!');
  await page.getByRole('button',{name:'创建管理员并进入'}).click();
  await page.waitForSelector('.app-shell',{timeout:30000});
  await page.getByRole('button',{name:/家庭设置/}).first().click();
  await page.waitForTimeout(1200);

  // 注意：用 `.option-pill` 文本定位时「大」会同时匹配「大」和「最大」，取 first 就是「大」
  const expected={标准:14,偏大:16.1,大:18.2,特大:21};
  for(const [label,px] of Object.entries(expected)){
    await page.locator('.option-pill').filter({hasText:new RegExp(`^${label}$`)}).first().click();
    await page.waitForTimeout(600);
    const rootPx=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
    console.log(label,'根字号',rootPx,'期望',px);
    expect(Math.abs(rootPx-px)).toBeLessThan(0.2);
  }

  // 特大档：侧栏里的品牌名、导航文字、账号名都不能超出侧栏右边界
  const overflow=await page.evaluate(()=>{
    const sb=document.querySelector('.sidebar').getBoundingClientRect();
    const sel='.sidebar .brand span:last-child,.sidebar .nav-item span,.sidebar .profile-button strong,.sidebar .family-switch strong';
    const bad=[];
    for(const el of document.querySelectorAll(sel)){
      const r=el.getBoundingClientRect();
      if(r.right>sb.right+0.5||r.left<sb.left-0.5)bad.push({cls:el.className||el.tagName,text:(el.textContent||'').slice(0,10),right:Math.round(r.right),sidebarRight:Math.round(sb.right)});
    }
    return {sidebarW:Math.round(sb.width),bad};
  });
  console.log('特大档侧栏',JSON.stringify(overflow));
  expect(overflow.bad).toEqual([]);
  // 特大档侧栏最宽 292px（文字实际需要这么多），不能无限跟着字号涨（纯 rem 会到 345px）
  expect(overflow.sidebarW).toBeLessThanOrEqual(300);
  await ctx.close();
});
