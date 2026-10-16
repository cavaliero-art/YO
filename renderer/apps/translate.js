(function (Y) {
  'use strict';

  // Translate: two boxes, the language picked from chips, the answer as you type.
  // The translating happens in the main process (main/translate.js), which needs the internet.
  // Typed: "tr hola to english", "translate bonjour", "tr good morning in ar".
  const { h, button } = Y.miniapps;
  const KEY = 'yo.translate';
  const WAIT_MS = 450; // after the last key, then translate
  const MAX_RECENT = 4;
  const LANGS = [
    ['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['ar', 'Arabic'], ['de', 'German'], ['it', 'Italian'],
    ['pt', 'Portuguese'], ['nl', 'Dutch'], ['tr', 'Turkish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['pl', 'Polish'],
    ['sv', 'Swedish'], ['zh-CN', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['hi', 'Hindi'],
  ];
  const nameOf = (code) => (LANGS.find(([c]) => c.toLowerCase() === String(code || '').toLowerCase()) || [null, code])[1];

  // "english", "en", "Arabic" -> its code
  function codeFor(word) {
    const w = String(word || '').trim().toLowerCase();
    const found = LANGS.find(([code, name]) => code.toLowerCase() === w || name.toLowerCase() === w) ||
      (w === 'chinese' || w === 'zh' ? ['zh-CN'] : null);
    return found ? found[0] : null;
  }

  // what was typed after "translate": the text, and maybe "to <language>"
  function parse(seed) {
    const m = /^(.*\S)\s+(?:to|in|into)\s+([a-z-]+)\s*$/i.exec(String(seed || '').trim());
    const to = m ? codeFor(m[2]) : null;
    return to ? { text: m[1], to } : { text: String(seed || '').trim(), to: null };
  }

  function load() {
    const base = { from: 'auto', to: 'en', recent: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (saved.from === 'auto' || codeFor(saved.from)) base.from = saved.from;
      if (codeFor(saved.to)) base.to = saved.to;
      if (Array.isArray(saved.recent)) base.recent = saved.recent.filter((r) => r && typeof r.src === 'string' && typeof r.out === 'string').slice(0, MAX_RECENT);
    } catch (err) { /* defaults */ }
    return base;
  }

  function mount(host) {
    const { t } = host;
    const state = load();
    let ask = 0;
    let timer = null;
    let result = '';
    let detected = null;
    let picking = null; // 'from' or 'to' while the language chips are open

    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { /* not kept */ }
    };

    const fromBtn = button('tr-lang', '', () => pick('from'));
    const toBtn = button('tr-lang', '', () => pick('to'));
    const swap = button('icon tr-swap', '⇄', swapLangs, { title: t('app.translate.swap'), 'aria-label': t('app.translate.swap') });
    const src = h('textarea.tr-src', { spellcheck: false, placeholder: t('app.translate.placeholder'), maxLength: 2000, 'aria-label': t('app.translate.from') });
    const out = h('div.tr-text', { 'aria-live': 'polite' });
    const copy = button('btn small ok tr-copy', t('copy'), () => {
      if (!result) return;
      host.copy(result);
      remember();
    });
    const status = h('span.tr-status');
    const recent = h('div.tr-recent');
    const chips = h('div.tr-chips', { role: 'listbox' });
    const picker = h('div.tr-pick', { hidden: true }, h('div.tr-pick-head', h('span.olabel.tr-pick-title'), button('link', t('close'), () => pick(null))), chips);

    const root = h('div.translate',
      h('div.tr-bar', fromBtn, swap, toBtn),
      h('div.tr-panes', src, h('div.tr-out', out, h('div.tr-out-actions', copy))),
      h('div.tr-foot', status, h('span.tr-note', { text: t('app.translate.note') })),
      recent,
      picker);

    function drawLangs() {
      fromBtn.textContent = (state.from === 'auto' ? (detected ? nameOf(detected) + ' ✓' : t('app.translate.detect')) : nameOf(state.from)) + ' ▾';
      toBtn.textContent = nameOf(state.to) + ' ▾';
      fromBtn.title = t('app.translate.from');
      toBtn.title = t('app.translate.to');
    }

    // the language chips: tap one; From also has "Detect"
    function pick(which) {
      picking = which;
      picker.hidden = !which;
      root.classList.toggle('picking', Boolean(which));
      if (!which) return src.focus();
      picker.querySelector('.tr-pick-title').textContent = t('app.translate.' + which);
      const options = (which === 'from' ? [['auto', t('app.translate.detect')]] : []).concat(LANGS);
      chips.replaceChildren(...options.map(([code, name]) => button('opt', name, () => {
        state[which] = code;
        if (state.from === state.to && which === 'to') state.from = 'auto';
        if (state.from === state.to && which === 'from') state.to = code === 'en' ? 'fr' : 'en';
        save();
        drawLangs();
        pick(null);
        host.sound('tick');
        go();
      }, { 'aria-pressed': String(state[which] === code), role: 'option' })));
      host.sound('drawer');
    }

    function swapLangs() {
      const from = state.from === 'auto' ? detected : state.from;
      if (!from || !codeFor(from)) return host.sound('info');
      state.from = state.to;
      state.to = codeFor(from);
      if (result) src.value = result;
      save();
      drawLangs();
      host.react('flip');
      host.sound('tick');
      go();
    }

    function show(text, line, tone) {
      result = text;
      out.textContent = text;
      root.classList.toggle('has-result', Boolean(text));
      status.textContent = line || '';
      status.dataset.tone = tone || '';
    }

    async function go() {
      clearTimeout(timer);
      const text = src.value.trim();
      const id = ++ask;
      if (!text) {
        detected = null;
        drawLangs();
        return show('', '');
      }
      if (!host.bridge.translate) return show('', t('app.translate.error.app'), 'error');
      root.classList.add('busy');
      status.textContent = t('app.translate.working');
      status.dataset.tone = '';
      let res;
      try {
        res = await host.bridge.translate({ text, from: state.from, to: state.to });
      } catch (err) {
        res = { error: 'net' };
      }
      if (id !== ask) return; // you kept typing; a newer one is on its way
      root.classList.remove('busy');
      if (!res || res.error) return show('', t('app.translate.error.' + ((res && res.error) || 'service')), 'error');
      detected = state.from === 'auto' && res.detected ? res.detected : null;
      drawLangs();
      show(res.text, res.cut ? t('app.translate.cut') : '', '');
    }

    function remember() {
      const text = src.value.trim();
      if (!text || !result) return;
      state.recent = [{ src: text.slice(0, 120), out: result.slice(0, 120), to: state.to }]
        .concat(state.recent.filter((r) => r.src !== text.slice(0, 120)))
        .slice(0, MAX_RECENT);
      save();
      drawRecent();
    }

    function drawRecent() {
      if (!state.recent.length) return recent.replaceChildren();
      recent.replaceChildren(h('span.olabel', { text: t('app.translate.recent') }), ...state.recent.map((r) => button('act tr-again', r.src + ' → ' + r.out, () => {
        src.value = r.src;
        if (codeFor(r.to)) state.to = r.to;
        drawLangs();
        go();
      }, { title: r.src + ' → ' + r.out })));
    }

    src.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(go, WAIT_MS);
      host.react('type');
    });
    src.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.ctrlKey && result) {
        event.preventDefault(); // Ctrl+Enter copies the translation
        host.copy(result);
        remember();
      }
    });

    drawLangs();
    drawRecent();

    return {
      root,
      open(seed) {
        pick(null);
        const typed = parse(seed);
        if (typed.to) {
          state.to = typed.to;
          if (state.from === state.to) state.from = 'auto';
          save();
          drawLangs();
        }
        const focus = () => setTimeout(() => src.focus(), 60);
        if (typed.text) {
          src.value = typed.text;
          go();
          return focus();
        }
        focus();
        // nothing typed: what you just copied is probably what you want translated
        if (src.value.trim()) return;
        host.recentCopy(90000).then((text) => {
          if (!text || src.value.trim() || /^https?:\/\//i.test(text.trim()) || !/\p{L}/u.test(text)) return;
          src.value = text.slice(0, 2000);
          go().then(() => { if (!status.textContent && result) status.textContent = t('app.translate.fromClip'); });
        });
      },
      escape() {
        if (!picking) return false;
        pick(null);
        return true;
      },
      drop(text) {
        src.value = text.slice(0, 2000);
        go();
        return true;
      },
      close() {
        remember();
      },
    };
  }

  Y.miniapps.define('translate', mount);
  Y.miniapps.parseTranslate = parse; // for tests
})((window.Yo = window.Yo || {}));
