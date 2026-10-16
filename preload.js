'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('yo', {
  setHitRect: (rect) => ipcRenderer.send('hit-rect', rect),
  show: (focus) => ipcRenderer.invoke('show-window', focus === true),
  hide: () => ipcRenderer.send('hide-window'),
  releaseFocus: () => ipcRenderer.send('release-focus'),
  quit: () => ipcRenderer.send('quit'),
  getInfo: () => ipcRenderer.invoke('get-info'),
  onHotkey: (callback) => ipcRenderer.on('hotkey', () => callback()),
  onCursor: (callback) => ipcRenderer.on('cursor', (event, point) => callback(point)),
  onPref: (callback) => ipcRenderer.on('pref', (event, pref) => callback(pref)),
  reportPrefs: (prefs) => ipcRenderer.send('prefs', prefs),
  run: (request) => ipcRenderer.send('agent-run', request),
  respond: (id, decision) => ipcRenderer.send('agent-respond', id, decision),
  stopAgent: () => ipcRenderer.send('agent-stop'),
  onAgent: (callback) => ipcRenderer.on('agent', (event, data) => callback(data)),
  suggestOpen: (arg) => ipcRenderer.invoke('suggest-open', arg),
  // a dropped file's path on disk (Electron no longer puts it on the File object)
  pathForFile: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch (err) { return ''; } },
  fileAction: (action, target) => ipcRenderer.invoke('file-action', action, target),
  onMedia: (callback) => ipcRenderer.on('media', (event, now) => callback(now)),
});
