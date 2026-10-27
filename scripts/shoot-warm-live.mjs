// 截真实应用的陪伴聊天页（暖色改版后），用于确认落地效果。
// 依赖：dev server 在 3711、mock 模型在 3799。
import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// Next 16 会拦截 127.0.0.1 的 dev HMR 跨域请求，统一用 localhost（见 playwright.config.mjs:2）
const BASE = 'http://localhost:3711';
const out = path.resolve('.impeccable/review/companion-warm-live');
await fs.mkdir(out, {recursive:true});

const ROOT = {name:'小雨', email:'admin@yiban.test', password:'TestPassword123!'};

const browser = await chromium.launch({executablePath:EDGE, headless:true});
const errors = [];

async function login(page, prefix) {
  const req = page.request;
  const status = await (await req.get(BASE + '/api/auth/status')).json();
  if (status.needsSetup) {
    const r = await req.post(BASE + '/api/auth/setup', {data: ROOT});
    if (!r.ok()) throw new Error('setup failed ' + r.status());
  } else if (!status.user) {
    const r = await req.post(BASE + '/api/auth/login', {data: {email: ROOT.email, password: ROOT.password}});
    if (!r.ok()) throw new Error('login failed ' + r.status());
  }
  const inv = await (await req.post(BASE + '/api/auth/invite', {data: {role:'admin'}})).json();
  const email = `${prefix}-${Date.now()}@yiban.test`;
  const created = await req.post(BASE + '/api/auth/register', {data:{code:inv.code, name:'测试家长', email, password:'TestPassword123!'}});
  if (created.status() !== 201) throw new Error('register failed ' + created.status() + ' ' + await created.text());
  const st = await (await req.get(BASE + '/api/auth/status')).json();
  await req.post(BASE + '/api/credits/grant', {data:{userId: st.user.id, amount: 100, note:'截图用额度'}});
  page.on('dialog', d => d.accept());
  return email;
}

async function shoot(page, name, w, h) {
  await page.setViewportSize({width:w, height:h});
  await page.waitForTimeout(500);
  await page.screenshot({path: path.join(out, `${name}.png`), animations:'disabled'});
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) errors.push(`[${name}] 横向溢出 ${over}px`);
}

for (const [tag, w, h] of [['desktop', 1440, 1000], ['laptop', 1280, 860], ['mobile', 390, 844]]) {
  const ctx = await browser.newContext({viewport:{width:w, height:h}, deviceScaleFactor:2, baseURL: BASE});
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  await login(page, `warm-${tag}`);
  await page.goto(BASE + '/');
  await page.waitForSelector('.app-shell', {timeout: 60000});
  // 进入陪伴页
  // 手机底部导航：visible 文本是「陪伴」，但 aria-label 是 NAV 里的「陪伴对话」
  const nav = tag === 'mobile' ? page.locator('.mobile-nav') : page.locator('.side-nav');
  await nav.getByRole('button', {name:'陪伴对话', exact:true}).click();
  await page.getByLabel('发送给家伴的消息').waitFor({state:'visible', timeout: 60000});
  await page.waitForTimeout(800);
  await shoot(page, `${tag}-empty`, w, h);

  // 发一条消息，让气泡、日期分隔、头像都出现
  await page.getByLabel('发送给家伴的消息').fill('今天翻到一张老照片，想起很多事。');
  await page.getByRole('button', {name:'发送消息', exact:true}).click();
  await page.getByRole('button', {name:'发送消息', exact:true}).waitFor({state:'visible', timeout: 60000});
  await page.waitForTimeout(900);
  await shoot(page, `${tag}-conversation`, w, h);

  if (tag === 'desktop') {
    // 详情面板
    await page.getByRole('button', {name:'打开联系人详情'}).click();
    await page.waitForTimeout(700);
    await shoot(page, 'desktop-details', w, h);
    await page.getByRole('button', {name:'关闭详情', exact:true}).click().catch(()=>{});
    await page.keyboard.press('Escape');
    // 夜间主题
    await page.evaluate(async () => {
      await fetch('/api/auth/preferences', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({theme:'night', fontScale:1, highContrast:false})});
    });
    await page.reload();
    await page.waitForSelector('.app-shell', {timeout: 60000});
    await page.locator('.side-nav').getByRole('button', {name:'陪伴对话', exact:true}).click();
    await page.getByLabel('发送给家伴的消息').waitFor({state:'visible', timeout: 60000});
    await page.waitForTimeout(900);
    await shoot(page, 'desktop-night', w, h);
  }
  await ctx.close();
}

await browser.close();
console.log(errors.length ? errors.join('\n') : 'OK: 无控制台错误、无横向溢出');
