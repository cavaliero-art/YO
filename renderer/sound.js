(function (Y) {
  'use strict';

  // YO's sounds, made in code with Web Audio: no audio files.
  // Three voices built from the same score:
  //   robot: little chirps that glide (YO's own voice)
  //   soft:  round sine tones, slower and calmer
  //   retro: 8-bit square waves that step instead of gliding
  // Every sound has a few variants and a small random pitch change, so it never repeats exactly.
  // Quiet by design, and never on every keypress.
  const VOLUMES = [0, 0.08, 0.15, 0.24]; // off, low, mid, high
  const VOICES = ['robot', 'soft', 'retro'];
  let ctx = null;
  let out = null;
  let enabled = true;
  let voice = 'robot';
  let volume = 2;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = VOLUMES[volume];
      const limiter = ctx.createDynamicsCompressor();
      out.connect(limiter);
      limiter.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // one note: an oscillator from f0 to f1, with a short attack and a fade out
  function note(c, { type = 'triangle', f0, f1 = f0, at = 0, dur = 0.12, vol = 0.4, vib = 0, vibRate = 9, glide = true }) {
    const t0 = c.currentTime + 0.01 + at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      if (glide) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      else osc.frequency.setValueAtTime(f1, t0 + dur / 2); // retro: one step, no glide
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    if (vib) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = vibRate;
      depth.gain.value = vib;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.1);
    }
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  // the score: each sound is a list of variants; each variant a list of notes
  // [f0, f1, at, dur, vol, type?, vib?]  (type: 's' sine, 't' triangle)
  const SCORE = {
    // YO's voice
    hello: [
      [[620, 940, 0, 0.07, 0.4], [880, 1250, 0.09, 0.07, 0.4], [1180, 1700, 0.18, 0.12, 0.4, 't', 40]],
      [[700, 1100, 0, 0.06, 0.4], [1100, 820, 0.08, 0.06, 0.38], [900, 1500, 0.16, 0.13, 0.4, 't', 30]],
    ],
    arrive: [
      [[700, 1050, 0, 0.06, 0.28], [1000, 1400, 0.07, 0.07, 0.28]],
      [[900, 1320, 0, 0.08, 0.28]],
      [[650, 900, 0, 0.05, 0.26], [900, 760, 0.06, 0.05, 0.24], [760, 1200, 0.12, 0.07, 0.26]],
      [[1100, 1500, 0, 0.05, 0.24], [1250, 1250, 0.07, 0.05, 0.22]],
    ],
    open: [[[520, 820, 0, 0.06, 0.18]], [[600, 900, 0, 0.05, 0.16]]],
    close: [[[820, 520, 0, 0.06, 0.16]], [[900, 600, 0, 0.05, 0.14]]],
    leave: [[[900, 420, 0, 0.12, 0.12, 's']]],
    drawer: [[[600, 900, 0, 0.05, 0.16], [900, 1200, 0.05, 0.05, 0.14]]],
    tick: [[[1500, 1500, 0, 0.022, 0.07, 's']], [[1650, 1650, 0, 0.022, 0.07, 's']]],
    equip: [
      [[880, 1320, 0, 0.06, 0.25], [1320, 1760, 0.07, 0.08, 0.25], [2093, 2093, 0.15, 0.18, 0.1, 's']],
      [[990, 1480, 0, 0.06, 0.25], [1480, 1980, 0.07, 0.08, 0.25], [2349, 2349, 0.15, 0.18, 0.1, 's']],
    ],
    boop: [
      [[260, 820, 0, 0.16, 0.5, 's', 70]],
      [[300, 950, 0, 0.14, 0.5, 's', 80]],
      [[240, 700, 0, 0.18, 0.5, 's', 60]],
    ],
    dizzy: [[[1100, 260, 0, 0.6, 0.38, 't', 90]]],
    gulp: [
      [[320, 160, 0, 0.09, 0.45, 's'], [520, 900, 0.11, 0.07, 0.3]],
      [[360, 180, 0, 0.08, 0.45, 's'], [600, 1000, 0.1, 0.07, 0.3]],
    ],
    unlock: [[[784, 784, 0, 0.12, 0.28, 's'], [988, 988, 0.1, 0.12, 0.28, 's'], [1175, 1175, 0.2, 0.12, 0.28, 's'],
      [1568, 1568, 0.3, 0.3, 0.3, 's'], [2093, 2093, 0.3, 0.4, 0.08, 's']]],
    pet: [
      [[520, 400, 0, 0.22, 0.38, 's'], [600, 470, 0.2, 0.24, 0.32, 's']],
      [[480, 620, 0, 0.18, 0.35, 's'], [620, 440, 0.18, 0.26, 0.3, 's']],
    ],
    snore: [[[190, 150, 0, 0.7, 0.1, 's', 6]]],
    yawn: [[[420, 720, 0, 0.18, 0.25], [720, 360, 0.18, 0.38, 0.22]]],
    cancel: [
      [[620, 420, 0, 0.12, 0.35], [440, 300, 0.13, 0.16, 0.3]],
      [[560, 380, 0, 0.16, 0.34]],
    ],
    info: [
      [[520, 760, 0, 0.1, 0.35], [760, 620, 0.12, 0.1, 0.3]],
      [[600, 600, 0, 0.07, 0.3], [600, 860, 0.09, 0.1, 0.32]],
    ],
    error: [[[400, 300, 0, 0.14, 0.4], [300, 200, 0.15, 0.2, 0.4]]],
    // system feedback
    success: [
      [[784, 784, 0, 0.22, 0.3, 's'], [988, 988, 0.07, 0.22, 0.3, 's'], [1319, 1319, 0.14, 0.22, 0.3, 's']],
      [[880, 880, 0, 0.2, 0.3, 's'], [1109, 1109, 0.07, 0.2, 0.3, 's'], [1319, 1319, 0.14, 0.24, 0.3, 's']],
      [[698, 698, 0, 0.2, 0.3, 's'], [1047, 1047, 0.09, 0.26, 0.3, 's']],
    ],
    set: [[[1200, 1200, 0, 0.03, 0.22, 's'], [900, 900, 0.14, 0.03, 0.22, 's'], [1200, 1200, 0.28, 0.03, 0.18, 's']]],
    knock: [[[300, 180, 0, 0.07, 0.5, 's'], [300, 180, 0.14, 0.07, 0.5, 's'], [620, 940, 0.3, 0.12, 0.25]]],
    chime: [[[1319, 1319, 0, 1.0, 0.3, 's'], [2637, 2637, 0, 0.6, 0.08, 's'], [1047, 1047, 0.28, 1.1, 0.26, 's'], [2093, 2093, 0.28, 0.6, 0.07, 's']]],
    alarm: [[0, 0.22, 0.44, 0.66].flatMap((at) => [[1568, 1568, at, 0.1, 0.3, 's'], [1319, 1319, at + 0.1, 0.1, 0.28, 's']])],
  };

  // how each voice plays the score
  const STYLE = {
    robot: (n) => n,
    soft: (n) => Object.assign(n, { type: 'sine', vib: 0, dur: n.dur * 1.4, f0: n.f0 * 0.85, f1: n.f1 * 0.85, vol: n.vol * 0.9 }),
    retro: (n) => Object.assign(n, { type: 'square', vib: 0, glide: false, vol: n.vol * 0.32 }),
  };
  const lastVariant = {};

  function play(name) {
    if (!enabled || !volume || !SCORE[name]) return;
    try {
      const c = audio();
      if (!c) return;
      const variants = SCORE[name];
      // pick a variant, not the same one twice in a row when there is a choice
      let i = Math.floor(Math.random() * variants.length);
      if (variants.length > 1 && i === lastVariant[name]) i = (i + 1) % variants.length;
      lastVariant[name] = i;
      const pitch = 1 + (Math.random() - 0.5) * 0.1;
      variants[i].forEach(([f0, f1, at, dur, vol, type, vib]) => {
        note(c, STYLE[voice]({
          f0: f0 * pitch, f1: f1 * pitch, at, dur, vol,
          type: type === 's' ? 'sine' : 'triangle', vib: vib || 0, vibRate: vib ? 9 + Math.random() * 4 : 9,
        }));
      });
    } catch (err) { /* sound is a nicety: never break YO for it */ }
  }

  Y.sound = {
    play,
    VOICES,
    setEnabled: (on) => { enabled = Boolean(on); },
    isEnabled: () => enabled,
    setVoice: (name) => { if (VOICES.indexOf(name) !== -1) voice = name; },
    setVolume: (level) => {
      volume = Math.max(0, Math.min(3, Math.round(level)));
      if (out) out.gain.value = VOLUMES[volume];
    },
    NAMES: Object.keys(SCORE),
  };
})((window.Yo = window.Yo || {}));
