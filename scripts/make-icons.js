'use strict';

// Draws YO's icons from the real, living mascot (renderer/mascot.js), so the icon always looks like YO.
//   npx electron scripts/make-icons.js
// Writes build/icon.png (512, for the installer and the app) and assets/tray.png / tray@2x.png.
// YO is rendered offscreen with a transparent background, then framed on a canvas in the page.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.join(__dirname, '..');
const SIZE = 600; // the offscreen view; YO is drawn big in the middle, then cropped

const SETUP = `(() => {
  document.body.replaceChildren();
  document.documentElement.style.background = 'transparent';
  document.body.style.cssText = 'margin:0;background:transparent;display:grid;place-items:center;height:${SIZE}px';
  const host = document.createElement('div');
  document.body.append(host);
  const face = Yo.mascot.mount(host, 440);
  face.setLook(Yo.mascot.DEFAULT_LOOK);
  face.setActive(true);
  window.__face = face;
  const r = host.querySelector('svg').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
})()`;

// frame: the app icon is YO on a dark rounded square with a soft glow, like the pill
const FRAME = `(async (src, size, framed) => {
  const img = new Image();
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = src; });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  let pad = 0;
  if (framed) {
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();
    const glow = ctx.createRadialGradient(size / 2, size * 0.56, 0, size / 2, size * 0.56, size * 0.5);
    glow.addColorStop(0, 'rgba(93, 202, 165, 0.35)');
    glow.addColorStop(1, 'rgba(93, 202, 165, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    pad = size * 0.02; // the drawing has its own margin
  }
  const s = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2 + (framed ? size * 0.02 : 0), w, h);
  return canvas.toDataURL('image/png');
})`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: SIZE,
    height: SIZE,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: false },
  });
  let frame = null;
  win.webContents.on('paint', (event, dirty, image) => { frame = image; });
  win.webContents.setFrameRate(30);
  await win.loadFile(path.join(ROOT, 'renderer', 'index.html'));
  const box = await win.webContents.executeJavaScript(SETUP);
  await wait(1500); // let YO settle (springs, eyes open)
  win.webContents.invalidate();
  await wait(300);
  const crop = frame.crop({ x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.w), height: Math.ceil(box.h) });
  const src = crop.toDataURL();
  const out = async (size, framed) => {
    const data = await win.webContents.executeJavaScript(FRAME + '(' + JSON.stringify(src) + ',' + size + ',' + framed + ')');
    return Buffer.from(data.split(',')[1], 'base64');
  };
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.png'), await out(512, true));
  fs.writeFileSync(path.join(ROOT, 'assets', 'tray.png'), await out(16, false));
  fs.writeFileSync(path.join(ROOT, 'assets', 'tray@2x.png'), await out(32, false));
  console.log('icons written');
  app.quit();
});
