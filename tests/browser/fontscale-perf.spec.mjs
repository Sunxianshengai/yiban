// 字号切换卡顿定位 · 可量化性能验收测试
//
// 问题：家庭设置 → 我的个性化偏好 → 文字大小 切档「有卡顿感」。
// 要回答：卡顿发生在 ①样式重排（style recalc + layout）阶段，还是 ②700ms 自动保存的网络等待阶段。
//
// 运行前：
//   1. 起服务（务必用 localhost：Next 16 会拦截 127.0.0.1 的 dev HMR 跨域请求）
//        npx next dev -p 3711
//   2. npx playwright test tests/browser/fontscale-perf.spec.mjs --project=perf --reporter=list
//      可选环境变量：FS_LEVELS=标准,特大（对比的两档）  FS_SAMPLES=7（每方向有效样本数）
//
// 测量口径：每 (起点档 → 目标档) = 1 个样本，默认 7 个有效样本 + 1 个预热样本丢弃。
//   click          CDP Input.dispatchMouseEvent 派发 mousedown 时刻（真实指针事件，非 el.click()）
//   firstPaint     点击 → 新字号真正提交到屏幕上的一帧（逐帧读 html 计算字号 + 选中态，首次命中即记）
//   settleMs       点击 → 根字号数值连续 3 帧不变（布局稳定）
//   longtask       PerformanceObserver('longtask')（>50ms 的主线程任务）
//   layout/style   CDP Performance.getMetrics：LayoutCount / RecalcStyleCount / LayoutDuration / RecalcStyleDuration 差值
//   FPS            rAF 逐帧采样；掉帧 = 相邻帧间隔 > 1.5× 标称帧间隔
//   /api/*         CDP Network：点击后所有请求的真实起止（含 700ms 防抖触发的 PATCH /api/auth/preferences
//                  与保存成功后的后续请求）
//
// 结果写入 public/perf-fontscale.json（原始样本）与 public/perf-fontscale.md（汇总）：
// 后者是唯一权威报告，直接对比「修复前(基线) / 修复后(当前代码)」两种实现。
import {test,expect} from '@playwright/test';
import {signInAsNewAdmin} from './helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const BASE = process.env.PW_BASE_URL || 'http://localhost:3711';
const DIRECTION = process.env.FS_DIRECTION || 'a-b'; // a-b：基线 → 当前；b-a：当前 → 基线
const SAMPLES = Number(process.env.FS_SAMPLES || 7);
const LEVELS = (process.env.FS_LEVELS || '标准,特大').split(',');
const OBSERVE_MS = 2200;   // 观测窗口：覆盖 700ms 防抖 + 请求往返 + 保存后的渲染
const SAVE_DEBOUNCE_MS = 700;
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public');
const RESULT_FILE = path.join(OUT_DIR, 'perf-fontscale.json');
const MD_FILE = path.join(OUT_DIR, 'perf-fontscale.md');
const SHOT_DIR = path.join(OUT_DIR, 'perf-screenshots');

const FONT_PX = {'标准': 14, '偏大': 16.1, '大': 18.2, '特大': 21};

function stats(values) {
  const v = values.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = p => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  return {
    n: v.length,
    median: +q(0.5).toFixed(2),
    mean: +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2),
    p90: +q(0.9).toFixed(2),
    min: +v[0].toFixed(2),
    max: +v[v.length - 1].toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// 页面内探针：longtask / 逐帧 / 事件时间戳 / 首帧绘制检测
// ---------------------------------------------------------------------------
function installProbes() {
  if (window.__fsPerf) return;
  const perf = (window.__fsPerf = {
    longtasks: [], frames: [], events: [], paintedAt: null, startAt: null, windowEnd: 0, lastSample: null, paintDetail: null,
  });
  try {
    perf.ltObserver = new PerformanceObserver(list => {
      for (const e of list.getEntries()) perf.longtasks.push({start: e.startTime, duration: e.duration, name: e.name});
    });
    perf.ltObserver.observe({entryTypes: ['longtask']});
  } catch (e) { perf.ltError = String(e); }

  let last = 0;
  const loop = t => {
    if (last) perf.frames.push({t, dt: t - last});
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // capture 阶段记录浏览器事件时间戳：比 JS 回调更接近「用户按下」的真实时刻
  addEventListener('pointerdown', e => { if (e.isTrusted) perf.events.push({type: 'pointerdown', t: e.timeStamp}); }, true);
  addEventListener('click', e => { if (e.isTrusted) perf.events.push({type: 'click', t: e.timeStamp}); }, true);

  // 首帧绘制检测：每帧读 root 计算字号 + 选中的 .option-pill，
  // 用 document.timeline.currentTime（该 rAF 回调对应的帧提交时刻）作为上屏时刻。
  perf.markStart = expectedPx => {
    perf.startAt = performance.now();
    perf.windowEnd = perf.startAt + 3000;
    perf.paintedAt = null;
    perf.paintDetail = null;
    const tick = () => {
      const now = document.timeline.currentTime;
      const htmlPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const btn = [...document.querySelectorAll('.option-pill')].find(b => b.classList.contains('selected'));
      perf.lastSample = {now, htmlPx, selected: btn?.textContent};
      if (perf.paintedAt == null && Math.abs(htmlPx - expectedPx) < 0.05 && btn) {
        perf.paintedAt = now;
        perf.paintDetail = {htmlPx, selected: btn.textContent};
        return;
      }
      if (now < perf.windowEnd) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  perf.reset = () => {
    perf.longtasks.length = 0; perf.frames.length = 0; perf.events.length = 0;
    perf.paintedAt = null; perf.paintDetail = null; perf.lastSample = null;
  };
}

const READ = () => {
  const p = window.__fsPerf;
  return {longtasks: p.longtasks.slice(), frames: p.frames.slice(), events: p.events.slice(), paintedAt: p.paintedAt, startAt: p.startAt, paintDetail: p.paintDetail, lastSample: p.lastSample};
};

const WAIT_STABLE = () => new Promise(resolve => {
  let last = null, stable = 0;
  const t0 = performance.now();
  const tick = () => {
    const num = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (num === last) stable++; else { stable = 0; last = num; }
    if (stable >= 3 || performance.now() - t0 > 2500) return resolve({stableAt: document.timeline.currentTime, fontSize: num});
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// 页面是否还停留在「家庭设置」页（防止因并发改动/导航导致假数据）
const ON_SETTINGS = () => Boolean(document.querySelector('.personalize-panel') && document.querySelector('.option-pill'));

// ---------------------------------------------------------------------------
// 用 git 还原「修复前」实现，做基线 A/B 对比
// ---------------------------------------------------------------------------
const BASELINE_REF = process.env.FS_BASELINE_REF || 'HEAD';
function gitShow(ref, file) {
  return execSync(`git show ${ref}:${file}`, {cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
}
function readWork(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function writeWork(file, content) {
  fs.writeFileSync(path.join(ROOT, file), content, 'utf8');
}
// 只替换有差异的文件，并在结束时逐一还原工作区原始内容
function applySources(target) {
  const files = ['app/page.jsx', 'app/globals.css'];
  const backup = {};
  const changed = [];
  for (const f of files) {
    const cur = readWork(f);
    backup[f] = cur;
    if (cur !== target[f]) { writeWork(f, target[f]); changed.push(f); }
  }
  return {backup, apply: {readWork, writeWork}, changed};
}

test.describe.configure({mode: 'serial', timeout: 900000});

test(`字号切换性能验收（${DIRECTION === 'b-a' ? '当前→基线' : '基线→当前'}）`, async ({browser}) => {
  const current = {'app/page.jsx': readWork('app/page.jsx'), 'app/globals.css': readWork('app/globals.css')};
  const baseline = {'app/page.jsx': gitShow(BASELINE_REF, 'app/page.jsx'), 'app/globals.css': gitShow(BASELINE_REF, 'app/globals.css')};
  const [A, B] = DIRECTION === 'b-a' ? [current, baseline] : [baseline, current];
  // 明确记录两版在关键位置上的差异，防止「以为在测旧实现，其实测的还是新实现」
  const fingerprint = src => ({
    rootFontRules: [...src['app/globals.css'].matchAll(/html(\[data-font-level='\d'\])?\{font-size:[^}]*\}/g)].map(m => m[0]),
    hasDataFontLevel: /data-font-level/.test(src['app/globals.css']),
    mainWritesFontScaleVar: /document\.documentElement\.style\.setProperty\('--font-scale'/.test(src['app/page.jsx']),
    mainWritesDataFontLevel: /dataset\.fontLevel/.test(src['app/page.jsx']),
    afterSaveCallsRefresh: /await refresh\(\)/.test(src['app/page.jsx']),
    saveDebounceMs: (src['app/page.jsx'].match(/setTimeout\([^\n]{0,80}?,\s*(\d+)\)/) || [])[1] ?? null,
  });

  const results = [];

  const measure = async (source, label) => {
    const prev = applySources(source);
    try {
      const context = await browser.newContext({baseURL: BASE, viewport: {width: 1440, height: 900}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));

      // 账号：走统一的 helpers（管理员邀请码注册），不再用已封掉的「留空邀请码」后门
      await signInAsNewAdmin(page, {name: '性能测试', prefix: `perf-${label}-${Math.floor(Math.random() * 1e6)}`});
      await page.getByRole('button', {name: /家庭设置/}).first().click();
      await page.waitForSelector('.personalize-panel', {timeout: 60000});
      await page.waitForSelector('.option-pill');
      await page.waitForTimeout(1500); // 等图片/字体/入场动画稳定
      if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, {recursive: true});
      await page.screenshot({path: path.join(SHOT_DIR, `settings-${label}.png`), fullPage: false});

      await page.evaluate(installProbes);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Network.enable');

      const netLog = [];
      const pending = new Map();
      cdp.on('Network.requestWillBeSent', e => {
        if (!e.request.url.includes('/api/')) return;
        pending.set(e.requestId, {url: new URL(e.request.url).pathname, method: e.request.method, wallStart: Date.now(), startedAt: performance.now()});
      });
      cdp.on('Network.responseReceived', e => {
        const rec = pending.get(e.requestId);
        if (rec) rec.status = e.response.status;
      });
      cdp.on('Network.loadingFinished', e => {
        const rec = pending.get(e.requestId);
        if (!rec) return;
        rec.dur = +(performance.now() - rec.startedAt).toFixed(1);
        netLog.push(rec);
        pending.delete(e.requestId);
      });

      const METRIC_KEYS = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'];
      const readMetrics = async () => {
        const {metrics} = await cdp.send('Performance.getMetrics');
        const m = {};
        for (const it of metrics) if (METRIC_KEYS.includes(it.name)) m[it.name] = it.value;
        return m;
      };

      const clickPill = async label => {
        const loc = page.locator('.option-pill', {hasText: label}).first();
        const box = await loc.boundingBox();
        if (!box) throw new Error(`找不到档位按钮：${label}（页面可能已被导航走）`);
        await page.evaluate(px => window.__fsPerf.markStart(px), FONT_PX[label]);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      };

      // dev 模式整页重载（HMR full reload / worker 重启）会让应用回到 home 视图。
      // 这不是产品行为，必须恢复后继续，而不是把它当成卡顿证据。
      const ensureSettings = async (reason) => {
        if (await page.evaluate(ON_SETTINGS)) return false;
        const snap = await page.evaluate(() => ({auth: Boolean(document.querySelector('.auth-screen')), loading: Boolean(document.querySelector('.loading-screen')), shell: Boolean(document.querySelector('.app-shell'))}));
        if (!snap.shell) {
          // 回到首页后会用 Cookie 自动登录，等应用壳出现
          await page.waitForSelector('.app-shell', {timeout: 120000}).catch(() => {});
        }
        if (!await page.evaluate(ON_SETTINGS)) {
          await page.getByRole('button', {name: /家庭设置/}).first().click({timeout: 60000});
          await page.waitForSelector('.personalize-panel', {timeout: 120000});
        }
        await page.waitForSelector('.option-pill');
        await page.waitForTimeout(1500);
        reloads.push({at: reason, snapshot: snap});
        return true;
      };
      const reloads = [];

      const runSample = async (fromLabel, toLabel) => {
        await ensureSettings('sample-start');
        // 回到起点档
        await page.locator('.option-pill', {hasText: fromLabel}).first().evaluate(el => el.click());
        await page.waitForTimeout(SAVE_DEBOUNCE_MS + 1200); // 让起点档自己的自动保存链路彻底结束
        await ensureSettings('before-measure');
        await page.evaluate(() => window.__fsPerf.reset());
        netLog.length = 0;
        pending.clear();

        const m0 = await readMetrics();
        await clickPill(toLabel);
        const clickWall = Date.now();
        const stable = await page.evaluate(WAIT_STABLE);
        const mid = await page.evaluate(READ);
        await page.waitForTimeout(Math.max(0, OBSERVE_MS - (Date.now() - clickWall)));
        const end = await page.evaluate(READ);
        const m1 = await readMetrics();
        const stillOnSettings = await page.evaluate(ON_SETTINGS);

        const clickTs = mid.events.find(e => e.type === 'pointerdown')?.t ?? null;
        const clickEventTs = mid.events.find(e => e.type === 'click')?.t ?? null;
        const paintAt = end.paintedAt;
        // 防呆：若测量途中发生整页重载，时间基准会错位，样本直接作废
        if (!clickTs || paintAt == null || !stillOnSettings) {
          return {invalid: true, reason: !clickTs ? 'no-pointer-event' : paintAt == null ? 'font-not-applied' : 'left-settings-page', from: fromLabel, to: toLabel};
        }
        const rel = t => (clickTs != null && t != null ? +(t - clickTs).toFixed(1) : null);

        // 帧：点击后 1.2s 内的相邻帧间隔
        const win = end.frames.filter(f => clickTs != null && f.t >= clickTs && f.t <= clickTs + 1200);
        const dts = win.map(f => f.dt).filter(dt => dt > 0 && dt < 600);
        const nominal = dts.length ? [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)] : 0;
        const dropped = dts.filter(dt => dt > nominal * 1.5).length;

        const lt = end.longtasks;
        const ltFP = clickTs != null && paintAt != null ? lt.filter(l => l.start + l.duration >= clickTs && l.start <= paintAt) : [];
        const net = netLog.map(r => ({url: r.url, method: r.method, status: r.status, offset: r.wallStart - clickWall, dur: r.dur}))
          .sort((a, b) => a.offset - b.offset);
        const patch = net.find(r => r.method === 'PATCH' && r.url.includes('/preferences'));
        const after = net.filter(r => r !== patch);

        return {
          from: fromLabel, to: toLabel, stillOnSettings,
          firstPaint: rel(paintAt),
          firstClickToPaint: clickEventTs != null && paintAt != null ? +(paintAt - clickEventTs).toFixed(1) : null,
          settleMs: rel(stable.stableAt),
          finalHtmlPx: stable.fontSize,
          paintDetail: end.paintDetail,
          longtask: {
            count: lt.length,
            totalMs: +(lt.reduce((s, l) => s + l.duration, 0)).toFixed(1),
            maxMs: +(lt.length ? Math.max(...lt.map(l => l.duration)) : 0).toFixed(1),
            inFirstPaint: ltFP.length,
            inFirstPaintMs: +(ltFP.reduce((s, l) => s + l.duration, 0)).toFixed(1),
            list: lt.map(l => +(l.duration).toFixed(1)),
          },
          frames: {n: dts.length, fps: dts.length ? +(1000 / (dts.reduce((s, x) => s + x, 0) / dts.length)).toFixed(1) : null, dropped, droppedPct: dts.length ? +(dropped / dts.length * 100).toFixed(1) : null, maxGap: dts.length ? +Math.max(...dts).toFixed(1) : null, nominal: +nominal.toFixed(2)},
          metrics: {
            layoutCount: m1.LayoutCount - m0.LayoutCount,
            recalcStyleCount: m1.RecalcStyleCount - m0.RecalcStyleCount,
            layoutMs: +((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(1),
            recalcStyleMs: +((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(1),
            scriptMs: +((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(1),
            taskMs: +((m1.TaskDuration - m0.TaskDuration) * 1000).toFixed(1),
          },
          network: {patchStartOffset: patch?.offset ?? null, patchMs: patch?.dur ?? null, patchStatus: patch?.status ?? null, after, all: net},
        };
      };

      const samples = [];
      const invalidate = [];
      for (const [a, b] of [[LEVELS[0], LEVELS[1]], [LEVELS[1], LEVELS[0]]]) {
        // 预热 1 次丢弃；作废样本不计入，最多补跑到 SAMPLES 个有效样本
        await runSample(a, b);
        let valid = 0;
        for (let i = 0; valid < SAMPLES && i < SAMPLES * 3; i++) {
          const s = await runSample(a, b);
          if (s.invalid) { invalidate.push(s); continue; }
          samples.push(s);
          valid++;
        }
      }

      const env = {
        userAgent: await page.evaluate(() => navigator.userAgent),
        hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency),
        deviceMemory: await page.evaluate(() => navigator.deviceMemory || null),
      };
      await context.close();
      results.push({label, fingerprint: fingerprint(source), samples, pageErrors: errors, env, reloads, invalidated: invalidate});
    } finally {
      // 无论成败都还原工作区源码
      for (const [f, content] of Object.entries(prev.backup)) writeWork(f, content);
    }
  };

  const labels = DIRECTION === 'b-a' ? ['current', 'baseline'] : ['baseline', 'current'];
  for (const [i, src] of [A, B].entries()) await measure(src, labels[i]);

  // ---------------- 汇总 ----------------
  const summarize = res => {
    const dir = (a, b) => {
      const S = res.samples.filter(s => s.from === a && s.to === b);
      return {
        direction: `${a} → ${b}`,
        n: S.length,
        firstPaint: stats(S.map(s => s.firstPaint)),
        settle: stats(S.map(s => s.settleMs)),
        ltTotal: stats(S.map(s => s.longtask.totalMs)),
        ltMax: stats(S.map(s => s.longtask.maxMs)),
        ltInFP: stats(S.map(s => s.longtask.inFirstPaintMs)),
        dropped: stats(S.map(s => s.frames.dropped)),
        dropPct: stats(S.map(s => s.frames.droppedPct)),
        maxGap: stats(S.map(s => s.frames.maxGap)),
        fps: stats(S.map(s => s.frames.fps)),
        layoutCount: stats(S.map(s => s.metrics.layoutCount)),
        recalcCount: stats(S.map(s => s.metrics.recalcStyleCount)),
        layoutMs: stats(S.map(s => s.metrics.layoutMs)),
        recalcMs: stats(S.map(s => s.metrics.recalcStyleMs)),
        scriptMs: stats(S.map(s => s.metrics.scriptMs)),
        taskMs: stats(S.map(s => s.metrics.taskMs)),
        patchStart: stats(S.map(s => s.network.patchStartOffset)),
        patchMs: stats(S.map(s => s.network.patchMs)),
        afterCount: stats(S.map(s => s.network.after.length)),
        afterMs: stats(S.flatMap(s => s.network.after.map(r => r.dur))),
        allOnSettings: S.every(s => s.stillOnSettings),
      };
    };
    return {
      label: res.label,
      fingerprint: res.fingerprint,
      env: res.env,
      pageErrors: res.pageErrors,
      directions: [dir(LEVELS[0], LEVELS[1]), dir(LEVELS[1], LEVELS[0])],
      reloads: res.reloads,
      invalidated: res.invalidated,
      raw: res.samples,
    };
  };
  const summary = results.map(summarize);

  fs.mkdirSync(OUT_DIR, {recursive: true});
  let prevDoc = null;
  if (fs.existsSync(RESULT_FILE)) { try { prevDoc = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8')); } catch {} }
  const doc = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    gitHead: execSync('git rev-parse --short HEAD', {cwd: ROOT, encoding: 'utf8'}).trim(),
    config: {SAMPLES, OBSERVE_MS, SAVE_DEBOUNCE_MS, levels: LEVELS, viewport: '1440x900', baselineRef: BASELINE_REF},
    runs: summary,
  };
  // 两次方向跑完才合并：以标签为准覆盖同名结果
  const merged = prevDoc?.runs ? prevDoc.runs.filter(r => !summary.some(s => s.label === r.label)) : [];
  doc.runs = [...merged, ...summary];
  fs.writeFileSync(RESULT_FILE, JSON.stringify(doc, null, 2), 'utf8');

  // Markdown 报告
  const f2 = x => (x == null ? '–' : Number(x).toFixed(2)) ;
  const cell = s => (s ? `${f2(s.median)}` : '–');
  const md = [];
  md.push('# 字号切换卡顿定位 · 实测报告', '');
  md.push(`生成时间：${doc.generatedAt}　Git HEAD：\`${doc.gitHead}\`　服务：${BASE}`);
  md.push(`样本：每方向 ${SAMPLES} 个有效样本（另 1 个预热丢弃），窗口 ${OBSERVE_MS}ms，自动保存防抖 ${SAVE_DEBOUNCE_MS}ms，视口 1440×900`);
  md.push(`环境：${summary[0]?.env?.userAgent || ''}　CPU 线程 ${summary[0]?.env?.hardwareConcurrency}`);
  md.push('');
  md.push('| 指标（中位数） | ' + summary.map(s => s.label === 'baseline' ? `基线 ${BASELINE_REF} 标准→特大` : '当前 标准→特大').join(' | ') + ' | ' + summary.map(s => s.label === 'baseline' ? `基线 ${BASELINE_REF} 特大→标准` : '当前 特大→标准').join(' | ') + ' |');
  md.push('|---' + '|---'.repeat(summary.length * 2) + '|');
  const rows = [
    ['首帧绘制（点击→新字号上屏）ms', r => cell(r.directions[0].firstPaint), r => cell(r.directions[1].firstPaint)],
    ['布局稳定（字号连续3帧不变）ms', r => cell(r.directions[0].settle), r => cell(r.directions[1].settle)],
    ['longtask 总时长 ms', r => cell(r.directions[0].ltTotal), r => cell(r.directions[1].ltTotal)],
    ['最长单个 longtask ms', r => cell(r.directions[0].ltMax), r => cell(r.directions[1].ltMax)],
    ['首帧窗口内 longtask ms', r => cell(r.directions[0].ltInFP), r => cell(r.directions[1].ltInFP)],
    ['掉帧数（>1.5×标称帧间隔）', r => cell(r.directions[0].dropped), r => cell(r.directions[1].dropped)],
    ['掉帧比例 %', r => cell(r.directions[0].dropPct), r => cell(r.directions[1].dropPct)],
    ['最长单帧间隔 ms', r => cell(r.directions[0].maxGap), r => cell(r.directions[1].maxGap)],
    ['平均 FPS', r => cell(r.directions[0].fps), r => cell(r.directions[1].fps)],
    ['Layout 次数', r => cell(r.directions[0].layoutCount), r => cell(r.directions[1].layoutCount)],
    ['RecalcStyle 次数', r => cell(r.directions[0].recalcCount), r => cell(r.directions[1].recalcCount)],
    ['Layout 耗时 ms', r => cell(r.directions[0].layoutMs), r => cell(r.directions[1].layoutMs)],
    ['RecalcStyle 耗时 ms', r => cell(r.directions[0].recalcMs), r => cell(r.directions[1].recalcMs)],
    ['Script 耗时 ms', r => cell(r.directions[0].scriptMs), r => cell(r.directions[1].scriptMs)],
    ['PATCH 发起时刻（相对点击）ms', r => cell(r.directions[0].patchStart), r => cell(r.directions[1].patchStart)],
    ['PATCH /api/auth/preferences 耗时 ms', r => cell(r.directions[0].patchMs), r => cell(r.directions[1].patchMs)],
    ['保存后附加请求数 / 耗时 ms', r => `${cell(r.directions[0].afterCount)} / ${cell(r.directions[0].afterMs)}`, r => `${cell(r.directions[1].afterCount)} / ${cell(r.directions[1].afterMs)}`],
    ['样本均在设置页（无导航丢失）', r => r.directions.every(d => d.allOnSettings) ? 'yes' : 'NO', r => r.directions.every(d => d.allOnSettings) ? 'yes' : 'NO'],
  ];
  for (const [name, a, b] of rows) md.push(`| ${name} | ${summary.map(a).join(' | ')} | ${summary.map(b).join(' | ')} |`);
  md.push('');
  md.push('## 实现指纹（证明测的是不同代码）', '');
  for (const s of summary) {
    const fp = s.fingerprint;
    md.push(`- **${s.label}**：根字号规则 ${fp.rootFontRules.map(r => `\`${r}\``).join('、') || '（无）'}；` +
      `CSS 使用 data-font-level=${fp.hasDataFontLevel}；` +
      `JS 写 --font-scale=${fp.mainWritesFontScaleVar}；JS 写 data-font-level=${fp.mainWritesDataFontLevel}；` +
      `保存后 await refresh()=${fp.afterSaveCallsRefresh}；防抖=${fp.saveDebounceMs}ms`);
  }
  md.push('');
  md.push('## 页面报错 / 作废样本剔除', '');
  for (const s of summary) md.push(`- ${s.label}：页面报错 ${s.pageErrors.length ? s.pageErrors.join(' | ') : '无'}；作废样本 ${s.invalidated.length ? s.invalidated.map(x => `${x.from}→${x.to}:${x.reason}`).join('、') : '0'}；dev 整页重载 ${s.reloads.length} 次`);
  fs.writeFileSync(MD_FILE, md.join('\n'), 'utf8');

  for (const s of summary) {
    console.log(`\n##### ${s.label} #####`);
    for (const d of s.directions) {
      console.log(`\n== ${d.direction} (n=${d.n}) ==`);
      console.log(`首帧 ${JSON.stringify(d.firstPaint)}`);
      console.log(`稳定 ${JSON.stringify(d.settle)}`);
      console.log(`longtask 总数 ${JSON.stringify(d.ltTotal)} 最长 ${JSON.stringify(d.ltMax)} 首帧窗内 ${JSON.stringify(d.ltInFP)}`);
      console.log(`掉帧 ${JSON.stringify(d.dropped)} (${JSON.stringify(d.dropPct)}%) 最长帧间隔 ${JSON.stringify(d.maxGap)} FPS ${JSON.stringify(d.fps)}`);
      console.log(`Layout 次数 ${JSON.stringify(d.layoutCount)} 耗时 ${JSON.stringify(d.layoutMs)} | RecalcStyle 次数 ${JSON.stringify(d.recalcCount)} 耗时 ${JSON.stringify(d.recalcMs)}`);
      console.log(`PATCH 发起 +${JSON.stringify(d.patchStart)}ms 耗时 ${JSON.stringify(d.patchMs)} | 此后请求数 ${JSON.stringify(d.afterCount)} 耗时 ${JSON.stringify(d.afterMs)}`);
    }
  }
  expect(summary.length).toBe(2);
});
