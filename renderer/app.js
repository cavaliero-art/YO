(function (Y) {
  'use strict';

  const { t, setLang } = Y.i18n;
  const FACE = { idle: 'idle', listening: 'listen', working: 'think', approval: 'alert', result: 'done', done: 'done' };
  const ENTER_MS = 1000;
  const LEAVE_MS = 340;
  const PEEK_MS = 7000;
  const MAX_SUGGEST = 5;
  const SAY_MAX = 260; // widest the peek message gets before it wraps
  const SLEEP_MS = 20000; // an open bar left alone this long and YO dozes off
  const PET_MS = 380; // hold the robot this long to pet it

  const $ = (id) => document.getElementById(id);
  const bridge = window.yo || {
    setHitRect() {}, releaseFocus() {}, quit() {}, hide() {},
    show: () => Promise.resolve(),
    getInfo: () => Promise.resolve({ locale: navigator.language, shortcut: 'Ctrl+Space' }),
    onHotkey(cb) {
      document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); cb(); } });
    },
    onCursor(cb) {
      document.addEventListener('mousemove', (e) => cb({ x: e.clientX, y: e.clientY }));
    },
    onPref() {}, reportPrefs() {}, onMedia() {},
  };

  const el = {
    island: $('island'), bar: $('bar'), hero: $('hero'), face: $('face'), label: $('label'),
    cmd: $('cmd'), mic: $('mic'), stop: $('stop'), suggest: $('suggest'), panel: $('panel'), browse: $('browse'),
    bubble: $('bubble'), risk: $('risk'), announce: $('announce'),
    aTitle: $('aTitle'), aBody: $('aBody'), rTitle: $('rTitle'), rBody: $('rBody'),
    bDeny: $('bDeny'), bAllow: $('bAllow'), bAlways: $('bAlways'), bCopy: $('bCopy'), bClose: $('bClose'),
    preview: $('preview'), cOpts: $('cOpts'), cDone: $('cDone'), cRandom: $('cRandom'), cReset: $('cReset'), rMore: $('rMore'),
  };

  const face = Y.mascot.mount(el.face, 46);
  const s = { state: 'idle', label: '', card: null, pendingId: null, timer: null, fg: false, category: 'system' };
  const agent = Y.agent.create(onEvent);
  const later = []; // news that arrived while you were busy
  let composing = false;
  let vis = 'hidden';
  let visToken = 0;
  let hovering = false;
  let shortcut = 'Ctrl+Space';
  let peekTimer = null;
  let bubbleText = '';
  let spoken = '';
  let matches = [];
  let pick = 0;
  let openAsk = 0; // latest "open <something>" lookup; older answers are ignored
  let panel = false; // the "all actions" panel under the bar
  let hoverCat = null; // category of the action under the pointer in that panel
  const PANEL_ORDER = ['apps', 'time', 'media', 'tools', 'system'];
  let lastActive = Date.now();
  let lastSnore = 0;
  let dozing = false;
  let customizing = false; // the Customize panel is open
  let customHint = ''; // shown in the panel title for a moment (how to unlock something)
  let nowPlaying = null; // { playing, title, artist } while the pill is on screen
  let dragDepth = 0;
  let preview = null; // the big YO in that panel

  // ---------- preferences: YO's look and sound (kept in this window's storage until Stage 3 saves settings) ----------
  const DEFAULT_PREFS = { sound: true, voice: 'robot', volume: 2, seasonal: true, look: Object.assign({}, Y.mascot.DEFAULT_LOOK) };
  const prefs = loadPrefs();

  function loadPrefs() {
    const base = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    try {
      const saved = JSON.parse(localStorage.getItem('yo.prefs') || '{}');
      ['sound', 'voice', 'volume', 'seasonal'].forEach((key) => { if (key in saved) base[key] = saved[key]; });
      Object.assign(base.look, saved.look || {});
    } catch (err) { /* start from the defaults */ }
    return base;
  }

  function savePrefs() {
    try { localStorage.setItem('yo.prefs', JSON.stringify(prefs)); } catch (err) { /* not saved, still applied */ }
  }

  // a seasonal outfit only fills the slots you left empty
  const effectiveLook = () => Y.mascot.lookFor(prefs);

  function applyPrefs() {
    Y.sound.setEnabled(prefs.sound);
    Y.sound.setVoice(prefs.voice);
    Y.sound.setVolume(prefs.volume);
    const look = effectiveLook();
    face.setLook(look);
    if (preview) preview.setLook(look);
    bridge.reportPrefs({ sound: prefs.sound });
  }

  function setPref(key, value) {
    if (key !== 'sound') return false;
    prefs.sound = Boolean(value);
    savePrefs();
    applyPrefs();
    if (customizing) syncCustom();
    return true;
  }

  // the first time YO shows up each day it says a proper hello
  function firstToday() {
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem('yo.greeted') === today) return false;
      localStorage.setItem('yo.greeted', today);
    } catch (err) { /* no storage: greet anyway */ }
    return true;
  }

  // ---------- what the island should look like right now ----------
  function derive() {
    if (customizing) return 'custom';
    if (composing) return 'command';
    if (s.state === 'listening') return 'listening';
    if (s.state === 'working') return 'working';
    if (s.state === 'approval' && s.fg) return 'approval';
    if (s.state === 'result' && s.fg) return 'result';
    return 'peek'; // idle, short "done" message, or news that waits for a click
  }

  function busy() {
    return composing || customizing || s.state === 'working' || s.state === 'listening' || s.state === 'approval' ||
      (s.state === 'result' && s.fg);
  }

  function bubbleFor() {
    if (s.state === 'done') return s.label;
    if (s.state === 'approval') return t('needsOk');
    if (s.state === 'result') return (s.card && s.card.title) || t('done');
    if (!composing && nowPlaying && nowPlaying.playing && nowPlaying.title) return '♪ ' + songText(nowPlaying);
    return '';
  }

  const songText = (now) => (now.artist ? now.title + ' · ' + now.artist : now.title);

  // the black pill grows to fit the message next to the robot
  const measure = document.createElement('canvas').getContext('2d');
  function sayWidth(text) {
    if (!text) return 0;
    measure.font = getComputedStyle(el.bubble).font || '13px "Segoe UI", system-ui, sans-serif';
    return Math.min(Math.ceil(measure.measureText(text).width), SAY_MAX) + 24;
  }

  function setBubble(text) {
    if (text === bubbleText) return;
    bubbleText = text;
    el.bubble.textContent = text;
    el.bubble.hidden = !text;
    el.island.style.setProperty('--say', sayWidth(text) + 'px');
    if (text) restart(el.bubble, 'pop');
  }

  // screen readers hear each new status once
  function announce(text) {
    if (!text || text === spoken) return;
    spoken = text;
    el.announce.textContent = text;
  }

  function fillCard(kind, card) {
    if (kind === 'approval') {
      el.aTitle.textContent = card.title;
      el.aBody.textContent = card.body;
      el.risk.textContent = t('risk.' + card.risk);
      el.risk.dataset.risk = card.risk;
      el.bAlways.hidden = !card.allowAlways;
    } else {
      el.rTitle.textContent = card.title;
      el.rBody.textContent = card.body;
      el.bCopy.hidden = !card.copyable || Boolean(card.actions);
      el.rMore.replaceChildren(...(card.actions || []).map((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = action.primary ? 'btn ok' : 'btn';
        button.textContent = action.label;
        button.addEventListener('click', action.run);
        return button;
      }));
    }
  }

  // while typing, YO wears the look of the highlighted action
  function variant() {
    if (composing && panel && hoverCat) return hoverCat;
    if (composing && !panel && matches[pick]) return matches[pick].category;
    return s.category;
  }

  function render() {
    const mode = derive();
    const faceState = composing ? 'idle' : FACE[s.state];

    if (vis !== 'leaving') {
      el.island.dataset.mode = mode;
      el.island.dataset.variant = variant();
      el.island.dataset.face = faceState;
      face.setState(faceState);
      face.setVariant(variant());
      face.focusInput(composing);
      let text = '';
      if (mode === 'listening' || mode === 'working') text = s.label;
      else if (mode === 'approval') text = t('needsOk');
      else if (mode === 'result') text = s.label || t('done');
      else if (mode === 'custom') text = customHint || t('customize');
      el.label.textContent = text;
      setBubble(mode === 'peek' ? bubbleFor() : '');
      announce(text || bubbleText);
      if (s.card && (mode === 'approval' || mode === 'result')) fillCard(mode, s.card);
    }

    if (!composing && document.activeElement === el.cmd) el.cmd.blur();
    schedulePeek();
  }

  function applyStrings() {
    el.mic.setAttribute('aria-label', t('voiceLabel'));
    el.stop.textContent = t('stop');
    el.browse.setAttribute('aria-label', t('browse'));
    el.browse.title = t('browse');
    el.panel.setAttribute('aria-label', t('browse'));
    drawPanel();
    el.hero.setAttribute('aria-label', 'YO');
    el.hero.title = t('heroTip');
    el.cDone.textContent = t('done');
    el.cRandom.textContent = t('surprise');
    el.cReset.textContent = t('reset');
    el.suggest.setAttribute('aria-label', t('actions'));
    el.cmd.placeholder = t('placeholder');
    el.cmd.setAttribute('aria-label', t('placeholder'));
    el.bDeny.textContent = t('deny');
    el.bAllow.textContent = t('allow');
    el.bAlways.textContent = t('always');
    el.bCopy.textContent = t('copy');
    el.bClose.textContent = t('close');
    bubbleText = '\u0000'; // force the bubble to refresh
    render();
  }

  function restart(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  // ---------- suggestions: nothing until you type; the grid button (or ↓) shows everything ----------
  // which drawer is open under the bar: 'off', 'list' (matches) or 'all' (the panel)
  function syncDrawer() {
    const typed = Boolean(el.cmd.value.trim());
    const next = panel ? 'all' : typed ? 'list' : 'off';
    const before = el.island.dataset.list;
    el.island.dataset.list = next;
    el.cmd.setAttribute('aria-expanded', String(next === 'list'));
    if (next === 'list' && before !== 'list') restart(el.suggest, 'intro');
    if (next === 'all' && before !== 'all') restart(el.panel, 'intro');
  }

  function updateSuggestions() {
    const typed = el.cmd.value.trim();
    if (typed) panel = false; // typing takes over from the panel
    el.browse.setAttribute('aria-expanded', String(panel));
    matches = typed ? Y.commands.match(typed, MAX_SUGGEST) : [];
    // a quick answer (math, units, color, uuid...) goes first: Enter copies it
    const found = typed ? Y.quick.answer(typed) : null;
    if (found) {
      const answers = found.rows.map((row) => ({ id: 'answer', category: 'tools', kind: found.kind, swatch: found.swatch, answer: row }));
      matches = answers.concat(matches).slice(0, MAX_SUGGEST);
    }
    pick = 0;
    drawSuggestions();
    syncDrawer();
    lookUpOpen(typed);
  }

  // "open spo" -> Spotify, Downloads, github.com... from the main process (installed apps live there)
  function lookUpOpen(typed) {
    const ask = ++openAsk;
    const open = Y.commands.byId('open');
    const arg = Y.commands.argOf(open, typed);
    if (!Y.commands.leadWord(open, typed) || !arg) return;
    Y.agent.suggestOpen(arg).then((found) => {
      if (ask !== openAsk || !composing || !Array.isArray(found) || !found.length) return;
      const targets = found.map((target) => ({ id: 'open', category: 'apps', target }));
      // the real targets replace the generic "Open an app, folder or site" row
      matches = targets.concat(matches.filter((cmd) => cmd.id !== 'open' || cmd.target)).slice(0, MAX_SUGGEST);
      pick = 0;
      drawSuggestions();
      syncDrawer();
    });
  }

  function setPanel(open) {
    if (open && !panel) Y.sound.play('drawer');
    panel = open;
    hoverCat = null;
    el.browse.setAttribute('aria-expanded', String(open));
    syncDrawer();
    syncPick();
  }

  // every action as a small chip, one row per category
  function drawPanel() {
    const rows = PANEL_ORDER.map((cat) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const chips = document.createElement('div');
      row.className = 'prow';
      name.className = 'plabel';
      name.textContent = t('cat.' + cat);
      chips.className = 'chips';
      if (cat === 'tools') {
        Y.quick.TOOLS.forEach((tool) => chips.append(toolChip(tool)));
        row.append(name, chips);
        return row;
      }
      Y.commands.LIST.filter((cmd) => cmd.category === cat).forEach((cmd) => {
        const chip = document.createElement('button');
        const label = document.createElement('span');
        chip.type = 'button';
        chip.className = 'act';
        chip.dataset.cat = cat;
        chip.title = t('cmd.' + cmd.id);
        chip.innerHTML = cmd.icon; // static markup from commands.js
        label.textContent = t('short.' + cmd.id);
        chip.append(label);
        chip.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the bar
        chip.addEventListener('mouseenter', () => previewCat(cat));
        chip.addEventListener('focus', () => previewCat(cat));
        chip.addEventListener('click', () => fromPanel(cmd));
        chips.append(chip);
      });
      row.append(name, chips);
      return row;
    });
    el.panel.replaceChildren(...rows);
  }

  // a Tools chip puts an example in the bar; the answer shows right away
  function toolChip(tool) {
    const chip = document.createElement('button');
    const label = document.createElement('span');
    chip.type = 'button';
    chip.className = 'act';
    chip.dataset.cat = 'tools';
    chip.innerHTML = Y.quick.ICONS[tool.id]; // static markup from quick.js
    label.textContent = t('tool.' + tool.id);
    chip.append(label);
    chip.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the bar
    chip.addEventListener('mouseenter', () => previewCat('tools'));
    chip.addEventListener('focus', () => previewCat('tools'));
    chip.addEventListener('click', () => {
      el.cmd.value = tool.fill;
      updateSuggestions();
      focusCommand();
    });
    return chip;
  }

  function previewCat(cat) {
    hoverCat = cat;
    syncPick();
  }

  // a chip runs its action, or fills the bar when the action still needs something
  function fromPanel(cmd) {
    if (cmd.arg) {
      el.cmd.value = cmd.fill;
      updateSuggestions();
      focusCommand();
      return;
    }
    el.cmd.value = '';
    setPanel(false);
    submit(cmd);
  }

  function drawSuggestions() {
    const rows = matches.map((cmd, i) => {
      const row = document.createElement('div');
      const icon = document.createElement('span');
      const title = document.createElement('span');
      const example = document.createElement('span');
      const enter = document.createElement('kbd');
      row.id = 'sug-' + i;
      row.className = 'sug';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === pick));
      row.dataset.cat = cmd.category;
      icon.className = 'ico';
      title.className = 'ttl';
      example.className = 'ex';
      if (cmd.target) {
        icon.innerHTML = Y.commands.TARGET_ICONS[cmd.target.kind] || Y.commands.TARGET_ICONS.app; // static markup
        title.textContent = cmd.target.label;
        example.textContent = t('target.' + cmd.target.kind);
      } else if (cmd.answer) {
        row.classList.add('answer');
        if (cmd.swatch) {
          icon.classList.add('swatch');
          icon.style.background = cmd.swatch;
        } else {
          icon.innerHTML = Y.quick.ICONS[cmd.kind] || Y.quick.ICONS.math; // static markup from quick.js
        }
        title.textContent = cmd.answer.value;
        example.textContent = cmd.answer.label;
      } else {
        icon.innerHTML = cmd.icon; // static markup from commands.js
        title.textContent = t('cmd.' + cmd.id);
        example.textContent = t('example.' + cmd.id);
      }
      enter.textContent = '↵';
      example.append(enter);
      row.append(icon, title, example);
      row.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the bar
      row.addEventListener('mousemove', () => { if (pick !== i) setPick(i); });
      row.addEventListener('click', () => choose(i));
      return row;
    });
    if (!rows.length && el.cmd.value.trim()) {
      const empty = document.createElement('div');
      empty.className = 'sug empty';
      empty.textContent = t('noMatch') + ' · ' + t('noMatchHint');
      rows.push(empty);
    }
    el.suggest.replaceChildren(...rows);
    syncPick();
  }

  function syncPick() {
    Array.from(el.suggest.children).forEach((row, i) => {
      if (row.id) row.setAttribute('aria-selected', String(i === pick));
    });
    if (matches[pick]) el.cmd.setAttribute('aria-activedescendant', 'sug-' + pick);
    else el.cmd.removeAttribute('aria-activedescendant');
    const look = variant();
    el.island.dataset.variant = look;
    face.setVariant(look);
  }

  function setPick(i) {
    pick = i;
    syncPick();
  }

  // Enter or click on an action: run it, or fill the bar when it still needs something
  function choose(i) {
    const cmd = matches[i];
    if (!cmd) return submit(null);
    if (cmd.answer) return copyAnswer(cmd.answer.value);
    if (cmd.target) {
      el.cmd.value = 'open ' + cmd.target.label;
      return submit(Y.commands.byId('open'));
    }
    const text = el.cmd.value;
    if (!Y.commands.ready(cmd, text)) {
      if (Y.commands.leadWord(cmd, text)) restart(el.bar, 'knock');
      else el.cmd.value = cmd.fill;
      updateSuggestions();
      focusCommand();
      return;
    }
    submit(cmd);
  }

  function copyAnswer(value, isAnswer) {
    const short = value.length > 30 ? value.slice(0, 29) + '…' : value;
    const done = (ok) => {
      el.cmd.value = '';
      composing = false;
      onEvent({ type: 'message', category: 'tools', tone: ok ? 'ok' : 'error', text: ok ? t('copied').replace('{v}', short) : t('copyFailed') });
      if (ok && isAnswer !== false) earn('answers');
    };
    if (!navigator.clipboard) return done(false);
    navigator.clipboard.writeText(value).then(() => done(true), () => done(false));
  }

  // ---------- show / hide: the robot only exists when it has something to say ----------
  function focusCommand() {
    setTimeout(() => {
      if (!composing) return;
      el.cmd.focus();
      const end = el.cmd.value.length;
      el.cmd.setSelectionRange(end, end);
    }, 40);
  }

  async function showIsland(focus) {
    // already out: only grab focus, and leave the entrance timer alone
    if (vis === 'shown' || vis === 'entering') {
      if (focus) await bridge.show(true);
      return;
    }
    visToken += 1;
    const token = visToken;
    await bridge.show(Boolean(focus));
    if (token !== visToken) return;
    vis = 'entering';
    el.island.dataset.vis = 'entering';
    render();
    face.setActive(true);
    reportHit();
    earn('visit');
    const greet = firstToday();
    // when the robot touches down: a full hello once a day, a quick landing otherwise
    setTimeout(() => {
      if (token !== visToken) return;
      face.react(greet ? 'greet' : 'land');
      if (greet || focus) Y.sound.play(greet ? 'hello' : 'arrive');
    }, 560);
    setTimeout(() => {
      if (token !== visToken) return;
      vis = 'shown';
      el.island.dataset.vis = 'shown';
      reportHit();
    }, ENTER_MS);
  }

  function hideIsland() {
    if (vis === 'hidden' || vis === 'leaving') return;
    clearTimeout(peekTimer);
    Y.sound.play('leave');
    vis = 'leaving';
    el.island.dataset.vis = 'leaving';
    visToken += 1;
    const token = visToken;
    setTimeout(() => {
      if (token !== visToken) return;
      vis = 'hidden';
      el.island.dataset.vis = 'hidden';
      face.setActive(false);
      face.reset();
      dozing = false;
      reportHit();
      bridge.hide();
    }, LEAVE_MS);
  }

  // nothing going on: deliver waiting news first, otherwise leave
  function maybeHide() {
    if (composing || customizing || s.state !== 'idle') return;
    if (later.length) return onEvent(later.shift());
    hideIsland();
  }

  // a lone robot with nothing to say waits a while, then leaves
  function schedulePeek() {
    clearTimeout(peekTimer);
    if (derive() !== 'peek' || s.state !== 'idle') return;
    if (vis !== 'shown' && vis !== 'entering') return;
    peekTimer = setTimeout(function tick() {
      if (hovering) { peekTimer = setTimeout(tick, 3000); return; }
      if (derive() === 'peek' && s.state === 'idle') maybeHide();
    }, PEEK_MS);
  }

  // ---------- events from the agent ----------
  function scheduleClose(ms) {
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      if (hovering && s.state === 'result') return scheduleClose(4000);
      if (s.state !== 'done' && s.state !== 'result') return;
      s.state = 'idle';
      s.card = null;
      s.fg = false;
      render();
      maybeHide();
    }, ms);
  }

  function surface() {
    render();
    if (vis === 'shown') restart(el.hero, 'nudge');
    if (derive() === 'approval') restart(el.bar, 'knock');
    showIsland(false);
  }

  function onEvent(ev) {
    // YO's own news (a reminder) waits until you're done with what you're doing
    if (ev.background && busy()) {
      later.push(ev);
      return;
    }
    if (ev.category) s.category = ev.category;
    if (ev.background) s.fg = false; // YO's own news knocks in the pill; you open it
    if (ev.type === 'state') {
      s.state = ev.state;
      s.label = ev.text || '';
      return render();
    }
    if (ev.type === 'step') {
      s.label = ev.text;
      if (!composing) el.label.textContent = ev.text;
      return;
    }
    if (ev.type === 'approval_needed') {
      s.state = 'approval';
      s.pendingId = ev.id;
      s.card = { title: ev.title, body: ev.body, risk: ev.risk, allowAlways: Boolean(ev.allowAlways) };
    } else if (ev.type === 'message') {
      s.state = 'done';
      s.label = ev.text;
      scheduleClose(ev.ms || 3200);
    } else if (ev.type === 'result') {
      s.state = 'result';
      s.label = ev.sources || t('done');
      s.card = { title: ev.title, body: ev.body, copyable: !ev.sticky };
      if (ev.unlock) {
        const { slot, value } = ev.unlock;
        s.card.actions = [{
          label: t('unlock.tryOn'),
          primary: true,
          run: () => {
            prefs.look[slot] = value;
            savePrefs();
            applyPrefs();
            clearCard();
            Y.sound.play('equip');
            onEvent({ type: 'message', category: 'system', tone: 'ok', text: t('unlock.wearing'), ms: 3600 });
          },
        }];
      }
      if (ev.sticky) clearTimeout(s.timer);
      else scheduleClose(14000);
    } else {
      return;
    }
    feel(ev);
    surface();
  }

  // YO reacts to what happens, with a sound on the moments that matter
  const TONES = {
    ok: ['success', 'success'], set: ['success', 'set'], cancel: ['cancel', 'cancel'], info: ['info', 'info'],
    media: ['media', ''], error: ['error', 'error'],
  };
  function feel(ev) {
    let move = '';
    let sound = '';
    if (ev.type === 'approval_needed') {
      move = 'ask';
      sound = 'knock';
    } else if (ev.type === 'result' && ev.unlock) {
      move = 'equip';
      sound = 'unlock';
    } else if (ev.type === 'result') {
      move = ev.background ? 'remind' : 'success';
      sound = ev.background ? (ev.alarm ? 'alarm' : 'chime') : 'success';
    } else if (ev.type === 'message' && TONES[ev.tone]) {
      [move, sound] = TONES[ev.tone];
    }
    if (dozing) {
      dozing = false;
      face.react('wake');
    }
    if (move) face.react(move);
    if (sound) Y.sound.play(sound);
  }

  // ---------- unlocks: earned by using YO ----------
  function earn(kind) {
    const fresh = Y.unlocks.record(kind);
    fresh.forEach((rule) => {
      onEvent({
        type: 'result', background: true, sticky: true, category: 'system', unlock: { slot: rule.slot, value: rule.value },
        title: t('unlock.title').replace('{name}', optionLabel(rule.slot, rule.value)),
        body: t('unlock.body'),
      });
    });
    if (fresh.length && customizing) drawCustom();
  }

  function lockHint(group, value) {
    const p = Y.unlocks.progress(group, value);
    return p ? t('lock.' + p.stat).replace(/\{need\}/g, p.need).replace('{have}', p.have) : '';
  }

  // ---------- small life: dozing off, petting, boops ----------
  function activity() {
    lastActive = Date.now();
    if (!dozing) return;
    dozing = false;
    face.react('wake');
    Y.sound.play('yawn');
  }

  setInterval(() => {
    if (dozing && vis === 'shown' && Date.now() - lastSnore > 3600) {
      lastSnore = Date.now();
      Y.sound.play('snore');
    }
    const open = composing || (s.fg && (s.state === 'result' || s.state === 'approval'));
    if (dozing || vis !== 'shown' || !open || Date.now() - lastActive < SLEEP_MS) return;
    dozing = true;
    lastSnore = Date.now();
    face.react('sleep');
  }, 1000);

  // ---------- Customize: right-click YO ----------
  // each row: [label key, pref group, values]; swatches for colors, chips for the rest
  const CUSTOM_ROWS = [
    ['custom.color', 'color'],
    ['custom.eyes', 'eyes', 'eyeColor'],
    ['custom.hat', 'hat'],
    ['custom.glasses', 'glasses'],
    ['custom.item', 'item'],
    ['custom.seasonal', 'seasonal'],
    ['custom.voice', 'voice'],
    ['custom.volume', 'volume'],
  ];
  const SWATCHES = { color: true, eyeColor: true };

  function optionsFor(group) {
    if (group === 'seasonal') return [true, false];
    if (group === 'voice') return Y.sound.VOICES.concat('off');
    if (group === 'volume') return [1, 2, 3];
    return Y.mascot.LOOKS[group];
  }

  function optionLabel(group, value) {
    if (group === 'seasonal') return t(value ? 'seasonOn' : 'seasonOff');
    if (group === 'voice') return t('voice.' + value);
    if (group === 'volume') return t('volume.' + value);
    return t('look.' + group + '.' + value);
  }

  function isPicked(group, value) {
    if (group === 'seasonal') return prefs.seasonal === value;
    if (group === 'voice') return value === 'off' ? !prefs.sound : prefs.sound && prefs.voice === value;
    if (group === 'volume') return prefs.volume === value;
    return prefs.look[group] === value;
  }

  function drawCustom() {
    const rows = CUSTOM_ROWS.map(([labelKey, ...groups]) => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      const opts = document.createElement('div');
      row.className = 'orow';
      if (groups[0] === 'voice') row.classList.add('sep');
      name.className = 'olabel';
      name.textContent = t(labelKey);
      opts.className = 'ochips';
      opts.setAttribute('role', 'group');
      opts.setAttribute('aria-label', t(labelKey));
      groups.forEach((group) => {
        optionsFor(group).forEach((value) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = SWATCHES[group] ? 'sw' : 'opt';
          if (group === 'eyeColor') button.classList.add('sw-eye');
          button.dataset.group = group;
          button.dataset.value = String(value);
          if (SWATCHES[group]) {
            button.dataset[group === 'color' ? 'color' : 'eye'] = value;
            button.title = optionLabel(group, value);
            button.setAttribute('aria-label', optionLabel(group, value));
          } else {
            button.textContent = optionLabel(group, value);
          }
          if (!Y.unlocks.isUnlocked(group, value)) {
            button.classList.add('locked');
            button.setAttribute('aria-disabled', 'true');
            button.title = lockHint(group, value);
          }
          button.addEventListener('click', () => chooseLook(group, value));
          opts.append(button);
        });
      });
      row.append(name, opts);
      if (groups[0] === 'seasonal') row.append(seasonInfo());
      return row;
    });
    el.cOpts.replaceChildren(...rows);
    syncCustom();
  }

  // what's on today, what comes next, and the whole list: so you know what exists
  function seasonInfo() {
    const info = document.createElement('div');
    const today = Y.mascot.seasonal();
    const next = Y.mascot.nextSeason();
    let line = today ? t('seasonToday').replace('{name}', t('season.' + today)) : t('seasonNone');
    if (next) {
      const date = next.date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      line += ' · ' + t('seasonNext').replace('{name}', t('season.' + next.name)).replace('{date}', date);
    }
    info.className = 'oinfo';
    info.textContent = line + '. ' + t('seasonAll');
    info.title = t('seasonRule');
    return info;
  }

  function syncCustom() {
    el.cOpts.querySelectorAll('button[data-group]').forEach((button) => {
      const group = button.dataset.group;
      const raw = button.dataset.value;
      const value = group === 'seasonal' ? raw === 'true' : group === 'volume' ? Number(raw) : raw;
      button.setAttribute('aria-pressed', String(isPicked(group, value)));
    });
  }

  function chooseLook(group, value) {
    // still locked: say how to earn it, in the panel's title for a moment
    if (!Y.unlocks.isUnlocked(group, value)) {
      customHint = '🔒 ' + lockHint(group, value);
      render();
      preview.react('info');
      Y.sound.play('info');
      clearTimeout(chooseLook.timer);
      chooseLook.timer = setTimeout(() => { customHint = ''; render(); }, 2800);
      return;
    }
    if (group === 'seasonal') prefs.seasonal = value;
    else if (group === 'voice') {
      prefs.sound = value !== 'off';
      if (value !== 'off') prefs.voice = value;
    } else if (group === 'volume') prefs.volume = value;
    else prefs.look[group] = value;
    savePrefs();
    applyPrefs();
    syncCustom();
    // a little show: YO reacts, and the sound settings play a sample
    if (group === 'voice' || group === 'volume') {
      preview.react('success');
      Y.sound.play('hello');
    } else {
      preview.react('equip');
      Y.sound.play('equip');
    }
  }

  function surprise() {
    const L = {};
    Object.keys(Y.mascot.LOOKS).forEach((key) => {
      L[key] = Y.mascot.LOOKS[key].filter((value) => Y.unlocks.isUnlocked(key, value));
    });
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    prefs.look = {
      color: pick(L.color), eyeColor: pick(L.eyeColor), eyes: pick(L.eyes),
      hat: Math.random() < 0.8 ? pick(L.hat) : 'none',
      glasses: Math.random() < 0.4 ? pick(L.glasses) : 'none',
      item: Math.random() < 0.5 ? pick(L.item) : 'none',
    };
    savePrefs();
    applyPrefs();
    syncCustom();
    preview.react('equip');
    Y.sound.play('equip');
  }

  function resetLook() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    Object.assign(prefs, fresh);
    savePrefs();
    applyPrefs();
    syncCustom();
    preview.react('land');
    Y.sound.play('arrive');
  }

  function openCustom() {
    if (customizing) return;
    customizing = true;
    composing = false;
    panel = false;
    if (!preview) preview = Y.mascot.mount(el.preview, 150);
    drawCustom();
    applyPrefs();
    preview.setActive(true);
    render();
    showIsland(true);
    Y.sound.play('drawer');
    setTimeout(() => { if (customizing) preview.react('land'); }, 120);
  }

  function closeCustom() {
    if (!customizing) return;
    customizing = false;
    preview.setActive(false);
    preview.reset();
    render();
    Y.sound.play('close');
    maybeHide();
  }

  // ---------- what the user does ----------
  function expand(seed) {
    if (!composing) Y.sound.play('open');
    if (s.state === 'done') { clearTimeout(s.timer); s.state = 'idle'; s.fg = false; }
    composing = true;
    el.cmd.value = seed || '';
    panel = false;
    updateSuggestions();
    render();
    focusCommand();
  }

  function heroClick() {
    const mode = derive();
    if (mode === 'peek') {
      if (s.state === 'approval' || s.state === 'result') {
        s.fg = true;
        return render();
      }
      return expand('');
    }
    if (mode === 'command') {
      composing = false;
      Y.sound.play('close');
      render();
    }
  }

  function submit(cmd) {
    const text = el.cmd.value.trim();
    if (!text && !cmd) return;
    if (text === '/quit') return bridge.quit();
    earn('actions');
    el.cmd.value = '';
    composing = false;
    s.fg = true;
    s.state = 'working';
    s.category = cmd ? cmd.category : s.category;
    s.label = t('working');
    render();
    agent.send(text, cmd && cmd.id);
  }

  // close a card without sending YO away (a card button is about to do something else)
  function clearCard() {
    clearTimeout(s.timer);
    s.state = 'idle';
    s.card = null;
    s.pendingId = null;
    s.fg = false;
  }

  // run an action as if it had been typed
  function runText(text, id) {
    el.cmd.value = text;
    submit(Y.commands.byId(id));
  }

  function respond(decision) {
    if (!s.pendingId) return;
    const id = s.pendingId;
    s.pendingId = null;
    s.state = 'working';
    s.label = t('working');
    s.card = null;
    render();
    agent.respond(id, decision);
  }

  function dismiss() {
    clearTimeout(s.timer);
    s.state = 'idle';
    s.card = null;
    s.pendingId = null;
    s.fg = false;
    render();
    maybeHide();
  }

  function escape() {
    if (customizing) return closeCustom();
    if (composing && panel) return setPanel(false); // first Esc closes the panel
    if (composing) {
      composing = false;
      Y.sound.play('close');
      render();
      return maybeHide();
    }
    if (s.state === 'approval' && s.pendingId) return respond('deny');
    if (s.state === 'working') return agent.stop();
    dismiss();
  }

  function startListening() {
    composing = false;
    s.state = 'listening';
    s.label = t('listening');
    render();
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.state = 'idle';
      expand('');
    }, 3000);
  }

  // hold YO to pet it; a click on its antenna is a boop
  let petTimer = null;
  let petting = false;
  let skipClick = false;
  function stopPet() {
    clearTimeout(petTimer);
    if (!petting) return;
    petting = false;
    face.pet(false);
  }
  el.hero.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    skipClick = false;
    clearTimeout(petTimer);
    petTimer = setTimeout(() => {
      petting = true;
      skipClick = true;
      face.pet(true);
      Y.sound.play('pet');
      earn('pets');
    }, PET_MS);
  });
  el.hero.addEventListener('pointerup', stopPet);
  el.hero.addEventListener('pointerleave', stopPet);
  el.hero.addEventListener('click', (event) => {
    if (skipClick) { skipClick = false; return; }
    if (event.target.closest && event.target.closest('.hit-ant')) {
      Y.sound.play(face.boop() ? 'dizzy' : 'boop');
      return;
    }
    heroClick();
  });
  document.addEventListener('pointerdown', activity);
  el.hero.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    stopPet();
    openCustom();
  });
  el.cDone.addEventListener('click', closeCustom);
  el.cRandom.addEventListener('click', surprise);
  el.cReset.addEventListener('click', resetLook);
  el.island.addEventListener('mouseenter', () => { hovering = true; });
  el.island.addEventListener('mouseleave', () => { hovering = false; });
  el.cmd.addEventListener('input', updateSuggestions);
  el.cmd.addEventListener('input', () => face.react('type'));
  el.cmd.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!el.cmd.value.trim()) return setPanel(true); // empty bar: show what YO can do
      choose(pick);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!matches.length) {
        if (!el.cmd.value.trim()) setPanel(event.key === 'ArrowDown');
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : matches.length - 1;
      setPick((pick + step) % matches.length);
      Y.sound.play('tick');
    }
  });
  document.addEventListener('keydown', (event) => {
    activity();
    if (event.key === 'Escape') return escape();
    if (composing || vis === 'hidden' || vis === 'leaving') return;
    if (derive() !== 'peek' || s.state !== 'idle') return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    // typing while the lone robot is out opens the bar and keeps your first key
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      expand('');
    } else if (event.key.length === 1) {
      event.preventDefault();
      expand(event.key);
    }
  });
  el.browse.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the bar
  el.browse.addEventListener('click', () => {
    if (el.cmd.value.trim()) {
      el.cmd.value = '';
      matches = [];
      drawSuggestions();
    }
    setPanel(!panel);
    focusCommand();
  });
  el.mic.addEventListener('click', startListening);
  el.stop.addEventListener('click', () => agent.stop());
  el.bDeny.addEventListener('click', () => respond('deny'));
  el.bAllow.addEventListener('click', () => respond('allow'));
  el.bAlways.addEventListener('click', () => respond('always'));
  el.bClose.addEventListener('click', dismiss);
  el.bCopy.addEventListener('click', () => {
    const text = el.rTitle.textContent + '\n' + el.rBody.textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    dismiss();
  });

  // where YO is in the window: the main process lets clicks (and drops) reach it there, and through everywhere else
  let lastHit = '';
  function reportHit() {
    let rect = null;
    if (vis !== 'hidden') {
      const r = el.island.getBoundingClientRect();
      rect = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const key = JSON.stringify(rect);
    if (key === lastHit) return;
    lastHit = key;
    bridge.setHitRect(rect);
  }
  new ResizeObserver(reportHit).observe(el.island);

  // ---------- drop a file or some text on YO: it opens its mouth, then eats it ----------
  function dragKind(event) {
    const types = Array.from((event.dataTransfer && event.dataTransfer.types) || []);
    if (types.indexOf('Files') !== -1) return 'files';
    return types.indexOf('text/plain') !== -1 ? 'text' : null;
  }

  function eatDrop(data) {
    const files = Array.from(data.files || []);
    const paths = files.map((file) => (bridge.pathForFile ? bridge.pathForFile(file) : '')).filter(Boolean);
    const text = files.length ? '' : (data.getData('text/plain') || '').trim();
    face.setHungry(false);
    if (!paths.length && !text) return;
    if (customizing) closeCustom();
    face.react('eat');
    Y.sound.play('gulp');
    composing = false;
    panel = false;
    clearTimeout(s.timer);
    s.state = 'result';
    s.fg = true;
    if (paths.length) {
      const first = paths[0];
      const name = first.split(/[\\/]/).pop() || first;
      s.category = 'apps';
      s.label = paths.length > 1 ? t('drop.many').replace('{n}', paths.length) : t('drop.one');
      s.card = {
        title: paths.length > 1 ? t('drop.files').replace('{name}', name).replace('{n}', paths.length - 1) : name,
        body: paths.join('\n'),
        actions: [
          { label: t('drop.copyPath'), primary: true, run: () => copyAnswer(paths.join('\r\n'), false) },
          { label: t('drop.reveal'), run: () => { if (bridge.fileAction) bridge.fileAction('reveal', first); dismiss(); } },
          { label: t('drop.open'), run: () => { clearCard(); runText('open ' + first, 'open'); } },
        ],
      };
    } else {
      const words = text.split(/\s+/).filter(Boolean).length;
      const link = /^https?:\/\/\S+$/i.test(text);
      s.category = 'tools';
      s.label = t('drop.text');
      s.card = {
        title: text.length > 60 ? text.slice(0, 59) + '…' : text,
        body: t('drop.count').replace('{w}', words).replace('{c}', text.length),
        actions: [
          link
            ? { label: t('drop.openLink'), primary: true, run: () => { clearCard(); runText('open ' + text, 'open'); } }
            : { label: t('drop.remind'), primary: true, run: () => { clearCard(); expand('remind me in 10 min to ' + text.slice(0, 100)); } },
          { label: t('copy'), run: () => copyAnswer(text, false) },
        ],
      };
    }
    render();
    showIsland(true);
  }

  el.island.addEventListener('dragenter', (event) => {
    if (!dragKind(event)) return;
    event.preventDefault();
    dragDepth += 1;
    if (dragDepth === 1) {
      hovering = true;
      activity();
      face.setHungry(true);
    }
  });
  el.island.addEventListener('dragover', (event) => {
    if (!dragKind(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  el.island.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) { hovering = false; face.setHungry(false); }
  });
  el.island.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    hovering = false;
    eatDrop(event.dataTransfer);
  });
  // a drop anywhere else in the window does nothing (never opens the file in the page)
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => event.preventDefault());
  window.addEventListener('blur', () => {
    if (composing && !el.cmd.value) {
      composing = false;
      render();
      maybeHide();
    }
  });

  bridge.onHotkey(() => {
    if (customizing) return closeCustom();
    if (vis === 'hidden' || vis === 'leaving') {
      composing = false;
      render();
      showIsland(true);
    } else if (composing) {
      composing = false;
      render();
      maybeHide();
    } else if (derive() === 'peek' && s.state === 'idle') {
      hideIsland();
    } else if (derive() === 'peek' && (s.state === 'approval' || s.state === 'result')) {
      // news is waiting: the shortcut opens it
      s.fg = true;
      render();
      showIsland(true);
    } else if (s.state === 'done') {
      expand('');
    }
  });

  // the pointer, from anywhere on screen: YO's eyes follow it
  bridge.onCursor((point) => {
    if (vis === 'hidden') return;
    const r = el.hero.getBoundingClientRect();
    face.lookAt(point.x - (r.left + r.width / 2), point.y - (r.top + r.height / 2));
    activity();
  });

  // what's playing (only asked while YO is on screen): YO bops along and names the song
  bridge.onMedia((now) => {
    const changed = !nowPlaying || !now || now.title !== nowPlaying.title;
    nowPlaying = now;
    face.setMusic(Boolean(now && now.playing));
    // right after next / previous: say the new song
    if (changed && now && now.playing && now.title && s.state === 'done' && s.category === 'media') {
      s.label = '♪ ' + songText(now);
      scheduleClose(3600);
    }
    render();
  });

  // Sounds on/off from the tray menu
  bridge.onPref((pref) => {
    if (pref) setPref(pref.key, pref.value);
  });

  // English only for now: the FR/AR strings stay in i18n.js but are no longer offered
  setLang('en');
  applyPrefs();
  applyStrings();
  bridge.getInfo().then((info) => {
    if (info && info.shortcut) shortcut = info.shortcut;
    onEvent({ type: 'message', category: 'system', text: t('welcome').replace('{key}', shortcut), ms: 4600 });
  });

  Y.app = {
    onEvent,
    session: s,
    mascot: face,
    view: () => ({ composing, vis, mode: el.island.dataset.mode, bubble: bubbleText, variant: el.island.dataset.variant, queued: later.length }),
  };
})((window.Yo = window.Yo || {}));
