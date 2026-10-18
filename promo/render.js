// Renders a reel (1080x1920, 30 fps, with sound):
//   npm run promo                         promo/scene.html -> promo/out/yo-reel.mp4 (the animated one)
//   npm run promo -- --scene demo         promo/demo.html  -> promo/out/yo-demo.mp4 (the filmed YO, after `npm run film`)
//   npm run promo -- --scene live         YO's real page drawn frame by frame -> promo/out/yo-live.mp4
//                    [--theme sidi|mint|blocks]
//   npm run promo -- --stills 1,8         only pictures of those seconds (promo/out/still-8.png), to check a frame
// Needs ffmpeg on the PATH.
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const seedScript = require('./seed');

const W = 1080;
const H = 1920;
const HALF = H / 2; // a 1920-tall window doesn't fit a laptop screen, even offscreen: each frame is taken in two halves
const OUT = path.join(__dirname, 'out');

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const arg = (name) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? null : process.argv[i + 1];
};

// the live reel: YO's own page, with the video's clock put in before it starts, then the stage around it
async function openLive(win, theme) {
  const wc = win.webContents;
  wc.on('console-message', (event, level, message) => { if (process.env.PROMO_DEBUG) console.log('page:', message); });
  const page = path.join(__dirname, '..', 'renderer', 'index.html');
  await win.loadFile(page);
  await wc.executeJavaScript(seedScript());
  // YO's page only allows its own scripts and styles (CSP): in this render window only, let the reel's font in
  wc.debugger.attach('1.3');
  await wc.debugger.sendCommand('Page.setBypassCSP', { enabled: true });
  await win.loadFile(page); // start again with the demo data
  await wc.insertCSS(fs.readFileSync(path.join(__dirname, 'live.css'), 'utf8'));
  await wc.executeJavaScript('window.__theme = ' + JSON.stringify(theme) + ';');
  await wc.executeJavaScript(fs.readFileSync(path.join(__dirname, 'band.js'), 'utf8'));
  await wc.executeJavaScript(fs.readFileSync(path.join(__dirname, 'live.js'), 'utf8'));
  await wc.executeJavaScript('document.fonts.load("600 92px Fredoka").then(() => document.fonts.ready).then(() => true)');
}

function run(cmd, args) {
  return new Promise((done, fail) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    p.on('close', (code) => (code ? fail(new Error(cmd + ' ' + code)) : done()));
  });
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const scene = arg('scene') || 'scene';
  const theme = arg('theme') || 'sidi';
  const live = scene === 'live';
  const win = new BrowserWindow({
    width: W, height: HALF, show: false, useContentSize: true, frame: false,
    webPreferences: live
      ? { offscreen: true, backgroundThrottling: false, partition: 'yo-live', preload: path.join(__dirname, 'live-preload.js'), contextIsolation: false, sandbox: false }
      : { offscreen: true, backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setFrameRate(60);
  const name = scene === 'scene' ? 'yo-reel' : 'yo-' + scene + (live && theme !== 'sidi' ? '-' + theme : '');
  if (live) {
    await openLive(win, theme);
  } else {
    await win.loadFile(path.join(__dirname, scene + '.html'));
    // the captions' font, loaded before the first frame
    await wc.executeJavaScript('document.fonts.load("600 88px Fredoka").then(() => document.fonts.ready).then(() => true)');
  }
  wc.setZoomFactor(1); // Chromium remembers zoom per page: always render at 100%
  if (scene === 'demo') {
    const timeline = fs.readFileSync(path.join(OUT, 'film', 'timeline.json'), 'utf8');
    await wc.executeJavaScript('__scene.load(' + timeline + ')');
  }
  const FPS = await wc.executeJavaScript('__scene.FPS');
  // the live reel knows its length only once its script has played
  const total = () => wc.executeJavaScript('Math.round(__scene.FPS * __scene.DUR)');

  // one half of the frame, once the paint shows it (the corner pixel says which frame and which half it is)
  async function grab(n, half) {
    for (let tries = 0; tries < 80; tries += 1) {
      if (tries) await new Promise((done) => setTimeout(done, 8));
      wc.invalidate();
      const image = await wc.capturePage();
      const size = image.getSize();
      if (image.isEmpty()) continue; // a capture can come before the page has any pixels
      if (size.width !== W || size.height !== HALF) throw new Error('frame is ' + size.width + 'x' + size.height);
      const px = image.toBitmap(); // BGRA
      const i = (W * HALF - 1) * 4;
      if (Math.abs(px[i + 2] - (n & 255)) <= 2 && Math.abs(px[i + 1] - (n >> 8) * 32) <= 3 && Math.abs(px[i] - half * 128) <= 3) {
        px.copy(px, i, i - 4, i); // hide the marker: copy the pixel next to it
        return px;
      }
    }
    throw new Error('frame ' + n + ' never painted');
  }

  // step the scene to frame n and take both halves
  const step = (n) => {
    if (process.env.PROMO_DEBUG && n % 15 === 0) console.log('step', n);
    return wc.executeJavaScript('__scene.step(' + n / FPS + ', ' + n + ')');
  };
  async function frame(n) {
    await step(n);
    const top = await grab(n, 0);
    await wc.executeJavaScript('__scene.half(1)');
    const bottom = await grab(n, 1);
    return Buffer.concat([top, bottom]);
  }

  const stills = arg('stills');
  if (stills) {
    const want = stills.split(',').map(Number).sort((a, b) => a - b);
    const last = Math.round(want[want.length - 1] * FPS);
    for (let n = 0; n <= last; n += 1) {
      const hit = want.find((s) => Math.round(s * FPS) === n);
      if (hit === undefined) { await step(n); continue; }
      const px = await frame(n);
      const file = path.join(OUT, 'still-' + (live ? theme + '-' : '') + hit + '.png');
      fs.writeFileSync(file, nativeImage.createFromBitmap(px, { width: W, height: H }).toPNG());
      console.log('still', hit);
    }
    app.quit();
    return;
  }

  // every frame into ffmpeg (picture only), then the sound, then both together
  // (--sound-only: the picture is already made; play the scene through without pictures, for its sound)
  const silent = path.join(OUT, name + '.video.mp4');
  const soundOnly = process.argv.includes('--sound-only');
  if (soundOnly) for (let n = 0; n < (await total()); n += 1) await step(n);
  else {
  const ff = spawn('ffmpeg', [
    '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', W + 'x' + H, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', silent,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const finished = new Promise((done, fail) => ff.on('close', (code) => (code ? fail(new Error('ffmpeg ' + code)) : done())));
  const started = Date.now();
  for (let n = 0; n < (await total()); n += 1) {
    const px = await frame(n);
    if (!ff.stdin.write(px)) await new Promise((done) => ff.stdin.once('drain', done));
    if (n % 60 === 0) console.log('frame', n, '/', await total(), Math.round((Date.now() - started) / 1000) + 's');
  }
  ff.stdin.end();
  await finished;
  }

  const wavPath = path.join(OUT, name + '.wav');
  console.log('sound…');
  fs.writeFileSync(wavPath, Buffer.from(await wc.executeJavaScript('__scene.audio()'), 'base64'));
  console.log('sound done');
  const mp4 = path.join(OUT, name + '.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', wavPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4]);
  fs.rmSync(silent, { force: true });
  console.log('done:', mp4);
  app.quit();
}).catch((err) => {
  console.error('render failed:', err && (err.stack || err.message) ? err.stack || err.message : JSON.stringify(err), String(err));
  app.exit(1);
});
