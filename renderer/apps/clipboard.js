(function (Y) {
  'use strict';

  // Clipboard: everything you copied (text), searchable. Enter pastes it into the window you were in.
  // The history itself lives in the main process (main/clipboard.js); this page only shows it.
  const { h, button, ago } = Y.miniapps;
  const SHOW = 50;
  const PREVIEW = 160;

  function kindOf(text) {
    const s = text.trim();
    if (/^https?:\/\/\S+$/i.test(s)) return 'link';
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || /^rgba?\([\d\s.,%]+\)$/i.test(s)) return 'color';
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return 'email';
    if (/^[-+]?[\d\s.,]+$/.test(s) && /\d/.test(s)) return 'number';
    if (s.includes('\n') && /[{};]\s*$|^\s*(const|let|var|function|import|export|def|class|return|if|for)\b|^\s*<\w+/m.test(s)) return 'code';
    return 'text';
  }

  const BADGE = { link: '↗', email: '@', number: '#', code: '</>', text: 'T' };

  function mount(host) {
    const { t } = host;
    let items = [];
    let paused = false;
    let shown = [];
    let pick = 0;
    let open = false;

    const q = h('input.clip-q', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('app.clipboard.search'), 'aria-label': t('app.clipboard.search') });
    const pauseBtn = button('btn small', '', () => act(paused ? 'resume' : 'pause'));
    const clearBtn = button('btn small', t('app.clipboard.clear'), () => act('clear'));
    const list = h('div.clip-list', { role: 'listbox', 'aria-label': t('cmd.clipboard') });
    const foot = h('div.clip-foot');

    const root = h('div.clipapp', h('div.clip-head', q, pauseBtn, clearBtn), list, foot);

    function refresh() {
      if (!host.bridge.clips) {
        list.replaceChildren(h('div.side-empty', { text: t('app.clipboard.app') }));
        return Promise.resolve();
      }
      return host.bridge.clips().then((data) => {
        if (!data) return;
        items = data.items || [];
        paused = Boolean(data.paused);
        draw();
      });
    }

    function draw() {
      const needle = q.value.trim().toLowerCase();
      shown = items.filter((c) => !needle || c.text.toLowerCase().includes(needle)).slice(0, SHOW);
      pick = Math.min(pick, Math.max(0, shown.length - 1));
      pauseBtn.textContent = t(paused ? 'app.clipboard.resume' : 'app.clipboard.pause');
      pauseBtn.classList.toggle('ok', paused);
      clearBtn.hidden = !items.some((c) => !c.pinned);
      foot.textContent = paused ? t('app.clipboard.paused') : shown.length ? t('app.clipboard.hint') : t('app.clipboard.privacy');
      foot.dataset.tone = paused ? 'warn' : '';
      if (!shown.length) {
        list.replaceChildren(h('div.side-empty', { text: needle ? t('app.clipboard.none') : t('app.clipboard.empty') }));
        return;
      }
      const now = Date.now();
      list.replaceChildren(...shown.map((c, i) => {
        const kind = kindOf(c.text);
        const flat = c.text.replace(/\s+/g, ' ').trim();
        const ico = h('span.clip-ico', { title: t('app.clipboard.kind.' + kind) });
        if (kind === 'color') ico.style.background = c.text.trim();
        else ico.textContent = BADGE[kind];
        const row = h('div.clip-row', { role: 'option', 'aria-selected': String(i === pick) },
          ico,
          h('span.clip-txt', { text: flat.length > PREVIEW ? flat.slice(0, PREVIEW - 1) + '…' : flat }),
          h('span.clip-meta', { text: ago(c.at, now) }),
          button('clip-act pin' + (c.pinned ? ' on' : ''), '★', (event) => { event.stopPropagation(); act('pin', c.id); },
            { title: t(c.pinned ? 'app.clipboard.unpin' : 'app.clipboard.pin'), 'aria-label': t(c.pinned ? 'app.clipboard.unpin' : 'app.clipboard.pin') }),
          button('clip-act', '×', (event) => { event.stopPropagation(); act('remove', c.id); },
            { title: t('app.clipboard.remove'), 'aria-label': t('app.clipboard.remove') }));
        row.dataset.kind = kind;
        if (c.pinned) row.classList.add('pinned');
        row.addEventListener('mousedown', (event) => event.preventDefault());
        row.addEventListener('mousemove', () => { if (pick !== i) setPick(i); });
        row.addEventListener('click', () => paste(c));
        return row;
      }));
    }

    function setPick(i) {
      pick = i;
      Array.from(list.children).forEach((row, n) => row.setAttribute('aria-selected', String(n === pick)));
      const row = list.children[pick];
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }

    function act(action, id) {
      if (!host.bridge.clip) return;
      host.bridge.clip(action, id).then((ok) => {
        if (action === 'pin' && ok === false) host.toast(t('app.clipboard.full'));
        host.sound(action === 'remove' || action === 'clear' ? 'cancel' : 'tick');
        refresh();
      });
    }

    // paste: put it on the clipboard, YO steps aside, Ctrl+V lands in the window you were in
    function paste(c) {
      if (!host.bridge.clip) return;
      host.bridge.clip('copy', c.id).then((ok) => { if (ok) host.pasteBack(); });
    }

    function copyOnly(c) {
      host.bridge.clip('copy', c.id).then((ok) => { if (ok) host.toast(t('app.copied')); host.sound('success'); });
    }

    q.addEventListener('input', () => { pick = 0; draw(); });
    q.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!shown.length) return;
        setPick((pick + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
        host.sound('tick');
      } else if (event.key === 'Enter' && shown[pick]) {
        event.preventDefault();
        if (event.ctrlKey) copyOnly(shown[pick]);
        else paste(shown[pick]);
      }
    });
    if (host.bridge.onClips) host.bridge.onClips(() => { if (open) refresh(); });

    return {
      root,
      open(seed) {
        open = true;
        q.value = seed || '';
        pick = 0;
        refresh();
        setTimeout(() => q.focus(), 60);
      },
      escape() {
        if (!q.value) return false;
        q.value = '';
        draw();
        return true;
      },
      close() {
        open = false;
      },
    };
  }

  Y.miniapps.define('clipboard', mount);
  Y.miniapps.clipKind = kindOf; // for tests
})((window.Yo = window.Yo || {}));
