(function (Y) {
  'use strict';

  // Habits: small daily habits, built on the four laws of behavior change.
  //   Obvious:     every habit has a cue ("after Fajr", "at 17:00"); YO comes down once at that time
  //   Attractive:  who you're becoming ("because I'm a reader") is said back to you; a sprout for YO
  //   Easy:        every habit has a tiny version ("2 pages"), and the tiny version counts
  //   Satisfying:  an instant tick, the day path filling in, the chain of days, "never miss twice"
  // The day is drawn as a path between the five prayers, with each habit where its cue is.
  // Kept on this PC, in YO's own storage.
  const { h, button } = Y.miniapps;
  const KEY = 'yo.habits';
  const NUDGED = 'yo.habitsNudged';
  const MAX_HABITS = 30;
  const KEEP_DAYS = 120;
  const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  // without a city in Prayer: rough times, so "after Fajr" still has a place on the path
  const ROUGH = { fajr: '05:30', dhuhr: '12:30', asr: '15:45', maghrib: '18:30', isha: '20:00' };
  const SPELLINGS = {
    fajr: 'fajr|fajer|sobh|subh|subuh', dhuhr: 'dhuhr|duhr|zuhr|dohr|dhohr', asr: 'asr|3asr',
    maghrib: 'maghrib|maghreb|iftar', isha: 'isha|ishaa|icha',
  };
  // everyday moments: a rough time to place them on the path (YO doesn't come down for these)
  const MOMENTS = [
    [/\b(wake|waking|morning|breakfast|coffee|tea)\b/i, '08:00'], [/\b(lunch|noon)\b/i, '13:00'],
    [/\b(class|classes|school|work|uni)\b/i, '17:00'], [/\b(dinner|evening)\b/i, '20:30'], [/\b(bed|sleep|night)\b/i, '22:30'],
  ];
  const UNITS = 'pages?|min(?:ute)?s?|glass(?:es)?|cups?|push-?ups?|squats?|times|km|steps|verses?|ayat|ayahs?|lines?|words?|exercises?|rounds?|hours?|h';
  const AFTER_MIN = 10; // "after Fajr": ten minutes after the prayer time
  const BEFORE_MIN = 20; // "before Fajr": twenty minutes before
  const NUDGE_WINDOW = 2 * 3600000; // a cue more than 2 hours ago doesn't bring YO down any more

  // the packs: ready-made habits, written the way you'd type them
  const PACKS = {
    bac: [
      'At 08:00 I will study 25 min because I\'m a focused student',
      'After Asr I will walk 10 min because I\'m someone who moves',
      'After Isha I will review 1 page because I\'m prepared',
      'At 23:00 I will put my phone away because I\'m someone who sleeps well',
    ],
    ramadan: [
      'Before Fajr I will drink 2 glasses of water because I\'m someone who takes care of my body',
      'After Fajr I will read 1 page of Quran because I\'m close to the Quran',
      'After Maghrib I will make dua 2 min because I\'m grateful',
      'After Isha I will walk 10 min because I\'m someone who moves',
    ],
    water: [
      'After Fajr I will drink 1 glass of water because I\'m someone who stays hydrated',
      'After Dhuhr I will drink 1 glass of water because I\'m someone who stays hydrated',
      'After Asr I will drink 1 glass of water because I\'m someone who stays hydrated',
      'After Maghrib I will drink 1 glass of water because I\'m someone who stays hydrated',
    ],
    body: [
      'With my morning coffee I will drink 1 glass of water because I\'m someone who takes care of my body',
      'After Dhuhr I will stretch 2 min because I\'m someone who moves',
      'After Maghrib I will walk 10 min because I\'m someone who moves',
      'At 23:00 I will put my phone away because I\'m someone who sleeps well',
    ],
  };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const clock = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const counts = (v) => v === 'done' || v === 'tiny';
  // YO says who you're becoming back to you: "my body" becomes "your body"
  const toYou = (text) => String(text || '').replace(/\bmyself\b/gi, 'yourself').replace(/\bmy\b/gi, 'your').replace(/\bme\b/gi, 'you');

  // ---------- one sentence -> a habit ----------
  // "After Fajr I will read 2 pages because I'm a reader"
  //   -> { name: 'Read', cue: { type: 'prayer', prayer: 'fajr', when: 'after' }, tiny: '2 pages', identity: 'a reader' }
  function parse(input) {
    let s = ' ' + String(input || '').replace(/\s+/g, ' ').trim() + ' ';
    const out = { name: '', cue: null, tiny: '', identity: '' };
    // who you're becoming
    let m = /\s(?:because|as)\s+i(?:'m|’m|\s+am)\s+(.+?)\s*$/i.exec(s);
    if (m) {
      out.identity = m[1].replace(/[.!]+$/, '').trim().slice(0, 60);
      s = s.slice(0, m.index) + ' ';
    }
    // the cue: a prayer, a clock time, or an everyday moment
    const prayer = new RegExp('\\b(after|before)\\s+(?:the\\s+)?(' + Object.values(SPELLINGS).join('|') + ')\\b', 'i').exec(s);
    const time = /\b(?:at|every\s+day\s+at)\s+(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?(?=[\s,.]|$)/i.exec(s);
    const moment = /\b(after|before|with|when|during)\s+((?:my|i|the)\s+)?[a-z][a-z' ]{1,30}?(?=,|\s+i\s+will|\s+i'll|\s+i’ll|\s*$)/i.exec(s);
    if (prayer) {
      const word = prayer[2].toLowerCase();
      out.cue = { type: 'prayer', prayer: PRAYERS.find((p) => new RegExp('^(' + SPELLINGS[p] + ')$').test(word)), when: prayer[1].toLowerCase() };
      m = prayer;
    } else if (time) {
      let hour = Number(time[1]);
      const min = Number(time[2] || 0);
      if (time[3]) hour = (hour % 12) + (/pm/i.test(time[3]) ? 12 : 0);
      if (hour <= 23 && min <= 59) out.cue = { type: 'time', at: pad(hour) + ':' + pad(min) };
      m = out.cue ? time : null;
    } else if (moment && /\s+i(?:\s+will|'ll|’ll)\s/i.test(s.slice(moment.index))) {
      out.cue = { type: 'moment', text: moment[0].trim().slice(0, 40) };
      m = moment;
    } else {
      m = null;
    }
    if (m) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    // what you'll do
    const will = /\bi(?:\s+will|'ll|’ll)\s+(.+)$/i.exec(s);
    let what = (will ? will[1] : s).replace(/^[\s,]+/, '');
    // the tiny version: "2 pages", "10 min", "1 glass"
    const tiny = new RegExp('\\b(\\d+(?:[.,]\\d+)?)\\s*(' + UNITS + ')\\b', 'i').exec(what);
    if (tiny) {
      out.tiny = tiny[0].replace(/\s+/g, ' ');
      const without = what.slice(0, tiny.index) + ' ' + what.slice(tiny.index + tiny[0].length);
      // "do 10 pushups" would leave just "do": then the thing itself stays in the name ("Do pushups")
      what = /^\s*(?:do|make|have|get|go|take)?\s*$/i.test(without.replace(/\s+of\s+/i, ' '))
        ? what.slice(0, tiny.index) + ' ' + tiny[2] + ' ' + what.slice(tiny.index + tiny[0].length)
        : without.replace(/\s+of\s+/i, ' '); // "read 1 page of Quran" -> "read Quran"
    }
    out.name = cap(what.replace(/\s+/g, ' ').replace(/^\s*(?:to|and|then)\s+/i, '').replace(/[\s.,!]+$/, '').trim()).slice(0, 50);
    return out;
  }

  // ---------- when a habit's cue comes, on a given day ----------
  function prayerTime(name, day, times) {
    const isToday = ymd(day) === ymd(new Date());
    if (times && isToday && times[name]) return new Date(times[name].getTime());
    const [hh, mm] = ROUGH[name].split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
  }

  function cueAt(habit, day, times) {
    const c = habit.cue;
    if (!c) return null;
    if (c.type === 'prayer') {
      const base = prayerTime(c.prayer, day, times);
      return new Date(base.getTime() + (c.when === 'before' ? -BEFORE_MIN : AFTER_MIN) * 60000);
    }
    const at = c.type === 'time' ? c.at : (MOMENTS.find(([re]) => re.test(c.text)) || [null, null])[1];
    if (!at) return null;
    const [hh, mm] = at.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
  }

  // YO only comes down for cues with a real time (a prayer or a clock time)
  const nudges = (habit) => Boolean(habit.cue && (habit.cue.type === 'prayer' || habit.cue.type === 'time'));

  // ---------- a habit's days: the chain, runs, and "never miss twice" ----------
  function dayState(habit, day, today) {
    const key = ymd(day);
    const v = (habit.log || {})[key];
    if (key > ymd(today)) return 'future';
    if (key < ymd(new Date(habit.created))) return 'before';
    if (v === 'done' || v === 'tiny') return v;
    return key === ymd(today) ? 'open' : 'missed';
  }

  // the run that's still alive: today (if done) and the days before it in a row
  function currentRun(habit, today) {
    let n = 0;
    let d = counts((habit.log || {})[ymd(today)]) ? today : addDays(today, -1);
    while (counts((habit.log || {})[ymd(d)])) {
      n += 1;
      d = addDays(d, -1);
    }
    return n;
  }

  function bestRun(habit) {
    const days = Object.keys(habit.log || {}).filter((k) => counts(habit.log[k])).sort();
    let best = 0;
    let run = 0;
    let prev = null;
    days.forEach((k) => {
      const [y, m, d] = k.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      run = prev && ymd(addDays(prev, 1)) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = date;
    });
    return best;
  }

  // 'ok', 'once' (missed yesterday: don't miss twice), or 'twice' (two in a row: make it smaller?)
  function missState(habit, today) {
    const y1 = dayState(habit, addDays(today, -1), today);
    const y2 = dayState(habit, addDays(today, -2), today);
    if (y1 === 'missed' && y2 === 'missed' && !counts((habit.log || {})[ymd(today)])) return 'twice';
    if (y1 === 'missed' && !counts((habit.log || {})[ymd(today)])) return 'once';
    return 'ok';
  }

  function neverMissedTwice(habit, from, today) {
    let streak = 0;
    for (let d = new Date(from); d < today; d = addDays(d, 1)) {
      streak = dayState(habit, d, today) === 'missed' ? streak + 1 : 0;
      if (streak >= 2) return false;
    }
    return true;
  }

  // ---------- storage ----------
  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string') : [];
    } catch (err) {
      return [];
    }
  }

  function save(list) {
    const cutoff = ymd(addDays(new Date(), -KEEP_DAYS));
    list.forEach((x) => Object.keys(x.log || {}).forEach((k) => { if (k < cutoff) delete x.log[k]; }));
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (err) { /* not kept */ }
  }

  function makeHabit(sentence) {
    const p = parse(sentence);
    if (!p.name) return null;
    return {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      said: String(sentence).trim().slice(0, 200), name: p.name, cue: p.cue, tiny: p.tiny, identity: p.identity,
      created: Date.now(), log: {},
    };
  }

  // ---------- shared by the app and the coach (the cue cards) ----------
  let host = null;
  const listeners = new Set(); // the open app redraws when a card logs something
  const t = (key) => Y.i18n.t(key);
  const times = () => (Y.prayerAlerts && Y.prayerAlerts.times ? Y.prayerAlerts.times() : null);

  function cueText(habit) {
    const c = habit.cue;
    if (!c) return t('habits.anytime');
    if (c.type === 'prayer') return t('habits.cue.' + c.when).replace('{prayer}', t('prayer.name.' + c.prayer));
    if (c.type === 'time') return t('habits.cue.at').replace('{t}', c.at);
    return cap(c.text);
  }

  // log today: 'done', 'tiny', 'skip', or null to undo
  function logToday(id, value) {
    const list = load();
    const habit = list.find((x) => x.id === id);
    if (!habit) return null;
    habit.log = habit.log || {};
    const key = ymd(new Date());
    if (value) habit.log[key] = value;
    else delete habit.log[key];
    save(list);
    if (counts(value) && host && host.earn) host.earn('habitRun', Math.max(...list.map(bestRun)));
    listeners.forEach((fn) => fn());
    return habit;
  }

  // the coach: at a habit's cue, YO comes down once, quietly, with Done / the tiny version / Not today
  function check() {
    if (!host) return;
    const now = new Date();
    const key = ymd(now);
    let nudged = {};
    try { nudged = JSON.parse(localStorage.getItem(NUDGED) || '{}'); } catch (err) { /* none yet */ }
    if (nudged.day !== key) nudged = { day: key, ids: [] };
    const list = load();
    const tt = times();
    list.forEach((habit) => {
      if (!nudges(habit) || nudged.ids.indexOf(habit.id) !== -1 || (habit.log || {})[key]) return;
      const at = cueAt(habit, now, tt);
      if (!at || now < at || now - at > NUDGE_WINDOW || at.getTime() < habit.created) return;
      nudged.ids.push(habit.id);
      const body = (habit.identity ? cap(toYou(habit.identity)) + '. ' : '') +
        (habit.tiny ? t('habits.card.tiny').replace('{tiny}', habit.tiny) : t('habits.card.small'));
      host.card(cueText(habit) + ': ' + habit.name.toLowerCase(), body, [
        { label: t('habits.done'), primary: true, run: () => { logToday(habit.id, 'done'); host.react('heart'); host.sound('success'); } },
        { label: habit.tiny ? t('habits.justTiny').replace('{tiny}', habit.tiny) : t('habits.justLittle'), run: () => { logToday(habit.id, 'tiny'); host.react('success'); host.sound('tick'); } },
        { label: t('habits.notToday'), run: () => { logToday(habit.id, 'skip'); } },
      ], { label: t('short.habits'), calm: true });
    });
    try { localStorage.setItem(NUDGED, JSON.stringify(nudged)); } catch (err) { /* may nudge again */ }
  }

  function start(h0) {
    host = host || h0;
    check();
    setInterval(check, 30000);
  }

  // the home tile: "2 of 4 today"
  Y.miniapps.live.habits = () => {
    const list = load();
    if (!list.length) return null;
    const key = ymd(new Date());
    const done = list.filter((x) => counts((x.log || {})[key])).length;
    return t('habits.tile').replace('{n}', done).replace('{m}', list.length);
  };

  // ---------- the app ----------
  function mount(h0) {
    host = host || h0;
    let view = 'today'; // today, month, new
    let editing = null; // id of the habit being edited on the New screen
    let monthPick = null;
    let confirmDelete = false;

    const tabs = h('div.ctabs.hb-tabs', { role: 'tablist' });
    const who = h('div.hb-who');
    const body = h('div.hb-body');
    const root = h('div.habits', h('div.hb-top', who, tabs), body);

    function drawTabs() {
      tabs.replaceChildren(...['today', 'month', 'new'].map((name) => button('ctab', name === 'new' ? '+ ' + t('habits.new') : t('habits.' + name), () => {
        if (name === 'new') editing = null;
        show(name);
        host.sound('tick');
      }, { role: 'tab', 'aria-selected': String(view === name) })));
    }

    function show(name) {
      view = name;
      confirmDelete = false;
      draw();
    }

    function draw() {
      const list = load();
      const ids = [];
      list.forEach((x) => { if (x.identity && ids.indexOf(toYou(x.identity)) === -1) ids.push(toYou(x.identity)); });
      who.replaceChildren(h('div.hb-title', { text: t('short.habits') }),
        h('div.hb-sub', ids.length
          ? [h('span', { text: t('habits.becoming') + ' ' }), h('span.hb-id', { text: ids[0] }),
            ...(ids[1] ? [h('span', { text: ' ' + t('habits.and') + ' ' }), h('span.hb-id', { text: ids[1] })] : [])].reduce((a, n) => { a.append(n); return a; }, document.createDocumentFragment())
          : t('habits.motto')));
      drawTabs();
      if (view === 'new') return body.replaceChildren(drawNew(list));
      if (!list.length) return body.replaceChildren(drawEmpty());
      if (view === 'month') return body.replaceChildren(drawMonth(list));
      return body.replaceChildren(drawToday(list));
    }

    // ---------- Today: the day path, then a row per habit ----------
    function drawToday(list) {
      const now = new Date();
      const tt = times();
      const rows = list.slice().sort((a, b) => {
        const ta = cueAt(a, now, tt);
        const tb = cueAt(b, now, tt);
        return (ta ? ta.getTime() : 9e15) - (tb ? tb.getTime() : 9e15);
      });
      const done = list.filter((x) => counts((x.log || {})[ymd(now)])).length;
      const warn = rows.find((x) => missState(x, now) === 'twice') || rows.find((x) => missState(x, now) === 'once');
      const foot = h('div.hb-foot', h('span', h('span.hb-count', { text: t('habits.count').replace('{n}', done).replace('{m}', list.length) }), ' · ' + t('habits.tapHint')));
      if (warn) {
        const state = missState(warn, now);
        const note = h('span.hb-warn' + (state === 'twice' ? '.twice' : ''), { text: t('habits.miss.' + state).replace('{name}', warn.name) });
        if (state === 'twice') note.append(' ', button('link hb-smaller', t('habits.smaller'), () => edit(warn.id)));
        foot.append(note);
      }
      return h('div.hb-today', path(rows, now, tt), h('div.hb-rows', {}, ...rows.map((x) => row(x, now))), foot);
    }

    // the day as a path from before Fajr to after Isha; prayers are landmarks, habits sit at their cue
    function path(list, now, tt) {
      const W = 540;
      const H = 112;
      const start = new Date(prayerTime('fajr', now, tt).getTime() - 45 * 60000);
      const end = new Date(Math.max(prayerTime('isha', now, tt).getTime() + 150 * 60000, start.getTime() + 16 * 3600000));
      const xOf = (d) => 12 + Math.max(0, Math.min(1, (d - start) / (end - start))) * (W - 24);
      const yOf = (x) => 58 + 14 * Math.sin((x / W) * Math.PI * 2.4 + 0.5);
      const line = (x0, x1) => {
        let d = '';
        for (let x = x0; x <= x1; x += 6) d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + yOf(x).toFixed(1);
        return d + 'L' + x1.toFixed(1) + ' ' + yOf(x1).toFixed(1);
      };
      const nowX = xOf(now);
      const anchor = (x) => (x > W - 60 ? 'end' : x < 60 ? 'start' : 'middle');
      let svg = '<svg class="hb-path" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
        '<path class="hb-road" d="' + line(12, W - 12) + '"/>' +
        '<path class="hb-trail" d="' + line(12, nowX) + '"/>';
      // labels near an edge lean inward; two prayers close together (Maghrib, Isha) take two lines
      let prevX = -99;
      let low = false;
      PRAYERS.forEach((p) => {
        const at = prayerTime(p, now, tt);
        const x = xOf(at);
        low = x - prevX < 70 ? !low : false;
        prevX = x;
        svg += '<circle class="hb-mark" cx="' + x.toFixed(1) + '" cy="' + yOf(x).toFixed(1) + '" r="3.5"/>' +
          '<text class="hb-pname" text-anchor="' + anchor(x) + '" x="' + x.toFixed(1) + '" y="' + (yOf(x) + (low ? 33 : 21)).toFixed(1) + '">' +
          t('prayer.name.' + p) + (tt ? ' ' + clock(at) : '') + '</text>';
      });
      svg += '<g class="hb-now" transform="translate(' + nowX.toFixed(1) + ' ' + yOf(nowX).toFixed(1) + ')">' +
        '<circle r="11" class="hb-halo"/><rect x="-7" y="-6" width="14" height="10" rx="4.5" class="hb-head"/>' +
        '<rect x="-5" y="-4" width="10" height="5.5" rx="2.5" class="hb-visor"/><path d="M0 -6V-10" class="hb-ant"/><circle cy="-11" r="1.6" class="hb-ball"/></g>';
      svg += '</svg>';
      const box = h('div.hb-pathbox', { html: svg }); // static markup, our own numbers and strings
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      let lastX = -99;
      let lift = 0;
      list.forEach((x) => {
        const at = cueAt(x, now, tt);
        if (!at) return;
        const cx = xOf(at);
        const cy = yOf(cx);
        lift = cx - lastX < 52 ? (lift + 1) % 3 : 0;
        lastX = cx;
        const v = (x.log || {})[ymd(now)];
        const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        node.setAttribute('class', 'hb-node' + (counts(v) ? ' on' : '') + (v === 'tiny' ? ' tiny' : ''));
        node.dataset.id = x.id;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', cx.toFixed(1));
        dot.setAttribute('cy', cy.toFixed(1));
        dot.setAttribute('r', '8');
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', cx.toFixed(1));
        label.setAttribute('text-anchor', anchor(cx));
        label.setAttribute('y', (cy - 14 - lift * 11).toFixed(1));
        label.textContent = x.name.length > 12 ? x.name.slice(0, 11) + '…' : x.name;
        node.append(dot, label);
        node.addEventListener('click', () => toggle(x.id));
        g.append(node);
      });
      box.querySelector('svg').append(g);
      return box;
    }

    function row(x, now) {
      const v = (x.log || {})[ymd(now)];
      const miss = missState(x, now);
      const chain = h('span.hb-chain', { title: t('habits.chainTip') });
      for (let i = 6; i >= 0; i -= 1) {
        const st = dayState(x, addDays(now, -i), now);
        chain.append(h('i.' + st + (i === 0 ? '.today' : '') + (i === 0 && miss !== 'ok' ? '.warn' : '')));
      }
      const tiny = x.tiny ? button('hb-tiny' + (v === 'tiny' ? '.on' : ''), x.tiny, (e) => { e.stopPropagation(); log(x.id, v === 'tiny' ? null : 'tiny'); },
        { title: t('habits.tinyTip').replace('{tiny}', x.tiny) }) : '';
      const at = cueAt(x, now, times());
      const node = h('div.hb-row' + (counts(v) ? '.on' : '') + (v === 'skip' ? '.skip' : ''),
        button('hb-check', '', () => toggle(x.id), { 'aria-pressed': String(counts(v)), 'aria-label': x.name }),
        h('div.hb-what', h('div.hb-name', { text: x.name }), h('div.hb-cue', { text: cueText(x) + (at && x.cue.type === 'prayer' ? ' · ' + clock(at) : '') })),
        tiny,
        chain,
        button('row-act hb-edit', '⋯', () => edit(x.id), { title: t('habits.edit'), 'aria-label': t('habits.edit') + ': ' + x.name }));
      node.dataset.id = x.id;
      return node;
    }

    function toggle(id) {
      const habit = load().find((x) => x.id === id);
      if (!habit) return;
      log(id, counts((habit.log || {})[ymd(new Date())]) ? null : 'done');
    }

    // a tick: YO cheers right away; the last one of the day gets a bigger one
    function log(id, value) {
      logToday(id, value);
      if (!value) return host.sound('cancel');
      const list = load();
      const key = ymd(new Date());
      const all = list.every((x) => counts((x.log || {})[key]));
      host.sound(all ? 'success' : 'tick');
      host.react(all ? 'success' : value === 'tiny' ? 'note' : 'heart');
      if (all) host.toast(t('habits.allDone'));
      const n = body.querySelector('.hb-node[data-id="' + id + '"] circle');
      if (n) Y.miniapps.pop(n, 1.5);
    }

    // ---------- Month: one habit at a glance ----------
    function drawMonth(list) {
      const now = new Date();
      if (!list.find((x) => x.id === monthPick)) monthPick = list[0].id;
      const x = list.find((y) => y.id === monthPick);
      const pick = h('div.ochips.hb-pick', {}, ...list.map((y) => button('opt', y.name, () => { monthPick = y.id; draw(); host.sound('tick'); },
        { 'aria-pressed': String(y.id === monthPick), title: cueText(y) })));
      const first = addDays(now, -27 - ((now.getDay() + 6) % 7)); // a Monday, about four weeks back
      const grid = h('div.hb-grid');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d) => grid.append(h('span.hb-dow', { text: d })));
      let doneDays = 0;
      let counted = 0;
      for (let i = 0; i < 35; i += 1) {
        const d = addDays(first, i);
        const st = dayState(x, d, now);
        if (st === 'done' || st === 'tiny') doneDays += 1;
        if (st !== 'future' && st !== 'before' && st !== 'open') counted += 1;
        grid.append(h('i.' + st + (ymd(d) === ymd(now) ? '.today' : ''), { title: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }) }));
      }
      const run = bestRun(x);
      const stat = (label, value, cls) => h('div.hb-stat', h('span.olabel', { text: label }), h('div.hb-statv' + (cls || ''), { text: value }));
      // a run that's already long enough (from days logged earlier) still earns the sprout
      const best = Math.max(...list.map(bestRun));
      if (best >= 7 && host.earn && Y.unlocks && !Y.unlocks.isUnlocked('tip', 'sprout')) host.earn('habitRun', best);
      const sprout = Y.unlocks && Y.unlocks.isUnlocked('tip', 'sprout');
      return h('div.hb-month', pick,
        h('div.hb-monthmain',
          h('div.hb-gridbox', h('div.hb-gridhead', h('span', { text: x.name + ' · ' + cueText(x) }),
            h('span.hb-count', { text: t('habits.daysOf').replace('{n}', doneDays).replace('{m}', Math.max(counted, doneDays)) })), grid),
          h('div.hb-stats',
            stat(t('habits.bestRun'), t(run === 1 ? 'habits.day' : 'habits.days').replace('{n}', run)),
            stat(t('habits.neverTwice'), neverMissedTwice(x, first, now) ? t('habits.yes') : t('habits.notYet'), '.acc'),
            stat(t('habits.reward'), sprout ? t('habits.sproutHave') : t('habits.sproutNeed').replace('{n}', Math.min(7, Math.max(...list.map(bestRun)))), ''))),
        h('div.hb-legend', { text: t('habits.legend') }));
    }

    // ---------- New (or edit): one sentence, then the packs ----------
    function drawNew(list) {
      const habit = editing ? list.find((x) => x.id === editing) : null;
      const input = h('input.hb-say', { type: 'text', spellcheck: false, autocomplete: 'off', maxLength: 200, placeholder: t('habits.say'), 'aria-label': t('habits.say') });
      if (habit) input.value = habit.said || '';
      const chips = h('div.hb-chips');
      const add = button('btn small ok', habit ? t('habits.save') : t('habits.add'), submit);
      const del = habit ? button('link hb-del', t('habits.delete'), () => {
        if (!confirmDelete) {
          confirmDelete = true;
          del.textContent = t('habits.sure');
          del.classList.add('warn');
          return;
        }
        save(load().filter((x) => x.id !== habit.id));
        editing = null;
        host.react('cancel');
        host.sound('close');
        show('today');
      }) : '';
      function read() {
        const p = parse(input.value);
        const bits = [];
        if (p.cue) bits.push([t('habits.part.cue'), cueText({ cue: p.cue })]);
        if (p.name) bits.push([t('habits.part.what'), p.name]);
        if (p.tiny) bits.push([t('habits.part.tiny'), p.tiny]);
        if (p.identity) bits.push([t('habits.part.who'), p.identity]);
        chips.replaceChildren(...(bits.length ? bits.map(([k, v]) => h('span.todo-chip', { text: k + ': ' + v }))
          : [h('span.hb-hint', { text: t('habits.example') })]));
        if (input.value.trim() && !p.cue) chips.append(h('span.hb-hint', { text: t('habits.noCue') }));
      }
      function submit() {
        const made = makeHabit(input.value);
        if (!made) { host.sound('info'); return; }
        const all = load();
        if (habit) {
          const old = all.find((x) => x.id === habit.id);
          Object.assign(old, { said: made.said, name: made.name, cue: made.cue, tiny: made.tiny, identity: made.identity });
        } else {
          if (all.length >= MAX_HABITS) { host.toast(t('habits.full')); return; }
          all.push(made);
        }
        save(all);
        editing = null;
        host.react('note');
        host.sound('set');
        host.toast(habit ? t('habits.saved') : t('habits.added'));
        show('today');
      }
      input.addEventListener('input', () => { read(); host.react('type'); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      read();
      setTimeout(() => input.focus(), 40);
      const packs = habit ? '' : h('div.hb-packs', h('span.olabel', { text: t('habits.packs') }),
        h('div.hb-packlist', {}, ...Object.keys(PACKS).map((id) => {
          // the same habit at several prayers reads once: "Drink water 1 glass (after Fajr, Dhuhr, Asr)"
          const groups = [];
          PACKS[id].map((s) => parse(s)).forEach((p) => {
            const label = p.name + (p.tiny ? ' ' + p.tiny : '');
            const g = groups.find((x) => x.label === label);
            const when = p.cue && p.cue.type === 'prayer' ? t('prayer.name.' + p.cue.prayer) : null;
            if (g) g.when.push(when);
            else groups.push({ label, when: [when], first: p.cue ? cueText(p).toLowerCase() : '' });
          });
          const items = groups.map((g) => (g.when.length > 1 && g.when.every(Boolean)
            ? g.label + ' (' + g.first.split(' ')[0] + ' ' + g.when.join(', ') + ')' : g.label));
          return h('div.hb-pack',
            h('div.hb-packname', { text: t('habits.pack.' + id) }),
            h('div.hb-packitems', { text: items.join(' · ') }),
            button('btn small', t('habits.addPack'), () => addPack(id)));
        })));
      return h('div.hb-new',
        h('div.hb-sayrow', input, add),
        chips,
        habit ? h('div.hb-editrow', h('span.hb-hint', { text: t('habits.editHint') }), del) : h('div.hb-hint', { text: t('habits.laws') }),
        packs);
    }

    // a pack adds the habits you don't have yet (same habit, same cue)
    function addPack(id) {
      const all = load();
      let added = 0;
      PACKS[id].forEach((s) => {
        const made = makeHabit(s);
        if (!made || all.length >= MAX_HABITS) return;
        if (all.some((x) => x.name === made.name && JSON.stringify(x.cue) === JSON.stringify(made.cue))) return;
        all.push(made);
        added += 1;
      });
      save(all);
      host.react(added ? 'heart' : 'info');
      host.sound(added ? 'set' : 'info');
      host.toast(added ? t('habits.packAdded').replace('{n}', added) : t('habits.packHave'));
      if (added) show('today');
    }

    function edit(id) {
      editing = id;
      show('new');
    }

    function drawEmpty() {
      return h('div.hb-empty',
        h('div.hb-emptytitle', { text: t('habits.emptyTitle') }),
        h('div', { text: t('habits.emptyBody') }),
        h('div.hb-emptybtns', button('btn small ok', '+ ' + t('habits.new'), () => show('new')),
          ...Object.keys(PACKS).map((id) => button('btn small', t('habits.pack.' + id), () => addPack(id)))));
    }

    listeners.add(() => { if (view !== 'new') draw(); });

    return {
      root,
      open(seed) {
        const text = String(seed || '').trim();
        if (text) {
          editing = null;
          view = 'new';
          draw();
          const input = body.querySelector('.hb-say');
          if (input) {
            input.value = text;
            input.dispatchEvent(new Event('input'));
          }
          return;
        }
        if (view === 'new' && !editing) view = load().length ? 'today' : 'new';
        draw();
      },
      escape() {
        if (view === 'new' && load().length) { editing = null; show('today'); return true; }
        if (view === 'month') { show('today'); return true; }
        return false;
      },
    };
  }

  Y.miniapps.define('habits', mount);
  Y.habitsCoach = { start, check };
  Y.miniapps.habitsCore = { parse, cueAt, dayState, currentRun, bestRun, missState, neverMissedTwice, PACKS }; // for tests
})((window.Yo = window.Yo || {}));
