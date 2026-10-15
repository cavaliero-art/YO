'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');

const WIN_W = 640;
const WIN_H = 560;
// Ctrl+Space takes over IDE autocomplete while YO runs; Stage 4 adds a shortcut picker in the tray
const SHORTCUTS = ['Control+Space', 'Control+Alt+Y'];
const CURSOR_MS = 33; // how often YO's eyes get the pointer position, only while it is on screen

let win = null;
let tray = null;
let activeShortcut = null;
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
  });

  app.on('second-instance', summon);
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
