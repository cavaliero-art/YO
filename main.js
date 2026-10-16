'use strict';

const fs = require('fs');
const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, shell } = require('electron');
const path = require('path');
const Agent = require('./main/agent');
const keys = require('./main/keys');
const apps = require('./main/apps');
const watch = require('./main/watch');

const WIN_W = 640;
const WIN_H = 560;
// Ctrl+Space takes over IDE autocomplete while YO runs; Stage 4 adds a shortcut picker in the tray
const SHORTCUTS = ['Control+Space', 'Control+Alt+Y'];
const POINTER_MS = 33; // pointer checks while a YO window is on screen: eyes follow it, clicks reach YO
const HIT_MARGIN = 4;
const MEDIA_MS = 2500; // what's playing, asked only while the pill is on screen

let win = null;
let tray = null;
let activeShortcut = null;
let agent = null;
let pointerTimer = null;
let mediaTimer = null;
let lastMedia = '';
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

  win.on('show', () => { startPointer(); startMedia(); });
  win.on('hide', stopMedia);
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

// ---------- the pointer, while YO is on screen ----------
// The page tells us where YO is (its "hit" rectangle). The window lets clicks through everywhere
// else. Checking the pointer from here (not from the page) also works while you drag a file.
const hits = new Map(); // webContents id -> { x, y, w, h } or null
const ignoring = new Map(); // webContents id -> true while clicks pass through
const lastPointer = new Map();

function yoWindows() {
  return [win].filter((w) => w && !w.isDestroyed() && w.isVisible());
}

function pointerTick() {
  const shown = yoWindows();
  if (!shown.length) return stopPointer();
  const point = screen.getCursorScreenPoint();
  shown.forEach((w) => {
    const id = w.webContents.id;
    const b = w.getBounds();
    const x = point.x - b.x;
    const y = point.y - b.y;
    const r = hits.get(id);
    const over = Boolean(r) && x >= r.x - HIT_MARGIN && x <= r.x + r.w + HIT_MARGIN && y >= r.y - HIT_MARGIN && y <= r.y + r.h + HIT_MARGIN;
    if (ignoring.get(id) !== !over) {
      ignoring.set(id, !over);
      if (over) w.setIgnoreMouseEvents(false);
      else w.setIgnoreMouseEvents(true, { forward: true });
    }
    const key = x + ',' + y;
    if (lastPointer.get(id) !== key) {
      lastPointer.set(id, key);
      w.webContents.send('cursor', { x, y });
    }
  });
}

function startPointer() {
  if (!pointerTimer) pointerTimer = setInterval(pointerTick, POINTER_MS);
}

function stopPointer() {
  clearInterval(pointerTimer);
  pointerTimer = null;
}

// ---------- what's playing, while the pill is on screen (YO bops along) ----------
async function mediaTick() {
  const now = await watch.nowPlaying();
  if (!now || !win || !win.isVisible()) return;
  const key = JSON.stringify(now);
  if (key === lastMedia) return;
  lastMedia = key;
  win.webContents.send('media', now);
}

function startMedia() {
  if (mediaTimer || process.platform !== 'win32') return;
  lastMedia = '';
  mediaTick();
  mediaTimer = setInterval(mediaTick, MEDIA_MS);
}

function stopMedia() {
  clearInterval(mediaTimer);
  mediaTimer = null;
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

const isRect = (r) => r && ['x', 'y', 'w', 'h'].every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]));

ipcMain.on('hit-rect', (event, rect) => {
  if (!fromMainWindow(event)) return;
  hits.set(event.sender.id, isRect(rect) ? rect : null);
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

// ---------- something dropped on YO: only real, absolute paths ----------
ipcMain.handle('file-action', async (event, action, target) => {
  if (!fromMainWindow(event) || typeof target !== 'string' || !path.isAbsolute(target) || !fs.existsSync(target)) return false;
  if (action === 'reveal') {
    shell.showItemInFolder(path.normalize(target));
    return true;
  }
  return false;
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
    watch.stop();
  });
  app.on('window-all-closed', () => app.quit());
}
