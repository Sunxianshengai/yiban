/**
 * 启动器：避开 ELECTRON_RUN_AS_NODE，并处理本机的 Chromium 沙箱限制。
 *
 * 1. ELECTRON_RUN_AS_NODE
 *    有些终端环境（比如某些 Electron 应用自带的终端、CI 包装脚本）会把这个变量设成 1，
 *    那样 electron.exe 会退化成纯 Node，`require('electron').app` 直接是 undefined，
 *    报错信息还很莫名其妙（Cannot read properties of undefined (reading 'commandLine')）。
 *    这里显式清掉再拉起真正的 Electron。
 *
 * 2. --no-sandbox
 *    在没有管理员权限、且父进程本身就带着受限 Job/AppContainer 的环境里，
 *    Chromium 的渲染进程沙箱会初始化失败，electron.exe 直接退出（本机实测 exit code 3，
 *    连 user-data 目录都没建出来）。这类环境只能关掉沙箱才能起来。
 *    代价：渲染进程不再有 OS 级沙箱隔离。本壳只加载我们自己的站点（contextIsolation 开、
 *    nodeIntegration 关、站外导航一律拦截），风险可控；如果你在正常桌面环境跑，
 *    用 `node electron/launch.cjs --sandbox` 可以把沙箱打开。
 */
const { spawn } = require('node:child_process')
const path = require('node:path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const argv = process.argv.slice(2)
const wantSandbox = argv.includes('--sandbox')
const passthrough = argv.filter((a) => a !== '--sandbox')

const electron = require('electron')
const flags = wantSandbox ? [] : ['--no-sandbox']
// Chromium 开关必须排在脚本路径之前，否则 Electron 会把它当成传给
// 应用自己的参数而忽略掉（症状：直接报 crashpad not connected 然后秒退）。
//
// profile 目录默认放仓库里（.desktop-profile），不用 %APPDATA%\Electron：
// 后者在受限环境里常常连创建都失败，表现就是同一句 crashpad 报错 + 秒退。
const profileDir = process.env.YIBAN_DESKTOP_PROFILE || path.join(__dirname, '..', '.desktop-profile')
flags.push(`--user-data-dir=${profileDir}`)
const args = [...flags, path.join(__dirname, 'main.cjs'), ...passthrough]

const child = spawn(electron, args, { stdio: 'inherit', env, windowsHide: false })

child.on('close', (code, signal) => {
  if (signal) {
    console.error('Electron 被信号中断：', signal)
    process.exit(1)
  }
  process.exit(code ?? 0)
})
