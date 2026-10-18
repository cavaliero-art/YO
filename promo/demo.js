// The demo reel: the real YO, filmed by promo/film.js, edited here frame by frame.
// render.js hands over the film's timeline (load), then steps the clock; every frame is a function of t
// and of the frames before it (the camera glides).
(function () {
  'use strict';

  const FPS = 30;
  const END = 3.6; // seconds of end card after YO says bye
  const MON = { w: 1000, h: 1120 };
  const $ = (sel) => document.querySelector(sel);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const out3 = (k) => 1 - Math.pow(1 - k, 3);
  const back = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  // what to say over each part of the film (by the marks film.js left)
  const CAPTIONS = {
    start: ['This is YO', 'a little robot that lives on top of your PC'],
    call: ['Ctrl + Space', 'calls it from anywhere'],
    eyes: ['It watches your mouse', ''],
    boop: ['Boop its antenna', 'three times…'],
    pet: ['Hold to pet it', ''],
    type: ['Ask a quick question', 'math, units, colors…'],
    home: ['8 mini apps, one click', ''],
    habits: ['Habits', 'anchored on prayer times'],
    tick: ['Tick one, YO celebrates', ''],
    prayer: ['Prayer times', 'for your city, offline'],
    focus: ['A focus timer', 'with rain or deep sounds'],
    dress: ['Right-click to dress it up', 'chechia, fouta, Sidi Bou Said…'],
    unlock: ['Your habits unlock outfits', ''],
    dance: ['And yes, it dances', ''],
  };
  // how close the camera comes for each part, and what it follows (YO itself, or the pointer)
  const ZOOM = {
    call: [2.4, 'yo'], eyes: [3.4, 'yo'], boop: [4.2, 'yo'], pet: [4.2, 'yo'], type: [2.6, 'yo'],
    tick: [2.5, 'pointer'], dress: [2.1, 'pointer'], dance: [2.6, 'yo'],
  };

  let tl = null;
  let marks = [];
  let duration = 0;

  function load(timeline) {
    tl = timeline;
    marks = [[0, 'start']].concat(tl.marks);
    const bye = (marks.find((m) => m[1] === 'bye') || [tl.duration])[0];
    duration = Math.max(tl.duration, bye + 1.4) + END;
    return { duration, fps: FPS };
  }
  const markAt = (t) => { let m = marks[0]; marks.forEach((x) => { if (x[0] <= t) m = x; }); return m; };
  const markTime = (name) => (marks.find((m) => m[1] === name) || [Infinity])[0];

  // a sample of a timeline list ([t, ...values]) at t, the last one before it
  function sample(list, t) {
    let lo = 0;
    let hi = list.length - 1;
    if (!list.length) return null;
    if (t <= list[0][0]) return list[0];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid][0] <= t) lo = mid; else hi = mid - 1;
    }
    return list[lo];
  }
  // the pointer moves in small steps: blend between two of them
  function cursorAt(t) {
    const c = tl.cursor;
    if (!c.length) return { x: 600, y: 420 };
    if (t <= c[0][0]) return { x: c[0][1], y: c[0][2] };
    for (let i = 1; i < c.length; i += 1) {
      if (c[i][0] >= t) {
        const k = clamp((t - c[i - 1][0]) / Math.max(1e-3, c[i][0] - c[i - 1][0]));
        return { x: c[i - 1][1] + (c[i][1] - c[i - 1][1]) * k, y: c[i - 1][2] + (c[i][2] - c[i - 1][2]) * k };
      }
    }
    const l = c[c.length - 1];
    return { x: l[1], y: l[2] };
  }

  // ---------- the camera: fills the screen with the island, and comes closer where things happen ----------
  // it looks at a view of the filmed window: top-left (vx, vy), s screen pixels per window pixel
  const cam = { s: 2, vx: 0, vy: 0, ready: false };
  function aim(t) {
    const [, ix, iy, iw, ih, hx, hy] = sample(tl.island, t) || [0, 199, 0, 322, 76, 360, 38];
    const m = markAt(t)[1];
    const zoom = ZOOM[m];
    const fit = clamp((0.94 * MON.w) / Math.max(iw, 1), 1.5, 3.1);
    const s = zoom ? Math.max(zoom[0], fit) : fit;
    const vw = MON.w / s;
    const vh = MON.h / s;
    const p = zoom && zoom[1] === 'pointer' ? cursorAt(t) : zoom ? { x: hx + (m === 'dance' || m === 'type' || m === 'call' ? 150 : 60), y: hy } : { x: ix + iw / 2, y: 0 };
    // keep the view on the island: centered on it when it fits, following the point when it doesn't
    const vx = iw <= vw ? ix + iw / 2 - vw / 2 : clamp(p.x - vw / 2, ix - 10, ix + iw + 10 - vw);
    const bottom = iy + ih;
    const vy = bottom <= vh * 0.9 ? 0 : clamp(p.y - vh * 0.4, 0, bottom + 20 - vh);
    return { s, vx, vy };
  }
  function moveCamera(t, dt) {
    const want = aim(t);
    if (!cam.ready) { Object.assign(cam, want, { ready: true }); return; }
    const k = 1 - Math.exp(-dt * 4); // glide: about a third of a second to settle
    ['s', 'vx', 'vy'].forEach((key) => { cam[key] += (want[key] - cam[key]) * k; });
  }
  // a point of the filmed window -> the screen
  const toScreen = (x, y) => ({ x: (x - cam.vx) * cam.s, y: (y - cam.vy) * cam.s });

  // ---------- one frame ----------
  const img = $('#app');
  let shownFile = '';
  let lastT = 0;
  let shown = 0;

  async function step(t, n) {
    const film = Math.min(t, tl.duration - 1 / FPS);
    const file = tl.frames[Math.max(0, Math.min(tl.frames.length - 1, Math.floor(film * FPS)))];
    if (file !== shownFile) {
      shownFile = file;
      img.src = 'out/film/' + file;
      await img.decode();
    }
    moveCamera(film, t - lastT);
    lastT = t;
    img.style.transform = 'translate(' + (-cam.vx * cam.s).toFixed(2) + 'px, ' + (-cam.vy * cam.s).toFixed(2) + 'px) scale(' + cam.s.toFixed(4) + ')';

    // the pointer (a bit bigger when the camera is close) and its clicks
    const p = toScreen(cursorAt(film).x, cursorAt(film).y);
    const cur = $('#cursor');
    cur.style.transform = 'translate(' + (p.x - 3).toFixed(1) + 'px, ' + (p.y - 3).toFixed(1) + 'px) scale(' + (0.75 + cam.s * 0.15).toFixed(3) + ')';
    cur.style.transformOrigin = '3px 3px';
    const click = tl.clicks.filter((c) => c[0] <= film).pop();
    const rip = $('#ripple');
    if (click) {
      const held = click[3] === 'hold' ? 1.9 : 0;
      const age = film - click[0];
      const k = held && age < held ? (age % 0.6) / 0.6 : span(age, 0, 0.45);
      const live = held ? age < held + 0.45 : age < 0.45;
      const r = (10 + 34 * out3(k)) * (0.6 + cam.s * 0.2);
      const q = toScreen(click[1], click[2]);
      rip.style.opacity = live ? String(0.9 * (1 - k)) : '0';
      rip.style.left = q.x + 'px';
      rip.style.top = q.y + 'px';
      rip.style.width = rip.style.height = (r * 2) + 'px';
      rip.style.margin = (-r) + 'px 0 0 ' + (-r) + 'px';
      rip.style.boxShadow = '0 0 0 4px ' + (click[3] === 'right' ? 'rgba(159,225,203,.95)' : 'rgba(255,255,255,.85)');
    } else {
      rip.style.opacity = '0';
    }

    // keys pressed, as keycaps under the screen
    const key = tl.keys.filter((k) => k[0] <= film && film - k[0] < 1.4).pop();
    const keys = $('#keys');
    if (key) {
      if (keys.dataset.at !== String(key[0])) {
        keys.dataset.at = String(key[0]);
        keys.innerHTML = key[1].split(' + ').map((k) => '<span class="cap">' + k + '</span>').join('<span class="plus">+</span>');
      }
      const age = film - key[0];
      keys.style.opacity = String(span(age, 0, 0.12) * (1 - span(age, 1.1, 1.4)));
      keys.style.transform = 'translateY(' + ((1 - back(span(age, 0, 0.35))) * 30).toFixed(1) + 'px) scale(' + (age < 0.15 ? 0.94 : 1) + ')';
    } else {
      keys.style.opacity = '0';
    }

    // the caption for this part
    const [mt, name] = markAt(film);
    const cap = CAPTIONS[name];
    const caps = $('#captions');
    const bye = markTime('bye');
    if (cap && film < bye) {
      if (caps.dataset.name !== name) {
        caps.dataset.name = name;
        caps.querySelector('.title').textContent = cap[0];
        caps.querySelector('.sub').textContent = cap[1];
      }
      const k = out3(span(film, mt, mt + 0.45));
      caps.style.opacity = String(k);
      caps.style.transform = 'translateY(' + ((1 - k) * 34).toFixed(1) + 'px)';
      caps.style.filter = k < 1 ? 'blur(' + ((1 - k) * 6).toFixed(1) + 'px)' : '';
    } else {
      caps.style.opacity = String(1 - span(film, bye, bye + 0.3));
    }

    // the glow behind the screen, and the end card
    const endAt = bye + 1.1;
    const e = out3(span(t, endAt, endAt + 0.6));
    $('#glow').style.background = 'radial-gradient(900px 700px at 540px ' + (900 - e * 0) + 'px, rgba(79,127,224,' + (0.16 + e * 0.1).toFixed(3) + '), transparent 72%)';
    const mon = $('#monitor');
    mon.style.opacity = String(1 - e * 0.85);
    mon.style.transform = 'scale(' + (1 - e * 0.06) + ')';
    const end = $('#end');
    end.style.opacity = t > endAt ? '1' : '0';
    [['.word', endAt + 0.1], ['.free', endAt + 0.45], ['.cta', endAt + 0.85]].forEach(([sel, at]) => {
      const el = end.querySelector(sel);
      el.style.opacity = String(span(t, at, at + 0.2));
      el.style.transform = 'translateY(' + ((1 - back(span(t, at, at + 0.5))) * 50).toFixed(1) + 'px)';
    });

    shown = n;
    half(0);
  }

  // the renderer takes each frame in two halves: this slides the frame up to show the bottom one
  function half(h) {
    $('#frame').style.transform = h ? 'translateY(-960px)' : '';
    document.querySelectorAll('.marker').forEach((m) => { m.style.background = 'rgb(' + (shown & 255) + ',' + ((shown >> 8) * 32) + ',' + h * 128 + ')'; });
  }

  // ---------- sound: YO's real sounds at the times they played, the clicks, and the band ----------
  async function audio() {
    const sr = 48000;
    const c = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.ratio.value = 8;
    const master = c.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(2, 0.3); // +6 dB: YO's own sounds are quiet by design
    master.gain.setValueAtTime(2, duration - 0.9);
    master.gain.linearRampToValueAtTime(0, duration);
    master.connect(limiter); limiter.connect(c.destination);

    // renderer/sound.js plays into this context as if it were live, at the time we set
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
    Yo.sound.setVoice('robot');
    Yo.sound.setVolume(3);
    tl.sfx.forEach(([time, name]) => { at = time; Yo.sound.play(name); });

    // a soft click for every click, a tap for every key
    const ui = c.createGain(); ui.gain.value = 0.6; ui.connect(master);
    tl.clicks.forEach(([time]) => Band.tone(c, ui, { type: 'sine', f0: 2400, f1: 1700, at: time, dur: 0.012, vol: 0.12 }));
    tl.keys.forEach(([time]) => Band.tone(c, ui, { type: 'triangle', f0: 900, f1: 700, at: time, dur: 0.02, vol: 0.1 }));

    // the band, quieter than in the first reel: YO is the voice here; it steps out for prayer
    const band = c.createGain();
    const pray = markTime('prayer');
    const focus = markTime('focus');
    band.gain.setValueAtTime(0.28, 0);
    if (Number.isFinite(pray)) {
      band.gain.setValueAtTime(0.28, pray + 0.4);
      band.gain.linearRampToValueAtTime(0, pray + 1.0);
      band.gain.setValueAtTime(0, focus);
      band.gain.linearRampToValueAtTime(0.28, focus + 0.6);
    }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
    band.connect(lp); lp.connect(master);
    Band.play(c, band, 0.2, duration);

    const buf = await c.startRendering();
    return Band.wav(buf);
  }

  window.__scene = { FPS, load, step, half, audio, get DUR() { return duration; } };
})();
