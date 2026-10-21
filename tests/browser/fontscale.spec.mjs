import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
const BASE='http://localhost:3711';

test('字号档位对全站文字的实际影响',async({browser})=>{
  const ctx=await browser.newContext({baseURL:BASE,viewport:{width:1440,height:1200}});
  const page=await ctx.newPage();
  await signInAsNewAdmin(page,{name:'字号测试',prefix:'fs'});

  // 采样一批有代表性的元素
  const sample=async()=>await page.evaluate(()=>{
    const pick=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null;};
    return {
      body:pick('body'),
      navItem:pick('.nav-item'),
      navLabel:pick('.nav-item span'),
      heroTitle:pick('.hero-copy h2'),
      cardTitle:pick('.memory-card strong'),
      cardMeta:pick('.memory-card small'),
      statNum:pick('.stat-card strong'),
      sidebarLabel:pick('.sidebar-label'),
      btn:pick('.btn'),
      brandName:pick('.sidebar .brand>span:last-child'),
    };
  });

  await page.getByRole('button',{name:/家庭设置/}).first().click();
  await page.waitForTimeout(500);
  const optSampler=async()=>await page.evaluate(()=>{
    const pick=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null;};
    return {optPill:pick('.option-pill'),panelP:pick('.personalize-panel>p'),hint:pick('.settings-hint'),label:pick('.field label'),input:pick('input')};
  });

  const setScale=async(label)=>{
    await page.locator('.option-pill',{hasText:label}).first().click();
    await page.waitForTimeout(900);
  };

  await setScale('标准');
  const stdHome=await sample();
  const stdSet=await optSampler();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/fs-standard.png'});
  await setScale('特大');
  const bigSet=await optSampler();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/fs-large.png'});
  await page.getByRole('button',{name:'记忆小屋'}).first().click();
  await page.waitForTimeout(600);
  const bigHome=await sample();
  await page.screenshot({path:'C:/Users/25641/AppData/Local/Temp/fs-large-home.png'});

  console.log('标准·首页',JSON.stringify(stdHome));
  console.log('特大·首页',JSON.stringify(bigHome));
  console.log('标准·设置',JSON.stringify(stdSet));
  console.log('特大·设置',JSON.stringify(bigSet));
  const ratio=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]?+(b[k]/a[k]).toFixed(2):null]));
  console.log('倍数·首页',JSON.stringify(ratio(stdHome,bigHome)));
  console.log('倍数·设置',JSON.stringify(ratio(stdSet,bigSet)));
  await ctx.close();
});
