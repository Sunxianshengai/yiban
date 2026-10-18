const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('node:path');

const config = require('./desktop-config.json');

function getAppUrl() {
  if (!app.isPackaged) {
    return process.env.YIBAN_DESKTOP_URL || 'http://localhost:3000';
  }

  const configuredUrl = process.env.YIBAN_DESKTOP_URL || config.webUrl;
  if (!configuredUrl) {
    throw new Error('请先在 electron/desktop-config.json 中填写 Vercel 部署地址。');
  }

  const url = new URL(configuredUrl);
  if (url.protocol !== 'https:') {
    throw new Error('桌面版线上地址必须使用 HTTPS。');
  }

  return url.toString();
}

function openExternal(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      shell.openExternal(parsedUrl.toString());
    }
  } catch {
    // Ignore invalid or unsupported URLs.
  }
}

async function createWindow() {
  let appUrl;
  try {
    appUrl = getAppUrl();
  } catch (error) {
    await dialog.showMessageBox({
      type: 'error',
      title: '忆伴桌面版配置错误',
      message: error.message,
    });
    app.quit();
    return;
  }

  const appOrigin = new URL(appUrl).origin;
  const isTrustedOrigin = (requestingUrl) => {
    try {
      return new URL(requestingUrl).origin === appOrigin;
    } catch {
      return false;
    }
  };

  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestsAudio = permission === 'media' && details.mediaTypes?.includes('audio');
    callback(requestsAudio && isTrustedOrigin(details.requestingUrl || webContents.getURL()));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingUrl, details) => {
    const requestsAudio = permission === 'media' && details?.mediaType === 'audio';
    return requestsAudio && isTrustedOrigin(requestingUrl || webContents?.getURL());
  });

  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== appOrigin) {
      event.preventDefault();
      openExternal(url);
    }
  });

  try {
    await window.loadURL(appUrl);
  } catch {
    await dialog.showMessageBox({
      type: 'error',
      title: '无法打开忆伴',
      message: `无法连接到：${appUrl}`,
      detail: '请检查网络连接和 Vercel 部署地址。',
    });
  }
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
