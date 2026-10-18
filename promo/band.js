// The reels' music and sound helpers, made in code with Web Audio (rendered offline, on the video's clock):
// a darbuka playing malfuf, soft chords of the Andalusian cadence (malouf), and a WAV writer.
(function () {
  'use strict';

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // one tone: f0 gliding to f1, quick attack, soft fade
  function tone(c, out, { type = 'triangle', f0, f1 = f0, at, dur, vol, vib = 0 }) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05);
    if (vib) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.frequency.value = 10;
      depth.gain.value = vib;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.1);
    }
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }

  function noiseBuffer(c) {
    const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // the darbuka: doum (the deep center) and tek (the sharp rim)
  function doum(c, out, at, vol) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(58, at + 0.14);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(g); g.connect(out);
    osc.start(at); osc.stop(at + 0.5);
  }
  function tek(c, out, noise, at, vol) {
    const src = c.createBufferSource();
    src.buffer = noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(at); src.stop(at + 0.1);
    tone(c, out, { type: 'triangle', f0: 1900, f1: 1500, at, dur: 0.015, vol: vol * 0.35 });
  }

  // soft chords: Am, G, F, E
  const CHORDS = [[220, 261.63, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [164.81, 207.65, 246.94]];
  function pad(c, out, at, len, freqs) {
    freqs.forEach((f, i) => {
      [0, 1].forEach((side) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = side ? 'triangle' : 'sine';
        osc.frequency.value = f * (side ? 1.003 : 1);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(0.05 - i * 0.008, at + 0.35);
        g.gain.setValueAtTime(0.05 - i * 0.008, at + len - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, at + len + 0.2);
        osc.connect(g); g.connect(out);
        osc.start(at); osc.stop(at + len + 0.3);
      });
    });
  }

  // the band from `from` to `to` seconds: malfuf in 2/4 (DOUM . . tek . . tek .), 100 beats a minute unless told
  function play(c, out, from, to, bpm = 100) {
    const noise = noiseBuffer(c);
    const BAR = 120 / bpm;
    for (let bar = 0, at = from; at < to; bar += 1, at += BAR) {
      doum(c, out, at, 0.9);
      tek(c, out, noise, at + BAR * 3 / 8, 0.5);
      tek(c, out, noise, at + BAR * 6 / 8, 0.5);
      if (bar % 2) tek(c, out, noise, at + BAR * 7 / 8, 0.22); // a little "ka" on every other bar
      if (bar % 2 === 0) pad(c, out, at, BAR * 2, CHORDS[(bar / 2) % 4]);
    }
  }

  // 16-bit stereo WAV, as base64 for the renderer
  function wav(buf) {
    const n = buf.length;
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const bytes = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i += 1) bytes.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVE');
    str(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, buf.sampleRate, true); bytes.setUint32(28, buf.sampleRate * 4, true);
    bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
    str(36, 'data'); bytes.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i += 1) {
      bytes.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true);
      bytes.setInt16(46 + i * 4, clamp(R[i], -1, 1) * 32767, true);
    }
    const u8 = new Uint8Array(bytes.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // ---------- extras for a fuller reel ----------
  // a long noise burst (for whooshes and risers)
  function noiseLong(c, seconds) {
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  // air moving past: a band of noise sweeping up, quick in, soft out
  function whoosh(c, out, at, vol = 0.35, dur = 0.45) {
    const src = c.createBufferSource();
    src.buffer = noiseLong(c, dur + 0.1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(350, at);
    bp.frequency.exponentialRampToValueAtTime(3200, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp); bp.connect(g); g.connect(out);
    src.start(at); src.stop(at + dur + 0.05);
  }
  // a build-up before a big moment: noise and a tone rising together
  function riser(c, out, at, dur = 1.2, vol = 0.22) {
    whoosh(c, out, at, vol, dur);
    tone(c, out, { type: 'sine', f0: 220, f1: 880, at, dur, vol: vol * 0.5 });
  }
  // a little sparkle: quick high notes going up
  function sparkle(c, out, at, vol = 0.12) {
    [1568, 2093, 2637, 3136].forEach((f, i) => tone(c, out, { type: 'sine', f0: f, at: at + i * 0.05, dur: 0.18, vol }));
  }
  // a shaker on the eighths and a soft bass under the chords, on the same bars as play()
  function groove(c, out, from, to, bpm = 100) {
    const noise = noiseBuffer(c);
    const BAR = 120 / bpm;
    const ROOTS = [110, 98, 87.31, 82.41]; // A, G, F, E
    for (let bar = 0, at = from; at < to; bar += 1, at += BAR) {
      for (let i = 0; i < 4; i += 1) {
        const t = at + i * (BAR / 4);
        const src = c.createBufferSource();
        src.buffer = noise;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
        const g = c.createGain();
        const v = i % 2 ? 0.07 : 0.11;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(hp); hp.connect(g); g.connect(out);
        src.start(t); src.stop(t + 0.07);
      }
      const root = ROOTS[Math.floor(bar / 2) % 4];
      [0, 0.75].forEach((k) => tone(c, out, { type: 'sine', f0: root, at: at + k * BAR, dur: BAR * 0.22, vol: 0.32 }));
    }
  }

  window.Band = { tone, doum, tek, pad, play, wav, CHORDS, whoosh, riser, sparkle, groove };
})();
