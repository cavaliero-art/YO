'use strict';

// YO's desktop walk: a thin transparent strip just above the taskbar where YO walks around.
// It steps aside while the pill at the top is showing and while a fullscreen app is in front.
const path = require('path');
const { BrowserWindow, screen } = require('electron');
const watch = require('./watch');

const HEIGHT = 130;
const FULLSCREEN_CHECK_MS = 3000;

function create({ preload, onReady }) {
  let win = null;
  let enabled = false;
  let pillOpen = false; // the main pill is showing: YO is up there, not down here
  let fullscreen = false;
  let checkTimer = null;
  let loaded = false; // the page is ready to hear "start walking"

  function place() {
    if (!win) return;
    const { workArea } = screen.getPrimaryDisplay();
    win.setBounds({ x: workArea.x, y: workArea.y + workArea.height - HEIGHT, width: workArea.width, height: HEIGHT });
  }

  function build() {
    win = new BrowserWindow({
      width: 800,
      height: HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    win.setAlwaysOnTop(true, 'pop-up-menu');
    win.setIgnoreMouseEvents(true, { forward: true });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.on('closed', () => { win = null; loaded = false; });
    place();
    win.loadFile(path.join(__dirname, '..', 'renderer', 'walker.html'));
    win.webContents.once('did-finish-load', () => {
      loaded = true;
      sync();
      if (onReady) onReady(win);
    });
  }

  // show it only when walking is on, the pill is away and nothing is fullscreen
  function sync() {
    if (!win || !loaded) return;
    const want = enabled && !pillOpen && !fullscreen;
    if (want && !win.isVisible()) {
      place();
      win.showInactive();
      win.webContents.send('walker', { active: true });
    } else if (!want && win.isVisible()) {
      win.webContents.send('walker', { active: false });
      win.hide();
    }
  }

  async function checkFullscreen() {
    const next = await watch.isFullscreen();
    if (next !== fullscreen) {
      fullscreen = next;
      sync();
    }
  }

  return {
    get window() { return win; },
    isEnabled: () => enabled,
    setEnabled(on) {
      enabled = Boolean(on);
      if (enabled && !win) build();
      clearInterval(checkTimer);
      checkTimer = enabled ? setInterval(checkFullscreen, FULLSCREEN_CHECK_MS) : null;
      sync();
    },
    setPillOpen(open) {
      pillOpen = Boolean(open);
      sync();
    },
    place,
    destroy() {
      clearInterval(checkTimer);
      if (win) win.destroy();
      win = null;
    },
  };
}

module.exports = { create };
