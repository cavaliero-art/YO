// Films the real YO for the demo reel: the real renderer (renderer/index.html), offscreen, with its
// own throwaway demo data, played by a script that moves a mouse, clicks and types like a person.
//   npm run film      writes promo/out/film/ (frames, timeline.json); then `npm run promo -- --scene demo`
// Nothing here touches your own YO or its data: the page runs in an in-memory session.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const W = 720; // the real YO window (main.js)
const H = 600;
const FPS = 30;
const OUT = path.join(__dirname, 'out', 'film');

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const seedScript = require('./seed'); // the demo data, written before YO loads

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach((f) => fs.rmSync(path.join(OUT, f), { force: true })); // the last take
  const win = new BrowserWindow({
    width: W, height: H, show: false, frame: false, transparent: true, useContentSize: true,
    webPreferences: { offscreen: true, partition: 'yo-film', backgroundThrottling: false },
  });
  const wc = win.webContents;
  wc.setFrameRate(FPS);
  const page = path.join(__dirname, '..', 'renderer', 'index.html');
  await win.loadFile(page);
  wc.setZoomFactor(1);
  await wc.executeJavaScript(seedScript());
  await win.loadFile(page); // start again with the demo data
  wc.focus(); // keys reach the page like in the real window
  await sleep(800);

  // YO's sounds are written down (with their time), not played: the reel's sound is made from this list
  await wc.executeJavaScript(`(() => {
    window.__sfx = [];
    window.__t0 = performance.now();
    Yo.sound.play = (name) => { window.__sfx.push([(performance.now() - window.__t0) / 1000, name]); };
    Yo.sound.ambient = () => {};
  })()`);

  // ---------- the camera: every paint is kept; a steady 30 fps clock writes the latest one ----------
  let latest = null;
  let latestId = 0;
  wc.on('paint', (event, dirty, image) => { latest = image; latestId += 1; });
  const frames = []; // frame index -> file
  let writtenId = -1;
  let lastFile = null;
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const ticker = setInterval(() => {
    while (latest && frames.length < Math.floor(now() * FPS)) {
      if (latestId !== writtenId) {
        lastFile = 'f' + String(frames.length).padStart(5, '0') + '.png';
        fs.writeFileSync(path.join(OUT, lastFile), latest.toPNG());
        writtenId = latestId;
      }
      frames.push(lastFile);
    }
  }, 4);

  // ---------- the person ----------
  const log = { cursor: [], clicks: [], keys: [], marks: [] };
  let mouse = { x: 600, y: 420 };
  const mark = (name) => log.marks.push([now(), name]);
  // where YO and its island are, ten times a second: the reel's camera follows them
  log.island = [];
  const watcher = setInterval(async () => {
    const t = now();
    try {
      const r = await wc.executeJavaScript(`(() => {
        const i = document.getElementById('island').getBoundingClientRect();
        const h = document.getElementById('hero').getBoundingClientRect();
        return [i.left, i.top, i.width, i.height, h.left + h.width / 2, h.top + h.height / 2];
      })()`);
      log.island.push([t, ...r.map(Math.round)]);
    } catch (err) { /* the page is busy: next time */ }
  }, 100);
  const send = (event) => wc.sendInputEvent(event);
  // waits a little for it to appear, like a person would
  const at = async (expr) => {
    for (let tries = 0; tries < 30; tries += 1) {
      const r = await wc.executeJavaScript(expr);
      if (r) return r;
      await sleep(100);
    }
    throw new Error('not found: ' + expr);
  };
  // the center of an element: a CSS selector, and optionally the text it shows
  const find = (sel, text) => at(`(() => {
    const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    const el = ${text ? `all.find((e) => e.textContent.trim().toLowerCase().includes(${JSON.stringify(String(text).toLowerCase())}))` : 'all[0]'};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  async function move(to, ms = 600) {
    const from = Object.assign({}, mouse);
    const start = Date.now();
    for (let k = 0; k < 1;) {
      k = Math.min(1, (Date.now() - start) / ms); // by the clock: a slow timer never slows the hand
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // a slight arc, like a hand
      const lift = Math.sin(k * Math.PI) * Math.min(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.08);
      mouse = { x: Math.round(from.x + (to.x - from.x) * e), y: Math.round(from.y + (to.y - from.y) * e - lift) };
      send({ type: 'mouseMove', x: mouse.x, y: mouse.y });
      log.cursor.push([now(), mouse.x, mouse.y]);
      if (k < 1) await sleep(8);
    }
  }
  async function click(button = 'left', holdMs = 90) {
    send({ type: 'mouseDown', x: mouse.x, y: mouse.y, button, clickCount: 1 });
    log.clicks.push([now(), mouse.x, mouse.y, button]);
    await sleep(holdMs);
    send({ type: 'mouseUp', x: mouse.x, y: mouse.y, button, clickCount: 1 });
  }
  const goClick = async (target, ms, button) => { await move(target, ms); await sleep(120); await click(button); };
  async function key(keyCode, modifiers = [], label) {
    if (label) log.keys.push([now(), label]);
    send({ type: 'keyDown', keyCode, modifiers });
    if (!modifiers.length && keyCode.length === 1) send({ type: 'char', keyCode });
    await sleep(60);
    send({ type: 'keyUp', keyCode, modifiers });
  }
  async function type(text, cps = 11) {
    for (const ch of text) {
      await key(ch);
      await sleep(1000 / cps + (Math.random() - 0.5) * 30);
    }
  }

  // ---------- the demo ----------
  try {
    await sleep(900);
    await move({ x: 470, y: 330 }, 500);
    mark('call');
    await key('Space', ['control'], 'Ctrl + Space');
    await sleep(1300);

    // the eyes follow the pointer
    mark('eyes');
    await move({ x: 330, y: 200 }, 550);
    await move({ x: 60, y: 240 }, 550);
    await move({ x: 210, y: 150 }, 500);
    await sleep(200);

    // three boops on the antenna: dizzy
    mark('boop');
    const ant = await find('.hit-ant');
    await move(ant, 600);
    for (let i = 0; i < 3; i += 1) { await click(); await sleep(240); }
    await sleep(1600);

    // hold to pet
    mark('pet');
    const hero = await find('#hero');
    await move({ x: hero.x, y: hero.y + 6 }, 400);
    send({ type: 'mouseDown', x: mouse.x, y: mouse.y, button: 'left', clickCount: 1 });
    log.clicks.push([now(), mouse.x, mouse.y, 'hold']);
    await sleep(1900);
    send({ type: 'mouseUp', x: mouse.x, y: mouse.y, button: 'left', clickCount: 1 });
    await sleep(300);

    // a quick answer, typed
    mark('type');
    await goClick(await find('#cmd'), 500);
    await type('12*7+3');
    await sleep(1300);
    await key('A', ['control']);
    await key('Backspace');
    await sleep(400);

    // the home screen: every mini app
    mark('home');
    await goClick(await find('#browse'), 600);
    await sleep(1100);

    // Habits: tick today's water
    mark('habits');
    await goClick(await find('.htile', 'Habits'), 600);
    await sleep(1100);
    mark('tick');
    await goClick(await find('.hb-row[data-id="hwater"] .hb-check'), 700);
    await sleep(2300);

    // Prayer, then Focus
    mark('prayer');
    await goClick(await find('#aBack'), 600);
    await sleep(700);
    await goClick(await find('.htile', 'Prayer'), 600);
    await sleep(2300);
    mark('focus');
    await goClick(await find('#aBack'), 600);
    await sleep(700);
    await goClick(await find('.htile', 'Focus'), 600);
    await sleep(2000);
    await goClick(await find('#aClose'), 600);
    await sleep(700);

    // right-click YO: dress it up
    mark('dress');
    await goClick(await find('#hero'), 700, 'right');
    await sleep(300);
    // offscreen, a right click may not raise the menu event by itself: send it to YO like Windows would
    await wc.executeJavaScript(`document.getElementById('cOpts').offsetParent || document.getElementById('hero').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: ${mouse.x}, clientY: ${mouse.y}, button: 2 }))`);
    await sleep(800);
    await goClick(await find('.ctab', 'outfit'), 600);
    await sleep(350);
    await goClick(await find('[data-group="hat"][data-value="chechia"]'), 600);
    await sleep(650);
    await goClick(await find('[data-group="neck"][data-value="fouta"]'), 600);
    await sleep(650);
    await goClick(await find('.ctab', 'body'), 600);
    await sleep(350);
    await goClick(await find('[data-group="color"][data-value="sidi"]'), 600);
    await sleep(650);
    await goClick(await find('[data-group="tip"][data-value="jasmine"]'), 600);
    await sleep(900);
    await goClick(await find('#cDone'), 600);
    await sleep(650);

    // ticking the water habit 7 days in a row unlocked the sprout: YO offers it
    mark('unlock');
    await move({ x: 420, y: 260 }, 900);
    await sleep(500);
    await key('Space', ['control'], 'Ctrl + Space'); // YO has news: the shortcut opens it
    await sleep(700);
    await goClick(await find('button', 'Try it on'), 700);
    await sleep(1300);

    // YO's moves: a little dance
    mark('dance');
    if (!(await wc.executeJavaScript(`Boolean(document.getElementById('browse').offsetParent)`))) {
      await key('Space', ['control'], 'Ctrl + Space');
      await sleep(900);
    }
    await goClick(await find('#browse'), 600);
    await sleep(900);
    await goClick(await find('.mbtn'), 600);
    await sleep(3400);
    mark('bye');
    await key('Escape', [], 'Esc');
    await sleep(1600);
    mark('end');
  } catch (err) {
    console.error('the demo stopped:', err.message.split('\n')[0], err.message.match(/querySelectorAll\(([^)]*)\)/)?.[1]);
    console.error('buttons on screen:', await wc.executeJavaScript(`[...document.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.id || b.textContent.trim().slice(0, 20)).join(' | ')`));
  }

  clearInterval(ticker);
  clearInterval(watcher);
  const sfx = await wc.executeJavaScript('window.__sfx');
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ fps: FPS, w: W, h: H, duration: frames.length / FPS, frames, sfx, ...log }));
  console.log('filmed', frames.length, 'frames,', new Set(frames).size, 'pictures,', sfx.length, 'sounds; marks:', log.marks.map((m) => m[1] + '@' + m[0].toFixed(1)).join(' '));
  app.quit();
}).catch((err) => {
  console.error(err);
  app.exit(1);
});
