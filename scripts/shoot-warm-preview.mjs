import {chromium} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base = 'http://127.0.0.1:3811/public/design-preview/companion-warm-preview/index.html';
const outDir = path.resolve('.impeccable/review/companion-warm-preview');
await fs.mkdir(outDir, {recursive:true});

const shots = [
  {name:'desktop-1440-sage', width:1440, height:1000, query:''},
  {name:'desktop-1440-clay', width:1440, height:1000, query:'?bubble=clay'},
  {name:'desktop-1280-sage', width:1280, height:900, query:''},
  {name:'laptop-1024-sage', width:1024, height:768, query:''},
  {name:'mobile-390-sage', width:390, height:844, query:''},
  {name:'mobile-390-clay', width:390, height:844, query:'?bubble=clay'},
];

const browser = await chromium.launch({executablePath:EDGE, headless:true});
const errors = [];
for (const s of shots) {
  const ctx = await browser.newContext({viewport:{width:s.width, height:s.height}, deviceScaleFactor:2});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${s.name}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${s.name}] pageerror: ${e.message}`));
  const res = await page.goto(base + s.query, {waitUntil:'networkidle'});
  if (!res || !res.ok()) errors.push(`[${s.name}] HTTP ${res && res.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(outDir, `${s.name}.png`)});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) errors.push(`[${s.name}] 横向溢出 ${overflow}px`);
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'OK: 无控制台错误、无横向溢出');
