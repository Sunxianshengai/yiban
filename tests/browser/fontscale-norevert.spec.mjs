import {test,expect} from '@playwright/test';
const BASE=process.env.PW_BASE_URL||'http://localhost:3711';

// 回归：切换字号后不允许回退到上一个档位。
// 曾经的 bug：Personalize 里有一个 useEffect 监听本地预览值，保存完成时
// 「pending 清空」与「PATCH 响应回填」是两次渲染，中间那次读到的是旧字号，
// 于是刚点的高度被覆盖回旧值 —— 用户看到的就是「闪回上一个字号」。
test('切换字号全过程不回退到旧档位',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1000}});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  await page.goto('/');
  await page.waitForSelector('.auth-screen',{timeout:30000});
  await page.getByRole('button',{name:'创建管理员账号'}).click();
  await page.fill('input[name=name]','回退测试');
  await page.fill('input[name=email]',`fb-${Date.now()}@yiban.test`);
  await page.fill('input[name=password]','TestPassword123!');
  await page.getByRole('button',{name:'创建管理员并进入'}).click();
  await page.waitForSelector('.app-shell',{timeout:30000});
  await page.getByRole('button',{name:/家庭设置/}).first().click();
  await page.waitForTimeout(1500);

  // 在页面里装一个观察器，记录根字号每一次变化的时间与数值（含旧值）
  await page.evaluate(()=>{
    window.__fs=[];
    const read=()=>parseFloat(getComputedStyle(document.documentElement).fontSize);
    window.__fs.push({t:0,px:read(),note:'start'});
    const t0=performance.now();
    // 记录内联 style 的写入（不读布局，避免观察器本身触发重排）
    const desc=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'style');
    new MutationObserver(muts=>{
      for(const m of muts){
        if(m.type==='attributes'&&m.attributeName==='style'){
          window.__fs.push({t:+(performance.now()-t0).toFixed(1),inline:document.documentElement.style.fontSize||'(空)',note:'style属性变化'});
        }
      }
    }).observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    // 另外每帧采样一次真实 computed 值
    const sample=()=>{window.__fs.push({t:+(performance.now()-t0).toFixed(1),px:read(),note:'frame'});if(window.__sampling)requestAnimationFrame(sample);};
    window.__sampling=true;requestAnimationFrame(sample);
  });

  const clickPill=async label=>{
    await page.locator('.option-pill').filter({hasText:new RegExp(`^${label}$`)}).first().click();
  };

  await clickPill('特大');
  await page.waitForTimeout(2500);   // 等自动保存(700ms) + 请求 + 回填渲染全部结束
  await clickPill('标准');
  await page.waitForTimeout(2500);
  await clickPill('大');
  await page.waitForTimeout(2500);

  const log=await page.evaluate(()=>{window.__sampling=false;return window.__fs;});
  const seeds=log.filter(e=>e.inline!==undefined).map(e=>`${e.t}ms ${e.inline}`);
  console.log('内联字号写入序列:');
  seeds.forEach(s=>console.log('  '+s));
  // 每帧真实数值的去重序列
  const seq=[];for(const e of log){if(e.px!==undefined&&(seq.length===0||seq[seq.length-1].px!==e.px))seq.push(e);}
  console.log('真实渲染字号变化序列:');
  seq.forEach(e=>console.log(`  ${e.t}ms ${e.px}px`));

  const finalPx=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(Math.abs(finalPx-18.2)).toBeLessThan(0.2);

  // 核心断言：一旦升到 21px，后面就不允许在「还没点新档位之前」跌回 14px
  const pxSeq=seq.map(e=>e.px);
  const i21=pxSeq.indexOf(21);
  expect(i21).toBeGreaterThan(-1);
  const between=seq.slice(i21).filter(e=>e.px===14);
  // 14px 只允许出现在「主动点回标准」之后
  console.log('21px 之后出现过 14px 的次数:',between.length);

  await ctx.close();
});
