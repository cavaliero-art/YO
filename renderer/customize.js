(function (Y) {
  'use strict';

  // Customize: right-click YO. Tabs for the body, the outfit, the pill and the sound, then saved looks
  // and look codes. app.js owns the island; this panel only asks it to save, apply and redraw.

  // each row: [label key, pref group, values]; swatches for colors, chips for the rest
  // tabs keep the panel short: each one has its rows
  const CUSTOM_TABS = {
    body: [['custom.color', 'color'], ['custom.eyes', 'eyes', 'eyeColor'], ['custom.tip', 'tip'], ['custom.sticker', 'sticker']],
    outfit: [['custom.hat', 'hat'], ['custom.neck', 'neck'], ['custom.glasses', 'glasses'], ['custom.item', 'item'], ['custom.seasonal', 'seasonal']],
    pill: [['custom.pillStyle', 'pillStyle'], ['custom.position', 'position'], ['custom.size', 'size']],
    sound: [['custom.voice', 'voice'], ['custom.volume', 'volume']],
    saved: [],
  };
  const SWATCHES = { color: true, eyeColor: true };

  // ---------- look codes: each choice is a digit in a mixed-radix number, written in base 36 ----------
  const CODE_KEYS = ['color', 'eyeColor', 'eyes', 'hat', 'glasses', 'item', 'neck', 'tip', 'sticker'];

  const lookOf = (look) => {
    const out = {};
    CODE_KEYS.forEach((key) => { out[key] = look[key]; });
    return out;
  };

  function encodeLook(look) {
    let n = 0;
    CODE_KEYS.forEach((key) => {
      const list = Y.mascot.LOOKS[key];
      n = n * list.length + Math.max(0, list.indexOf(look[key]));
    });
    return 'YO-' + n.toString(36).toUpperCase();
  }

  function decodeLook(code) {
    const m = /^\s*YO-([0-9A-Z]{1,8})\s*$/i.exec(code || '');
    if (!m) return null;
    let n = parseInt(m[1], 36);
    const max = CODE_KEYS.reduce((acc, key) => acc * Y.mascot.LOOKS[key].length, 1);
    if (!Number.isFinite(n) || n < 0 || n >= max) return null;
    const look = {};
    CODE_KEYS.slice().reverse().forEach((key) => {
      const list = Y.mascot.LOOKS[key];
      look[key] = list[n % list.length];
      n = Math.floor(n / list.length);
    });
    return look;
  }

  // app: { t, el, prefs, PILL, DEFAULT_PREFS, savePrefs, applyPrefs, render, reportHit, showIsland, maybeHide, beforeOpen }
  function create(app) {
    const { t, el, prefs, PILL } = app;
    let open = false;
    let hint = ''; // shown in the panel title for a moment (how to unlock something)
    let preview = null; // the big YO in the panel
    let customTab = 'body';
    let savedFaces = [];

    function optionsFor(group) {
      if (group === 'seasonal') return [true, false];
      if (group === 'voice') return Y.sound.VOICES.concat('off');
      if (group === 'volume') return [1, 2, 3];
      if (PILL[group]) return PILL[group];
      return Y.mascot.LOOKS[group];
    }

    function optionLabel(group, value) {
      if (group === 'seasonal') return t(value ? 'seasonOn' : 'seasonOff');
      if (group === 'voice') return t('voice.' + value);
      if (group === 'volume') return t('volume.' + value);
      if (PILL[group]) return t('pill.' + group + '.' + value);
      return t('look.' + group + '.' + value);
    }

    function lockHint(group, value) {
      const p = Y.unlocks.progress(group, value);
      return p ? t('lock.' + p.stat).replace(/\{need\}/g, p.need).replace('{have}', p.have) : '';
    }

    function isPicked(group, value) {
      if (group === 'seasonal') return prefs.seasonal === value;
      if (group === 'voice') return value === 'off' ? !prefs.sound : prefs.sound && prefs.voice === value;
      if (group === 'volume') return prefs.volume === value;
      if (PILL[group]) return prefs.pill[group] === value;
      return prefs.look[group] === value;
    }

    function draw() {
      const tabs = document.createElement('div');
      tabs.className = 'ctabs';
      tabs.setAttribute('role', 'tablist');
      Object.keys(CUSTOM_TABS).forEach((tab) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ctab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(tab === customTab));
        button.textContent = t('tab.' + tab);
        button.addEventListener('click', () => {
          if (tab === customTab) return;
          customTab = tab;
          draw();
          Y.sound.play('tick');
        });
        tabs.append(button);
      });
      stopSavedFaces();
      if (customTab === 'saved') {
        el.cOpts.replaceChildren(tabs, savedView());
        return;
      }
      const rows = CUSTOM_TABS[customTab].map(([labelKey, ...groups]) => {
        const row = document.createElement('div');
        const name = document.createElement('span');
        const opts = document.createElement('div');
        row.className = 'orow';
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
      el.cOpts.replaceChildren(tabs, ...rows);
      sync();
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

    function sync() {
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
        preview.react('info');
        Y.sound.play('info');
        flashHint('🔒 ' + lockHint(group, value), 2800);
        return;
      }
      if (group === 'seasonal') prefs.seasonal = value;
      else if (group === 'voice') {
        prefs.sound = value !== 'off';
        if (value !== 'off') prefs.voice = value;
      } else if (group === 'volume') prefs.volume = value;
      else if (PILL[group]) prefs.pill[group] = value;
      else prefs.look[group] = value;
      // the Sidi Bou Said pill dresses YO in its white and blue too, unless you picked a color yourself
      if (group === 'pillStyle' && value === 'sidi' && prefs.look.color === 'mint') prefs.look.color = 'sidi';
      app.savePrefs();
      app.applyPrefs();
      sync();
      // a little show: YO reacts, and the sound settings play a sample
      if (group === 'voice' || group === 'volume') {
        preview.react('success');
        Y.sound.play('hello');
      } else if (PILL[group]) {
        Y.sound.play('tick');
        app.reportHit();
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
        neck: Math.random() < 0.5 ? pick(L.neck) : 'none',
        tip: Math.random() < 0.5 ? pick(L.tip) : 'ball',
        sticker: Math.random() < 0.4 ? pick(L.sticker) : 'none',
      };
      app.savePrefs();
      app.applyPrefs();
      sync();
      preview.react('equip');
      Y.sound.play('equip');
    }

    function reset() {
      Object.assign(prefs, JSON.parse(JSON.stringify(app.DEFAULT_PREFS)));
      app.savePrefs();
      app.applyPrefs();
      sync();
      preview.react('land');
      Y.sound.play('arrive');
    }

    function openPanel() {
      if (open) return;
      app.beforeOpen();
      open = true;
      if (!preview) preview = Y.mascot.mount(el.preview, 150);
      draw();
      app.applyPrefs();
      preview.setActive(true);
      app.render();
      app.showIsland(true);
      Y.sound.play('drawer');
      setTimeout(() => { if (open) preview.react('land'); }, 120);
    }

    // put the panel away without a sound: something else is taking over the island
    function dismiss() {
      if (!open) return;
      open = false;
      stopSavedFaces();
      preview.setActive(false);
      preview.reset();
    }

    function close() {
      if (!open) return;
      dismiss();
      app.render();
      Y.sound.play('close');
      app.maybeHide();
    }

    // ---------- saved looks and look codes ----------
    function stopSavedFaces() {
      savedFaces.forEach((f) => f.setActive(false));
      savedFaces = [];
    }

    // wear a look; anything still locked falls back to the default
    function wear(look, message) {
      let locked = false;
      CODE_KEYS.forEach((key) => {
        if (look[key] === undefined) return;
        if (Y.unlocks.isUnlocked(key, look[key])) prefs.look[key] = look[key];
        else { locked = true; prefs.look[key] = Y.mascot.DEFAULT_LOOK[key]; }
      });
      app.savePrefs();
      app.applyPrefs();
      preview.react('equip');
      Y.sound.play('equip');
      flashHint(locked ? t('saved.locked') : message);
    }

    function flashHint(text, ms) {
      hint = text;
      app.render();
      clearTimeout(flashHint.timer);
      flashHint.timer = setTimeout(() => { hint = ''; app.render(); }, ms || 2600);
    }

    function savedView() {
      const wrap = document.createElement('div');
      wrap.className = 'saved';
      const slots = document.createElement('div');
      slots.className = 'slots';
      prefs.saved.forEach((look, i) => {
        const slot = document.createElement('div');
        const mini = document.createElement('div');
        const buttons = document.createElement('div');
        slot.className = 'slot' + (look ? '' : ' empty');
        mini.className = 'mini-yo';
        buttons.className = 'slot-actions';
        if (look) {
          const f = Y.mascot.mount(mini, 62);
          f.setLook(look);
          f.setActive(true);
          savedFaces.push(f);
          buttons.append(
            smallButton(t('saved.wear'), true, () => wear(look, t('saved.wearing'))),
            smallButton(t('saved.replace'), false, () => saveSlot(i))
          );
        } else {
          mini.textContent = t('saved.empty');
          buttons.append(smallButton(t('saved.save'), true, () => saveSlot(i)));
        }
        slot.append(mini, buttons);
        slots.append(slot);
      });

      // share: your look as a code, and a box to use someone else's
      const share = document.createElement('div');
      share.className = 'share';
      const code = encodeLook(prefs.look);
      const mine = document.createElement('span');
      mine.className = 'code';
      mine.textContent = code;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'code-in';
      input.placeholder = t('saved.paste');
      input.spellcheck = false;
      input.maxLength = 16;
      const useCode = () => {
        const look = decodeLook(input.value);
        if (!look) { flashHint(t('saved.bad')); Y.sound.play('info'); return; }
        input.value = '';
        wear(look, t('saved.applied'));
        draw();
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); useCode(); }
        event.stopPropagation(); // typing here is not the command bar
      });
      share.append(
        label(t('saved.code')), mine,
        smallButton(t('copy'), false, () => {
          if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
          flashHint(t('copied').replace('{v}', code));
          Y.sound.play('tick');
        }),
        input, smallButton(t('saved.apply'), false, useCode)
      );
      wrap.append(slots, share);
      return wrap;
    }

    function saveSlot(i) {
      prefs.saved[i] = lookOf(prefs.look);
      app.savePrefs();
      Y.sound.play('equip');
      flashHint(t('saved.done'));
      draw();
    }

    function smallButton(text, primary, run) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn small' + (primary ? ' ok' : '');
      button.textContent = text;
      button.addEventListener('click', run);
      return button;
    }

    function label(text) {
      const span = document.createElement('span');
      span.className = 'olabel';
      span.textContent = text;
      return span;
    }

    return {
      isOpen: () => open,
      hint: () => hint,
      preview: () => preview,
      open: openPanel,
      close,
      dismiss,
      redraw: draw,
      sync,
      surprise,
      reset,
      optionLabel,
      lockHint,
    };
  }

  Y.customize = { create, encodeLook, decodeLook };
})((window.Yo = window.Yo || {}));
