import {test,expect} from '@playwright/test';
import {BASE,signInAsNewAdmin} from './helpers.mjs';

// 「找人说说话」是这一轮的主功能：一屋子可以换的人，按心里的困惑挑，不是按辈分挑。
// 三个用例分别盯住三件容易做坏的事：
//   1. 换角色真的换了人（同一句话不同人回得不一样）；
//   2. 每个角色的对话各存各的，换回来还能接着说；
//   3. 记忆默认不借用——不打开开关，它就不该提旧事。

test('一屋子的人：按来源与困惑挑、选一个就能聊、换个人回的话不一样',async({page})=>{
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'roles'});
  await page.getByRole('navigation').getByRole('button',{name:/找人说说话/}).click();
  await expect(page.locator('.page-heading h1')).toContainText('找人说说话');
  await expect(page.locator('.role-card')).toHaveCount(30);

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

  // 挑「母亲」聊一句。
  await page.locator('.role-card',{hasText:'母亲'}).first().click();
  await expect(page.locator('.companion-head h2')).toContainText('母亲');
  // 角色先开口，不是给一个空输入框。
  await expect(page.locator('.companion-opening')).toBeVisible();
  await page.getByLabel('跟这个角色说一句话').fill('今天好累');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);
  // 用户那句是乐观插入的，角色那句要等接口回来。
  // 注意打字动画本身也挂在 `.companion-line.companion` 上，所以等它退场再读。
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-line.companion')).toHaveCount(1);
  const motherReply=await page.locator('.companion-line.companion').last().innerText();
  expect(motherReply.length).toBeGreaterThan(4);

  // 换个人，同一句话，回的应该是另一种话。
  await page.getByRole('button',{name:'换个人说话'}).click();
  await page.locator('.role-card',{hasText:'兄弟'}).first().click();
  await expect(page.locator('.companion-head h2')).toContainText('兄弟');
  await page.getByLabel('跟这个角色说一句话').fill('今天好累');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-line.companion')).toHaveCount(1);
  const brotherReply=await page.locator('.companion-line.companion').last().innerText();
  expect(brotherReply).not.toBe(motherReply);
});

test('每个角色的对话各聊各的，换回来还能接着说',async({page})=>{
  await signInAsNewAdmin(page,{name:'测试家长',prefix:'roles-thread'});
  await page.getByRole('navigation').getByRole('button',{name:/找人说说话/}).click();

  await page.locator('.role-card',{hasText:'老朋友'}).first().click();
  await page.getByLabel('跟这个角色说一句话').fill('最近总觉得没意思');
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-line.user')).toHaveCount(1);

  // 换去另一个角色：对话是空的，不串味。
  await page.getByRole('button',{name:'换个人说话'}).click();
  await page.locator('.role-card',{hasText:'老师'}).first().click();
  await expect(page.locator('.companion-line')).toHaveCount(0);
  await expect(page.locator('.companion-opening')).toBeVisible();

  // 换回老朋友：刚才那句还在。
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

  await page.getByRole('navigation').getByRole('button',{name:/找人说说话/}).click();
  await page.locator('.role-card',{hasText:'奶奶'}).first().click();

  // 默认没开记忆：说一件跟记忆有关的事，它不该提起厦门的贝壳。
  await page.getByLabel('跟这个角色说一句话').fill('还记得那年夏天在厦门捡贝壳吗');
  await page.getByRole('button',{name:'说一句'}).click();
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
  await page.getByRole('button',{name:'说一句'}).click();
  await expect(page.locator('.companion-typing')).toHaveCount(0);
  await expect(page.locator('.companion-sources')).toBeVisible();
  await expect(page.locator('.companion-sources')).toContainText('自动测试找说话的记忆');

  // 手机上不横向溢出。
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
