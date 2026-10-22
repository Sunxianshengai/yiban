import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

// 左栏的筛选：先从三十张里挑，挑到人就聊。
// 这几条盯住的是「挑不到人」最容易踩的坑——分类叠加、筛选后列表不该乱。

test('按来源与困惑挑人：分类是「与」的关系，能叠加也能清空',async({page})=>{
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'roles'});
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.page-heading h1')).toContainText('说说话');
  await expect(page.locator('.role-card')).toHaveCount(30,{timeout:15000});

  // 按「家里的事」筛一遍，剩下的应该都是家里人这类角色。
  await page.locator('.concern-chip',{hasText:'家里的事'}).click();
  const familyCount=await page.locator('.role-card').count();
  expect(familyCount).toBeGreaterThan(1);
  expect(familyCount).toBeLessThan(30);

  await page.locator('.concern-chip',{hasText:'都能聊'}).click();
  await expect(page.locator('.role-card')).toHaveCount(30);

  // 书里的人：只剩九位，并且界面明说这不是原文。
  await page.getByRole('button',{name:'书里的人',exact:true}).click();
  await expect(page.locator('.role-card')).toHaveCount(9);
  await expect(page.getByText(/话是照着书里写定的性子说的/)).toBeVisible();
  await page.getByRole('button',{name:'史书里的人',exact:true}).click();
  await expect(page.locator('.role-card')).toHaveCount(9);
  await page.locator('.kind-tab',{hasText:'都在这儿'}).click();
  await expect(page.locator('.role-card')).toHaveCount(30);

  // 两个维度叠加：史书里的人 + 工作与钱，应该比单独任一个都少。
  await page.getByRole('button',{name:'史书里的人',exact:true}).click();
  await page.locator('.concern-chip',{hasText:'工作与钱'}).click();
  const both=await page.locator('.role-card').count();
  expect(both).toBeGreaterThan(0);
  expect(both).toBeLessThan(9);

  // 搜索框能按名字/出处/脾气找到人。
  await page.locator('.kind-tab',{hasText:'都在这儿'}).click();
  await page.locator('.concern-chip',{hasText:'都能聊'}).click();
  await page.getByLabel('找谁说话').fill('苏轼');
  await expect(page.locator('.role-card')).toHaveCount(1);
  await expect(page.locator('.role-card')).toContainText('苏轼');
});

test('每个角色的对话各聊各的，换回来还能接着说',async({page})=>{
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'roles-thread'});
  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.role-card')).toHaveCount(30,{timeout:15000});

  await page.locator('.role-card',{hasText:'老朋友'}).first().click();
  await page.getByLabel('跟这个角色说一句话').fill('最近总觉得没意思');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);

  // 换去另一个角色：对话是空的，不串味。
  await page.getByRole('button',{name:'换个人说话'}).click();
  await page.locator('.role-card',{hasText:'老师'}).first().click();
  await expect(page.locator('.companion-line')).toHaveCount(0);
  await expect(page.locator('.companion-opening')).toBeVisible();

  // 换回老朋友：刚才那句还在，卡片上标着聊过几句。
  await page.getByRole('button',{name:'换个人说话'}).click();
  await expect(page.locator('.role-card',{hasText:'老朋友'}).first()).toBeVisible();
  await expect(page.locator('.role-card',{hasText:'聊过'}).first()).toBeVisible();
  await page.locator('.role-card',{hasText:'老朋友'}).first().click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);
  await expect(page.locator('.companion-line.user')).toContainText('最近总觉得没意思');

  // 重新开始只清这段对话。
  await page.getByRole('button',{name:'重新开始'}).click();
  await expect(page.locator('.companion-line')).toHaveCount(0);
});

test('记忆默认不借用：不打开开关就不提旧事，打开了才提，并且能点回原文',async({page})=>{
  const request=page.context().request;
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'roles-memory'});
  // 造一段只属于这位管理员本人的已确认记忆，避免撞到种子数据。
  const created=await request.post('/api/memories',{data:{title:'自动测试找说话的记忆',year:'1999',location:'厦门',theme:'旅行',people:['测试家长'],story:'那年夏天在厦门海边捡了很多贝壳。',status:'confirmed'}});
  expect(created.ok()).toBe(true);

  await page.getByRole('navigation').getByRole('button',{name:'说说话'}).click();
  await expect(page.locator('.role-card')).toHaveCount(30,{timeout:15000});
  await page.locator('.role-card',{hasText:'奶奶'}).first().click();

  // 默认没开记忆：说一件跟记忆有关的事，它不该提起厦门的贝壳。
  await page.getByLabel('跟这个角色说一句话').fill('还记得那年夏天在厦门捡贝壳吗');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  // 打字动画也挂 `.companion-line.companion`，等它退场才说明回复真到了，
  // 否则 `toHaveCount(1)` 会被动画骗过去。
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-line.companion')).toHaveCount(1);
  await expect(page.locator('.companion-sources')).toHaveCount(0);

  // 打开开关，再问一次。
  await page.getByRole('button',{name:'换个说法'}).click();
  await page.getByRole('dialog',{name:'换个说法'}).getByRole('checkbox').check();
  await page.getByRole('dialog',{name:'换个说法'}).getByRole('button',{name:'就这样'}).click();
  await expect(page.locator('.role-memory-on')).toBeVisible();

  await page.getByLabel('跟这个角色说一句话').fill('还记得那年夏天在厦门捡贝壳吗');
  await page.getByRole('button',{name:'说一句',exact:true}).click();
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-sources')).toBeVisible();
  await expect(page.locator('.companion-sources')).toContainText('自动测试找说话的记忆');

  // 手机上不横向溢出。
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
