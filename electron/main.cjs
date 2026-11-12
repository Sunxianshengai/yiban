/**
 * 旅程日记 · 桌宠壳
 *
 * 这是一个很薄的 Electron 外壳：它不复制任何业务代码，只是把线上（或本机 dev）
 * 的 /pet 页面装进一个透明置顶窗口，做成能贴在壁纸上的小羊。
 *
 * 用法：
 *   npx electron electron/main.cjs                # 用 desktop-config.json 的 webUrl
 *   npx electron electron/main.cjs --dev          # 连本机 devUrl
 *   npx electron electron/main.cjs --no-main      # 只显示桌宠，不打开日记主窗口
 *
 * 关掉主窗口不会退出进程（桌宠要继续待着）；退出请用托盘菜单或 Ctrl+Shift+Q。
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { createPetManager } = require('./pet-manager.cjs')

const CONFIG_PATH = path.join(__dirname, 'desktop-config.json')

function readConfig() {
  const fallback = {
    webUrl: 'https://yiban-memory.eu.cc/',
    resolveIp: '216.198.79.2',
    devUrl: 'http://127.0.0.1:3000/',
    startHidden: false,
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    return { ...fallback, ...raw }
  } catch {
    return fallback
  }
}

const config = readConfig()
const argv = new Set(process.argv.slice(1))
const useDev = argv.has('--dev')
const appUrl = useDev ? config.devUrl : config.webUrl

/**
 * 本机 DNS 被污染（yiban-memory.eu.cc 会解析到国内 IP），
 * 但 Vercel 的真实 IP 稳定可用。用 Chromium 自己的解析规则钉住，
 * 比改系统 hosts 干净，也不需要管理员权限。
 */
if (!useDev && config.resolveIp) {
  try {
    const host = new URL(appUrl).hostname
    app.commandLine.appendSwitch('host-resolver-rules', `MAP ${host} ${config.resolveIp}`)
  } catch {
    /* URL 写错了就让 DNS 自己去失败，别在这里崩 */
  }
}
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

let mainWindow = null
let petManager = null
let tray = null

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: '#f6f7f5',
    title: '旅程日记',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  window.once('ready-to-show', () => {
    if (!config.startHidden) window.show()
  })
  // 站外链接交给系统浏览器，不在壳里开新窗口
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('did-fail-load', (_e, code, desc, url) => {
    // 网络没通时给一句人话，否则就是一片白
    const html = `<!doctype html><meta charset="utf-8"><title>连不上</title>
<body style="font:14px/1.7 system-ui;padding:48px;color:#33404a;background:#f6f7f5">
<h2 style="font-weight:600">没能打开旅程日记</h2>
<p>${desc || '网络请求失败'}（${code}）</p>
<p style="color:#71808a">${url}</p>
<p>如果是被墙了，把 desktop-config.json 里的 webUrl 换成 <code>https://yiban-memory.eu.cc/</code>，或改用 <code>--dev</code> 连本机服务。</p>
</body>`
    window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {})
  })
  window.on('closed', () => {
    mainWindow = null
  })
  window.loadURL(appUrl).catch(() => {})
  return window
}

function ensureTray() {
  if (tray) return
  // Windows 托盘图标只吃 png/ico，webp 会静默变成空白
  const iconPath = path.join(__dirname, 'pet-icon.png')
  const image = nativeImage.createFromPath(iconPath)
  tray = new Tray(
    image.isEmpty()
      ? nativeImage.createFromBuffer(Buffer.alloc(16 * 16 * 4, 180), { width: 16, height: 16 })
      : image.resize({ width: 32, height: 32 }),
  )
  tray.setToolTip('旅程日记 · 瞌睡小羊')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开日记', click: () => { if (!mainWindow) mainWindow = createMainWindow(); mainWindow.show(); mainWindow.focus() } },
      { label: '显示桌宠', click: () => void petManager?.show() },
      { label: '隐藏桌宠', click: () => petManager?.hide() },
      { type: 'separator' },
      { label: '退出', click: () => { app.quit() } },
    ]),
  )
  tray.on('double-click', () => { if (!mainWindow) mainWindow = createMainWindow(); mainWindow.show() })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    petManager = createPetManager({ appUrl, getMainWindow: () => mainWindow })
    mainWindow = createMainWindow()
    ensureTray()
    if (!argv.has('--no-main') && !config.startHidden) mainWindow.show()
    await petManager.show()

    // 找不到托盘图标时的安全阀：任何窗口聚焦时按 Esc 都能把桌宠收起来
    globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit())
  })

  app.on('window-all-closed', () => {
    // 桌宠还在托盘里，别跟着主窗口一起退
    if (!petManager?.shouldKeepRunning()) app.quit()
  })

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createMainWindow()
    mainWindow.show()
  })
}
