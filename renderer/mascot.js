(function (Y) {
  'use strict';

  // YO, drawn and moved in code.
  // One SVG body; a small engine moves it every frame while YO is on screen:
  // springs (squash, hop, tilt, antenna, ears/bells, hats, held item, arms, eyes), blinks,
  // expressions and particles. The look is the user's (color, eyes, hat, glasses, held item);
  // the category of what YO is doing shows as an accessory:
  //   system: plain antenna   media: ring   apps: pointed ears   time: alarm-clock bells
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const STAR = 'M0 -6L1.53 -2.1L5.71 -1.85L2.47 0.8L3.53 4.85L0 2.6L-3.53 4.85L-2.47 0.8L-5.71 -1.85L-1.53 -2.1Z';
  const HEART = 'M0 4.5C-8 -0.5 -5 -7.5 0 -3.2C5 -7.5 8 -0.5 0 4.5Z';

  // every eye shape, centered on 0,0; one is shown at a time
  const EYE =
    '<rect class="sh-open" x="-4" y="-5" width="8" height="10" rx="3"/>' +
    '<rect class="sh-wide" x="-5" y="-7" width="10" height="14" rx="3.5"/>' +
    '<rect class="sh-squint" x="-5" y="-1.5" width="10" height="3" rx="1.5"/>' +
    '<rect class="sh-sleepy" x="-5" y="0.5" width="10" height="3.5" rx="1.75"/>' +
    '<path class="sh-happy stroke" d="M-5.5 2.5Q0 -6 5.5 2.5"/>' +
    '<path class="sh-heart" d="' + HEART + '"/>' +
    '<path class="sh-star" d="' + STAR + '"/>' +
    '<path class="sh-spiral stroke" d="M0 0m-1 0a1 1 0 1 1 2 0a2.4 2.4 0 1 1 -4.8 0a3.8 3.8 0 1 1 7.6 0"/>' +
    '<path class="sh-x stroke" d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5"/>';
  const ARM = '<rect class="c-foot" x="-4" y="-2" width="8" height="18" rx="4"/>';

  const MARKUP =
    '<svg class="yo-char" viewBox="-16 -12 120 104" data-state="idle" data-variant="system" data-color="mint" ' +
    'data-eye="mint" data-eyes="classic" data-hat="none" data-glasses="none" data-item="none" data-moon="false" aria-hidden="true">' +
    '<g transform="translate(-60,-48)"><g class="rig">' +
    '<g class="acc acc-apps"><polygon class="c-body" points="76,78 77,60 93,72"/><polygon class="c-body" points="124,78 123,60 107,72"/></g>' +
    '<g class="acc acc-time"><circle class="c-foot" cx="76" cy="68" r="7"/><circle class="c-foot" cx="124" cy="68" r="7"/></g>' +
    '<g class="ant">' +
      '<line class="c-ant" x1="100" y1="72" x2="100" y2="58" stroke-width="3" stroke-linecap="round"/>' +
      '<circle class="c-ring acc acc-media" cx="100" cy="53" r="9"/>' +
      '<circle class="dot" cx="100" cy="53" r="5"/>' +
      '<path class="o-moon" d="M103 45.5a7.5 7.5 0 1 0 0 15a9 9 0 0 1 0 -15z"/>' +
      '<circle class="hit-ant" cx="100" cy="54" r="12"/>' +
    '</g>' +
    '<rect class="c-foot" x="80" y="130" width="14" height="7" rx="3"/>' +
    '<rect class="c-foot" x="106" y="130" width="14" height="7" rx="3"/>' +
    '<rect class="c-body" x="68" y="70" width="64" height="60" rx="22"/>' +
    '<rect class="c-visor" x="76" y="84" width="48" height="30" rx="12"/>' +
    '<g class="blush"><ellipse cx="81" cy="119" rx="4.5" ry="2.2"/><ellipse cx="119" cy="119" rx="4.5" ry="2.2"/></g>' +
    '<g class="eye eye-l">' + EYE + '</g><g class="eye eye-r">' + EYE + '</g>' +
    '<g class="mouth"><rect class="c-jaw" x="79" y="98" width="42" height="14.5" rx="7"/>' +
      '<rect class="c-teeth" x="85.5" y="98" width="6" height="3.4" rx="1.2"/><rect class="c-teeth" x="108.5" y="98" width="6" height="3.4" rx="1.2"/>' +
      '<ellipse class="c-tongue" cx="100" cy="109.5" rx="10" ry="3.6"/></g>' +
    '<g class="smile"><path class="c-smile" d="M90 106Q100 113 110 106"/><ellipse class="c-tongue" cx="106.5" cy="109.6" rx="2.8" ry="2.2"/></g>' +
    '<g class="o-round"><circle cx="90" cy="99" r="7.5"/><circle cx="110" cy="99" r="7.5"/><path d="M97.5 98.5Q100 96.5 102.5 98.5"/></g>' +
    '<g class="o-glasses"><rect x="80.5" y="92" width="17.5" height="12" rx="5"/><rect x="102" y="92" width="17.5" height="12" rx="5"/>' +
      '<path class="bridge" d="M98 96.5h4"/><path class="shine" d="M84 95.5l4 -1.6M105.5 95.5l4 -1.6"/></g>' +
    '<g class="hat">' +
      '<g class="o-winter"><path class="o-red" d="M70 78Q70 50 100 50Q130 50 130 78Z"/><rect class="o-white" x="67" y="70" width="66" height="9" rx="4.5"/><circle class="o-white" cx="100" cy="47.5" r="5.5"/></g>' +
      '<g class="o-party"><path class="o-violet" d="M75 72L98 70L84 39Z"/><path class="o-stripe" d="M79.5 62.5L94.5 61.3M82 53L90.5 52.3"/><circle class="o-yellow" cx="84" cy="38" r="3.6"/></g>' +
      '<g class="o-witch"><ellipse class="o-dark" cx="86" cy="71" rx="21" ry="4.5"/><path class="o-dark" d="M73 70Q83 56 79 35Q92 48 99 70Z"/><path class="o-band" d="M75.5 66Q86 62.5 97.5 66"/></g>' +
      '<g class="o-crown"><path class="o-gold" d="M80 73L80 58L88.5 65L94 54L100 63L106 54L111.5 65L120 58L120 73Z"/>' +
        '<circle class="o-gem" cx="100" cy="68" r="2.4"/><circle class="o-gem2" cx="88" cy="69" r="1.6"/><circle class="o-gem2" cx="112" cy="69" r="1.6"/></g>' +
      '<g class="o-cap"><path class="o-capc" d="M70 77Q70 53 100 53Q130 53 130 77Z"/><path class="o-capc" d="M114 73Q134 68 146 76Q134 81 114 79Z"/>' +
        '<path class="o-capline" d="M100 54V76"/><circle class="o-white" cx="100" cy="52.5" r="2.6"/></g>' +
      '<g class="o-phones"><path class="o-band2" d="M66 96C64 52 136 52 134 96"/><rect class="o-cup" x="60" y="84" width="12" height="22" rx="5"/>' +
        '<rect class="o-cup" x="128" y="84" width="12" height="22" rx="5"/><rect class="o-cupin" x="63" y="88" width="6" height="14" rx="3"/>' +
        '<rect class="o-cupin" x="131" y="88" width="6" height="14" rx="3"/></g>' +
      '<g class="o-bow"><path class="o-pink" d="M117 70L106 63.5Q104 70 106 76.5Z"/><path class="o-pink" d="M117 70L128 63.5Q130 70 128 76.5Z"/>' +
        '<circle class="o-pink2" cx="117" cy="70" r="3"/></g>' +
      '<g class="o-prop"><path class="o-propcap" d="M76 74Q76 56 100 56Q124 56 124 74Z"/><path class="o-propstripe" d="M89 58Q90.5 66 90.5 74M111 58Q109.5 66 109.5 74"/>' +
        '<rect class="o-stem" x="98.6" y="47" width="2.8" height="10" rx="1"/>' +
        '<g class="blades"><ellipse class="o-blade" cx="91.5" cy="47" rx="8.5" ry="2.2"/><ellipse class="o-blade2" cx="108.5" cy="47" rx="8.5" ry="2.2"/></g></g>' +
      '<g class="o-night"><path class="o-navy" d="M71 72Q73 52 98 52Q118 52 132 64Q141 71 143 82L135 80Q127 70 121 72Z"/>' +
        '<rect class="o-white" x="68" y="69" width="64" height="8" rx="4"/><circle class="o-white" cx="142" cy="84" r="4.5"/></g>' +
      '<g class="o-halo"><ellipse cx="100" cy="41" rx="15" ry="4.2"/></g>' +
      '<g class="o-grad"><path class="o-dark" d="M82 71Q82 62 100 62Q118 62 118 71Z"/><path class="o-dark" d="M100 50.5L131 60L100 69.5L69 60Z"/>' +
        '<circle class="o-gold" cx="100" cy="60" r="1.8"/>' +
        '<g class="tassel"><path class="o-goldline" d="M100 60L125 64L125 74"/><rect class="o-gold" x="122.5" y="73" width="5" height="7" rx="1.5"/></g></g>' +
    '</g>' +
    '<g class="o-pad"><rect class="o-padbody" x="85" y="110" width="30" height="13" rx="6.5"/><path class="o-dpad" d="M90 116.5h5M92.5 114v5"/>' +
      '<circle class="o-btn" cx="107.5" cy="114.8" r="1.6"/><circle class="o-btn2" cx="111" cy="118" r="1.6"/></g>' +
    '<g class="arm arm-l">' + ARM + '</g>' +
    '<g class="arm arm-r">' + ARM +
      '<g class="held">' +
        '<g class="o-lantern"><path class="o-chain" d="M0 0v4"/><path class="o-gold" d="M-5 5h10l-5 -4z"/>' +
        '<rect class="o-gold" x="-5.5" y="5" width="11" height="13" rx="2.5"/><rect class="o-flame" x="-3" y="7.5" width="6" height="8" rx="1.5"/>' +
        '<path class="o-gold" d="M-3 18h6l-3 3z"/></g>' +
        '<g class="o-mug"><path class="o-steam" d="M0 -6q-2 -3 0 -6M4.5 -6q-2 -3 0 -6"/><rect class="o-cup-body" x="-3.5" y="-3" width="11" height="12" rx="2.2"/>' +
        '<path class="o-handle" d="M7.5 0q4 0 4 3.5q0 3.5 -4 3.5"/><rect class="o-coffee" x="-2.5" y="-3" width="9" height="2" rx="1"/></g>' +
      '</g>' +
    '</g>' +
    '<g class="x-listen"><path d="M54 90Q48 100 54 110M146 90Q152 100 146 110"/></g>' +
    '<g class="x-alert"><circle class="badge" cx="128" cy="64" r="8.5"/><text x="128" y="64.5" text-anchor="middle" dominant-baseline="central">!</text></g>' +
    '</g><g class="fx"></g></g></svg>';

  // arm angles in degrees: 0 hangs down, 90 points out, 170 is straight up; negative reaches inward
  const POSES = {
    rest: [12, 12], listen: [42, 42], think: [12, -62], raise: [12, 148], cheer: [150, 150], wave: [12, 140],
    cover: [-124, -124], droop: [3, 3], shrug: [66, 66], pet: [32, 32], hold: [12, 74], game: [-58, -58], reach: [96, 96],
  };
  // eye shape for each expression: [left, right]
  const EXPR = {
    idle: ['open', 'open'], listen: ['wide', 'wide'], think: ['open', 'open'], done: ['happy', 'happy'],
    alert: ['wide', 'wide'], love: ['heart', 'heart'], proud: ['star', 'star'], dizzy: ['spiral', 'spiral'],
    sleepy: ['sleepy', 'sleepy'], squint: ['squint', 'squint'], wink: ['open', 'happy'], oops: ['x', 'x'],
  };
  // what each state looks like when nothing else is going on: [expression, pose]
  const BASE = {
    idle: ['idle', 'rest'], listen: ['listen', 'listen'], think: ['think', 'think'], done: ['done', 'rest'], alert: ['alert', 'raise'],
  };
  const BLINKS = { open: true, wide: true };
  const HAT_PIVOT = {
    winter: [100, 74], party: [87, 71], witch: [86, 71], crown: [100, 73], cap: [100, 76], headphones: [100, 74], bow: [117, 72],
    propeller: [100, 74], nightcap: [100, 74], grad: [100, 70],
  };
  // what the user can pick; the first of each list is the default
  const LOOKS = {
    color: ['mint', 'sky', 'coral', 'lilac', 'lemon', 'bubblegum', 'snow', 'graphite', 'gold'],
    eyeColor: ['mint', 'white', 'amber', 'pink', 'cyan'],
    eyes: ['classic', 'round', 'pixel'],
    hat: ['none', 'winter', 'party', 'witch', 'crown', 'cap', 'headphones', 'bow', 'propeller', 'nightcap', 'halo', 'grad'],
    glasses: ['none', 'sun', 'round'],
    item: ['none', 'lantern', 'mug', 'controller'],
  };
  const DEFAULT_LOOK = { color: 'mint', eyeColor: 'mint', eyes: 'classic', hat: 'none', glasses: 'none', item: 'none', moon: false };
  // eye style: [x, y, width, height, corner] of the open and the wide eye
  const EYE_STYLE = {
    classic: { open: [-4, -5, 8, 10, 3], wide: [-5, -7, 10, 14, 3.5] },
    round: { open: [-4.6, -4.6, 9.2, 9.2, 4.6], wide: [-6, -6, 12, 12, 6] },
    pixel: { open: [-4, -4, 8, 8, 0.6], wide: [-5, -6, 10, 12, 0.8] },
  };
  // what each seasonal outfit puts on
  const SEASON_LOOK = {
    winter: { hat: 'winter' }, party: { hat: 'party' }, witch: { hat: 'witch' }, lantern: { item: 'lantern', moon: true }, sun: { glasses: 'sun' },
  };

  const round = (n) => Math.round(n * 100) / 100;
  const spring = (x, k, c) => ({ x, v: 0, t: x, k, c });

  function el(tag, attrs, cls, text) {
    const node = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
    node.setAttribute('class', cls);
    if (text) node.textContent = text;
    return node;
  }

  const PARTICLE = {
    spark: () => el('circle', { r: 1.8 }, 'p-spark'),
    dot: () => el('circle', { r: 1.5 }, 'p-spark'),
    heart: () => el('path', { d: HEART, transform: 'scale(.7)' }, 'p-heart'),
    star: () => el('path', { d: STAR, transform: 'scale(.6)' }, 'p-star'),
    sweat: () => el('path', { d: 'M0 -4Q3.2 0.5 0 3Q-3.2 0.5 0 -4Z' }, 'p-sweat'),
    z: () => el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'p-text p-z', 'z'),
    note: () => el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'p-text p-note', '♪'),
    q: () => el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'p-text p-q', '?'),
  };

  // a small accessory for the day: Ramadan, Eid, New Year, Halloween, winter, summer
  function seasonal(date) {
    const d = date || new Date();
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' }).formatToParts(d);
      const month = Number(parts.find((p) => p.type === 'month').value);
      const day = Number(parts.find((p) => p.type === 'day').value);
      if (month === 9) return 'lantern';
      if ((month === 10 && day <= 3) || (month === 12 && day >= 10 && day <= 13)) return 'party';
    } catch (err) { /* no Islamic calendar available: skip those */ }
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'party';
    if (month === 10 && day >= 20) return 'witch';
    if (month === 12 || month <= 2) return 'winter';
    if (month === 7 || month === 8) return 'sun';
    return null;
  }

  // YO's look from saved preferences: a seasonal outfit only fills the slots left empty
  function lookFor(prefs, date) {
    const look = Object.assign({}, DEFAULT_LOOK, prefs && prefs.look);
    const season = !prefs || prefs.seasonal !== false ? seasonal(date) : null;
    const extra = season ? SEASON_LOOK[season] : {};
    Object.keys(extra).forEach((key) => {
      if (key === 'moon' || look[key] === 'none') look[key] = extra[key];
    });
    return look;
  }

  // the next day a different seasonal outfit starts, to show it in Customize
  function nextSeason(from) {
    const d = new Date(from || Date.now());
    const now = seasonal(d);
    for (let i = 1; i < 400; i += 1) {
      d.setDate(d.getDate() + 1);
      const name = seasonal(d);
      if (name && name !== now) return { name, date: new Date(d) };
    }
    return null;
  }

  function mount(host, size) {
    host.innerHTML = MARKUP;
    const svg = host.firstElementChild;
    svg.setAttribute('height', String(size));
    const $ = (sel) => svg.querySelector(sel);
    const node = {
      rig: $('.rig'), ant: $('.ant'), ears: $('.acc-apps'), bells: $('.acc-time'), hat: $('.hat'), glasses: $('.o-glasses'),
      armL: $('.arm-l'), armR: $('.arm-r'), held: $('.held'), steam: $('.o-steam'), eyeL: $('.eye-l'), eyeR: $('.eye-r'),
      mouth: $('.mouth'), smile: $('.smile'), blades: $('.blades'), halo: $('.o-halo'), tassel: $('.tassel'),
      blush: $('.blush'), fx: $('.fx'), badge: $('.x-alert'), listen: $('.x-listen'),
    };

    const sp = {
      hop: spring(0, 260, 15), sx: spring(1, 320, 12), sy: spring(1, 320, 12), tilt: spring(0, 120, 11),
      ant: spring(0, 240, 5), acc: spring(0, 180, 7), hat: spring(0, 70, 4.5), glasses: spring(0, 150, 15),
      lantern: spring(0, 45, 2.2), armL: spring(12, 170, 15), armR: spring(12, 170, 15),
      lookX: spring(0, 120, 17), lookY: spring(0, 120, 17), blush: spring(0, 40, 12), mouth: spring(0, 520, 22),
    };
    const holds = {}; // short overrides: expr, pose, look, tilt -> { v, until }
    const later = []; // steps of a reaction: { at, fn }
    const emitters = []; // particle streams: { id, every, next, until, fn }
    const parts = [];
    let state = 'idle';
    let hat = 'none';
    let item = 'none';
    let raf = 0;
    let last = 0;
    let clock = 0;
    let shown = '';
    let shapes = ['open', 'open'];
    let blinkT = -1;
    let blinkAt = 2;
    let cursor = { x: 0, y: 0, at: -99 };
    let wander = { x: 0, y: 0, next: 3 };
    let typingFocus = false;
    let sleeping = false;
    let petting = false;
    let dizzyUntil = 0;
    let ringUntil = 0;
    let lastType = 0;
    let boops = [];
    let hungry = false; // a file is hovering over YO: mouth open
    let chompUntil = 0;
    let smileUntil = 0;
    let music = false; // something is playing: YO bops along

    const calm = () => reduced.matches;
    const hold = (kind, v, ms) => { holds[kind] = { v, until: clock + ms / 1000 }; };
    const held = (kind) => (holds[kind] && holds[kind].until > clock ? holds[kind].v : null);
    const after = (ms, fn) => later.push({ at: clock + ms / 1000, fn });
    const kick = (name, dv) => { if (!calm()) sp[name].v += dv; };

    function stream(id, every, ms, fn) {
      stopStream(id);
      emitters.push({ id, every, next: clock, until: ms ? clock + ms / 1000 : Infinity, fn });
    }
    function stopStream(id) {
      for (let i = emitters.length - 1; i >= 0; i -= 1) if (emitters[i].id === id) emitters.splice(i, 1);
    }

    function spawn(kind, x, y, vx, vy, life, gravity, scale) {
      if (calm() || parts.length > 40) return;
      const p = PARTICLE[kind]();
      const wrap = el('g', {}, 'p');
      wrap.appendChild(p);
      node.fx.appendChild(wrap);
      parts.push({ node: wrap, x, y, vx, vy, life, g: gravity || 0, s: scale || 1, age: 0, spin: (Math.random() - 0.5) * 120 });
    }

    function burst(kind, n, x, y, speed, life) {
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        spawn(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed - speed * 0.3, life, 40, 1);
      }
    }

    function setShape(eye, shape) {
      Array.from(eye.children).forEach((c) => c.classList.toggle('on', c.classList.contains('sh-' + shape)));
    }

    function showExpr(name) {
      if (name === shown) return;
      shown = name;
      shapes = EXPR[name] || EXPR.idle;
      setShape(node.eyeL, shapes[0]);
      setShape(node.eyeR, shapes[1]);
    }

    function lookTarget() {
      const forced = held('look');
      if (forced) return forced;
      if (sleeping) return [0, 0.7];
      if (state === 'think') return [0.55 + Math.sin(clock * 0.8) * 0.2, -0.8];
      if (clock - cursor.at < 2.5) return [cursor.x, cursor.y];
      if (typingFocus) return [0.75, 0.5];
      if (clock > wander.next) {
        const glance = Math.random() < 0.55;
        wander = { x: glance ? (Math.random() - 0.5) * 1.6 : 0, y: glance ? (Math.random() - 0.5) * 0.8 : 0, next: clock + 1.8 + Math.random() * 3.5 };
      }
      return [wander.x, wander.y];
    }

    // eyelid: 1 open, ~0 shut
    function lidAt() {
      if (blinkT < 0) return 1;
      if (blinkT < 0.07) return 1 - (blinkT / 0.07) * 0.92;
      if (blinkT < 0.2) return 0.08 + ((blinkT - 0.07) / 0.13) * 0.92;
      blinkT = -1;
      return 1;
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      clock += dt;

      for (let i = later.length - 1; i >= 0; i -= 1) {
        if (later[i].at <= clock) later.splice(i, 1)[0].fn();
      }
      for (let i = emitters.length - 1; i >= 0; i -= 1) {
        const e = emitters[i];
        if (clock > e.until) { emitters.splice(i, 1); continue; }
        if (clock >= e.next) { e.fn(); e.next = clock + e.every; }
      }

      // what YO looks like right now: a short reaction wins over sleep/pet, which win over the state
      const base = BASE[state] || BASE.idle;
      const expr = held('expr') || (sleeping ? 'sleepy' : petting ? 'done' : base[0]);
      let pose = held('pose') || (sleeping ? 'droop' : petting ? 'pet' : base[1]);
      if (pose === 'rest' && (item === 'lantern' || item === 'mug')) pose = 'hold'; // holds it out
      if (pose === 'rest' && item === 'controller') pose = 'game'; // both hands on the pad
      showExpr(expr);
      let [armL, armR] = POSES[pose] || POSES.rest;
      if (pose === 'wave') armR += Math.sin(clock * 14) * 24;
      if (petting) { armL += Math.sin(clock * 9) * 10; armR -= Math.sin(clock * 9) * 10; }
      sp.armL.t = armL;
      sp.armR.t = armR;

      const still = calm();
      sp.hop.t = still || state === 'think' ? 0 : Math.sin(clock * (sleeping ? 1.4 : 2.4)) * (sleeping ? 1.3 : 0.9);
      sp.sy.t = 1 + (sleeping ? Math.sin(clock * 1.4) * 0.025 : petting ? Math.sin(clock * 9) * 0.03 : 0);
      sp.sx.t = 1 - (sp.sy.t - 1) * 0.6;
      const tilt = held('tilt');
      sp.tilt.t = tilt !== null ? tilt : clock < dizzyUntil ? Math.sin(clock * 8) * 12 : sleeping ? 7 : state === 'think' ? -4 : 0;
      if (music && !still && !sleeping && !hungry && (state === 'idle' || state === 'done')) {
        // bopping to the music, 112 beats a minute
        const beat = clock * Math.PI * (112 / 60);
        sp.hop.t = -Math.abs(Math.sin(beat)) * 2.6;
        if (tilt === null && clock >= dizzyUntil) sp.tilt.t = Math.sin(beat) * 6;
        sp.armL.t = armL + Math.abs(Math.sin(beat)) * 30;
        sp.armR.t = armR + Math.abs(Math.cos(beat)) * 30;
      }
      // open wide while a file hovers; after the snap, a few small chews
      sp.mouth.t = hungry ? 1 + Math.sin(clock * 7) * 0.06 : clock < chompUntil ? (Math.sin(clock * 28) > 0 ? 0.35 : 0) : 0;
      if (hungry) {
        sp.armL.t += Math.sin(clock * 9) * 8; // "gimme" wiggle
        sp.armR.t -= Math.sin(clock * 9) * 8;
      }

      // the antenna leans against the motion, ears/bells and hats lag behind it
      sp.ant.t = -sp.tilt.x * 0.9 + sp.hop.v * 0.05;
      sp.acc.t = sp.ant.x * 0.35;
      sp.hat.t = -sp.tilt.x * 1.2 + sp.hop.v * 0.07 + sp.ant.x * 0.12;
      sp.lantern.t = -sp.armR.v * 0.05 - sp.tilt.x;
      sp.glasses.t = expr === 'idle' || expr === 'think' ? 0 : -16; // sunglasses go up when YO emotes
      sp.blush.t = petting || expr === 'done' || expr === 'love' || expr === 'wink' ? 1 : 0;

      const [lx, ly] = lookTarget();
      sp.lookX.t = lx;
      sp.lookY.t = ly;

      Object.keys(sp).forEach((key) => {
        const s = sp[key];
        if (still) { s.x = s.t; s.v = 0; return; }
        s.v += (-s.k * (s.x - s.t) - s.c * s.v) * dt;
        s.x += s.v * dt;
      });

      // blink now and then (only open eyes blink), sometimes twice
      if (BLINKS[shapes[0]] && clock > blinkAt && blinkT < 0) {
        blinkT = 0;
        blinkAt = clock + (Math.random() < 0.22 ? 0.28 : 2.2 + Math.random() * 3.2);
      }
      if (blinkT >= 0) blinkT += dt;
      const lid = BLINKS[shapes[0]] ? lidAt() : 1;

      node.rig.setAttribute('transform',
        'translate(0 ' + round(sp.hop.x) + ') translate(100 137) scale(' + round(sp.sx.x) + ' ' + round(sp.sy.x) + ') translate(-100 -137) rotate(' + round(sp.tilt.x) + ' 100 104)');
      node.ant.setAttribute('transform', 'rotate(' + round(sp.ant.x) + ' 100 70)');
      node.ears.setAttribute('transform', 'rotate(' + round(sp.acc.x) + ' 100 72)');
      const ring = clock < ringUntil && !still ? Math.sin(clock * 42) * 9 : 0;
      node.bells.setAttribute('transform', 'rotate(' + round(sp.acc.x + ring) + ' 100 70)');
      const pivot = HAT_PIVOT[hat];
      if (pivot) node.hat.setAttribute('transform', 'rotate(' + round(sp.hat.x) + ' ' + pivot[0] + ' ' + pivot[1] + ')');
      node.glasses.setAttribute('transform', 'translate(0 ' + round(sp.glasses.x) + ')');
      node.armL.setAttribute('transform', 'translate(70 102) rotate(' + round(sp.armL.x) + ')');
      node.armR.setAttribute('transform', 'translate(130 102) rotate(' + round(-sp.armR.x) + ')');
      // the held item stays upright in the hand; a lantern swings, a mug barely
      const swing = item === 'lantern' ? sp.lantern.x : sp.lantern.x * 0.2;
      node.held.setAttribute('transform', 'translate(0 15) rotate(' + round(sp.armR.x + swing) + ')');
      if (item === 'mug') node.steam.setAttribute('opacity', String(round(0.35 + Math.sin(clock * 2.2) * 0.3)));
      const ex = round(sp.lookX.x * 4.5);
      const ey = round(sp.lookY.x * 3.5);
      node.eyeL.setAttribute('transform', 'translate(' + (90 + ex) + ' ' + (99 + ey) + ') scale(1 ' + round(lid) + ')');
      node.eyeR.setAttribute('transform', 'translate(' + (110 + ex) + ' ' + (99 + ey) + ') scale(1 ' + round(lid) + ')');
      node.blush.setAttribute('opacity', String(round(Math.max(0, sp.blush.x) * 0.85)));
      const mouth = Math.max(0, sp.mouth.x);
      node.mouth.setAttribute('transform', 'translate(100 98) scale(1 ' + round(Math.min(mouth, 1.1)) + ') translate(-100 -98)');
      node.mouth.setAttribute('opacity', mouth > 0.04 ? '1' : '0');
      node.smile.setAttribute('opacity', clock < smileUntil && mouth < 0.1 ? '1' : '0');
      if (hat === 'propeller') node.blades.setAttribute('transform', 'translate(100 47) scale(' + round(still ? 1 : Math.cos(clock * 22)) + ' 1) translate(-100 -47)');
      if (hat === 'halo') node.halo.setAttribute('transform', 'translate(0 ' + round(still ? 0 : Math.sin(clock * 2.2) * 1.6) + ')');
      if (hat === 'grad') node.tassel.setAttribute('transform', 'rotate(' + round(sp.hat.x * 2.2) + ' 125 64)');
      node.badge.setAttribute('transform', state === 'alert' && !still ? 'translate(128 64) scale(' + round(1 + Math.sin(clock * 6) * 0.08) + ') translate(-128 -64)' : '');
      node.listen.setAttribute('opacity', state === 'listen' ? String(round(0.55 + Math.sin(clock * 6) * 0.45)) : '0');

      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { p.node.remove(); parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.age / p.life;
        const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const scale = p.s * (0.6 + 0.4 * Math.min(1, k * 4));
        p.node.setAttribute('transform', 'translate(' + round(p.x) + ' ' + round(p.y) + ') rotate(' + round(p.spin * k) + ') scale(' + round(scale) + ')');
        p.node.setAttribute('opacity', String(round(alpha)));
      }
    }

    function clearFx() {
      parts.forEach((p) => p.node.remove());
      parts.length = 0;
      emitters.length = 0;
    }

    // ---------- reactions ----------
    const REACT = {
      land() {
        blinkT = 0.07; // eyes pop open as it lands
        kick('sy', -5); kick('sx', 3); kick('ant', 520); kick('hat', 300); kick('lantern', 200);
      },
      greet() {
        REACT.land();
        after(320, () => hold('look', [-0.9, -0.1], 380));
        after(720, () => hold('look', [0.9, -0.1], 380));
        after(1120, () => { hold('expr', 'wink', 450); hold('look', [0, 0.15], 500); });
        after(1300, () => { hold('pose', 'wave', 1500); burst('spark', 7, 100, 62, 55, 0.8); });
      },
      success() {
        hold('expr', 'done', 900);
        hold('pose', 'cheer', 700);
        kick('hop', -95); kick('ant', 400);
        burst('spark', 8, 100, 62, 60, 0.75);
      },
      cancel() {
        hold('expr', 'squint', 900); hold('pose', 'droop', 900); hold('tilt', -8, 800);
        kick('sy', -1.5);
      },
      info() {
        hold('tilt', 12, 900); hold('pose', 'shrug', 800);
        spawn('q', 130, 58, 6, -22, 1.2, 0, 1);
      },
      media() {
        hold('expr', 'done', 1300);
        stream('notes', 0.35, 1400, () => spawn('note', 122 + Math.random() * 10, 64, 10 + Math.random() * 10, -26, 1.3, 0, 1));
        [0, 350, 700].forEach((ms) => after(ms, () => { kick('hop', -40); kick('ant', 220); }));
      },
      ask() {
        kick('hop', -50); kick('ant', 300);
      },
      remind() {
        hold('expr', 'listen', 380);
        after(380, () => hold('expr', 'done', 1300));
        hold('pose', 'wave', 1600);
        ringUntil = clock + 1.2;
        kick('hop', -60);
      },
      error() {
        hold('pose', 'cover', 1300); hold('expr', 'oops', 1300);
        spawn('sweat', 127, 74, 4, 8, 1.1, 50, 1);
      },
      type() {
        if (clock - lastType < 0.08) return;
        lastType = clock;
        kick('hop', 14);
      },
      sleep() {
        sleeping = true;
        stream('z', 1.1, 0, () => spawn('z', 122, 62, 7, -11, 2.2, 0, 1 + Math.random() * 0.4));
      },
      wave() {
        hold('pose', 'wave', 1500);
        hold('expr', 'done', 1100);
        kick('hop', -40);
      },
      // snap shut, belly bulge, a few chews, then a smile and a lick
      eat() {
        hungry = false;
        delete holds.look;
        sp.mouth.v = -30;
        chompUntil = clock + 0.75;
        kick('sx', 9); kick('sy', -7); kick('hop', -60); kick('ant', 420); kick('hat', 300);
        hold('expr', 'squint', 700);
        hold('pose', 'rest', 900);
        burst('spark', 7, 100, 108, 38, 0.6);
        after(760, () => {
          smileUntil = clock + 1.3;
          hold('expr', 'done', 1300);
          kick('sy', -1.5);
        });
      },
      equip() {
        hold('expr', 'done', 800);
        hold('pose', 'cheer', 450);
        kick('hop', -70); kick('ant', 450); kick('hat', 420); kick('lantern', 260);
        burst('star', 5, 100, 58, 45, 0.9);
      },
      wake() {
        sleeping = false;
        stopStream('z');
        hold('expr', 'listen', 600);
        kick('hop', -70); kick('ant', 400);
      },
    };

    return {
      setState(next) {
        if (!BASE[next] || next === state) return;
        state = next;
        svg.setAttribute('data-state', next);
      },
      setVariant(name) {
        svg.setAttribute('data-variant', name);
      },
      // color, eyes, hat, glasses, held item (unknown values fall back to the default)
      setLook(look) {
        const next = Object.assign({}, DEFAULT_LOOK, look);
        Object.keys(LOOKS).forEach((key) => {
          if (LOOKS[key].indexOf(next[key]) === -1) next[key] = DEFAULT_LOOK[key];
        });
        svg.setAttribute('data-color', next.color);
        svg.setAttribute('data-eye', next.eyeColor);
        svg.setAttribute('data-eyes', next.eyes);
        svg.setAttribute('data-hat', next.hat);
        svg.setAttribute('data-glasses', next.glasses);
        svg.setAttribute('data-item', next.item);
        svg.setAttribute('data-moon', String(Boolean(next.moon)));
        hat = next.hat;
        item = next.item;
        node.hat.removeAttribute('transform');
        const style = EYE_STYLE[next.eyes];
        [node.eyeL, node.eyeR].forEach((eye) => {
          ['open', 'wide'].forEach((shape) => {
            const [x, y, w, h, r] = style[shape];
            const rect = eye.querySelector('.sh-' + shape);
            rect.setAttribute('x', x); rect.setAttribute('y', y);
            rect.setAttribute('width', w); rect.setAttribute('height', h);
            rect.setAttribute('rx', r);
          });
        });
      },
      // run the engine only while YO is on screen
      setActive(on) {
        if (on && !raf) {
          last = 0;
          raf = requestAnimationFrame(frame);
        } else if (!on && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          clearFx();
        }
      },
      // forget anything half-done (YO is leaving)
      reset() {
        Object.keys(holds).forEach((key) => delete holds[key]);
        later.length = 0;
        sleeping = false;
        petting = false;
        dizzyUntil = 0;
        hungry = false;
        chompUntil = 0;
        smileUntil = 0;
        clearFx();
      },
      react(name) {
        if (REACT[name]) REACT[name]();
      },
      // dx/dy: pointer offset from YO in pixels
      lookAt(dx, dy) {
        cursor = { x: Math.tanh(dx / 180), y: Math.tanh(dy / 140), at: clock };
      },
      focusInput(on) {
        typingFocus = Boolean(on);
      },
      pet(on) {
        petting = Boolean(on);
        if (petting) {
          kick('sy', -2);
          stream('hearts', 0.33, 0, () => spawn('heart', 90 + Math.random() * 20, 62, (Math.random() - 0.5) * 16, -26, 1.2, 0, 1));
        } else {
          stopStream('hearts');
        }
      },
      // a boop on the antenna; three quick boops make YO dizzy (returns true then)
      boop() {
        kick('ant', (Math.random() < 0.5 ? -1 : 1) * 900);
        kick('sy', -2);
        hold('expr', 'squint', 220);
        boops = boops.filter((t) => clock - t < 1.6);
        boops.push(clock);
        if (boops.length < 3) return false;
        boops = [];
        dizzyUntil = clock + 2.4;
        hold('expr', 'dizzy', 2400);
        burst('star', 5, 100, 56, 40, 1.1);
        return true;
      },
      isSleeping: () => sleeping,
      // a file is being dragged over YO
      setHungry(on) {
        if (Boolean(on) === hungry) return;
        hungry = Boolean(on);
        if (hungry) {
          // eyes squeeze up into happy arcs, arms reach out: "gimme"
          hold('expr', 'done', 60000);
          hold('look', [0, -1], 60000);
          hold('pose', 'reach', 60000);
          kick('hop', -45); kick('ant', 300);
        } else {
          delete holds.expr;
          delete holds.look;
          delete holds.pose;
        }
      },
      setMusic(on) {
        if (Boolean(on) === music) return;
        music = Boolean(on);
        if (music) stream('music', 1.8, 0, () => spawn('note', 124 + Math.random() * 8, 62, 8 + Math.random() * 8, -24, 1.5, 0, 1));
        else stopStream('music');
      },
    };
  }

  Y.mascot = { mount, seasonal, nextSeason, lookFor, LOOKS, DEFAULT_LOOK, SEASON_LOOK };
})((window.Yo = window.Yo || {}));
