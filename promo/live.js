// The live reel: YO's real page, run on the video's clock (live-preload.js) and drawn at full size
// inside a 1080x1920 stage. A script plays the person (pointer, clicks, typing) in video time, the camera
// follows, captions pop word by word on the beat. render.js injects this after the page has loaded.
(function () {
  'use strict';

  const FPS = 30;
  const BPM = 112; // YO bops at 112 when music plays: the band plays at the same tempo
  const BEAT = 60 / BPM;
  const MON = { w: 1000, h: 1120 };
  const clock = window.__clock;
  const wait = (ms) => clock.wait(ms);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const out3 = (k) => 1 - Math.pow(1 - k, 3);
  const back = (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const Y = window.Yo;

  // ---------- the stage, built around YO's page ----------
  const THEME = window.__theme || 'sidi';
  const BLOCKS = { start: '#9FE1CB', open: '#F5C4B3', remind: '#D6CEFA', habits: '#B5D4F4', dress: '#F7E3A1', dance: '#F9C6DA', end: '#9FE1CB' };
  const pf = document.createElement('div');
  pf.id = 'pf';
  pf.dataset.theme = THEME;
  pf.innerHTML =
    '<div id="pf-glow"></div>' +
    '<div id="pf-pattern"><div class="door l"></div><div class="door r"></div>' +
      '<i class="flower" style="left:860px;top:40px;width:120px;height:120px"></i><i class="flower" style="left:960px;top:150px;width:70px;height:70px"></i>' +
      '<i class="flower" style="left:30px;top:1500px;width:90px;height:90px"></i></div>' +
    '<div id="pf-cap"></div>' +
    '<div id="pf-monitor"><div id="pf-wall"></div>' +
      '<div id="pf-win"><div class="bar"><span>♪</span><span>Spotify</span><span class="dots">— ▢ ✕</span></div>' +
        '<div class="body"><div class="art"></div><div class="meta"><div class="k">NOW PLAYING</div><div class="song">Darbuka Nights</div>' +
        '<div class="artist">Sidi Beats</div><div class="prog"><i></i></div><div class="ctrl"><span>⏮</span><span class="play">❚❚</span><span>⏭</span></div></div></div></div>' +
      '<div id="pf-app"></div>' +
      '<div id="pf-ring"></div>' +
      '<svg id="pf-cursor" viewBox="0 0 24 36" width="34" height="51"><path d="M2 2v26l7-6.5 4.6 10.6 4.2-1.8-4.6-10.4H22z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<div id="pf-taskbar"><i></i><i></i><i class="on"></i><i></i><i class="music" style="display:none"></i></div>' +
    '</div>' +
    '<div id="pf-keys"></div>' +
    '<div id="pf-later">10 minutes later…</div>' +
    '<div id="pf-end"><div class="yo"><div id="pf-endyo"></div></div><div class="text"><div class="word">YO</div>' +
      '<div class="free">Free for Windows</div><div class="cta">Comment « YO » for the link</div></div></div>' +
    '<div class="pf-marker" style="top:959px"></div><div class="pf-marker" style="top:1919px"></div>';
  document.body.appendChild(pf);
  const $ = (sel) => pf.querySelector(sel);
  const box = $('#pf-app');
  box.appendChild(document.getElementById('stage'));
  // the apps "installed" on this demo PC: what YO finds when you type "open spo"
  const APPS = ['Spotify', 'Spotify Web', 'Steam', 'Chrome', 'Discord', 'VS Code', 'WhatsApp'];
  Y.agent.suggestOpen = (arg) => Promise.resolve(APPS.filter((a) => a.toLowerCase().startsWith(String(arg).toLowerCase().trim()))
    .slice(0, 3).map((label) => ({ kind: 'app', label })));
  const endYo = Y.mascot.mount($('#pf-endyo'), 360);
  endYo.setLook({ color: 'sidi', hat: 'chechia', neck: 'fouta', tip: 'sprout' });
  endYo.setActive(true);

  // ---------- what the person does, in video time ----------
  const log = { clicks: [], keys: [], whoosh: [], marks: [] };
  let pointer = { x: 560, y: 420 }; // in YO's window (720x600)
  let caption = null; // { at, words, sub }
  let lastCaption = null;
  let windowAt = -1;
  let laterAt = -1;
  let skipMs = 0; // time the "later" cut jumps over
  let pendingSkip = 0;
  let skipAt = Infinity; // page seconds when the jump happened
  let endAt = Infinity;
  let section = 'start';
  let done = false;
  const vnow = () => (clock.now() - skipMs) / 1000; // video seconds

  // where something is in YO's window
  function where(sel, text) {
    const all = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
    const el = text ? all.find((e) => e.textContent.trim().toLowerCase().includes(text.toLowerCase())) : all[0];
    if (!el) throw new Error('not found: ' + sel + ' ' + (text || '') + ' at ' + vnow().toFixed(2) + 's, YO: ' + JSON.stringify(Yo.app.view()) + ' ' + JSON.stringify(Object.assign({}, document.getElementById('island').dataset)));
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { el, x: (r.left + r.width / 2 - b.left) / cam.s, y: (r.top + r.height / 2 - b.top) / cam.s };
  }
  const toClient = (p) => { const b = box.getBoundingClientRect(); return { x: b.left + p.x * cam.s, y: b.top + p.y * cam.s }; };

  async function move(to, ms = 550) {
    const from = Object.assign({}, pointer);
    const start = vnow();
    for (;;) {
      const k = clamp((vnow() - start) / (ms / 1000));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const lift = Math.sin(k * Math.PI) * Math.min(30, Math.hypot(to.x - from.x, to.y - from.y) * 0.08);
      pointer = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - lift };
      const c = toClient(pointer);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: c.x, clientY: c.y, bubbles: true }));
      if (k >= 1) return;
      await wait(1000 / 60);
    }
  }
  function fire(el, type, init) {
    const c = toClient(pointer);
    const opts = Object.assign({ bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, button: 0 }, init);
    el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, opts) : new MouseEvent(type, opts));
  }
  async function click(sel, text, how = 'left') {
    const target = where(sel, text);
    await move(target);
    await wait(110);
    log.clicks.push([vnow(), pointer.x, pointer.y, how]);
    if (how === 'right') {
      fire(target.el, 'contextmenu', { button: 2 });
    } else {
      fire(target.el, 'pointerdown');
      fire(target.el, 'mousedown');
      await wait(70);
      fire(target.el, 'pointerup');
      fire(target.el, 'mouseup');
      fire(target.el, 'click');
    }
    await wait(120);
  }
  function key(code, keyName, mods = {}, label) {
    if (label) log.keys.push([vnow(), label]);
    const target = document.activeElement || document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ code, key: keyName, bubbles: true, cancelable: true }, mods)));
    target.dispatchEvent(new KeyboardEvent('keyup', Object.assign({ code, key: keyName, bubbles: true }, mods)));
  }
  const hotkey = () => key('Space', ' ', { ctrlKey: true }, 'Ctrl + Space');
  // the bar, opened with the shortcut when YO went back to its small pill
  async function bar() {
    for (let i = 0; i < 6; i += 1) {
      const v = Yo.app.view();
      if (v.composing && v.vis === 'shown') return;
      if (v.vis === 'shown' && /^New/.test(v.bubble)) { // a reward is waiting: take it, then go on
        hotkey();
        await wait(700);
        await click('button', 'try it on');
        await wait(1100);
        continue;
      }
      if (v.vis === 'leaving' || v.vis === 'entering') { await wait(250); continue; } // let it finish, then ask
      if (v.vis === 'shown' && !v.bubble) key('Enter', 'Enter'); // the small YO is out: Enter opens its bar
      else hotkey();
      await wait(700);
    }
  }


  async function type(text) {
    const input = document.getElementById('cmd');
    input.focus();
    for (const ch of text) {
      input.value += ch;
      input.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true }));
      log.keys.push([vnow(), null]);
      await wait(62 + ((ch.charCodeAt(0) * 37) % 40));
    }
  }
  // a caption: words in *stars* take the accent color; it starts on the next half beat
  function say(text, sub) {
    const t = vnow();
    const at = Math.ceil((t - 0.2) / (BEAT / 2)) * (BEAT / 2) + 0.2;
    const words = text.split(' ').map((w) => ({ text: w.replace(/\*/g, ''), acc: /\*/.test(w) }));
    lastCaption = caption;
    caption = { at, words, sub: sub || '', from: t };
  }
  const mark = (name) => { section = name; log.marks.push([vnow(), name]); };

  async function demo() {
    await wait(500);
    mark('start');
    say('Meet *YO*', 'a little robot on top of your PC');
    await move({ x: 470, y: 260 }, 500);
    hotkey();
    await wait(1500);

    mark('boop');
    say('Boop it *3 times*');
    const ant = where('.hit-ant');
    await move(ant, 450);
    for (let i = 0; i < 3; i += 1) {
      log.clicks.push([vnow(), pointer.x, pointer.y, 'left']);
      fire(ant.el, 'click');
      await wait(230);
    }
    await wait(1500);

    mark('open');
    say('Open *any app*', 'type a few letters');
    await click('#cmd');
    await type('open spo');
    await wait(700);
    key('Enter', 'Enter', {}, 'Enter');
    await wait(250);
    windowAt = vnow();
    log.whoosh.push(windowAt);
    Y.app.mascot.setMusic(true); // music is playing: YO bops along
    await move({ x: 600, y: 420 }, 700);
    await wait(2000);

    mark('remind');
    say('Ask it to *remind you*');
    await bar();
    await click('#cmd');
    await type('remind me in 10 min to stretch');
    await wait(450);
    key('Enter', 'Enter', {}, 'Enter');
    await wait(1700);
    Y.app.mascot.setMusic(false);

    // "10 minutes later": the page's clock jumps, the reminder fires for real
    mark('later');
    laterAt = vnow();
    await wait(700);
    pendingSkip = 10 * 60 * 1000;
    await wait(900);
    say('It *comes back* on its own');
    await wait(1500);
    hotkey(); // YO's news opens with the shortcut
    await wait(900);
    await click('button', 'close');
    await wait(400);

    mark('habits');
    say('Tick a habit, *YO celebrates*');
    await bar();
    await click('#browse');
    await wait(800);
    await click('.htile', 'Habits');
    await wait(1100);
    await click('.hb-row[data-id="hwater"] .hb-check');
    await wait(2300);
    await click('#aClose');
    await wait(500);

    mark('dress');
    say('Right-click to *dress it up*');
    await click('#hero', null, 'right');
    await wait(700);
    await click('.ctab', 'outfit');
    await wait(250);
    await click('[data-group="hat"][data-value="chechia"]');
    await wait(450);
    await click('[data-group="neck"][data-value="fouta"]');
    await wait(450);
    await click('.ctab', 'body');
    await wait(250);
    await click('[data-group="color"][data-value="sidi"]');
    await wait(900);
    await click('#cDone');
    await wait(900);

    mark('unlock');
    say('Habits *unlock* outfits');
    hotkey();
    await wait(700);
    await click('button', 'try it on');
    await wait(1300);

    mark('dance');
    say('And yes, it *dances*');
    await bar();
    await click('#browse');
    await wait(600);
    await click('.mbtn');
    await wait(3000);
    key('Escape', 'Escape', {}, 'Esc');
    await wait(500);
    mark('end');
    endAt = vnow();
    endYo.react('greet');
    await wait(4300);
    done = true;
  }
  let failed = null;
  demo().catch((err) => { failed = err; console.error(err); done = true; });

  // ---------- the camera: fills the screen with the island, closer where things happen ----------
  const ZOOM = { start: [2.5, 'yo'], boop: [4.2, 'yo'], open: [2.1, 'yo'], remind: [2.1, 'yo'], later: [2.3, 'yo'], habits: [2.4, 'pointer'], dress: [1.6, 'island'], unlock: [2.6, 'island'], dance: [2.6, 'yo'] };
  const cam = { s: 2.5, vx: 0, vy: 0, ready: false };
  function aim() {
    const b = box.getBoundingClientRect();
    const r = document.getElementById('island').getBoundingClientRect();
    const h = document.getElementById('hero').getBoundingClientRect();
    const isl = { x: (r.left - b.left) / cam.s, y: (r.top - b.top) / cam.s, w: r.width / cam.s, h: r.height / cam.s };
    const hero = { x: (h.left + h.width / 2 - b.left) / cam.s, y: (h.top + h.height / 2 - b.top) / cam.s };
    const z = ZOOM[section] || [2, 'island'];
    const fit = clamp((0.94 * MON.w) / Math.max(isl.w, 1), 1.5, 3.2);
    const s = z[1] === 'island' ? fit : Math.max(z[0], fit);
    const vw = MON.w / s;
    const vh = MON.h / s;
    const p = z[1] === 'pointer' ? pointer : z[1] === 'yo' ? { x: hero.x + (section === 'boop' ? 30 : 170), y: hero.y } : { x: isl.x + isl.w / 2, y: 0 };
    const vx = isl.w <= vw ? isl.x + isl.w / 2 - vw / 2 : clamp(p.x - vw / 2, isl.x - 10, isl.x + isl.w + 10 - vw);
    const vy = isl.y + isl.h <= vh * 0.75 ? 0 : clamp(p.y - vh * 0.4, 0, isl.y + isl.h + 20 - vh);
    return { s, vx, vy };
  }
  function moveCamera(dt) {
    const want = aim();
    if (!cam.ready) { Object.assign(cam, want, { ready: true }); return; }
    const k = 1 - Math.exp(-dt * 5);
    ['s', 'vx', 'vy'].forEach((key) => { cam[key] += (want[key] - cam[key]) * k; });
  }

  // ---------- drawing one frame ----------
  function drawCaption(t) {
    const cap = $('#pf-cap');
    const draw = (c, leaving) => {
      const line = document.createElement('div');
      line.className = 'line';
      const chars = c.words.reduce((n, w) => n + w.text.length + 1, 0);
      line.style.fontSize = (chars > 22 ? 78 : 92) + 'px'; // long lines still fit on one line
      c.words.forEach((w, i) => {
        const span2 = document.createElement('span');
        span2.className = 'w' + (w.acc ? ' acc' : '');
        span2.textContent = (i ? ' ' : '') + w.text;
        const k = span(t, c.at + i * (BEAT / 2), c.at + i * (BEAT / 2) + 0.42);
        span2.style.opacity = String(span(t, c.at + i * (BEAT / 2), c.at + i * (BEAT / 2) + 0.1));
        span2.style.transform = 'translateY(' + ((1 - back(k)) * 60).toFixed(1) + 'px) scale(' + (0.7 + 0.3 * back(k)).toFixed(3) + ')';
        line.appendChild(span2);
      });
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = c.sub;
      const sk = out3(span(t, c.at + c.words.length * (BEAT / 2), c.at + c.words.length * (BEAT / 2) + 0.4));
      sub.style.opacity = String(sk);
      sub.style.transform = 'translateY(' + ((1 - sk) * 20).toFixed(1) + 'px)';
      const wrap = document.createElement('div');
      wrap.append(line, sub);
      if (leaving) {
        const k = out3(span(t, caption.at - 0.05, caption.at + 0.25));
        wrap.style.opacity = String(1 - k);
        wrap.style.transform = 'translateX(' + (-k * 160).toFixed(1) + 'px)';
        wrap.style.position = 'absolute';
        wrap.style.inset = '0';
      }
      return wrap;
    };
    const parts = [];
    if (lastCaption && caption && t < caption.at + 0.25) parts.push(draw(lastCaption, true));
    if (caption && t >= caption.at - 0.01) parts.push(draw(caption, false));
    cap.replaceChildren(...parts);
    cap.style.opacity = String(1 - span(t, endAt - 0.4, endAt));
  }

  function draw(t, dt) {
    moveCamera(dt);
    box.style.transform = 'translate(' + (-cam.vx * cam.s).toFixed(2) + 'px,' + (-cam.vy * cam.s).toFixed(2) + 'px) scale(' + cam.s.toFixed(4) + ')';

    // the screen settles in at the start
    const intro = out3(span(t, 0, 0.9));
    const mon = $('#pf-monitor');
    const e = out3(span(t, endAt, endAt + 0.6));
    mon.style.transform = 'perspective(1800px) rotateX(' + ((1 - intro) * 18).toFixed(2) + 'deg) translateY(' + ((1 - intro) * 80 + e * 120).toFixed(1) + 'px) scale(' + (0.94 + intro * 0.06 - e * 0.1).toFixed(4) + ')';
    mon.style.opacity = String(intro * (1 - e));

    // the theme's glow, and a color per part for "blocks"
    if (THEME === 'blocks') pf.style.setProperty('--pf-bg', BLOCKS[t >= endAt ? 'end' : section] || BLOCKS.start);
    const gy = 400 + 260;
    $('#pf-glow').style.background = 'radial-gradient(1000px 800px at 540px ' + gy + 'px, var(--pf-glow), transparent 70%)';

    // pointer, ring
    const c = { x: (pointer.x - cam.vx) * cam.s, y: (pointer.y - cam.vy) * cam.s };
    $('#pf-cursor').style.transform = 'translate(' + (c.x - 3).toFixed(1) + 'px,' + (c.y - 3).toFixed(1) + 'px) scale(' + (0.8 + cam.s * 0.14).toFixed(3) + ')';
    const last = log.clicks.filter((k) => k[0] <= t).pop();
    const ring = $('#pf-ring');
    if (last && t - last[0] < 0.45) {
      const k = out3(span(t - last[0], 0, 0.45));
      const r = (12 + 40 * k) * (0.6 + cam.s * 0.2);
      const q = { x: (last[1] - cam.vx) * cam.s, y: (last[2] - cam.vy) * cam.s };
      ring.style.cssText = 'left:' + (q.x - r) + 'px;top:' + (q.y - r) + 'px;width:' + 2 * r + 'px;height:' + 2 * r + 'px;opacity:' + (0.95 * (1 - k)).toFixed(3);
    } else {
      ring.style.opacity = '0';
    }

    // the app window YO opened
    const win = $('#pf-win');
    if (windowAt >= 0) {
      const k = span(t, windowAt, windowAt + 0.55);
      const gone = laterAt >= 0 ? span(t, laterAt + 0.3, laterAt + 0.6) : 0;
      win.style.opacity = String(span(t, windowAt, windowAt + 0.12) * (1 - gone));
      win.style.transform = 'translateY(' + ((1 - out3(k)) * -260).toFixed(1) + 'px) scale(' + (0.25 + 0.75 * back(k)).toFixed(3) + ')';
      win.style.transformOrigin = '50% 0';
      win.querySelector('.prog i').style.width = (30 + (t - windowAt) * 2.2).toFixed(1) + '%';
      $('#pf-taskbar .music').style.display = '';
    }

    // keys
    const keyNow = log.keys.filter((k) => k[1] && k[0] <= t && t - k[0] < 1.2).pop();
    const keys = $('#pf-keys');
    if (keyNow) {
      if (keys.dataset.at !== String(keyNow[0])) {
        keys.dataset.at = String(keyNow[0]);
        keys.innerHTML = keyNow[1].split(' + ').map((k) => '<span class="cap">' + k + '</span>').join('<span class="plus">+</span>');
      }
      const age = t - keyNow[0];
      keys.style.opacity = String(span(age, 0, 0.1) * (1 - span(age, 0.9, 1.2)));
      keys.style.transform = 'translateY(' + ((1 - back(span(age, 0, 0.35))) * 40).toFixed(1) + 'px)';
    } else {
      keys.style.opacity = '0';
    }

    // "10 minutes later…"
    const later = $('#pf-later');
    later.style.opacity = laterAt >= 0 ? String(span(t, laterAt, laterAt + 0.25) * (1 - span(t, laterAt + 1.35, laterAt + 1.6))) : '0';

    drawCaption(t);

    // the end card
    const end = $('#pf-end');
    end.style.opacity = String(span(t, endAt + 0.2, endAt + 0.5));
    const yk = back(span(t, endAt + 0.2, endAt + 0.75));
    end.querySelector('.yo').style.transform = 'translateY(' + ((1 - yk) * 300).toFixed(1) + 'px)';
    [['.word', 0.5], ['.free', 0.8], ['.cta', 1.15]].forEach(([sel, d]) => {
      const el = end.querySelector(sel);
      const k = span(t, endAt + d, endAt + d + 0.5);
      el.style.opacity = String(span(t, endAt + d, endAt + d + 0.15));
      el.style.transform = 'translateY(' + ((1 - back(k)) * 50).toFixed(1) + 'px)';
    });
  }

  // ---------- the renderer's side ----------
  let lastT = 0;
  let shown = 0;
  async function step(t, n) {
    if (pendingSkip) {
      skipAt = clock.now() / 1000;
      skipMs += pendingSkip;
      await clock.tick(clock.now() + pendingSkip, true);
      pendingSkip = 0;
    }
    await clock.tick(t * 1000 + skipMs);
    draw(t, t - lastT);
    lastT = t;
    shown = n;
    half(0);
    if (failed) throw failed;
  }
  function half(h) {
    pf.style.transform = h ? 'translateY(-960px)' : '';
    pf.querySelectorAll('.pf-marker').forEach((m) => { m.style.background = 'rgb(' + (shown & 255) + ',' + ((shown >> 8) * 32) + ',' + h * 128 + ')'; });
  }

  // the sound: YO's real sounds at the times they played, clicks, keys, the window, and the band
  async function audio(duration) {
    const sr = 48000;
    const c = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.ratio.value = 8;
    const master = c.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(1.8, 0.3);
    master.gain.setValueAtTime(1.8, duration - 0.9);
    master.gain.linearRampToValueAtTime(0, duration);
    master.connect(limiter); limiter.connect(c.destination);
    let at = 0;
    const live = new Proxy(c, {
      get(target, prop) {
        if (prop === 'currentTime') return at;
        if (prop === 'state') return 'running';
        if (prop === 'resume') return () => Promise.resolve();
        if (prop === 'destination') return master;
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    window.AudioContext = function () { return live; };
    Y.sound.setVoice('robot');
    Y.sound.setVolume(3);
    const play = Y.sound.realPlay;
    // sounds were written in page time: the "later" jump is taken out
    const later = log.marks.find((m) => m[1] === 'later');
    window.__sfx.forEach(([time, name]) => {
      // during the jump YO came and went many times in a blink: keep only the reminder itself
      const inJump = time > skipAt && time < skipAt + skipMs / 1000;
      if (inJump && !/alarm|chime|knock|remind|arrive/.test(name)) return;
      const v = inJump ? skipAt : time > skipAt ? time - skipMs / 1000 : time;
      if (v >= 0 && v < duration) { at = v; play(name); }
    });
    const ui = c.createGain(); ui.gain.value = 0.6; ui.connect(master);
    log.clicks.forEach(([time]) => Band.tone(c, ui, { type: 'sine', f0: 2400, f1: 1700, at: time, dur: 0.012, vol: 0.12 }));
    log.keys.forEach(([time]) => Band.tone(c, ui, { type: 'triangle', f0: 900, f1: 700, at: time, dur: 0.02, vol: 0.08 }));
    log.whoosh.forEach((time) => Band.tone(c, ui, { type: 'sine', f0: 300, f1: 1100, at: time, dur: 0.3, vol: 0.18 }));

    // the band: softer under the talking parts, up when the music app opens
    const band = c.createGain();
    band.gain.setValueAtTime(0.3, 0);
    if (windowAt >= 0) {
      band.gain.setValueAtTime(0.3, windowAt);
      band.gain.linearRampToValueAtTime(0.75, windowAt + 0.3);
      if (later) {
        band.gain.setValueAtTime(0.75, later[0]);
        band.gain.linearRampToValueAtTime(0.0, later[0] + 0.3);
        band.gain.setValueAtTime(0.0, later[0] + 1.5);
        band.gain.linearRampToValueAtTime(0.3, later[0] + 2.0);
      }
    }
    if (Number.isFinite(endAt)) {
      band.gain.setValueAtTime(0.3, endAt);
      band.gain.linearRampToValueAtTime(0.6, endAt + 0.4);
    }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800;
    band.connect(lp); lp.connect(master);
    Band.play(c, band, 0.2, duration, BPM);
    const buf = await c.startRendering();
    return Band.wav(buf);
  }

  window.__scene = {
    FPS,
    get DUR() { return Number.isFinite(endAt) ? endAt + 4.6 : 60; },
    get done() { return done; },
    step,
    half,
    audio: () => audio(window.__scene.DUR),
  };
})();
