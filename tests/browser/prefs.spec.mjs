import {test,expect} from '@playwright/test';
const BASE='http://localhost:3711';

test('偏好变更后样式真正生效',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await page.goto('/');
  await page.waitForSelector('.auth-screen',{timeout:30000});
  // 「创建管理员账号」→ 留空邀请码创建新家庭空间
  await page.getByRole('button',{name:'创建管理员账号'}).click();
  await page.fill('input[name=name]','测试家长');
  await page.fill('input[name=email]',`prefs-${Date.now()}@yiban.test`);
  await page.fill('input[name=password]','TestPassword123!');
  await page.getByRole('button',{name:'创建管理员并进入'}).click();
  await page.waitForSelector('.app-shell',{timeout:30000});

  const snap=async()=>await page.evaluate(()=>{
    const s=document.querySelector('.app-shell'),cs=getComputedStyle(s);
    return {profile:s.dataset.profile,accent:s.dataset.accent,contrast:s.dataset.contrast||'',
      green:cs.getPropertyValue('--green').trim(),radius:cs.getPropertyValue('--radius').trim(),
      btnRadius:cs.getPropertyValue('--btn-radius').trim(),
      rootSize:getComputedStyle(document.documentElement).fontSize,
      btnHeight:document.querySelector('.btn')?.getBoundingClientRect().height};
  });
  const before=await snap();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/pref-before.png'});

  // 走真实 UI 点选：长辈 + 特大 + 海蓝
  await page.getByRole('button',{name:/设置/}).last().click();
  await page.waitForTimeout(400);
  await page.getByText('长辈',{exact:true}).first().click();
  await page.waitForTimeout(300);
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

  expect(after.profile).toBe('senior');
  expect(after.accent).toBe('blue');
  expect(after.rootSize).not.toBe(before.rootSize);
  expect(after.radius).not.toBe(before.radius);
  await ctx.close();
});
