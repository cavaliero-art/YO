(function (Y) {
  'use strict';

  // Quick answers: small things YO works out as you type, ready to copy with Enter.
  //   = 12*7, sqrt(16) + 2     math (a small parser of its own: typed text is never run as code)
  //   20% of 150                percentages
  //   5 km in miles, 100 f to c units
  //   #ff6600, rgb(255, 102, 0) colors
  //   uuid, timestamp, timestamp 1700000000, base64 hello, unbase64 aGVsbG8=
  // answer(text) gives { kind, rows: [{ value, label }], swatch? } or null.

  const t = (key) => Y.i18n.t(key);
  const clean = (n) => String(Number(n.toPrecision(12)));

  // ---------- math ----------
  const FUNCS = {
    sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log,
  };
  const CONSTS = { pi: Math.PI, e: Math.E };

  function tokenize(src) {
    const tokens = [];
    const re = /\s*(\d+(?:\.\d+)?|\.\d+|[a-z]+|[-+*/^%()×÷])/giy;
    let m;
    let at = 0;
    while (at < src.length) {
      re.lastIndex = at;
      m = re.exec(src);
      if (!m) {
        if (/^\s*$/.test(src.slice(at))) break;
        return null;
      }
      tokens.push(m[1].toLowerCase().replace('×', '*').replace('÷', '/'));
      at = re.lastIndex;
    }
    return tokens;
  }

  function evaluate(src) {
    const tokens = tokenize(src);
    if (!tokens || !tokens.length) return null;
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    const isNum = (tok) => tok !== undefined && /^[\d.]/.test(tok);

    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '-') {
        const op = next();
        const start = i;
        let r = term();
        if (i - start === 2 && tokens[i - 1] === '%') r *= v; // "84 + 20%" adds 20% of 84, like a calculator
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = power();
      for (;;) {
        const op = peek();
        if (op === '*' || op === '/') { next(); v = op === '*' ? v * power() : v / power(); }
        else if (op === '%' && (isNum(tokens[i + 1]) || tokens[i + 1] === '(')) { next(); v %= power(); }
        else return v;
      }
    }
    function power() {
      const base = unary();
      if (peek() === '^') { next(); return Math.pow(base, power()); }
      return base;
    }
    function unary() {
      if (peek() === '-') { next(); return -unary(); }
      if (peek() === '+') { next(); return unary(); }
      return postfix();
    }
    // 50% on its own means 0.5
    function postfix() {
      let v = primary();
      while (peek() === '%' && !(isNum(tokens[i + 1]) || tokens[i + 1] === '(')) { next(); v /= 100; }
      return v;
    }
    function primary() {
      const tok = next();
      if (tok === undefined) throw new Error('end');
      if (isNum(tok)) return parseFloat(tok);
      if (tok === '(') {
        const v = expr();
        if (next() !== ')') throw new Error('paren');
        return v;
      }
      if (CONSTS[tok] !== undefined) return CONSTS[tok];
      if (FUNCS[tok]) {
        if (next() !== '(') throw new Error('call');
        const v = expr();
        if (next() !== ')') throw new Error('paren');
        return FUNCS[tok](v);
      }
      throw new Error('token');
    }

    try {
      const v = expr();
      return i === tokens.length && Number.isFinite(v) ? v : null;
    } catch (err) {
      return null;
    }
  }

  function math(text) {
    const forced = text.startsWith('=');
    const src = forced ? text.slice(1).trim() : text;
    const looksLikeMath = /[\d)]\s*[-+*/^%×÷]\s*[\d(a-z.]/i.test(src) || /^(sqrt|abs|round|floor|ceil|sin|cos|tan|log|ln)\s*\(/i.test(src);
    if (!forced && !looksLikeMath) return null;
    const v = evaluate(src);
    if (v === null) return null;
    return { kind: 'math', rows: [{ value: clean(v), label: src + ' =' }] };
  }

  function percent(text) {
    const m = /^(-?\d+(?:\.\d+)?)\s*%\s*of\s*(-?\d+(?:\.\d+)?)$/i.exec(text);
    if (!m) return null;
    const v = (parseFloat(m[1]) / 100) * parseFloat(m[2]);
    return { kind: 'math', rows: [{ value: clean(v), label: text + ' =' }] };
  }

  // ---------- units ----------
  // factor to the group's base unit
  const UNITS = {
    length: { m: 1, meter: 1, meters: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344,
      ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254, yd: 0.9144, yard: 0.9144, yards: 0.9144 },
    mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237, oz: 0.028349523125, t: 1000 },
    data: { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 },
    time: { ms: 0.001, s: 1, sec: 1, min: 60, mins: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600, day: 86400, days: 86400, week: 604800, weeks: 604800 },
    volume: { l: 1, liter: 1, liters: 1, ml: 0.001, gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784, cup: 0.2365882365, cups: 0.2365882365 },
    speed: { 'km/h': 1, kmh: 1, kph: 1, mph: 1.609344, 'm/s': 3.6 },
  };
  const TEMP = { c: 'c', '°c': 'c', celsius: 'c', f: 'f', '°f': 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };

  function groupOf(unit) {
    return Object.keys(UNITS).find((g) => UNITS[g][unit] !== undefined) || null;
  }

  function units(text) {
    const m = /^(-?\d+(?:\.\d+)?)\s*([a-z°/]+)\s+(?:in|to|as)\s+([a-z°/]+)$/i.exec(text);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const from = m[2].toLowerCase();
    const to = m[3].toLowerCase();
    let v = null;
    if (TEMP[from] && TEMP[to]) {
      const c = TEMP[from] === 'c' ? n : TEMP[from] === 'f' ? (n - 32) * 5 / 9 : n - 273.15;
      v = TEMP[to] === 'c' ? c : TEMP[to] === 'f' ? c * 9 / 5 + 32 : c + 273.15;
    } else {
      const g = groupOf(from);
      if (!g || groupOf(to) !== g) return null;
      v = (n * UNITS[g][from]) / UNITS[g][to];
    }
    return { kind: 'units', rows: [{ value: clean(v), label: m[1] + ' ' + m[2] + ' → ' + m[3] }] };
  }

  // ---------- colors ----------
  function hsl(r, g, b) {
    const [rr, gg, bb] = [r / 255, g / 255, b / 255];
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
    }
    return 'hsl(' + Math.round(h) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';
  }

  function color(text) {
    let r;
    let g;
    let b;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(text);
    if (hex) {
      const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
      [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    } else if (rgb) {
      [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
      if ([r, g, b].some((v) => v > 255)) return null;
    } else {
      return null;
    }
    const hexOut = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    return {
      kind: 'color',
      swatch: hexOut,
      rows: [
        { value: hexOut, label: t('quick.hex') },
        { value: 'rgb(' + r + ', ' + g + ', ' + b + ')', label: t('quick.rgb') },
        { value: hsl(r, g, b), label: t('quick.hsl') },
      ],
    };
  }

  // ---------- ids, time, base64 ----------
  function uuid(text) {
    if (!/^(uuid|guid)$/i.test(text)) return null;
    const id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : null;
    return id ? { kind: 'uuid', rows: [{ value: id, label: t('quick.uuid') }] } : null;
  }

  function timestamp(text) {
    let date = null;
    if (/^(timestamp|now|unix|epoch)$/i.test(text)) date = new Date();
    const m = /^(?:timestamp|ts|unix|epoch)\s+(\d{9,13})$/i.exec(text);
    if (m) date = new Date(m[1].length > 10 ? Number(m[1]) : Number(m[1]) * 1000);
    if (!date || Number.isNaN(date.getTime())) return null;
    return {
      kind: 'time',
      rows: [
        { value: String(Math.floor(date.getTime() / 1000)), label: t('quick.unix') },
        { value: date.toISOString(), label: t('quick.iso') },
        { value: date.toLocaleString('en-GB'), label: t('quick.local') },
      ],
    };
  }

  function base64(text) {
    const dec = /^(?:unbase64|base64\s+-d|from\s+base64)\s+(.+)$/i.exec(text);
    if (dec) {
      try {
        const bin = atob(dec[1].trim());
        const value = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
        return { kind: 'base64', rows: [{ value, label: t('quick.decoded') }] };
      } catch (err) {
        return null;
      }
    }
    const enc = /^(?:base64|to\s+base64)\s+(.+)$/i.exec(text);
    if (!enc) return null;
    const bytes = new TextEncoder().encode(enc[1]);
    let bin = '';
    bytes.forEach((byte) => { bin += String.fromCharCode(byte); });
    return { kind: 'base64', rows: [{ value: btoa(bin), label: t('quick.base64') }] };
  }

  const SOLVERS = [uuid, timestamp, base64, color, percent, units, math];

  function answer(text) {
    const src = String(text || '').trim();
    if (!src) return null;
    for (const solve of SOLVERS) {
      const result = solve(src);
      if (result) return result;
    }
    return null;
  }

  // ---------- icons for the answer rows ----------
  const svg = (paths) =>
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const ICONS = {
    math: svg('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 13h.01M12 13h.01M15 13h.01M9 17h.01M12 17h.01M15 17h.01"/>'),
    uuid: svg('<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>'),
    time: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    color: svg('<path d="M12 3.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5z"/>'),
    base64: svg('<path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/>'),
    units: svg('<path d="M3 16l13-13 5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>'),
  };
  Y.quick = { answer, evaluate, ICONS };
})((window.Yo = window.Yo || {}));
