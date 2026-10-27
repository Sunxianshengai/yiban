import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('.impeccable/review/proactive-contact-preview');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const base='http://127.0.0.1:3849/design-preview/proactive-contact-preview/';
const errors=[];
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 for(const screen of ['chat','settings','contacts','reason','notification','paused','quiet','device']){
  if(device==='desktop'&&screen==='contacts')continue;
  const response=await page.goto(base+'?screen='+screen,{waitUntil:'networkidle'});if(!response.ok())throw new Error('preview failed');await page.evaluate(()=>document.fonts.ready);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(device+' '+screen+' horizontal overflow');
  await page.screenshot({path:path.join(out,device+'-'+screen+'.png'),animations:'disabled'});
 }
 // Exercise the actual preview controls, without calling real notification APIs.
 await page.goto(base+'?screen=settings');await page.getByRole('button',{name:'多聊一点 每天最多 3 次',exact:true}).click();if(await page.getByRole('button',{name:'多聊一点 每天最多 3 次',exact:true}).getAttribute('aria-pressed')!=='true')throw new Error('frequency toggle failed');
 await page.getByRole('switch',{name:'允许小满主动联系'}).click();await page.getByRole('button',{name:'保存设置',exact:true}).click();await page.getByRole('button',{name:'主动联系设置',exact:true}).click();if(await page.getByRole('switch',{name:'允许小满主动联系'}).getAttribute('aria-checked')!=='false')throw new Error('prototype save failed');
 await page.goto(base+'?screen=settings');await page.getByRole('button',{name:'这台设备的通知 应用内消息始终保留 未开启',exact:true}).click();await page.getByRole('button',{name:'开启此设备通知 · 演示',exact:true}).click();if(!await page.getByText('此设备已开启通知（演示状态）。',{exact:true}).isVisible())throw new Error('notification preview failed');
 await context.close();
}
await browser.close();if(errors.length)throw new Error(errors.join('\n'));console.log('15 states captured; no page errors or horizontal overflow; preview switches and save verified.');
