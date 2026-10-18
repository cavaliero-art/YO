// Runs before YO's real page in the "live" reel (render.js --scene live), in the page's own world.
// It gives the page the video's clock instead of the real one: timers, animation frames, Date,
// performance.now and the CSS animations all move only when the renderer steps the video.
// YO's sounds are written down with their time instead of played; the reel's sound is made from that.
(() => {
  'use strict';

  const RealDate = Date;
  const realSetTimeout = setTimeout;
  const startedAt = RealDate.now();
  let vt = 0; // the page's time, in ms since the video started

  // ---------- timers ----------
  const timers = new Map();
  let nextId = 1;
  window.setTimeout = (fn, ms, ...args) => {
    const id = nextId++;
    timers.set(id, { at: vt + Math.max(0, Number(ms) || 0), fn, args, every: 0, order: id });
    return id;
  };
  window.setInterval = (fn, ms, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: vt + every, fn, args, every, order: id });
    return id;
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = window.clearTimeout;

  let frames = [];
  window.requestAnimationFrame = (cb) => { const id = nextId++; frames.push([id, cb]); return id; };
  window.cancelAnimationFrame = (id) => { frames = frames.filter((f) => f[0] !== id); };

  performance.now = () => vt;
  class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(startedAt + vt);
    }
    static now() { return startedAt + vt; }
  }
  window.Date = VirtualDate;

  // ---------- CSS animations and transitions: held still, then placed at the video's time ----------
  const born = new WeakMap();
  function placeAnimations() {
    document.getAnimations().forEach((a) => {
      if (!born.has(a)) {
        born.set(a, vt);
        a.pause();
      }
      const local = vt - born.get(a);
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(end) && local >= end) a.finish(); // fires its end events, like a real one
      else a.currentTime = local;
    });
  }

  // run the timers that are due, in order (a timer can add more)
  function runTimers(until) {
    for (let guard = 0; guard < 20000; guard += 1) { // a timer that keeps re-arming itself at 0 ms can't hang the video
      let due = null;
      timers.forEach((t, id) => {
        if (t.at <= until && (!due || t.at < due.t.at || (t.at === due.t.at && t.order < due.t.order))) due = { id, t };
      });
      if (!due) return;
      vt = Math.max(vt, due.t.at);
      if (due.t.every) due.t.at += due.t.every;
      else timers.delete(due.id);
      try { due.t.fn(...due.t.args); } catch (err) { console.error(err); }
    }
  }

  // move the page's time to `ms`, in 60 fps steps (a jump only runs the timers: "10 minutes later")
  async function tick(ms, jump) {
    const settle = () => new Promise((done) => realSetTimeout(done, 0)); // let promises finish
    if (jump) {
      runTimers(ms);
      vt = ms;
      await settle();
    }
    while (vt < ms - 0.01) {
      const next = Math.min(ms, vt + 1000 / 60);
      runTimers(next);
      vt = next;
      const run = frames;
      frames = [];
      run.forEach(([, cb]) => { try { cb(vt); } catch (err) { console.error(err); } });
      await settle();
    }
    placeAnimations();
  }

  // ---------- sounds, written down ----------
  window.__sfx = [];
  const Yo = {};
  let sound = null;
  Object.defineProperty(Yo, 'sound', {
    configurable: true,
    enumerable: true,
    get: () => sound,
    set(v) {
      sound = v;
      v.realPlay = v.play;
      v.play = (name) => { window.__sfx.push([vt / 1000, name]); };
      v.ambient = () => {};
    },
  });
  // the demo agent (no main process here) words things as a demo; the reel uses the real app's words
  const REAL_WORDS = { openDone: 'Opening {arg}' };
  let i18n = null;
  Object.defineProperty(Yo, 'i18n', {
    configurable: true,
    enumerable: true,
    get: () => i18n,
    set(v) {
      i18n = v;
      const t = v.t;
      v.t = (key) => (REAL_WORDS[key] !== undefined ? REAL_WORDS[key] : t(key));
    },
  });
  window.Yo = Yo;

  // the same "random" every render
  let seed = 20261018;
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  window.__clock = { tick, now: () => vt, wait: (ms) => new Promise((done) => window.setTimeout(done, ms)) };
})();
