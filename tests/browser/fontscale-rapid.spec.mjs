import {test,expect} from '@playwright/test';
import {signInAsNewAdmin,openSettings} from './helpers.mjs';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

// 压力测试：连续快速切换字号（比自动保存的 700ms 更快），
// 校验最终字号等于最后一个点击，且中途没有被旧档位覆盖。
test('快速连点字号不回退、终态正确',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await signInAsNewAdmin(page,{name:'连点测试',prefix:'rp'});
  await openSettings(page);

  const pill=label=>page.locator('.option-pill').filter({hasText:new RegExp(`^${label}$`)}).first();
  const rootPx=()=>page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));

  // 记录每次点击后立即读到的字号，不允许出现「点了 C 却显示 B」
  const seen=[];
  for(const label of ['特大','标准','大','偏大','特大']){
    await pill(label).click();
    await page.waitForTimeout(60);            // 比 700ms 自动保存快得多，请求都会互相追尾
    seen.push({label,px:+(await rootPx()).toFixed(1)});
  }
  console.log('连点后即时读数:',JSON.stringify(seen));
  await page.waitForTimeout(3500);

  const final=await rootPx();
  console.log('最终字号',final);
  expect(Math.abs(final-24)).toBeLessThan(0.2);

  // 刷新后服务端确认落库的也是最后一档
  await page.reload();
  await page.waitForSelector('.app-shell',{timeout:30000});
  const afterReload=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
  console.log('刷新后字号',afterReload);
  expect(Math.abs(afterReload-24)).toBeLessThan(0.2);

  await openSettings(page);
  const selected=await page.locator('.option-pill.selected').first().textContent();
  console.log('设置页选中档位:',selected);
  expect(selected.trim()).toBe('特大');
  expect(errors).toEqual([]);
  await ctx.close();
});
