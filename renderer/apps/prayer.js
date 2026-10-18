(function (Y) {
  'use strict';

  // Prayer times: the day's times for your city (worked out on this PC by renderer/prayer-calc.js),
  // a calm scene that follows the real sky, a bell per prayer, and gentle reminders.
  // At prayer time YO comes down quietly with a soft tone, offers "I prayed" and "Snooze", then keeps
  // its own news to itself for a while. No streaks, no scores: what you mark stays on this PC.
  const C = Y.prayerCalc;
  const { h, button } = Y.miniapps;
  const KEY = 'yo.prayer';
  const DONE = 'yo.prayed';
  const BEFORE = [0, 5, 10, 15, 20];
  const QUIET = [0, 10, 15, 30];
  const DEFAULTS = {
    place: null, method: 'tunisia', asr: 'shafi', adjust: {}, before: 10, sound: 'soft', quiet: 15,
    bells: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  };

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v && typeof v === 'object' ? v : fallback;
    } catch (err) {
      return fallback;
    }
  }
  const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (err) { /* not kept */ } };

  function loadSettings() {
    const saved = read(KEY, {});
    const s = JSON.parse(JSON.stringify(DEFAULTS));
    const p = saved.place;
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) {
      s.place = { name: String(p.name || '').slice(0, 60), country: String(p.country || '').slice(0, 40), lat: p.lat, lon: p.lon, tz: typeof p.tz === 'string' ? p.tz : '' };
    }
    if (C.METHODS[saved.method]) s.method = saved.method;
    if (saved.asr === 'hanafi') s.asr = 'hanafi';
    if (BEFORE.indexOf(saved.before) !== -1) s.before = saved.before;
    if (QUIET.indexOf(saved.quiet) !== -1) s.quiet = saved.quiet;
    if (saved.sound === 'silent') s.sound = 'silent';
    if (saved.adjust && typeof saved.adjust === 'object') {
      C.NAMES.forEach((n) => { if (Number.isFinite(saved.adjust[n])) s.adjust[n] = Math.max(-30, Math.min(30, Math.round(saved.adjust[n]))); });
    }
    if (saved.bells && typeof saved.bells === 'object') C.PRAYERS.forEach((n) => { if (typeof saved.bells[n] === 'boolean') s.bells[n] = saved.bells[n]; });
    return s;
  }

  const set = loadSettings();
  const save = () => write(KEY, set);
  const t = (key) => Y.i18n.t(key);
  const pname = (n) => t('prayer.name.' + n);

  // today's times in your city, worked out again when the day changes there
  let cache = { key: '', times: null };
  function today() {
    if (!set.place) return null;
    const day = C.dayIn(set.place.tz, new Date(Date.now()));
    const key = day.join('-') + JSON.stringify([set.place.lat, set.place.lon, set.method, set.asr, set.adjust]);
    if (cache.key !== key) cache = { key, day, times: C.times(set.place, { method: set.method, asr: set.asr, adjust: set.adjust }, day) };
    return cache;
  }

  function tomorrowFajr() {
    const now = today();
    if (!now) return null;
    const [y, m, d] = now.day;
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return C.times(set.place, { method: set.method, asr: set.asr, adjust: set.adjust }, [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()]).fajr;
  }

  // the next prayer (sunrise doesn't count): { name, at }
  function next() {
    const now = today();
    if (!now) return null;
    const ms = Date.now();
    const name = C.PRAYERS.find((n) => now.times[n].getTime() > ms);
    return name ? { name, at: now.times[name] } : { name: 'fajr', at: tomorrowFajr() };
  }

  function span(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 1) return t('prayer.now');
    const hh = Math.floor(min / 60);
    return hh ? hh + 'h ' + (min % 60) + 'm' : min + ' min';
  }

  // what you marked as prayed today (just for you, on this PC)
  function prayedToday() {
    const now = today();
    const v = read(DONE, {});
    return now && v.day === now.day.join('-') && Array.isArray(v.done) ? v.done : [];
  }
  function markPrayed(name) {
    const now = today();
    if (!now) return;
    const done = prayedToday();
    if (done.indexOf(name) === -1) done.push(name);
    write(DONE, { day: now.day.join('-'), done });
  }

  // ---------- reminders: a heads-up before, then at the time; they run even when the app is closed ----------
  let host = null;
  const fired = new Set();
  let snoozes = [];
  let quietTimer = null;
  let listeners = [];

  function alert(name, at, soon) {
    if (!host) return;
    const time = C.clock(at, set.place.tz);
    if (soon) {
      host.card(t('prayer.card.soon').replace('{name}', pname(name)).replace('{n}', set.before),
        t('prayer.card.soonBody').replace('{time}', time).replace('{place}', set.place.name), [], { calm: true, sound: '', face: 'moon', label: t('short.prayer') });
      return;
    }
    host.card(t('prayer.card.title').replace('{name}', pname(name)), t('prayer.card.body') + '\n' + set.place.name + ' · ' + time, [
      { label: t('prayer.card.prayed'), primary: true, run: () => { markPrayed(name); listeners.forEach((fn) => fn()); } },
      { label: t('prayer.card.snooze'), run: () => { snoozes.push({ name, at: Date.now() + 10 * 60000 }); } },
      { label: t('prayer.card.open'), run: () => host.open('prayer', '') },
    ], { calm: true, sound: set.sound === 'soft' ? 'prayer' : '', face: 'moon', label: t('short.prayer') });
    // a quiet moment: YO keeps its own news for a while
    if (set.quiet) {
      host.quiet('prayer', true);
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => host.quiet('prayer', false), set.quiet * 60000);
    }
  }

  function check() {
    const now = today();
    if (!now || !host) return;
    const ms = Date.now();
    const day = now.day.join('-');
    C.PRAYERS.forEach((name) => {
      if (!set.bells[name]) return;
      const at = now.times[name].getTime();
      const soonAt = at - set.before * 60000;
      // fire once, and only near the moment (never a pile of old ones after the PC wakes up)
      if (set.before && ms >= soonAt && ms < at && !fired.has(day + name + 'soon')) {
        fired.add(day + name + 'soon');
        alert(name, now.times[name], true);
      }
      if (ms >= at && ms < at + 10 * 60000 && !fired.has(day + name)) {
        fired.add(day + name);
        alert(name, now.times[name], false);
      }
    });
    snoozes = snoozes.filter((s) => {
      if (ms < s.at) return true;
      alert(s.name, today().times[s.name], false);
      return false;
    });
  }

  function start(h0) {
    host = h0;
    // what's already behind us today doesn't ring
    const now = today();
    if (now) {
      const ms = Date.now();
      C.PRAYERS.forEach((n) => {
        if (now.times[n].getTime() + 60000 < ms) fired.add(now.day.join('-') + n);
        if (now.times[n].getTime() < ms) fired.add(now.day.join('-') + n + 'soon');
      });
    }
    setInterval(check, 15000);
  }

  // "Asr 16:28", for the home tile
  // the Prayer tile: the next prayer and the time left ("Maghrib in 1h 12m"), with its clock time as a title
  function label() {
    const n = next();
    return n && n.at ? pname(n.name) + ' ' + t('prayer.in').replace('{t}', span(n.at - Date.now())) : '';
  }

  function clockLabel() {
    const n = next();
    return n && n.at ? pname(n.name) + ' ' + C.clock(n.at, set.place.tz) : '';
  }

  // ---------- the app ----------
  function mount(h0) {
    host = host || h0;
    let yo = null;
    let view = 'main'; // main, settings, setup
    let timer = null;
    let quote = Math.floor(Math.random() * 3);

    const scene = h('div.pr-scene');
    scene.innerHTML = SCENE; // static markup below
    const sky = scene.querySelector('.pr-sky');
    const yoBox = h('div.pr-yo');
    scene.append(yoBox);
    const nextChip = h('div.pr-next');
    const list = h('div.pr-list');
    const foot = h('div.pr-foot');
    const quoteEl = h('div.pr-quote');
    const gear = button('link pr-gear', '⚙ ' + t('prayer.settings'), () => show(view === 'settings' ? 'main' : 'settings'));
    const main = h('div.pr-main', scene, h('div.pr-side', nextChip, list, foot));
    const bottom = h('div.pr-bottom', quoteEl, gear);
    const settings = h('div.pr-settings', { hidden: true });
    const root = h('div.prayerapp', main, bottom, settings);

    function show(next0) {
      view = next0;
      const setup = view === 'setup';
      main.hidden = view !== 'main';
      bottom.hidden = view !== 'main';
      settings.hidden = view === 'main';
      if (view !== 'main') drawSettings(setup);
      else draw();
    }

    // the sky follows the real time of day there: night, dawn, day, sunset
    function phase(now) {
      const ms = Date.now();
      const tt = now.times;
      if (ms < tt.fajr.getTime() || ms >= tt.isha.getTime()) return 'night';
      if (ms < tt.sunrise.getTime() + 20 * 60000) return 'dawn';
      if (ms < tt.maghrib.getTime() - 40 * 60000) return 'day';
      return 'dusk';
    }

    // a prayer time passed: the highlight glides slowly from that row down to the next one
    function glide(from, row) {
      if (Y.miniapps.still()) return;
      const shape = h('div.pr-glide');
      shape.style.top = from.top + 'px';
      shape.style.height = from.height + 'px';
      list.append(shape);
      row.classList.add('arriving');
      const move = shape.animate([
        { transform: 'none', height: from.height + 'px' },
        { transform: 'translateY(' + (row.offsetTop - from.top) + 'px)', height: row.offsetHeight + 'px' },
      ], { duration: 700, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
      move.finished.then(() => {
        row.classList.remove('arriving');
        shape.remove();
      }, () => shape.remove());
    }

    function draw() {
      const now = today();
      if (!now) return show('setup');
      const n = next();
      const done = prayedToday();
      const ms = Date.now();
      const hij = C.hijri(new Date());
      let head = t('prayer.next').replace('{name}', pname(n.name));
      if (hij.ramadan && n.name === 'maghrib') head = t('prayer.iftar');
      if (hij.ramadan && n.name === 'fajr') head = t('prayer.suhoor');
      nextChip.replaceChildren(h('span', { text: head }), h('span.pr-in', { text: t('prayer.in').replace('{t}', span(n.at - ms)) }));
      sky.dataset.phase = phase(now);
      root.dataset.phase = sky.dataset.phase;

      const was = list.querySelector('.pr-row.next'); // where the highlight is now, so it can glide on
      const wasBox = was && was.offsetHeight ? { top: was.offsetTop, height: was.offsetHeight } : null;
      list.replaceChildren(...C.NAMES.map((name) => {
        const at = now.times[name];
        const past = at.getTime() <= ms;
        const isNext = name === n.name; // tomorrow's Fajr too, after Isha
        if (name === 'sunrise') {
          return h('div.pr-row.sun', h('span.pr-check'), h('span.pr-name', { text: pname(name) }), h('span.pr-time', { text: C.clock(at, set.place.tz) }), h('span.pr-bell'));
        }
        const prayed = done.indexOf(name) !== -1;
        const check = button('pr-check' + (prayed ? '.on' : ''), '', () => {
          if (prayed) return;
          markPrayed(name);
          if (yo) yo.react('heart');
          host.sound('tick');
          check.classList.add('on', 'just'); // fills softly, then the list catches up
          setTimeout(draw, Y.miniapps.still() ? 0 : 450);
        }, { title: prayed ? t('prayer.prayed') : t('prayer.markPrayed'), 'aria-label': (prayed ? t('prayer.prayed') : t('prayer.markPrayed')) + ': ' + pname(name), disabled: !past && !prayed });
        const bell = button('pr-bell' + (set.bells[name] ? '.on' : ''), '', () => {
          set.bells[name] = !set.bells[name];
          save();
          host.sound('tick');
          draw();
        }, { title: set.bells[name] ? t('prayer.bellOn') : t('prayer.bellOff'), 'aria-label': (set.bells[name] ? t('prayer.bellOn') : t('prayer.bellOff')) + ': ' + pname(name) });
        bell.innerHTML = set.bells[name] ? BELL_ON : BELL_OFF; // static markup
        const row = h('div.pr-row', check, h('span.pr-name', { text: pname(name) }), h('span.pr-time', { text: C.clock(at, set.place.tz) }), bell);
        if (isNext) row.classList.add('next');
        if (past) row.classList.add('past');
        return row;
      }));

      const nowRow = list.querySelector('.pr-row.next');
      if (wasBox && nowRow && nowRow.offsetTop !== wasBox.top) glide(wasBox, nowRow);

      const pcZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const local = set.place.tz && pcZone !== set.place.tz ? ' · ' + t('prayer.localTime').replace('{place}', set.place.name) : '';
      foot.textContent = [hij.text, set.place.name + ' · ' + C.METHODS[set.method].name].filter(Boolean).join(' · ') + local;
      const quotes = t('prayer.quotes');
      const q = Array.isArray(quotes) ? quotes[quote % quotes.length] : null;
      quoteEl.replaceChildren(...(q ? [h('span', { text: '“' + q[0] + '”' }), h('span.pr-src', { text: '— ' + q[1] })] : []));
    }

    // ---------- settings (and the first-time "where are you?") ----------
    function chips(options, current, label, pick) {
      return h('div.ochips', {}, ...options.map((v) => button('opt', label(v), () => { pick(v); save(); cache.key = ''; drawSettings(view === 'setup'); }, { 'aria-pressed': String(v === current) })));
    }

    function placeFinder() {
      const input = h('input.pr-search', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('prayer.search') });
      const results = h('div.ochips.pr-results');
      const coords = h('input.pr-search.pr-coords', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('prayer.coords') });
      const note = h('span.pr-note');
      const choose = (place) => {
        set.place = place;
        save();
        cache.key = '';
        host.sound('equip');
        if (yo) yo.react('success');
        if (view === 'setup') show('main');
        else drawSettings(false);
      };
      const list0 = () => {
        // in settings the suggestions wait until you type; the first time they show right away
        if (view !== 'setup' && !input.value.trim()) return results.replaceChildren();
        return results.replaceChildren(...C.findCity(input.value).map((c) => button('opt', c.name + (c.country ? ', ' + c.country : ''), () => choose(c))));
      };
      input.addEventListener('input', list0);
      coords.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(coords.value);
        if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) { note.textContent = t('prayer.badCoords'); return; }
        choose({ name: (+m[1]).toFixed(2) + ', ' + (+m[2]).toFixed(2), country: '', lat: +m[1], lon: +m[2], tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      });
      list0();
      setTimeout(() => input.focus(), 80);
      return h('div.pr-finder', input, results, h('div.pr-coordrow', coords, note));
    }

    function drawSettings(setup) {
      if (setup) {
        settings.replaceChildren(h('div.pr-title', { text: t('prayer.where') }), h('div.pr-hint', { text: t('prayer.whereHint') }), placeFinder());
        return;
      }
      const row = (label, control) => h('div.pr-set', h('span.olabel', { text: label }), control);
      const adjust = h('div.pr-adjust', {}, ...C.NAMES.filter((n) => n !== 'sunrise').map((n) => {
        const v = set.adjust[n] || 0;
        const step = (d) => { set.adjust[n] = Math.max(-30, Math.min(30, v + d)); save(); cache.key = ''; drawSettings(false); };
        return h('span.pr-adj', h('span', { text: pname(n) }), button('fz-pm', '−', () => step(-1), { 'aria-label': pname(n) + ' −1' }),
          h('span.pr-adjv', { text: (v > 0 ? '+' : '') + v }), button('fz-pm', '+', () => step(1), { 'aria-label': pname(n) + ' +1' }));
      }));
      settings.replaceChildren(
        row(t('prayer.set.place'), h('div.pr-placebox', h('span.pr-current', { text: set.place ? set.place.name + (set.place.country ? ', ' + set.place.country : '') : '—' }), placeFinder())),
        row(t('prayer.set.method'), chips(Object.keys(C.METHODS), set.method, (k) => C.METHODS[k].name, (k) => { set.method = k; })),
        row(t('prayer.set.asr'), chips(['shafi', 'hanafi'], set.asr, (k) => t('prayer.asr.' + k), (k) => { set.asr = k; })),
        row(t('prayer.set.before'), chips(BEFORE, set.before, (n) => (n ? t('prayer.min').replace('{n}', n) : t('prayer.off')), (n) => { set.before = n; })),
        row(t('prayer.set.sound'), chips(['soft', 'silent'], set.sound, (k) => t('prayer.' + k), (k) => { set.sound = k; if (k === 'soft') host.sound('prayer'); })),
        row(t('prayer.set.quiet'), chips(QUIET, set.quiet, (n) => (n ? t('prayer.min').replace('{n}', n) : t('prayer.off')), (n) => { set.quiet = n; })),
        row(t('prayer.set.adjust'), adjust),
        button('btn small ok fz-done', t('prayer.back'), () => show('main')));
    }

    function dressYo() {
      if (!yo) return;
      yo.setLook(Object.assign({}, host.look(), { item: 'lantern' }));
      yo.setMood('done');
    }

    return {
      root,
      open() {
        if (!yo) yo = Y.mascot.mount(yoBox, 104);
        yo.setActive(true);
        dressYo();
        quote += 1;
        show(set.place ? 'main' : 'setup');
        clearInterval(timer);
        timer = setInterval(() => { if (view === 'main') draw(); }, 20000);
        listeners = [() => { if (view === 'main') draw(); }];
      },
      escape() {
        if (view !== 'settings') return false;
        show('main');
        return true;
      },
      close() {
        clearInterval(timer);
        if (yo) { yo.setActive(false); yo.reset(); }
      },
    };
  }

  const BELL_ON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 1.5h-14z"/><path d="M10.5 20.5h3"/></svg>';
  const BELL_OFF = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 1.5h-14z"/><path d="M10.5 20.5h3M4 4l16 16"/></svg>';
  // the scene: sky, stars, moon and sun, a mosque skyline and a prayer rug; colors come from CSS by time of day
  const SCENE = '<svg class="pr-sky" viewBox="0 0 240 236" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<rect class="sky" width="240" height="236"/>' +
    '<ellipse class="haze" cx="120" cy="180" rx="170" ry="70"/>' +
    '<g class="stars"><circle cx="30" cy="28" r="1"/><circle cx="64" cy="14" r=".8"/><circle cx="96" cy="40" r="1.1"/><circle cx="150" cy="22" r=".8"/>' +
    '<circle cx="204" cy="48" r="1"/><circle cx="182" cy="12" r=".7"/><circle cx="18" cy="70" r=".8"/><circle cx="122" cy="62" r=".7"/></g>' +
    '<path class="moon" d="M186 30a14 14 0 1 0 0 28a19 19 0 0 1 0 -28z"/>' +
    '<circle class="sunb" cx="190" cy="54" r="15"/>' +
    '<g class="city">' +
      '<rect x="14" y="98" width="7" height="76"/><path d="M12 98h11l-5.5 -12z"/>' +
      '<rect x="206" y="104" width="7" height="70"/><path d="M204 104h11l-5.5 -12z"/>' +
      '<path d="M54 174V136a66 54 0 0 1 132 0v38z"/>' +
      '<path d="M86 136a34 30 0 0 1 68 0z"/><rect x="118" y="90" width="4" height="18"/><path d="M120 82a4 4 0 1 1 0 8a3.2 3.2 0 0 0 0 -8z"/>' +
      '<path d="M24 174v-28a20 18 0 0 1 40 0v28z"/><path d="M176 174v-30a19 17 0 0 1 38 0v30z"/>' +
      '<rect x="0" y="172" width="240" height="64"/>' +
    '</g>' +
    '<g class="lights"><rect x="104" y="148" width="6" height="10" rx="3"/><rect x="117" y="146" width="6" height="12" rx="3"/><rect x="130" y="148" width="6" height="10" rx="3"/>' +
      '<rect x="38" y="154" width="4" height="8" rx="2"/><rect x="190" y="152" width="4" height="8" rx="2"/></g>' +
    '<g class="rug"><path d="M62 222l18 -24h80l18 24z"/><path class="rugline" d="M70 218l14 -17h72l14 17z"/></g>' +
    '</svg>';

  Y.miniapps.define('prayer', mount);
  // today's times for the place you set (Habits puts them on its day path), or null with no place yet
  const times = () => { const now = today(); return now ? now.times : null; };
  Y.prayerAlerts = { start, label, clockLabel, next, check, times, settings: () => set };
})((window.Yo = window.Yo || {}));
