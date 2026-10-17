(function (Y) {
  'use strict';

  // Focus: Pomodoro sessions with YO. A ring counts down, a big YO focuses with you (headphones on,
  // calm eyes) and takes its breaks with a mug. Rounds of focus and short breaks, then a long break.
  // The timer keeps going when you close the app or YO hides: the tray shows the time left, and YO
  // comes back with a card when a session ends. You can link a task from your To-do list.
  const { h, button } = Y.miniapps;
  const KEY = 'yo.focus';
  const STATS = 'yo.focusStats';
  const RING = 2 * Math.PI * 80; // the ring's length (radius 80)
  const LIMITS = { focus: [5, 90, 5], short: [1, 30, 1], long: [5, 45, 5], rounds: [2, 8, 1] };
  const DEFAULTS = { focus: 25, short: 5, long: 15, rounds: 4, autoBreak: true, endSound: true, sound: 'off' };

  const PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1.4" fill="currentColor"/>' +
    '<rect x="13.5" y="5.5" width="4" height="13" rx="1.4" fill="currentColor"/></svg>';
  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  };
  const today = () => new Date().toDateString();

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
    const s = Object.assign({}, DEFAULTS);
    Object.keys(LIMITS).forEach((k) => {
      const [min, max] = LIMITS[k];
      if (Number.isFinite(saved[k])) s[k] = Math.min(max, Math.max(min, Math.round(saved[k])));
    });
    ['autoBreak', 'endSound'].forEach((k) => { if (typeof saved[k] === 'boolean') s[k] = saved[k]; });
    if (['off', 'rain', 'deep'].indexOf(saved.sound) !== -1) s.sound = saved.sound;
    return s;
  }

  function mount(host) {
    const { t } = host;
    const set = loadSettings();
    const st = { phase: 'focus', running: false, endsAt: 0, left: set.focus * 60000, round: 1, task: null };
    let stats = read(STATS, {});
    if (stats.day !== today()) stats = { day: today(), sessions: 0, minutes: 0 };
    let yo = null; // the big YO, made the first time the app opens
    let visible = false;
    let ticker = null;
    let lastStatus = '';
    let said = '';
    let sayUntil = 0; // a cheer stays up a few seconds before the usual lines come back
    let settingsOpen = false;
    let tasks = [];

    // ---------- the view ----------
    const svgNS = 'http://www.w3.org/2000/svg';
    const ring = document.createElementNS(svgNS, 'svg');
    ring.setAttribute('viewBox', '0 0 180 180');
    ring.setAttribute('class', 'fz-ringsvg');
    ring.innerHTML = '<circle class="fz-track" cx="90" cy="90" r="80"/>' +
      '<circle class="fz-prog" cx="90" cy="90" r="80" transform="rotate(-90 90 90)" stroke-dasharray="' + RING + '"/>' +
      '<circle class="fz-knob" r="5.5" cx="90" cy="10"/>'; // static markup
    const prog = ring.querySelector('.fz-prog');
    const knob = ring.querySelector('.fz-knob');
    const phaseEl = h('div.fz-phase');
    const timeEl = h('div.fz-time');
    const play = button('fz-play', '', toggle);
    const ringBox = h('div.fz-ring', ring, h('div.fz-center', phaseEl, timeEl, play));
    const say = h('div.fz-say');
    const mascot = h('div.fz-yo');
    const taskRow = h('div.fz-task');
    const dots = h('span.fz-dots');
    const roundsTxt = h('span.fz-val');
    const sessionTxt = h('span.fz-val');
    const todayTxt = h('span.fz-val');
    const skip = button('btn small fz-skip', t('focus.skip'), () => complete(true));
    const sounds = h('div.ochips.fz-sounds');
    const wave = h('span.fz-wave', {}, ...Array.from({ length: 14 }, () => h('i')));
    const gear = button('link fz-gear', '⚙ ' + t('focus.settings'), () => showSettings(!settingsOpen));
    const settings = h('div.fz-settings', { hidden: true });

    const main = h('div.fz-main',
      h('div.fz-top',
        ringBox,
        h('div.fz-side', say, mascot)),
      taskRow,
      h('div.fz-cards',
        h('div.fz-card', h('span.olabel', { text: t('focus.rounds') }), h('span.fz-row', dots, roundsTxt)),
        h('div.fz-card', h('span.olabel', { text: t('focus.session') }), sessionTxt),
        h('div.fz-card', h('span.olabel', { text: t('focus.today') }), todayTxt),
        skip),
      h('div.fz-soundrow', h('span.olabel', { text: t('focus.sound') }), sounds, wave, gear));
    const root = h('div.focusapp', main, settings);

    const length = (phase) => (phase === 'focus' ? set.focus : phase === 'short' ? set.short : set.long) * 60000;
    const leftNow = () => (st.running ? st.endsAt - Date.now() : st.left);
    // the home tile shows the time left while a session or a break runs
    Y.miniapps.live.focus = () => (st.running ? { phase: st.phase, left: Math.max(0, leftNow()), total: length(st.phase), text: mmss(Math.max(0, leftNow())) } : null);

    // ---------- YO: headphones while focusing, a mug on breaks ----------
    function dressYo() {
      if (!yo) return;
      const look = Object.assign({}, host.look());
      if (st.phase === 'focus' && st.running) look.hat = 'headphones';
      if (st.phase !== 'focus') look.item = 'mug';
      yo.setLook(look);
      yo.setMood(st.phase === 'focus' ? (st.running ? 'squint' : null) : 'done');
    }

    function speak(text) {
      if (text === said) return;
      said = text;
      say.textContent = text;
      say.classList.remove('pop');
      void say.offsetWidth;
      say.classList.add('pop');
    }

    function line() {
      if (st.phase === 'short') return Math.random() < 0.5 ? t('focus.say.breakShort') : t('focus.say.breakEyes');
      if (st.phase === 'long') return t('focus.say.breakLong');
      if (!st.running) return st.left < length('focus') ? t('focus.say.paused') : st.round > 1 ? t('focus.say.back') : t('focus.say.ready');
      const left = leftNow();
      if (left <= 5 * 60000 && length('focus') > 6 * 60000) return t('focus.say.last');
      if (left <= length('focus') / 2) return t('focus.say.half');
      return t('focus.say.go');
    }

    // ---------- drawing ----------
    function draw() {
      const left = leftNow();
      const k = Math.max(0, Math.min(1, left / length(st.phase)));
      prog.setAttribute('stroke-dashoffset', String(RING * (1 - k)));
      const a = -Math.PI / 2 + k * Math.PI * 2;
      knob.setAttribute('cx', String(90 + Math.cos(a) * 80));
      knob.setAttribute('cy', String(90 + Math.sin(a) * 80));
      root.dataset.phase = st.phase;
      root.classList.toggle('running', st.running);
      phaseEl.textContent = t('focus.phase.' + st.phase);
      timeEl.textContent = mmss(left);
      play.innerHTML = st.running ? PAUSE : PLAY; // static markup
      play.setAttribute('aria-label', st.running ? t('focus.pause') : st.left < length(st.phase) ? t('focus.resume') : t('focus.start'));
      dots.replaceChildren(...Array.from({ length: set.rounds }, (_, i) => h('i' + (i < st.round - (st.phase === 'focus' ? 1 : 0) ? '.on' : i === st.round - 1 ? '.now' : ''))));
      roundsTxt.textContent = st.round + ' / ' + set.rounds;
      sessionTxt.textContent = t('focus.min').replace('{n}', set.focus);
      todayTxt.textContent = t('focus.sessions').replace('{n}', stats.sessions).replace('{m}', stats.minutes);
      if (Date.now() >= sayUntil) speak(line());
    }

    function drawTasks() {
      const chosen = st.task;
      const chips = [null].concat(tasks.slice(0, 3)).map((task) => button('opt', task ? task.text : t('focus.none'), () => {
        st.task = task ? { id: task.id, text: task.text } : null;
        drawTasks();
        host.sound('tick');
      }, { 'aria-pressed': String(task ? Boolean(chosen && chosen.id === task.id) : !chosen) }));
      // a task typed with "focus on ..." that isn't in the list
      if (chosen && !tasks.some((x) => x.id === chosen.id)) chips.push(button('opt', chosen.text, () => {}, { 'aria-pressed': 'true' }));
      taskRow.replaceChildren(h('span.olabel', { text: t('focus.on') }), h('div.ochips', {}, ...chips));
    }

    function drawSounds() {
      sounds.replaceChildren(...['off', 'rain', 'deep'].map((k) => button('opt', t('focus.snd.' + k), () => {
        set.sound = k;
        write(KEY, set);
        syncAmbient();
        drawSounds();
      }, { 'aria-pressed': String(set.sound === k) })));
    }

    // the waveform follows the real sound
    function drawWave() {
      const level = Y.sound.ambientLevel();
      Array.from(wave.children).forEach((bar, i) => {
        const v = level ? Math.max(0.15, Math.min(1, level * (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 260 + i * 0.9))))) : 0.15;
        bar.style.transform = 'scaleY(' + v.toFixed(2) + ')';
      });
    }

    // ---------- settings: + / - steppers and two switches ----------
    function showSettings(on) {
      settingsOpen = on;
      settings.hidden = !on;
      main.hidden = on;
      if (on) drawSettings();
      host.sound('drawer');
    }

    function drawSettings() {
      const rows = Object.keys(LIMITS).map((k) => {
        const [min, max, step] = LIMITS[k];
        const value = h('span.fz-num', { text: k === 'rounds' ? String(set[k]) : t('focus.min').replace('{n}', set[k]) });
        const change = (d) => {
          const untouched = !st.running && st.left === length(st.phase); // not started yet: follows the new length
          set[k] = Math.min(max, Math.max(min, set[k] + d * step));
          write(KEY, set);
          if (untouched) st.left = length(st.phase);
          drawSettings();
          draw();
        };
        return h('div.fz-set', h('span', { text: t('focus.set.' + k) }),
          h('span.fz-step', button('fz-pm', '−', () => change(-1), { 'aria-label': '−' }), value, button('fz-pm', '+', () => change(1), { 'aria-label': '+' })));
      });
      const toggles = ['autoBreak', 'endSound'].map((k) => h('div.fz-set', h('span', { text: t('focus.set.' + k) }),
        button('fz-switch' + (set[k] ? '.on' : ''), '', () => { set[k] = !set[k]; write(KEY, set); drawSettings(); }, { role: 'switch', 'aria-checked': String(set[k]), 'aria-label': t('focus.set.' + k) })));
      settings.replaceChildren(...rows, ...toggles, button('btn small ok fz-done', t('focus.back'), () => showSettings(false)));
    }

    // ---------- the timer ----------
    function start() {
      st.running = true;
      st.endsAt = Date.now() + st.left;
      run();
      dressYo();
      if (yo && visible) yo.react(st.phase === 'focus' ? 'work' : 'success');
      host.sound('arrive');
      draw();
    }

    function pause() {
      st.left = Math.max(0, st.endsAt - Date.now());
      st.running = false;
      dressYo();
      host.sound('close');
      draw();
      status();
    }

    function toggle() {
      if (st.running) pause();
      else start();
    }

    function run() {
      if (ticker) return;
      ticker = setInterval(tick, 250);
    }

    function tick() {
      if (!st.running) {
        clearInterval(ticker);
        ticker = null;
        return;
      }
      if (st.endsAt - Date.now() <= 0) return complete(false);
      if (visible) {
        draw();
        drawWave();
      }
      status();
    }

    // the tray's tooltip: "Focus 18:42" (once a few seconds, not every tick)
    function status() {
      const text = st.running ? t('focus.status.' + (st.phase === 'focus' ? 'focus' : 'break')).replace('{t}', mmss(leftNow()).replace(/:\d\d$/, ' min').replace(/^0/, '')) : '';
      if (text !== lastStatus) {
        lastStatus = text;
        host.status(text);
      }
      host.quiet('focus', st.running && st.phase === 'focus');
    }

    // a session ends (or you skip it): count it, go to the next phase, tell you.
    // Watching it end, the ring fills, then shrinks into its round's dot, which pops filled.
    function complete(skipped) {
      if (complete.busy) return; // the ring is still on its way to the dot
      const here = visible && host.current() === 'focus' && !Y.miniapps.still();
      if (!skipped && here && st.phase === 'focus') {
        complete.busy = true;
        timeEl.textContent = mmss(0);
        prog.setAttribute('stroke-dashoffset', '0');
        const dot = dots.children[st.round - 1];
        setTimeout(() => {
          Y.miniapps.fly(ringBox, dot, 460, 0.06).then((move) => {
            finish(false);
            const filled = dots.children[st.round - 1 - (st.phase === 'focus' ? 1 : 0)];
            Y.miniapps.pop(filled, 1.7);
            if (move) move.cancel();
            if (move) ringBox.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: Y.miniapps.EASE });
            complete.busy = false;
          });
        }, 320);
        return;
      }
      finish(skipped);
    }

    function finish(skipped) {
      const was = st.phase;
      if (was === 'focus') {
        if (!skipped) {
          if (stats.day !== today()) stats = { day: today(), sessions: 0, minutes: 0 };
          stats.sessions += 1;
          stats.minutes += set.focus;
          write(STATS, stats);
        }
        st.phase = st.round >= set.rounds ? 'long' : 'short';
      } else {
        st.round = was === 'long' ? 1 : st.round + 1;
        st.phase = 'focus';
      }
      st.left = length(st.phase);
      st.running = false;
      if (st.phase !== 'focus' && set.autoBreak && !skipped) {
        st.running = true;
        st.endsAt = Date.now() + st.left;
      }
      if (st.running) run();
      dressYo();
      status();
      draw();
      if (!skipped) announce(was);
    }

    // in the app: YO cheers right here. Elsewhere: YO comes back with a card.
    function announce(was) {
      if (set.endSound) host.sound(was === 'focus' ? 'success' : 'chime');
      const here = visible && host.current() === 'focus';
      if (here) {
        if (yo) yo.react(was === 'focus' ? 'success' : 'wave');
        if (was === 'focus') {
          speak(t('focus.say.done'));
          sayUntil = Date.now() + 4000;
        }
        return;
      }
      const markDone = st.task && st.task.id && host.bridge.todo ? [{ label: t('focus.card.markDone'), run: () => {
        host.bridge.todo('toggle', st.task.id);
        st.task = null;
      } }] : [];
      if (was === 'focus') {
        const body = (st.phase === 'long' ? t('focus.card.bodyLong') : t('focus.card.body').replace('{n}', set.short)) +
          (st.task ? '\n' + t('focus.card.task').replace('{task}', st.task.text) : '');
        const actions = st.running ? [] : [{ label: t('focus.card.startBreak'), primary: true, run: () => start() }];
        host.card(t('focus.card.title'), body, actions.concat(markDone, [{ label: t('focus.card.open'), run: () => host.open('focus', '') }]), { label: t('short.focus') });
      } else {
        host.card(t('focus.card.breakOver'), t('focus.card.breakBody'), [
          { label: t('focus.card.startFocus'), primary: true, run: () => start() },
          { label: t('focus.card.open'), run: () => host.open('focus', '') },
        ], { label: t('short.focus') });
      }
    }

    function syncAmbient() {
      const want = set.sound !== 'off' && st.running && st.phase === 'focus' ? set.sound : null;
      if (Y.sound.ambientKind() !== want) Y.sound.ambient(want);
    }

    function loadTasks() {
      if (!host.bridge.todo) return Promise.resolve();
      return host.bridge.todo('list').then((all) => {
        const now = new Date();
        const day = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        tasks = (Array.isArray(all) ? all : []).filter((x) => !x.done && (!x.due || x.due <= day))
          .sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0));
        drawTasks();
      });
    }

    // "focus 50": a 50 minute session; "focus on math homework": that task (found in your list, or as typed)
    function useSeed(seed) {
      const text = String(seed || '').trim().replace(/^on\s+/i, '');
      if (!text) return;
      const minutes = /^(\d{1,2})\s*(?:m|min|mins|minutes)?$/i.exec(text);
      if (minutes) {
        set.focus = Math.min(LIMITS.focus[1], Math.max(LIMITS.focus[0], +minutes[1]));
        write(KEY, set);
      } else {
        const low = text.toLowerCase();
        const found = tasks.find((x) => x.text.toLowerCase().includes(low) || low.includes(x.text.toLowerCase()));
        st.task = found ? { id: found.id, text: found.text } : { id: null, text: text.slice(0, 80) };
        drawTasks();
      }
      if (st.phase === 'focus' && !st.running) {
        st.left = length('focus');
        start();
      }
    }

    // Space starts or pauses, while Focus is open and you aren't typing somewhere
    document.addEventListener('keydown', (event) => {
      if (event.key !== ' ' || host.current() !== 'focus' || settingsOpen) return;
      if (/^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
      event.preventDefault();
      toggle();
    });

    // the sound follows the timer: on while focusing, off on breaks and when paused
    setInterval(() => syncAmbient(), 500);
    drawSounds();
    drawTasks();
    draw();

    return {
      root,
      open(seed) {
        visible = true;
        if (!yo) yo = Y.mascot.mount(mascot, 140);
        yo.setActive(true);
        dressYo();
        if (settingsOpen) showSettings(false);
        loadTasks().then(() => useSeed(seed));
        draw();
        const waveLoop = () => {
          if (!visible) return;
          drawWave();
          requestAnimationFrame(waveLoop);
        };
        requestAnimationFrame(waveLoop);
      },
      escape() {
        if (!settingsOpen) return false;
        showSettings(false);
        return true;
      },
      close() {
        visible = false;
        if (yo) {
          yo.setActive(false);
          yo.reset();
        }
      },
    };
  }

  Y.miniapps.define('focus', mount);
})((window.Yo = window.Yo || {}));
