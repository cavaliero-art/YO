'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const Agent = require('./main/agent');
const keys = require('./main/keys');
const apps = require('./main/apps');

const WIN_W = 640;
const WIN_H = 560;
// Ctrl+Space takes over IDE autocomplete while YO runs; Stage 4 adds a shortcut picker in the tray
const SHORTCUTS = ['Control+Space', 'Control+Alt+Y'];
const CURSOR_MS = 33; // how often YO's eyes get the pointer position, only while it is on screen

let win = null;
let tray = null;
let activeShortcut = null;
let agent = null;
let cursorTimer = null;
let lastCursor = '';
// mirrored from the page, which keeps it; the tray menu shows and changes it
let prefs = { sound: true };

// YO's sounds play without a click first (it speaks when it arrives)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// appear on the screen the user is working on
function placeWindow() {
  if (!win) return;
  const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.setBounds({
    x: Math.round(bounds.x + (bounds.width - WIN_W) / 2),
    y: bounds.y,
    width: WIN_W,
    height: WIN_H,
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false, // YO only appears when it has something to say
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false, // keep reminders and agent timers on time while hidden
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  placeWindow();

  win.on('show', startCursor);
  win.on('hide', stopCursor);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // YO's hands live here, in the main process; the page only asks
  agent = Agent.create((event) => {
    if (win && !win.isDestroyed()) win.webContents.send('agent', event);
  });
  // once the page listens: deliver reminders that came due while YO was closed, re-arm the rest
  win.webContents.once('did-finish-load', () => agent.restore());
}

function summon() {
  if (!win) return;
  if (!win.isVisible()) placeWindow();
  win.show();
  win.focus();
  win.webContents.send('hotkey');
}

function registerHotkey() {
  for (const combo of SHORTCUTS) {
    if (globalShortcut.register(combo, summon)) {
      activeShortcut = combo;
      return;
    }
  }
  activeShortcut = null;
}

// the pointer position, relative to the window, while YO is visible (its eyes follow it)
function startCursor() {
  if (cursorTimer) return;
  lastCursor = '';
  cursorTimer = setInterval(() => {
    if (!win || !win.isVisible()) return stopCursor();
    const point = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const key = point.x + ',' + point.y;
    if (key === lastCursor) return;
    lastCursor = key;
    win.webContents.send('cursor', { x: point.x - bounds.x, y: point.y - bounds.y });
  }, CURSOR_MS);
}

function stopCursor() {
  clearInterval(cursorTimer);
  cursorTimer = null;
}

function setPref(key, value) {
  if (win) win.webContents.send('pref', { key, value });
}

function buildMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open YO', click: summon },
      { type: 'separator' },
      { label: 'Sounds', type: 'checkbox', checked: prefs.sound, click: (item) => setPref('sound', item.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'assets', 'tray.png'));
    tray.setToolTip('YO');
    tray.on('click', summon);
    buildMenu();
  } catch (err) {
    console.warn('Tray icon unavailable:', err.message);
  }
}

function fromMainWindow(event) {
  return win && event.sender === win.webContents;
}

ipcMain.on('ignore-mouse', (event, ignore) => {
  if (!fromMainWindow(event) || typeof ignore !== 'boolean') return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});

ipcMain.handle('show-window', (event, focus) => {
  if (!fromMainWindow(event)) return false;
  if (!win.isVisible()) placeWindow();
  if (focus === true) {
    win.show();
    win.focus();
  } else {
    win.showInactive();
  }
  return true;
});

ipcMain.on('hide-window', (event) => {
  if (fromMainWindow(event)) win.hide();
});

ipcMain.on('release-focus', (event) => {
  if (fromMainWindow(event)) win.blur();
});

ipcMain.on('prefs', (event, next) => {
  if (!fromMainWindow(event) || !next || typeof next !== 'object') return;
  prefs = { sound: next.sound !== false };
  buildMenu();
});

// ---------- the agent: every request is checked again here ----------
const DECISIONS = new Set(['allow', 'deny', 'always']);

ipcMain.on('agent-run', (event, request) => {
  if (!fromMainWindow(event) || !agent || !request || typeof request !== 'object') return;
  agent.send({
    text: typeof request.text === 'string' ? request.text : '',
    id: typeof request.id === 'string' ? request.id : null,
  });
});

ipcMain.on('agent-respond', (event, id, decision) => {
  if (!fromMainWindow(event) || !agent || typeof id !== 'string' || !DECISIONS.has(decision)) return;
  agent.respond(id, decision);
});

ipcMain.on('agent-stop', (event) => {
  if (fromMainWindow(event) && agent) agent.stop();
});

ipcMain.handle('suggest-open', (event, arg) => {
  if (!fromMainWindow(event) || !agent || typeof arg !== 'string') return [];
  return agent.suggestOpen(arg.slice(0, 120));
});

ipcMain.on('quit', (event) => {
  if (fromMainWindow(event)) app.quit();
});

ipcMain.handle('get-info', (event) => {
  if (!fromMainWindow(event)) return null;
  return {
    locale: app.getLocale(),
    shortcut: activeShortcut ? activeShortcut.replace('Control', 'Ctrl') : null,
    platform: process.platform,
  };
});

if (!app.requestSingleInstanceLock()) {
  // another YO is already running; it gets summoned through 'second-instance'
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();
    registerHotkey();
    createTray();
    screen.on('display-metrics-changed', placeWindow);
    // get ready in the background: media keys (~1.7 s) and the list of installed apps (~4 s)
    setTimeout(() => keys.warm(), 2000);
    setTimeout(() => apps.refresh(), 3000);
  });

  app.on('second-instance', summon);
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    keys.stop();
  });
  app.on('window-all-closed', () => app.quit());
}
