'use strict';

const fs = require('fs');
const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, shell } = require('electron');
const path = require('path');
const Agent = require('./main/agent');
const keys = require('./main/keys');
const apps = require('./main/apps');
const watch = require('./main/watch');
const clips = require('./main/clipboard');
const translator = require('./main/translate');
const store = require('./main/store');

const WIN_W = 720; // room for the large pill size
const WIN_H = 600;
const EDGE = 8; // gap from the screen side when the pill sits left or right
// the shortcuts you can pick in the tray; if yours is taken by another app, the next free one is used
const SHORTCUTS = ['Control+Space', 'Control+Shift+Space', 'Control+Alt+Y', 'Alt+Shift+Y'];
const SHORTCUT_NOTES = { 'Control+Space': ' (also IDE autocomplete)' };
const LOGIN_NAME = 'YO'; // the name of YO's "start with Windows" entry
const AT_LOGIN = process.argv.includes('--login'); // started by Windows: no hello, just wait in the tray
const POINTER_MS = 33; // pointer checks while a YO window is on screen: eyes follow it, clicks reach YO
const HIT_MARGIN = 4;
const MEDIA_MS = 2500; // what's playing, asked only while the pill is on screen
const PASTE_DELAY_MS = 180; // after YO hides, the window you were in has focus again

let win = null;
let tray = null;
let activeShortcut = null;
let agent = null;
let pointerTimer = null;
let mediaTimer = null;
let lastMedia = '';
// mirrored from the page, which keeps it; the tray menu shows and changes it
let prefs = { sound: true, position: 'center' };

// YO's sounds play without a click first (it speaks when it arrives)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// appear on the screen the user is working on
function placeWindow() {
  if (!win) return;
  const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const x = prefs.position === 'left' ? bounds.x + EDGE
    : prefs.position === 'right' ? bounds.x + bounds.width - WIN_W - EDGE
      : bounds.x + (bounds.width - WIN_W) / 2;
  win.setBounds({
    x: Math.round(x),
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

const pretty = (combo) => (combo ? combo.replace('Control', 'Ctrl') : 'none');

// your pick first, then the others; returns the one that worked
function registerHotkey(wanted) {
  if (activeShortcut) globalShortcut.unregister(activeShortcut);
  activeShortcut = null;
  const order = [wanted].concat(SHORTCUTS).filter((c, i, all) => SHORTCUTS.includes(c) && all.indexOf(c) === i);
  for (const combo of order) {
    try {
      if (globalShortcut.register(combo, summon)) {
        activeShortcut = combo;
        break;
      }
    } catch (err) { /* not a valid accelerator here: try the next */ }
  }
  return activeShortcut;
}

// settings.json is shared with the agent ("Always" choices): read it again before writing
function saveSetting(key, value) {
  store.save('settings', Object.assign(store.load('settings', {}), { [key]: value }));
}

function pickShortcut(combo) {
  const got = registerHotkey(combo);
  saveSetting('shortcut', combo);
  buildMenu();
  if (win) win.webContents.send('pref', { key: 'shortcut', value: pretty(got), wanted: pretty(combo) });
}

// start with Windows: when running from source (npm start), Electron needs the app folder too
function loginArgs() {
  return app.isPackaged ? ['--login'] : [path.resolve(__dirname), '--login'];
}

function startsWithWindows() {
  return app.getLoginItemSettings({ path: process.execPath, args: loginArgs() }).openAtLogin;
}

function setStartWithWindows(on) {
  app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: loginArgs(), name: LOGIN_NAME });
  buildMenu();
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
      { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (item) => setStartWithWindows(item.checked) },
      {
        label: 'Shortcut: ' + pretty(activeShortcut),
        submenu: SHORTCUTS.map((combo) => ({
          label: pretty(combo) + (SHORTCUT_NOTES[combo] || ''),
          type: 'radio',
          checked: combo === activeShortcut,
          click: () => pickShortcut(combo),
        })),
      },
      { label: 'Sounds', type: 'checkbox', checked: prefs.sound, click: (item) => setPref('sound', item.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'assets', 'tray.png')); // tray@2x.png is used on sharper screens
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

ipcMain.on('hide-window', (event, after) => {
  if (!fromMainWindow(event)) return;
  win.hide();
  // Clipboard app: what you picked is already on the clipboard; paste it where you were
  if (after === 'paste') setTimeout(() => { try { keys.paste(); } catch (err) { /* copied, not pasted */ } }, PASTE_DELAY_MS);
});

ipcMain.on('release-focus', (event) => {
  if (fromMainWindow(event)) win.blur();
});

ipcMain.on('prefs', (event, next) => {
  if (!fromMainWindow(event) || !next || typeof next !== 'object') return;
  const position = ['left', 'center', 'right'].includes(next.position) ? next.position : 'center';
  const moved = position !== prefs.position;
  prefs = { sound: next.sound !== false, position };
  buildMenu();
  if (moved) placeWindow(); // the pill moves to its new side right away
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

// ---------- mini apps ----------
ipcMain.handle('translate', (event, request) => {
  if (!fromMainWindow(event) || !request || typeof request !== 'object' || typeof request.text !== 'string') return { error: 'service' };
  return translator.translate(request.text, String(request.from), String(request.to));
});

const CLIP_ACTIONS = new Set(['pin', 'remove', 'clear', 'copy', 'pause', 'resume']);
ipcMain.handle('clips', (event) => {
  if (!fromMainWindow(event)) return null;
  keys.warm(); // the Clipboard app is open: get the paste key ready (PowerShell takes ~1.7 s to start)
  return clips.list();
});
ipcMain.handle('clip', (event, action, id) => {
  if (!fromMainWindow(event) || !CLIP_ACTIONS.has(action) || (id !== undefined && typeof id !== 'string')) return false;
  return clips.act(action, id);
});

ipcMain.on('quit', (event) => {
  if (fromMainWindow(event)) app.quit();
});

ipcMain.handle('get-info', (event) => {
  if (!fromMainWindow(event)) return null;
  return {
    locale: app.getLocale(),
    shortcut: activeShortcut ? pretty(activeShortcut) : null,
    platform: process.platform,
    atLogin: AT_LOGIN,
  };
});

if (!app.requestSingleInstanceLock()) {
  // another YO is already running; it gets summoned through 'second-instance'
  app.quit();
} else {
  app.whenReady().then(() => {
    app.setAppUserModelId('com.cavaliero.yo');
    createWindow();
    registerHotkey(store.load('settings', {}).shortcut);
    createTray();
    screen.on('display-metrics-changed', placeWindow);
    // get ready in the background: the list of installed apps (~4 s). The paste key starts with the Clipboard app.
    setTimeout(() => apps.refresh(), 3000);
    clips.start(() => { if (win && !win.isDestroyed()) win.webContents.send('clips'); });
  });

  app.on('second-instance', summon);
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    keys.stop();
    watch.stop();
    clips.stop();
  });
  app.on('window-all-closed', () => app.quit());
}
