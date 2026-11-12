/**
 * 覆盖层渲染进程的桥。只暴露桌宠需要的六个动作，
 * 通道名与主进程 pet-manager.cjs 里的 ipcMain 一一对应。
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('yibanPet', Object.freeze({
  version: 1,
  ready: () => ipcRenderer.send('pet:ready'),
  hitRegions: (rects) => ipcRenderer.send('pet:regions', rects),
  dragStart: () => ipcRenderer.send('pet:drag', true),
  dragEnd: () => ipcRenderer.send('pet:drag', false),
  openMain: (target) => ipcRenderer.invoke('pet:open-main', target),
  hide: () => ipcRenderer.invoke('pet:hide'),
  quit: () => ipcRenderer.invoke('pet:quit'),
}))
