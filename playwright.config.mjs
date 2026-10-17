import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  workers:1,
  timeout:45000,
  reporter:'list',
  use:{baseURL:'http://localhost:3100',headless:true,launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'},viewport:{width:1440,height:1080}},
});
