// The YO promo reel, written as code: every frame is a pure function of the time t (seconds).
// render.js steps the clock frame by frame, takes a picture of each one, and ffmpeg makes the MP4.
// The sound runs on the same clock: the score below is rendered offline into a WAV.
(function () {
  'use strict';

  const FPS = 30;
  const $ = (sel) => document.querySelector(sel);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const EASE = {
    linear: (k) => k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };

  // ---------- the parts of the reel, in order, with how long each one lasts (seconds) ----------
  const PARTS = [
    ['intro', 3.2], ['meet', 3.3], ['apps', 4.2], ['habits', 5.0], ['translate', 2.8], ['todo', 2.8],
    ['notes', 2.5], ['open', 3.9], ['focus', 2.3], ['prayer', 2.9], ['dress', 5.2], ['end', 4.4],
  ];
  const T = {};
  let DUR = 0;
  PARTS.forEach(([name, len]) => { T[name] = DUR; DUR += len; });
  const END = (name) => T[name] + PARTS.find((p) => p[0] === name)[1]; // when a part ends
  const BAR = 1.2; // the band: malfuf in 2/4 at 100 beats a minute, starting at 0.25 s

  // a camera track: [[t, {values}, ease?], ...]; the ease is the one used to arrive at that key
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i += 1) {
      const [t1, v1, ease] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = (EASE[ease] || EASE.inOut)(span(t, t0, t1));
        const out = {};
        Object.keys(v1).forEach((key) => {
          out[key] = typeof v1[key] === 'number' ? mix(v0[key], v1[key], k) : k < 0.5 ? v0[key] : v1[key];
        });
        return out;
      }
    }
    return keys[keys.length - 1][1];
  }

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const MINT = '#9FE1CB';
  const SIDI = '#5C9BEA';

  // ---------- the cast: YO big (the star) and YO small (in the pill on the desktop) ----------
  const big = Yo.mascot.mount($('#bigYo'), 560);
  const small = Yo.mascot.mount($('#smallYo'), 34);
  let look = { color: 'mint' };
  const dress = (more, who = big) => { look = Object.assign({}, look, more); who.setLook(look); };
  big.setLook(look);
  small.setLook({ color: 'mint' });
  big.setActive(true);
  small.setActive(true);

  // ---------- floating lights behind everything ----------
  const bokeh = document.createElement('div');
  bokeh.id = 'bokeh';
  $('#bg').after(bokeh);
  const LIGHTS = Array.from({ length: 26 }, (_, i) => {
    const el = document.createElement('i');
    const size = 6 + ((i * 53) % 17);
    el.style.width = el.style.height = size + 'px';
    bokeh.appendChild(el);
    return { el, x: (i * 137 + 40) % 1040, y0: (i * 311) % 1920, speed: 18 + ((i * 29) % 30), sway: (i * 0.7) % 6.28, a: 0.05 + ((i * 7) % 10) / 100 };
  });

  // ---------- words ----------
  const FLAG = (() => {
    // Tunisia: red field, white disc, red crescent and star
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 ? 0.75 : 1.85;
      const a = Math.PI + (i * Math.PI) / 5;
      pts.push((16.9 + Math.cos(a) * r).toFixed(2) + ',' + (10 + Math.sin(a) * r).toFixed(2));
    }
    return '<svg width="96" height="64" viewBox="0 0 30 20"><rect width="30" height="20" rx="2.5" fill="#E70013"/>' +
      '<circle cx="15" cy="10" r="5.4" fill="#fff"/><circle cx="14.6" cy="10" r="4" fill="#E70013"/>' +
      '<circle cx="15.6" cy="10" r="3.2" fill="#fff"/><polygon fill="#E70013" points="' + pts.join(' ') + '"/></svg>';
  })();

  // [from, to, top, size, html, class]
  const CAPTIONS = [
    [0.35, 2.75, 210, 86, 'I made a little robot'],
    [0.75, 2.75, 312, 86, 'that lives on my PC', 'acc'],
    [1.0, 2.6, 1150, 42, 'Ctrl + Space and it drops in', 'sub'],
    [T.meet + 0.35, END('meet') - 0.05, 220, 160, 'Meet YO'],
    [T.meet + 0.7, END('meet') - 0.05, 410, 52, 'a small healthy companion', 'sub'],
    [T.apps + 0.15, END('apps') - 0.1, 190, 86, 'Everything in one place'],
    [T.apps + 0.4, END('apps') - 0.1, 300, 46, '8 little apps, one click away', 'sub'],
    [T.habits + 0.15, END('habits') - 0.1, 190, 86, 'It keeps your habits'],
    [T.habits + 0.4, END('habits') - 0.1, 300, 46, 'and celebrates every one', 'sub'],
    [T.translate + 0.1, END('translate') - 0.1, 190, 86, 'Translate anything'],
    [T.translate + 0.35, END('translate') - 0.1, 300, 46, 'English, French, Arabic…', 'sub'],
    [T.todo + 0.1, END('todo') - 0.1, 190, 86, 'A to-do for exams'],
    [T.todo + 0.35, END('todo') - 0.1, 300, 46, 'dates, countdowns, reminders', 'sub'],
    [T.notes + 0.1, END('notes') - 0.1, 190, 86, 'Quick notes'],
    [T.notes + 0.35, END('notes') - 0.1, 300, 46, 'they save themselves', 'sub'],
    [T.open + 0.1, END('open') - 0.1, 190, 86, 'It opens your apps'],
    [T.open + 0.35, END('open') - 0.1, 300, 46, 'type a few letters, press Enter', 'sub'],
    [T.focus + 0.1, END('focus') - 0.1, 220, 96, 'It focuses with you'],
    [T.prayer + 0.1, END('prayer') - 0.1, 220, 96, 'Calm prayer times'],
    [T.prayer + 0.35, END('prayer') - 0.1, 345, 48, 'offline, Tunisia method', 'sub'],
    [T.dress + 0.05, END('dress') - 0.1, 230, 100, 'Dress it up' + FLAG],
    [T.dress + 0.4, END('dress') - 0.1, 360, 52, 'with a Tunisian touch', 'sub'],
  ].map(([a, b, top, size, html, cls]) => {
    const el = document.createElement('div');
    el.className = 'cap';
    el.style.top = top + 'px';
    el.style.fontSize = size + 'px';
    el.innerHTML = cls ? '<span class="' + cls + '">' + html + '</span>' : html;
    $('#captions').appendChild(el);
    return { a, b, el };
  });

  // words arrive from below and leave upward
  function words(el, t, a, b) {
    const kin = EASE.out(span(t, a, a + 0.5));
    const kout = EASE.in(span(t, b - 0.3, b));
    el.style.opacity = String(kin * (1 - kout));
    el.style.transform = 'translateY(' + ((1 - kin) * 46 - kout * 24) + 'px)';
    el.style.filter = kin < 1 ? 'blur(' + ((1 - kin) * 8).toFixed(1) + 'px)' : '';
  }

  // outfit names under YO
  const LABELS = [[T.dress + 0.4, T.dress + 1.4, 'Chechia'], [T.dress + 1.5, T.dress + 2.5, 'Fouta scarf'],
    [T.dress + 2.6, T.dress + 3.6, 'Sidi Bou Said'], [T.dress + 3.7, END('dress') - 0.1, 'Golden fanous']];

  // something that comes in (from below) and goes away between two times; returns its offset
  function inOut(el, t, a, b, dy = 60) {
    const kin = EASE.out(span(t, a, a + 0.45));
    const kout = EASE.in(span(t, b - 0.3, b));
    el.style.display = t >= a && t <= b ? '' : 'none';
    el.style.opacity = String(kin * (1 - kout));
    return (1 - kin) * dy + kout * dy * 0.5;
  }
  const typed = (text, t, from, gap) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - from) / gap) + 1)));
  const CHECK = (color) => '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- habit rows ----------
  function card(top, ico, name, cue, on) {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.top = top + 'px';
    el.innerHTML = '<div class="ico">' + ico + '</div><div class="txt"><div class="name">' + name + '</div>' +
      '<div class="cue">' + cue + '</div><div class="chain">' + '<i></i>'.repeat(7) + '</div></div>' +
      '<div class="check">' + CHECK('#04130e') + '</div>';
    $('#cards').appendChild(el);
    const dots = el.querySelectorAll('.chain i');
    dots.forEach((d, i) => d.classList.toggle('on', i < on));
    return { el, dots, on, check: el.querySelector('.check') };
  }
  const HABITS = [
    Object.assign(card(0, '💧', 'Drink water', 'after Fajr · 2 glasses', 6), { at: T.habits + 0.3, done: T.habits + 0.9 }),
    Object.assign(card(200, '🏃', 'Walk 20 min', 'after Asr', 3), { at: T.habits + 0.42, done: T.habits + 3.1 }),
    Object.assign(card(400, '📖', 'Read 10 pages', 'before bed', 5), { at: T.habits + 0.54, done: Infinity }),
  ];
  const SPROUT = T.habits + 1.9;
  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = '7 days in a row 🌱';
  HABITS[0].el.appendChild(badge);

  // ---------- all of YO's apps: its home screen, with the real icons (renderer/commands.js) ----------
  // [id, name, the face YO shows on its visor for it]
  const APP_LIST = [['translate', 'Translate', 'speech'], ['habits', 'Habits', 'star'], ['todo', 'To-do', 'check'], ['notes', 'Notes', 'notes'],
    ['focus', 'Focus', 'clock'], ['prayer', 'Prayer', 'moon'], ['inbox', 'Inbox', 'news'], ['customize', 'Customize', 'star']];
  const appsEl = document.createElement('div');
  appsEl.id = 'apps';
  const TILES = APP_LIST.map(([id, name], i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.left = (i % 4) * 234 + 'px';
    tile.style.top = Math.floor(i / 4) * 234 + 'px';
    const cmd = Yo.commands.byId(id);
    tile.innerHTML = '<div class="icon">' + (cmd ? cmd.icon : '') + '</div><div>' + name + '</div>'; // static markup from commands.js
    appsEl.appendChild(tile);
    return tile;
  });
  $('#frame').insertBefore(appsEl, $('#captions'));
  const TILE_IN = T.apps + 0.35;
  const SWEEP = T.apps + 1.35; // a light runs over the tiles, one after the other
  const SWEEP_STEP = 0.27;

  // ---------- the detail cards: translate, to-do, notes ----------
  const detail = document.createElement('div');
  detail.id = 'detail';
  $('#frame').insertBefore(detail, $('#captions'));
  const dcard = (html) => { const el = document.createElement('div'); el.className = 'dcard'; el.innerHTML = html; detail.appendChild(el); return el; };
  const trCard = dcard('<div class="lang"><b>EN</b><span class="src big"></span></div><div class="swap">⇅</div>' +
    '<div class="lang"><b>FR</b><span class="fr big"></span></div><div class="lang" style="margin-top:14px"><b>AR</b><span class="ar big"></span></div>');
  const TR = { src: 'Good morning', fr: 'Bonjour', ar: 'صباح الخير', type: T.translate + 0.45, swap: T.translate + 1.35 };
  const todoCard = dcard('<div class="k">TO-DO · THIS WEEK</div>' +
    '<div class="row r1"><span class="box">' + CHECK('#04130e') + '</span><span class="t">Maths exam</span><span class="pill hot">in 3 days</span></div>' +
    '<div class="row r2"><span class="box">' + CHECK('#04130e') + '</span><span class="t">Revise physics</span><span class="pill">today 18:00</span></div>' +
    '<div class="row r3"><span class="box">' + CHECK('#04130e') + '</span><span class="t">Call grandma</span><span class="pill">every Sun</span></div>');
  const TODO_TICK = T.todo + 1.45;
  const noteCard = dcard('<div class="k">NOTES · BAC PLAN</div><div class="note"></div><div class="saved">Saved</div>');
  const NOTE_TEXT = 'Maths: chapter 4\nPhysics: optics\nSport after Asr 💪';
  const NOTE_AT = T.notes + 0.45;
  const NOTE_GAP = 0.035;

  // ---------- opening an app: YO's bar, what it finds, the window ----------
  const open = document.createElement('div');
  open.id = 'open';
  open.innerHTML = '<div class="bar"><span class="typed"></span><span class="caret"></span></div>' +
    '<div class="found"><div class="r on"><span class="ic">♪</span>Spotify<span class="kind">App</span></div>' +
    '<div class="r"><span class="ic">♪</span>Spotify Web<span class="kind">App</span></div></div>' +
    '<div class="win"><div class="tb"><span>♪</span><span>Spotify</span><span class="dots">— ▢ ✕</span></div>' +
    '<div class="bd"><div class="art"></div><div class="meta"><div class="kk">NOW PLAYING</div><div class="song">Darbuka Nights</div>' +
    '<div class="artist">Sidi Beats</div><div class="prog"><i></i></div><div class="ctrl"><span>⏮</span><span class="play">❚❚</span><span>⏭</span></div></div></div></div>' +
    '<div id="keycap">Enter</div>';
  $('#frame').insertBefore(open, $('#captions'));
  const TYPED = 'open spo';
  const TYPE_AT = T.open + 0.5;
  const KEY_GAP = 0.11;
  const ENTER = T.open + 1.75;
  const OPENED = ENTER + 0.2;

  // ---------- prayer ----------
  const prayer = document.createElement('div');
  prayer.className = 'card';
  prayer.style.top = '250px';
  prayer.style.height = '200px';
  prayer.innerHTML = '<div class="ico">🌙</div><div class="txt"><div class="name">Maghrib · 18:21</div>' +
    '<div class="cue">in 12 min · Tunis</div><div class="path"><span>Fajr</span><span>Dhuhr</span><span>Asr</span><b>Maghrib</b><span>Isha</span></div></div>';
  $('#cards').appendChild(prayer);

  // ---------- what happens, and when ----------
  // [t, what YO does]
  const EVENTS = [
    [1.3, () => small.react('land')],
    [2.0, () => small.react('wave')],
    [T.meet + 0.1, () => big.react('greet')],
    [T.meet + 2.75, () => big.react('heart')],
    ...APP_LIST.map(([, , face], i) => [SWEEP + i * SWEEP_STEP, () => { big.flash(face, '', 250); big.react('ask'); }]),
    [SWEEP + APP_LIST.length * SWEEP_STEP + 0.05, () => big.react('success')],
    [T.habits + 0.9, () => big.react('sip')],
    [SPROUT, () => { dress({ tip: 'sprout' }); big.react('equip'); }],
    [T.habits + 3.1, () => big.react('jog')],
    [T.translate + 0.2, () => big.setWork('speech')],
    [TR.swap, () => big.react('work')],
    [T.todo, () => big.setWork(null)],
    [TODO_TICK, () => { big.flash('check', '', 900); big.react('success'); }],
    [T.notes + 0.2, () => big.setWork('notes')],
    [T.open, () => big.setWork(null)],
    ...TYPED.split('').map((ch, i) => [TYPE_AT + i * KEY_GAP, () => big.react('type')]),
    [ENTER, () => { big.setWork('launch'); big.react('work'); }],
    [OPENED + 0.35, () => { big.setWork(null); big.setMusic(true); }],
    [END('open') - 0.15, () => big.setMusic(false)],
    [T.focus - 0.05, () => { dress({ hat: 'headphones' }); big.react('work'); big.setWork('screen', '25:00'); }],
    ...[24, 23, 22, 21, 20].map((m, i) => [T.focus + 0.5 + i * 0.3, () => big.setWork('screen', m + ':00')]),
    [T.prayer - 0.05, () => { dress({ hat: 'none' }); big.setWork('moon'); big.setMood('done'); }],
    [T.dress, () => { big.setWork(null); big.setMood(null); }],
    [T.dress + 0.4, () => { dress({ hat: 'chechia' }); big.react('equip'); }],
    [T.dress + 1.5, () => { dress({ neck: 'fouta' }); big.react('equip'); }],
    [T.dress + 2.6, () => { dress({ color: 'sidi' }); big.react('equip'); }],
    [T.dress + 3.7, () => { dress({ item: 'fanous' }); big.react('equip'); }],
    [T.end, () => dress({ tip: 'jasmine', item: 'none' })],
    [T.end + 0.2, () => big.react('jump')],
    [T.end + 1.6, () => big.react('wave')],
    [T.end + 2.7, () => big.react('love')],
  ].sort((x, y) => x[0] - y[0]);

  // [t, sound]: YO's own score (renderer/sound.js) and the reel's own (whoosh, riser, sparkle, key)
  const SFX = [
    [1.3, 'arrive'], [2.0, 'hello'], [T.meet + 0.1, 'arrive'], [T.meet + 1.4, 'hello'], [T.meet + 2.75, 'pet'],
    // every part after the first ones comes in with a whoosh
    ...PARTS.slice(2).map(([name]) => [T[name] - 0.12, 'whoosh']),
    [T.apps + 0.2, 'drawer'], ...APP_LIST.map((a, i) => [TILE_IN + i * 0.09, 'tick']),
    ...APP_LIST.map((a, i) => [SWEEP + i * SWEEP_STEP, 'open']), [SWEEP + APP_LIST.length * SWEEP_STEP + 0.05, 'success'],
    [T.habits + 0.9, 'tick'], [T.habits + 0.95, 'success'], [T.habits + 1.55, 'gulp'], [SPROUT, 'unlock'], [SPROUT + 0.05, 'sparkle'],
    [T.habits + 3.1, 'tick'], [T.habits + 3.15, 'success'],
    ...TR.src.split('').map((ch, i) => (i % 2 ? null : [TR.type + i * 0.045, 'key'])).filter(Boolean),
    [TR.swap, 'equip'],
    [TODO_TICK, 'tick'], [TODO_TICK + 0.05, 'success'],
    ...NOTE_TEXT.split('').map((ch, i) => (i % 3 ? null : [NOTE_AT + i * NOTE_GAP, 'key'])).filter(Boolean),
    [NOTE_AT + NOTE_TEXT.length * NOTE_GAP + 0.15, 'set'],
    ...TYPED.split('').map((ch, i) => [TYPE_AT + i * KEY_GAP, 'key']),
    [ENTER, 'key'], [ENTER + 0.05, 'success'],
    [T.focus - 0.05, 'set'], ...[0, 1, 2, 3, 4].map((i) => [T.focus + 0.5 + i * 0.3, 'tick']),
    [T.prayer + 0.3, 'prayer'],
    [T.dress - 1.1, 'riser'],
    [T.dress + 0.4, 'equip'], [T.dress + 1.5, 'equip'], [T.dress + 2.6, 'equip'], [T.dress + 3.7, 'equip'], [T.dress + 3.75, 'sparkle'],
    [T.end + 0.3, 'success'], [T.end + 0.35, 'sparkle'], [T.end + 1.6, 'hello'], [T.end + 2.7, 'pet'],
  ];

  // ---------- the camera and the layout at time t ----------
  const UP = { y: 600, s: 0.62, o: 1 }; // YO up top, its app below
  const HERO = [
    [0, { y: 492, s: 0.42, o: 0 }],
    [3.12, { y: 492, s: 0.42, o: 0 }],
    [3.22, { y: 492, s: 0.42, o: 1 }, 'linear'],
    [3.95, { y: 900, s: 1, o: 1 }, 'back'],
    [T.apps - 0.05, { y: 900, s: 1, o: 1 }],
    [T.apps + 0.45, UP],
    [T.habits, UP],
    [T.habits + 0.45, { y: 690, s: 0.78, o: 1 }],
    [T.translate - 0.1, { y: 690, s: 0.78, o: 1 }],
    [T.translate + 0.35, UP],
    [T.focus - 0.2, UP],
    [T.focus + 0.3, { y: 860, s: 0.86, o: 1 }],
    [T.dress - 0.2, { y: 860, s: 0.86, o: 1 }],
    [T.dress + 0.35, { y: 960, s: 1, o: 1 }],
    [T.end - 0.1, { y: 960, s: 1, o: 1 }],
    [T.end + 0.5, { y: 720, s: 0.86, o: 1 }],
  ];
  // the glow behind YO follows its color
  const GLOW = [
    [0, { c: '#4F7FE0', a: 0.16 }],
    [3.2, { c: '#4F7FE0', a: 0.16 }],
    [3.9, { c: MINT, a: 0.2 }],
    [OPENED, { c: MINT, a: 0.2 }],
    [OPENED + 0.4, { c: '#E3508B', a: 0.22 }],
    [T.focus, { c: '#E3508B', a: 0.22 }],
    [T.focus + 0.4, { c: '#5C9BEA', a: 0.18 }],
    [T.prayer + 0.3, { c: '#A99BF0', a: 0.18 }],
    [T.dress + 0.2, { c: MINT, a: 0.2 }],
    [T.dress + 0.7, { c: '#E0434F', a: 0.26 }],
    [T.dress + 1.8, { c: '#F0997B', a: 0.22 }],
    [T.dress + 2.9, { c: SIDI, a: 0.26 }],
    [T.dress + 4.0, { c: '#E8C24F', a: 0.24 }],
    [T.end + 0.3, { c: SIDI, a: 0.26 }],
  ];

  function glowAt(t) {
    // colors are mixed by hand: the track helper only mixes numbers
    let i = 1;
    while (i < GLOW.length - 1 && GLOW[i][0] < t) i += 1;
    const [t0, g0] = GLOW[i - 1];
    const [t1, g1] = GLOW[i];
    const k = EASE.inOut(span(t, t0, t1));
    const [r0, gg0, b0] = hex(g0.c);
    const [r1, gg1, b1] = hex(g1.c);
    return [mix(r0, r1, k), mix(gg0, gg1, k), mix(b0, b1, k), mix(g0.a, g1.a, k)];
  }
  // the band is quiet in focus and prayer: the glow only pulses when it plays
  const bandOn = (t) => t > 0.25 && !(t > T.focus + 0.2 && t < T.dress - 0.2);
  // a soft pulse on each doum (the start of every bar)
  const pulse = (t) => {
    if (!bandOn(t)) return 0;
    const sinceDoum = (((t - 0.25) % BAR) + BAR) % BAR;
    return Math.exp(-sinceDoum * 7);
  };

  function layout(t) {
    const frame = $('#frame');
    frame.style.setProperty('--acc', t < T.dress + 2.6 ? MINT : SIDI);

    // scene A: the desktop, then the camera dives into the pill
    const zoom = EASE.in(span(t, 2.45, 3.35));
    $('#world').style.transform = 'scale(' + (1 + zoom * 6).toFixed(4) + ')';
    $('#world').style.opacity = String(1 - span(t, 3.0, 3.3));
    $('#world').style.visibility = t > 3.35 ? 'hidden' : '';
    const deskIn = EASE.out(span(t, 0, 0.6));
    $('#desk').style.opacity = String(deskIn);
    $('#desk').style.transform = 'translateY(' + ((1 - deskIn) * 40) + 'px) scale(' + (0.94 + deskIn * 0.06) + ')';
    const pill = EASE.back(span(t, 1.0, 1.35));
    $('#desk .pill').style.height = (44 * pill).toFixed(1) + 'px';

    // YO big, breathing a little with the beat
    const h = track(HERO, t);
    const hero = $('#hero');
    hero.style.transform = 'translate(540px, ' + h.y.toFixed(1) + 'px)';
    hero.style.opacity = String(h.o);
    $('#bigYo').style.transform = 'translate(-50%, -50%) scale(' + (h.s * (1 + pulse(t) * 0.012)).toFixed(4) + ')';

    const [r, g, b, a] = glowAt(t);
    const gy = t < 3.2 ? 770 : h.y;
    const ga = a * (1 + pulse(t) * 0.35);
    $('#bg').style.background = 'radial-gradient(760px 760px at 540px ' + gy.toFixed(0) + 'px, rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + ga.toFixed(3) + '), transparent 72%)';

    // the floating lights drift up slowly
    LIGHTS.forEach((l) => {
      const y = ((l.y0 - t * l.speed) % 1920 + 1920) % 1920;
      const x = l.x + Math.sin(t * 0.6 + l.sway) * 14;
      l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      l.el.style.opacity = (l.a * span(t, 3.2, 4.2) * (1 + pulse(t) * 0.6)).toFixed(3);
    });

    CAPTIONS.forEach((c) => {
      const on = t >= c.a - 0.01 && t <= c.b + 0.01;
      c.el.style.display = on ? '' : 'none';
      if (on) words(c.el, t, c.a, c.b);
    });

    // outfit name
    const label = LABELS.find(([a2, b2]) => t >= a2 && t <= b2);
    const lab = $('#label');
    lab.style.top = '1310px';
    if (label) {
      if (lab.dataset.text !== label[2]) { lab.dataset.text = label[2]; lab.innerHTML = '<span>' + label[2] + '</span>'; }
      const k = EASE.back(span(t, label[0], label[0] + 0.35));
      const out = span(t, label[1] - 0.15, label[1]);
      lab.style.opacity = String(span(t, label[0], label[0] + 0.15) * (1 - out));
      lab.style.transform = 'scale(' + (0.7 + 0.3 * k) + ')';
    } else {
      lab.style.opacity = '0';
    }

    // all the apps: the tiles pop in, then a light runs over them
    const appsOut = EASE.in(span(t, END('apps') - 0.4, END('apps') - 0.05));
    appsEl.style.display = t >= TILE_IN && t <= END('apps') ? '' : 'none';
    appsEl.style.opacity = String(1 - appsOut);
    appsEl.style.transform = 'translateY(' + (appsOut * 40).toFixed(1) + 'px)';
    const lit = Math.floor((t - SWEEP) / SWEEP_STEP);
    TILES.forEach((tile, i) => {
      const k = EASE.back(span(t, TILE_IN + i * 0.09, TILE_IN + i * 0.09 + 0.45));
      const on = lit === i || (lit >= APP_LIST.length && t < END('apps') - 0.4);
      const hop = lit === i ? Math.sin(span(t, SWEEP + i * SWEEP_STEP, SWEEP + i * SWEEP_STEP + 0.25) * Math.PI) * 0.1 : 0;
      tile.style.opacity = String(span(t, TILE_IN + i * 0.09, TILE_IN + i * 0.09 + 0.12));
      tile.style.transform = 'translateY(' + ((1 - k) * 60).toFixed(1) + 'px) scale(' + (0.6 + 0.4 * k + hop).toFixed(3) + ')';
      tile.classList.toggle('on', on);
    });

    // habit rows: in, tick, out
    HABITS.forEach((hb) => {
      const kin = EASE.out(span(t, hb.at, hb.at + 0.5));
      const kout = EASE.in(span(t, END('habits') - 0.4, END('habits') - 0.05));
      hb.el.style.opacity = String(kin * (1 - kout));
      hb.el.style.transform = 'translateY(' + ((1 - kin) * 70 + kout * 30) + 'px) scale(' + (0.96 + kin * 0.04) + ')';
      const done = t >= hb.done;
      hb.el.classList.toggle('done', done);
      hb.dots.forEach((d, i) => d.classList.toggle('on', i < hb.on + (done ? 1 : 0)));
      const pop = span(t, hb.done, hb.done + 0.35);
      hb.check.style.transform = 'scale(' + (done ? 1 + Math.sin(pop * Math.PI) * 0.18 : 1) + ')';
      hb.el.style.display = kin > 0 && kout < 1 ? '' : 'none';
    });
    badge.style.opacity = String(span(t, SPROUT, SPROUT + 0.1));
    badge.style.transform = 'scale(' + EASE.back(span(t, SPROUT, SPROUT + 0.35)) + ')';

    // translate: the words typed, then the answers swap in
    trCard.style.transform = 'translateY(' + inOut(trCard, t, T.translate + 0.2, END('translate') - 0.05).toFixed(1) + 'px)';
    trCard.querySelector('.src').textContent = typed(TR.src, t, TR.type, 0.045);
    const tk = span(t, TR.swap, TR.swap + 0.5);
    trCard.querySelector('.swap').style.transform = 'rotate(' + (EASE.inOut(tk) * 180).toFixed(1) + 'deg)';
    trCard.querySelector('.fr').textContent = t >= TR.swap + 0.15 ? TR.fr : '';
    trCard.querySelector('.ar').textContent = t >= TR.swap + 0.35 ? TR.ar : '';
    ['.fr', '.ar'].forEach((sel, i) => {
      const k = EASE.back(span(t, TR.swap + 0.15 + i * 0.2, TR.swap + 0.5 + i * 0.2));
      trCard.querySelector(sel).style.display = 'inline-block';
      trCard.querySelector(sel).style.transform = 'translateY(' + ((1 - k) * 30).toFixed(1) + 'px)';
    });

    // to-do: three tasks, the revision gets ticked
    todoCard.style.transform = 'translateY(' + inOut(todoCard, t, T.todo + 0.2, END('todo') - 0.05).toFixed(1) + 'px)';
    todoCard.querySelectorAll('.row').forEach((row, i) => {
      const k = EASE.out(span(t, T.todo + 0.35 + i * 0.12, T.todo + 0.75 + i * 0.12));
      row.style.opacity = String(k);
      row.style.transform = 'translateX(' + ((1 - k) * 60).toFixed(1) + 'px)';
    });
    const r2 = todoCard.querySelector('.r2');
    r2.classList.toggle('done', t >= TODO_TICK);
    r2.querySelector('.box').style.transform = 'scale(' + (t >= TODO_TICK ? 1 + Math.sin(span(t, TODO_TICK, TODO_TICK + 0.35) * Math.PI) * 0.2 : 1) + ')';
    todoCard.querySelector('.pill.hot').style.transform = 'scale(' + (1 + pulse(t) * 0.06) + ')';

    // notes: the note types itself, then "Saved"
    noteCard.style.transform = 'translateY(' + inOut(noteCard, t, T.notes + 0.2, END('notes') - 0.05).toFixed(1) + 'px)';
    noteCard.querySelector('.note').textContent = typed(NOTE_TEXT, t, NOTE_AT, NOTE_GAP);
    const savedAt = NOTE_AT + NOTE_TEXT.length * NOTE_GAP + 0.15;
    noteCard.querySelector('.saved').style.opacity = String(span(t, savedAt, savedAt + 0.15));
    noteCard.querySelector('.saved').style.transform = 'scale(' + EASE.back(span(t, savedAt, savedAt + 0.35)) + ')';

    // opening an app
    const barEl = open.querySelector('.bar');
    barEl.style.transform = 'translateY(' + inOut(barEl, t, T.open + 0.15, END('open') - 0.05).toFixed(1) + 'px)';
    const letters = typed(TYPED, t, TYPE_AT, KEY_GAP);
    open.querySelector('.typed').innerHTML = letters || '<span class="ph">Open, translate, remind me…</span>';
    open.querySelector('.caret').style.opacity = t < ENTER && Math.floor(t * 2.4) % 2 === 0 ? '1' : '0';
    const found = open.querySelector('.found');
    found.style.transform = 'translateY(' + inOut(found, t, TYPE_AT + 5 * KEY_GAP, ENTER + 0.25, 30).toFixed(1) + 'px)';
    const win = open.querySelector('.win');
    inOut(win, t, OPENED, END('open') - 0.05, 0);
    const wk = span(t, OPENED, OPENED + 0.55);
    win.style.transform = 'translateY(' + ((1 - EASE.out(wk)) * -220).toFixed(1) + 'px) scale(' + (0.25 + 0.75 * EASE.back(wk)).toFixed(3) + ')';
    win.style.opacity = String(span(t, OPENED, OPENED + 0.12) * (1 - EASE.in(span(t, END('open') - 0.35, END('open') - 0.05))));
    win.querySelector('.prog i').style.width = (24 + Math.max(0, t - OPENED) * 3).toFixed(1) + '%';
    win.querySelector('.art').style.transform = 'scale(' + (1 + pulse(t) * 0.04) + ')';
    const key = $('#keycap');
    key.style.display = t > ENTER - 0.1 && t < ENTER + 1.0 ? '' : 'none';
    key.style.opacity = String(span(t, ENTER - 0.1, ENTER) * (1 - span(t, ENTER + 0.7, ENTER + 1.0)));
    key.style.transform = 'translateX(-50%) translateY(' + ((1 - EASE.back(span(t, ENTER - 0.05, ENTER + 0.3))) * 30).toFixed(1) + 'px) scale(' + (t < ENTER + 0.08 ? 0.92 : 1) + ')';

    // focus ring
    const ring = $('#ring');
    ring.style.opacity = String(span(t, T.focus, T.focus + 0.35) * (1 - span(t, END('focus') - 0.3, END('focus'))));
    ring.style.left = (540 - 380) + 'px';
    ring.style.top = (h.y - 380) + 'px';
    ring.style.transform = 'scale(' + (0.92 + 0.08 * EASE.out(span(t, T.focus, T.focus + 0.45))) + ')';
    ring.querySelector('.arc').style.strokeDashoffset = String(578 * (1 - EASE.inOut(span(t, T.focus + 0.3, END('focus') - 0.2)) * 0.4));
    ring.querySelector('.arc').style.stroke = MINT;

    // prayer card
    const pin = EASE.out(span(t, T.prayer + 0.2, T.prayer + 0.7));
    const pout = span(t, END('prayer') - 0.3, END('prayer'));
    prayer.style.opacity = String(pin * (1 - pout));
    prayer.style.transform = 'translateY(' + ((1 - pin) * 60) + 'px)';
    prayer.style.display = pin > 0 && pout < 1 ? '' : 'none';

    // the end card
    const end = $('#end');
    end.style.opacity = t > T.end + 0.1 ? '1' : '0';
    [['.word', T.end + 0.25], ['.free', T.end + 0.6], ['.cta', T.end + 1.0]].forEach(([sel, at]) => {
      const k = EASE.back(span(t, at, at + 0.5));
      const el = end.querySelector(sel);
      el.style.opacity = String(span(t, at, at + 0.2));
      el.style.transform = 'translateY(' + ((1 - k) * 50) + 'px)';
    });
  }

  // ---------- one frame ----------
  let fired = 0;
  function step(t, n) {
    while (fired < EVENTS.length && EVENTS[fired][0] <= t + 1e-6) {
      EVENTS[fired][1]();
      fired += 1;
    }
    layout(t);
    // two half steps per frame keep YO's springs as smooth as in the app (60 per second)
    window.__clock.tick(t * 1000 - 1000 / 60);
    window.__clock.tick(t * 1000);
    shown = n;
    half(0);
  }

  // the renderer takes each frame in two halves: this slides the frame up to show the bottom one
  let shown = 0;
  function half(h) {
    $('#frame').style.transform = h ? 'translateY(-960px)' : '';
    document.querySelectorAll('.marker').forEach((m) => { m.style.background = 'rgb(' + (shown & 255) + ',' + ((shown >> 8) * 32) + ',' + h * 128 + ')'; });
  }

  // ---------- sound, on the same clock ----------
  // YO's voice, copied from renderer/sound.js: [f0, f1, at, dur, vol, type?, vib?]
  const SCORE = {
    hello: [[620, 940, 0, 0.07, 0.4], [880, 1250, 0.09, 0.07, 0.4], [1180, 1700, 0.18, 0.12, 0.4, 't', 40]],
    arrive: [[700, 1050, 0, 0.06, 0.28], [1000, 1400, 0.07, 0.07, 0.28]],
    tick: [[1500, 1500, 0, 0.022, 0.07, 's']],
    open: [[520, 820, 0, 0.06, 0.18]],
    drawer: [[600, 900, 0, 0.05, 0.16], [900, 1200, 0.05, 0.05, 0.14]],
    equip: [[880, 1320, 0, 0.06, 0.25], [1320, 1760, 0.07, 0.08, 0.25], [2093, 2093, 0.15, 0.18, 0.1, 's']],
    gulp: [[320, 160, 0, 0.09, 0.45, 's'], [520, 900, 0.11, 0.07, 0.3]],
    unlock: [[784, 784, 0, 0.12, 0.28, 's'], [988, 988, 0.1, 0.12, 0.28, 's'], [1175, 1175, 0.2, 0.12, 0.28, 's'],
      [1568, 1568, 0.3, 0.3, 0.3, 's'], [2093, 2093, 0.3, 0.4, 0.08, 's']],
    pet: [[520, 400, 0, 0.22, 0.38, 's'], [600, 470, 0.2, 0.24, 0.32, 's']],
    success: [[784, 784, 0, 0.22, 0.3, 's'], [988, 988, 0.07, 0.22, 0.3, 's'], [1319, 1319, 0.14, 0.22, 0.3, 's']],
    set: [[1200, 1200, 0, 0.03, 0.22, 's'], [900, 900, 0.14, 0.03, 0.22, 's'], [1200, 1200, 0.28, 0.03, 0.18, 's']],
    prayer: [[294, 294, 0, 1.8, 0.3, 's'], [440, 440, 0.45, 1.8, 0.26, 's'], [587, 587, 0.9, 2.4, 0.22, 's'], [880, 880, 0.9, 1.6, 0.04, 's']],
    key: [[900, 700, 0, 0.02, 0.1]],
  };

  async function audio() {
    const sr = 48000;
    const c = new OfflineAudioContext(2, Math.ceil(DUR * sr), sr);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.ratio.value = 8;
    const master = c.createGain();
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(1.1, 0.3);
    master.gain.setValueAtTime(1.1, DUR - 0.9);
    master.gain.linearRampToValueAtTime(0, DUR);
    master.connect(limiter); limiter.connect(c.destination);

    const sfx = c.createGain(); sfx.gain.value = 0.85; sfx.connect(master);
    SFX.forEach(([at, name]) => {
      if (name === 'whoosh') return Band.whoosh(c, sfx, at, 0.28);
      if (name === 'riser') return Band.riser(c, sfx, at, 1.1, 0.24);
      if (name === 'sparkle') return Band.sparkle(c, sfx, at, 0.1);
      SCORE[name].forEach(([f0, f1, dt, dur, vol, type, vib]) => {
        Band.tone(c, sfx, { type: type === 's' ? 'sine' : 'triangle', f0, f1, at: at + dt, dur, vol, vib: vib || 0 });
      });
    });

    // the band: darbuka and chords, a shaker and bass; louder when the music app plays,
    // out for focus and prayer, back for the outfits and the end
    const band = c.createGain();
    const set = (at, v) => band.gain.setValueAtTime(v, at);
    const ramp = (at, v) => band.gain.linearRampToValueAtTime(v, at);
    set(0, 0.5);
    set(OPENED, 0.5); ramp(OPENED + 0.3, 0.8);
    set(END('open') - 0.2, 0.8); ramp(T.focus + 0.2, 0.0);
    set(T.dress - 0.2, 0.0); ramp(T.dress + 0.15, 0.62);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    band.connect(lp); lp.connect(master);
    Band.play(c, band, 0.25, DUR);
    const groove = c.createGain(); groove.gain.value = 0.55; groove.connect(band);
    Band.groove(c, groove, 0.25 + BAR * 2, DUR); // the shaker and bass join after two bars
    const buf = await c.startRendering();
    return Band.wav(buf);
  }

  window.__scene = { FPS, DUR, step, half, audio };
})();
