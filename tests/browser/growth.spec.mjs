import {test,expect} from '@playwright/test';
import {cleanupTestMemories} from './helpers.mjs';

// 全年龄段的「成长记录」页。
//
// 这里锁的是三件产品决策：
// 1) 导航里必须有「成长记录」和「时间胶囊」两个入口——全年龄段不是把长辈功能改名，
//    是要让家里每个人都有一条自己的时间线。
// 2) 童言童语的录入必须便宜：一句话 + 选填年龄就能记下，录入框不能逼人填表。
// 3) 时间的封存：没到开启日期的内容对谁都不显示，连写它的人自己也看不到。

const STAMP=Date.now();

test.beforeEach(async({page,request})=>{
  const status=await (await request.get('/api/auth/status')).json();
  if(status.needsSetup){
    const setup=await request.post('/api/auth/setup',{data:{name:'小雨',email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(setup.status()).toBe(201);
  }else{
    const login=await request.post('/api/auth/login',{data:{email:'admin@yiban.test',password:'TestPassword123!'}});
    expect(login.status()).toBe(200);
  }
  await cleanupTestMemories(request);
  const cookies=(await request.storageState()).cookies;
  await page.context().addCookies(cookies);
  await page.goto('/');
  await page.waitForSelector('.app-shell',{timeout:30000});
});

test('导航里有「成长记录」，七个页签都在',async({page})=>{
  await page.getByRole('button',{name:'成长记录',exact:true}).click();
  await expect(page.getByRole('heading',{name:'成长记录'})).toBeVisible();
  for(const label of ['成长时间轴','那一年','人生里程碑','童言童语','成长对比','分龄采访','成长纪念册']){
    await expect(page.getByRole('button',{name:new RegExp(label)})).toBeVisible();
  }
});

test('没有出生年份时明说缺什么，而不是算出一个错的年龄',async({page,request})=>{
  const created=await request.post('/api/members',{data:{name:`自动测试家人${STAMP}`,relation:'女儿'}});
  expect(created.status()).toBe(201);
  const member=await created.json();
  try{
    // 家人是刚通过 API 加的，页面上的成员列表还是旧的——重载一次再找它。
    await page.reload();
    await page.getByRole('button',{name:'成长记录',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(`自动测试家人${STAMP}`)}).first().click();
    await expect(page.getByText('还没有出生年份')).toBeVisible();
  }finally{
    await request.delete(`/api/members/${member.id}`);
  }
});

test('童言童语：三秒能记下一句话',async({page,request})=>{
  const created=await request.post('/api/members',{data:{name:`自动测试家人${STAMP}`,relation:'女儿',birthYear:'1990'}});
  const member=await created.json();
  const text=`自动测试童言${STAMP}`;
  try{
    await page.reload();
    await page.getByRole('button',{name:'成长记录',exact:true}).click();
    await page.getByRole('button',{name:new RegExp(`自动测试家人${STAMP}`)}).first().click();
    await page.getByRole('button',{name:/童言童语/}).click();
    await page.getByLabel(/说了什么/).fill(text);
    await page.getByRole('button',{name:'记下这一句'}).click();
    await expect(page.getByText(text)).toBeVisible();
    const data=await (await request.get(`/api/stage/quotes?memberId=${member.id}`)).json();
    expect(data.quotes.some(q=>q.text===text)).toBe(true);
  }finally{
    const data=await (await request.get(`/api/stage/quotes?memberId=${member.id}`)).json();
    for(const q of data.quotes||[])await request.delete(`/api/quotes/${q.id}`);
    await request.delete(`/api/members/${member.id}`);
  }
});

test('时间胶囊：没到期的内容谁都看不到，连写它的人也看不到',async({page,request})=>{
  const created=await request.post('/api/members',{data:{name:`自动测试家人${STAMP}`,relation:'女儿',birthYear:'1990'}});
  const member=await created.json();
  try{
    await page.reload();
    await page.getByRole('button',{name:'时间胶囊',exact:true}).click();
    await expect(page.getByRole('heading',{name:'时间胶囊',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'写一封'}).click();
    await page.getByLabel(/标题/).fill('给你十八岁那天');
    await page.getByLabel(/写给谁/).selectOption(member.id);
    await page.getByLabel(/开启日期/).fill('2036-01-01');
    await page.getByLabel(/想说的话/).fill('那时候的你可能不信，但你已经很棒了。');
    await page.getByRole('button',{name:'封存'}).click();
    await expect(page.getByText('给你十八岁那天')).toBeVisible();
    // 封存了，但正文一个字都不显示，只说还剩多少天。
    await expect(page.getByText('那时候的你可能不信，但你已经很棒了。')).toHaveCount(0);
    await expect(page.getByText(/还有 \d+ 天开启/)).toBeVisible();
  }finally{
    const data=await (await request.get('/api/capsules')).json();
    for(const c of data.capsules||[])if(String(c.title||'').includes('给你十八岁那天'))await request.delete(`/api/capsules/${c.id}`);
    await request.delete(`/api/members/${member.id}`);
  }
});
