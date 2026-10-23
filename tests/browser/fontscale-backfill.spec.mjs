import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

// 精确复现旧 bug 的触发路径：先存好一个档位 → 切到另一个档位 → 等保存回填。
// 回填瞬间如果还有第二个写入者在读旧的 saved，就会把新字号覆盖回旧值。
// 这里用 DOM MutationObserver 记录每一次内联写入，一旦新档位之后出现旧值即判失败。
test('保存回填阶段不把新字号覆盖回旧值',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'回填测试',prefix:'bf'});
  await page.getByRole('button',{name:/设置/}).first().click();
  await page.waitForTimeout(1500);

  const pill=label=>page.locator('.option-pill').filter({hasText:new RegExp(`^${label}$`)}).first();

  // 先把「大」存好，让服务端处于一个明确的状态
  await pill('大').click();
  await page.waitForTimeout(2500);

  // 开始记录写入
  await page.evaluate(()=>{
    window.__writes=[];
    new MutationObserver(()=>{
      window.__writes.push({t:+(performance.now()-window.__t0).toFixed(1),v:document.documentElement.style.fontSize||'(空)'});
    }).observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    window.__t0=performance.now();
  });

  // 切到「特大」，保存过程中不允许出现 18.2px 的写入
  await pill('特大').click();
  await page.waitForTimeout(2500);
  const writes=await page.evaluate(()=>window.__writes);
  console.log('切到特大期间的字号写入:',JSON.stringify(writes));

  const reverted=writes.filter(w=>w.v==='18.2px');
  expect(reverted).toEqual([]);          // 绝不允许把已保存的旧档位写回去

  const final=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(Math.abs(final-21)).toBeLessThan(0.2);
  await ctx.close();
});
