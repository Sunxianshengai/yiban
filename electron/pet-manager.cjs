/**
 * 桌宠覆盖层的主进程实现。
 *
 * 设计取自重写前的 Electron 壳（忆伴 2625f27），但收窄到只做三件事：
 * 1. 开一个铺满工作区、透明、置顶、不占任务栏的窗口，加载 /pet?desktop=1；
 * 2. 让空白处的鼠标事件穿过去 —— 窗口本身永远 `setIgnoreMouseEvents(true, {forward:true})`，
 *    渲染进程每 120ms 上报「小羊/气泡/菜单」的矩形，这里 60ms 轮询鼠标位置做命中测试，
 *    命中时才把穿透关掉；
 * 3. 托盘菜单（显示/隐藏/打开日记/退出）+ 显示设置变化时重设窗口大小。
 *
 * 注意：不做任何页面导航放行，渲染进程只能停在 /pet。
 */
const { BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, app } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

function createPetManager({ appUrl, getMainWindow }) {
  const origin = new URL(appUrl).origin
  const overlays = new Map()
  const offlineUrl = pathToFileURL(path.join(__dirname, 'pet-offline.html')).href
  let tray = null
  let quitting = false
  let pointerTimer = null

  const isOverlayWindow = (window) => !!window && overlays.has(window.id)

  /** IPC 只认两种来源：主窗口同源页面，或本进程创建的覆盖层。 */
  function trusted(event, overlayOnly = false) {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || event.senderFrame !== event.sender.mainFrame) return false
    if (overlayOnly && !isOverlayWindow(window)) return false
    try {
      const url = event.senderFrame.url
      return new URL(url).origin === origin || (isOverlayWindow(window) && url === offlineUrl)
    } catch {
      return false
    }
  }

  function openMain() {
    const main = getMainWindow()
    if (main) {
      if (main.isMinimized()) main.restore()
      main.show()
      main.focus()
    }
  }

  function ensureTray() {
    if (tray) return
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
        { label: '打开日记', click: openMain },
        { label: '显示桌宠', click: () => void show() },
        { label: '隐藏桌宠', click: () => hide() },
        { type: 'separator' },
        { label: '退出', click: () => { quitting = true; app.quit() } },
      ]),
    )
    tray.on('double-click', openMain)
  }

  async function show() {
    ensureTray()
    if (overlays.size) {
      for (const entry of overlays.values()) entry.window.showInactive()
      return { ok: true }
    }

    const area = screen.getPrimaryDisplay().workArea
    const window = new BrowserWindow({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'pet-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    })
    overlays.set(window.id, { window, rects: [], ignoring: true, dragging: false })
    window.setIgnoreMouseEvents(true, { forward: true })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => {
      try {
        if (new URL(url).origin !== origin) event.preventDefault()
      } catch {
        event.preventDefault()
      }
    })
    window.on('closed', () => overlays.delete(window.id))
    // 覆盖层永远浮在普通窗口之上；失焦不隐藏，否则点一下别处它就没了
    window.setAlwaysOnTop(true, 'screen-saver')
    // 安全阀：覆盖层只能靠托盘/右键隐藏，万一托盘没了用户会「丢不掉」它，
    // 所以让 Esc 直接把它藏起来（不退出应用、不弹确认）。
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault()
        hide()
      }
    })

    try {
      const url = new URL('/pet', appUrl)
      url.searchParams.set('desktop', '1')
      await window.loadURL(url.toString())
    } catch {
      await window.loadFile(path.join(__dirname, 'pet-offline.html'))
    }
    window.showInactive()

    if (!pointerTimer) {
      pointerTimer = setInterval(() => {
        const point = screen.getCursorScreenPoint()
        for (const entry of overlays.values()) {
          if (entry.window.isDestroyed() || !entry.window.isVisible()) continue
          const bounds = entry.window.getBounds()
          const x = point.x - bounds.x
          const y = point.y - bounds.y
          const hit =
            entry.dragging ||
            entry.rects.some((r) => x >= r.x && y >= r.y && x <= r.x + r.width && y <= r.y + r.height)
          if (entry.ignoring === hit) {
            entry.ignoring = !hit
            entry.window.setIgnoreMouseEvents(!hit, { forward: true })
          }
        }
      }, 60)
      pointerTimer.unref?.()
    }
    return { ok: true }
  }

  function hide() {
    for (const entry of overlays.values()) entry.window.hide()
    return { ok: true }
  }

  function toggle() {
    const visible = [...overlays.values()].some((entry) => entry.window.isVisible())
    return visible ? hide() : show()
  }

  ipcMain.handle('pet:show', (event) => {
    if (!trusted(event)) throw new Error('Untrusted desktop sender')
    return show()
  })
  ipcMain.handle('pet:hide', (event) => {
    if (!trusted(event)) throw new Error('Untrusted desktop sender')
    return hide()
  })
  ipcMain.handle('pet:toggle', (event) => {
    if (!trusted(event)) throw new Error('Untrusted desktop sender')
    return toggle()
  })
  ipcMain.handle('pet:open-main', (event, target) => {
    if (!trusted(event, true)) throw new Error('Untrusted desktop sender')
    const main = getMainWindow()
    if (main) {
      // 只允许站内相对路径，避免被当成任意导航
      const safe = typeof target === 'string' && /^\/[a-z0-9\-/]*$/i.test(target) ? target : '/'
      const url = new URL(safe, appUrl).toString()
      void main.loadURL(url).catch(() => {})
      openMain()
    }
    return { ok: !!main }
  })
  ipcMain.handle('pet:quit', (event) => {
    if (!trusted(event, true)) throw new Error('Untrusted desktop sender')
    quitting = true
    app.quit()
    return { ok: true }
  })
  ipcMain.on('pet:ready', (event) => {
    if (trusted(event, true)) BrowserWindow.fromWebContents(event.sender)?.showInactive()
  })
  ipcMain.on('pet:drag', (event, active) => {
    if (!trusted(event, true)) return
    const entry = overlays.get(BrowserWindow.fromWebContents(event.sender).id)
    if (entry) entry.dragging = active === true
  })
  ipcMain.on('pet:regions', (event, rects) => {
    if (!trusted(event, true) || !Array.isArray(rects) || rects.length > 100) return
    const window = BrowserWindow.fromWebContents(event.sender)
    const entry = overlays.get(window.id)
    if (!entry) return
    const bounds = window.getBounds()
    entry.rects = rects
      .filter(
        (r) =>
          r &&
          ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k])) &&
          r.width > 0 &&
          r.height > 0 &&
          r.width <= bounds.width + 10 &&
          r.height <= bounds.height + 10,
      )
      .map(({ x, y, width, height }) => ({ x, y, width, height }))
  })

  screen.on('display-metrics-changed', () => {
    const area = screen.getPrimaryDisplay().workArea
    for (const entry of overlays.values()) entry.window.setBounds(area)
  })

  app.on('before-quit', () => {
    quitting = true
    if (pointerTimer) clearInterval(pointerTimer)
    pointerTimer = null
    for (const entry of overlays.values()) entry.window.destroy()
    overlays.clear()
    tray?.destroy()
    tray = null
  })

  return {
    show,
    hide,
    toggle,
    /**
     * 只给自动化测试用：把每个覆盖层的命中矩形和当前穿透状态读出来。
     * 没有它就没法验证「鼠标移到小羊身上时穿透真的关了」。
     */
    debugState: () =>
      [...overlays.values()].map((entry) => ({
        visible: entry.window.isVisible(),
        ignoring: entry.ignoring,
        dragging: entry.dragging,
        rects: entry.rects,
      })),
    shouldKeepRunning: () => !quitting && Boolean(tray),
    isQuitting: () => quitting,
  }
}

module.exports = { createPetManager }
