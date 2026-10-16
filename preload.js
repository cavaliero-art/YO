'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yo', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('ignore-mouse', Boolean(ignore)),
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
});
