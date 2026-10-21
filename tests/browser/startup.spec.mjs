import {test,expect} from '@playwright/test';

test('reconnect repeats auth detection and recovers first-run setup after a server failure',async({page})=>{
  let attempts=0;
  await page.route('**/api/auth/status',route=>{
    attempts++;
    return attempts===1
      ?route.fulfill({status:503,contentType:'text/html',body:'Service unavailable'})
      :route.fulfill({json:{needsSetup:true,user:null,remoteStorage:true}});
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'记忆小屋暂时无法打开'})).toBeVisible();
  await expect(page.getByText(/HTTP 503/)).toBeVisible();
  // 不断言绝对次数：React 严格模式 / 开发态会重复挂载 effect，
  // 真正的契约是「点重新连接会再发起一次探测，并且能恢复」。
  const before=attempts;
  await page.getByRole('button',{name:'重新连接'}).click();
  await expect(page.getByRole('heading',{name:'创建管理员账号'})).toBeVisible();
  expect(attempts).toBeGreaterThan(before);
});
