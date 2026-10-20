import {defineConfig} from '@playwright/test';
// Next 16 会拦截 127.0.0.1 的 dev HMR 跨域请求，统一用 http://localhost:3711
const BASE = process.env.PW_BASE_URL || 'http://localhost:3711';
export default defineConfig({
  testDir:'./tests/browser',
  workers:1,
  timeout:45000,
  reporter:'list',
  use:{baseURL:BASE,headless:true,launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'},viewport:{width:1440,height:1080}},
  projects:[
    // 默认项目：功能回归测试（不含性能验收）
    {name:'functional',testIgnore:/.*-perf\.spec\.mjs$/},
    // 性能验收：单测上限放宽，只跑 *-perf.spec.mjs
    {name:'perf',testMatch:/.*-perf\.spec\.mjs$/,timeout:600000},
  ],
});
