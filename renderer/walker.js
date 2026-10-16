(function (Y) {
  'use strict';

  // YO on the taskbar. It walks somewhere, stops to look around, naps now and then,
  // waves when your pointer comes close, and wakes up when you come by.
  // Hold it to pet it, boop its antenna, double-click it to open the pill.
  const api = window.yo || { setHitRect() {}, onCursor() {}, onWalker() {}, summon() {} };
  const SIZE = 64;
  const SPEED = 46; // pixels per second
  const NEAR = 140; // pointer this close: YO notices you
  const WAVE_EVERY = 20000;
  const PET_MS = 380;

  const buddy = document.getElementById('buddy');
  const flip = document.getElementById('flip');
  const face = Y.mascot.mount(flip, SIZE);

  // same look and sound as the pill (same storage); changes in Customize show up live
  let prefs = {};
  function applyPrefs() {
    try { prefs = JSON.parse(localStorage.getItem('yo.prefs') || '{}'); } catch (err) { prefs = {}; }
    face.setLook(Y.mascot.lookFor(prefs));
    Y.sound.setEnabled(prefs.sound !== false);
    Y.sound.setVoice(prefs.voice || 'robot');
    Y.sound.setVolume(typeof prefs.volume === 'number' ? prefs.volume : 2);
  }
  window.addEventListener('storage', (event) => { if (event.key === 'yo.prefs') applyPrefs(); });
  applyPrefs();

  let x = 120;
  let dir = 1;
  let target = 0;
  let mode = 'idle'; // walk, idle, sleep
  let until = 0;
  let active = false;
  let raf = 0;
  let last = 0;
  let lastWave = -WAVE_EVERY;
  let near = false;
  let lastHit = '';

  const maxX = () => Math.max(0, window.innerWidth - buddy.offsetWidth);

  function setMode(next, now) {
    if (mode === 'sleep' && next !== 'sleep') face.react('wake');
    mode = next;
    face.setWalking(next === 'walk');
    if (next === 'walk') {
      target = 30 + Math.random() * (maxX() - 60);
      dir = target > x ? 1 : -1;
    } else if (next === 'idle') {
      until = now + 2500 + Math.random() * 4500;
    } else if (next === 'sleep') {
      until = now + 15000 + Math.random() * 20000;
      face.react('sleep');
    }
  }

  // what to do next: mostly walk, sometimes rest, now and then a nap
  function decide(now) {
    const r = Math.random();
    setMode(r < 0.55 ? 'walk' : r < 0.88 ? 'idle' : 'sleep', now);
  }

  function reportHit() {
    const r = buddy.getBoundingClientRect();
    const rect = active ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
    const key = rect ? Math.round(rect.x / 3) + ',' + rect.y : 'none';
    if (key === lastHit) return;
    lastHit = key;
    api.setHitRect(rect);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (mode === 'walk') {
      x += dir * SPEED * dt;
      if ((dir > 0 && x >= target) || (dir < 0 && x <= target)) {
        x = target;
        setMode('idle', now);
      }
    } else if (now > until) {
      decide(now);
    }
    x = Math.min(Math.max(x, 0), maxX());
    buddy.style.transform = 'translateX(' + Math.round(x) + 'px)';
    flip.style.transform = 'scaleX(' + dir + ')';
    reportHit();
  }

  function start() {
    if (active) return;
    active = true;
    x = Math.random() * maxX();
    face.setActive(true);
    face.react('land');
    last = 0;
    setMode('idle', performance.now());
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    face.setWalking(false);
    face.setActive(false);
    face.reset();
    mode = 'idle';
    reportHit();
  }

  api.onWalker((state) => (state && state.active ? start() : stop()));

  // the pointer: eyes follow it; coming close wakes YO up or gets a wave
  api.onCursor((point) => {
    if (!active) return;
    const r = buddy.getBoundingClientRect();
    const dx = point.x - (r.left + r.width / 2);
    const dy = point.y - (r.top + r.height / 2);
    face.lookAt(dx * dir, dy);
    const close = Math.hypot(dx, dy) < NEAR;
    if (close && !near) {
      const now = performance.now();
      if (mode === 'sleep') setMode('idle', now);
      else if (now - lastWave > WAVE_EVERY) {
        lastWave = now;
        setMode('idle', now);
        dir = dx >= 0 ? 1 : -1;
        face.react('wave');
      }
    }
    near = close;
  });

  // hold to pet, boop the antenna, double-click to open the pill
  let petTimer = null;
  let petting = false;
  let skipClick = false;
  buddy.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    skipClick = false;
    clearTimeout(petTimer);
    petTimer = setTimeout(() => {
      petting = true;
      skipClick = true;
      if (mode === 'walk') setMode('idle', performance.now());
      face.pet(true);
      Y.sound.play('pet');
    }, PET_MS);
  });
  const stopPet = () => {
    clearTimeout(petTimer);
    if (!petting) return;
    petting = false;
    face.pet(false);
  };
  buddy.addEventListener('pointerup', stopPet);
  buddy.addEventListener('pointerleave', stopPet);
  buddy.addEventListener('click', (event) => {
    if (skipClick) { skipClick = false; return; }
    if (mode === 'walk' || mode === 'sleep') setMode('idle', performance.now());
    if (event.target.closest && event.target.closest('.hit-ant')) {
      Y.sound.play(face.boop() ? 'dizzy' : 'boop');
    } else {
      face.react('equip');
      Y.sound.play('arrive');
    }
  });
  buddy.addEventListener('dblclick', () => api.summon());

  // a plain browser (no Electron): just walk, for trying it out
  if (!window.yo) start();
})((window.Yo = window.Yo || {}));
