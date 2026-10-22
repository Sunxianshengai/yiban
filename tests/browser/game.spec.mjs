import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';

// 人生推演（L3）：从一段已确认的记忆出发，一幕一幕由模型现写。
// E2E 跑在 tests/mock-model.mjs 的假模型上，所以这里验的是「链路通、契约对」，
// 不是验文案好不好——文案每次都不一样。
test.beforeEach(async({page})=>{
  await signInAsNewAdmin(page,{name:'推演家长',prefix:'life'});
});

test('从一段记忆往后走，直到模型收尾，并明确说明这不是事实',async({page})=>{
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button',{name:/人生模拟/}).click();

  // 大界面（不是弹窗）：标题与起点列表都在页面里
  await expect(page.getByRole('heading',{name:'从一段记忆，往后走一生'})).toBeVisible();
  await expect(page.locator('.life-shell')).toBeVisible();
  await expect(page.getByText('推演出来的事都不是真的发生过的事')).toBeVisible();

  // 起点只来自已确认记忆
  const origins=page.locator('.life-origin');
  await expect(origins.first()).toBeVisible();
  await origins.first().click();

  // 第一幕：旁白 + 三个选项 + 自由输入
  await expect(page.locator('.life-narration').first()).toBeVisible();
  await expect(page.locator('.life-narration').first().locator('p')).not.toBeEmpty();
  await expect(page.locator('.life-choice')).toHaveCount(3);
  await expect(page.locator('.life-free input')).toBeVisible();
  await expect(page.getByText('幕数不设死')).toBeVisible();

  // 属性面板：六个属性都渲染出来，且是「属性」不是分数排名
  await expect(page.locator('.life-stats li')).toHaveCount(6);
  await expect(page.getByText('属性不是分数')).toBeVisible();

  // 一路点到收尾（假模型第三幕收尾）
  let rounds=0;
  while(rounds<8&&await page.locator('.life-choice').first().isVisible().catch(()=>false)){
    await page.locator('.life-choice').first().click();
    rounds+=1;
    await expect(page.locator('.life-mine')).toHaveCount(rounds);
  }
  expect(rounds).toBeGreaterThan(0);

  // 结局：正文 + 免责说明，且不说「你选对了」
  const ending=page.locator('.life-ending');
  await expect(ending).toBeVisible();
  await expect(ending.locator('.life-disclaimer')).toContainText('不是真实发生的事');
  await expect(ending).not.toContainText('你选对了');
  await expect(page.getByRole('button',{name:'再走一生'})).toBeVisible();

  // 界面不报错
});

test('自己写一句也能推进，空输入不提交',async({page})=>{
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button',{name:/人生模拟/}).click();
  await page.locator('.life-origin').first().click();
  await expect(page.locator('.life-choice')).toHaveCount(3);

  const submit=page.getByRole('button',{name:'就这样做'});
  await expect(submit).toBeDisabled();

  await page.locator('.life-free input').fill('我没有上那趟火车，留下来陪奶奶过完那个冬天。');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator('.life-mine').first()).toContainText('我没有上那趟火车');
  await expect(page.locator('.life-mine').first()).toContainText('自己写的');
});

test('没有已确认记忆时不给开局，只引导去确认一段',async({page})=>{
  // 用一个全新的家庭空间，把已有记忆全部改成草稿后再进推演页
  const state=await (await page.request.get('/api/state')).json();
  for(const memory of state.memories||[]){
    await page.request.patch(`/api/memories/${memory.id}`,{data:{title:memory.title,status:'draft'}});
  }
  try{
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button',{name:/人生模拟/}).click();
    await expect(page.getByText('还没有可以出发的记忆')).toBeVisible();
  }finally{
    for(const memory of state.memories||[]){
      await page.request.patch(`/api/memories/${memory.id}`,{data:{title:memory.title,status:'confirmed'}});
    }
  }
});
