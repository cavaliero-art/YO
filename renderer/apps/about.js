(function (Y) {
  'use strict';

  // About YO: the version and licence, your data (back up, restore, weekly backup, delete everything),
  // and what YO keeps and sends. Opened from the tray, or typed: "about", "backup", "privacy".
  // The files themselves are handled by the main process (main/backup.js); the page adds its own storage.
  const { h, button } = Y.miniapps;
  const SETTINGS = 'yo.backup'; // { auto: true }
  const AUTO_CHECK_MS = 6 * 3600000;

  // the page's part of your data: every "yo.*" entry
  function storage() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('yo.')) out[key] = localStorage.getItem(key);
      }
    } catch (err) { /* nothing readable */ }
    return out;
  }

  function replaceStorage(next) {
    try {
      Object.keys(storage()).forEach((key) => localStorage.removeItem(key));
      Object.keys(next || {}).forEach((key) => localStorage.setItem(key, next[key]));
    } catch (err) { /* the restart reads what was written */ }
  }

  function autoOn() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
      return s.auto !== false;
    } catch (err) {
      return true;
    }
  }

  // the weekly backup: checked a minute after YO starts, then every few hours (the main process
  // only writes one when the last is a week old)
  function start(host) {
    if (!host.bridge.backup) return;
    const run = () => { if (autoOn()) host.bridge.backup('auto', storage()).catch(() => {}); };
    setTimeout(run, 60000);
    setInterval(run, AUTO_CHECK_MS);
  }

  const dateText = (at) => new Date(at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

  function mount(host) {
    const { t, bridge } = host;
    let tab = 'about';
    let version = '';
    let pending = null; // a restore waiting for your yes
    let erasing = false;
    let status = { last: null };

    const tabs = h('div.ctabs.ab-tabs', { role: 'tablist' });
    const body = h('div.ab-body');
    const root = h('div.about', tabs, body);

    if (bridge.getInfo) bridge.getInfo().then((info) => { version = (info && info.version) || ''; if (tab === 'about') draw(); }).catch(() => {});

    function draw() {
      tabs.replaceChildren(...['about', 'data', 'privacy'].map((name) => button('ctab', t('about.tab.' + name), () => {
        tab = name;
        pending = null;
        erasing = false;
        draw();
        host.sound('tick');
      }, { role: 'tab', 'aria-selected': String(tab === name) })));
      body.replaceChildren(tab === 'data' ? drawData() : tab === 'privacy' ? drawPrivacy() : drawAbout());
    }

    function list(items) {
      return h('ul.ab-list', {}, ...items.map((text) => h('li', { text })));
    }

    function drawAbout() {
      return h('div.ab-page',
        h('div.ab-name', h('span.ab-yo', { text: 'YO' }), h('span.ab-ver', { text: version ? t('about.version').replace('{v}', version) : '' })),
        h('div.ab-text', { text: t('about.what') }),
        h('div.ab-block', h('span.olabel', { text: t('about.licenceTitle') }),
          h('div.ab-text', { text: t('about.licence') })),
        h('div.ab-block', h('span.olabel', { text: t('about.creditsTitle') }), list(t('about.credits'))));
    }

    function drawPrivacy() {
      return h('div.ab-page',
        h('div.ab-lead', { text: t('about.privacy.lead') }),
        h('div.ab-block', h('span.olabel', { text: t('about.privacy.staysTitle') }), list(t('about.privacy.stays'))),
        h('div.ab-block', h('span.olabel', { text: t('about.privacy.sentTitle') }), list(t('about.privacy.sent'))),
        h('div.ab-block', h('span.olabel', { text: t('about.privacy.readTitle') }), list(t('about.privacy.read'))),
        h('div.ab-text.ab-faint', { text: t('about.privacy.where') }));
    }

    // ---------- your data ----------
    function drawData() {
      if (!bridge.backup) return h('div.side-empty', { text: t('about.app') });
      if (pending) return drawConfirm();
      if (erasing) return drawErase();
      const auto = autoOn();
      const autoSwitch = button('fz-switch' + (auto ? '.on' : ''), '', () => {
        try { localStorage.setItem(SETTINGS, JSON.stringify({ auto: !auto })); } catch (err) { /* not kept */ }
        if (!auto) bridge.backup('auto', storage()).then(refreshStatus).catch(() => {});
        draw();
        host.sound('tick');
      }, { role: 'switch', 'aria-checked': String(auto), 'aria-label': t('about.data.auto') });
      return h('div.ab-page',
        h('div.ab-text', { text: t('about.data.lead') }),
        h('div.ab-actions',
          button('btn small ok', t('about.data.save'), save),
          button('btn small', t('about.data.restore'), pick)),
        h('div.fz-set', h('div', h('div', { text: t('about.data.auto') }),
          h('div.ab-faint.ab-small', { text: status.last ? t('about.data.last').replace('{d}', dateText(status.last)) : t('about.data.none') })), autoSwitch),
        h('div.ab-row', button('link', t('about.data.folder'), () => bridge.backup('folder').catch(() => {})),
          button('link ab-danger', t('about.data.erase'), () => { erasing = true; draw(); host.sound('info'); })));
    }

    function refreshStatus() {
      return bridge.backup('status').then((s) => {
        status = s || status;
        if (tab === 'data' && !pending && !erasing) draw();
      }).catch(() => {});
    }

    function save() {
      bridge.backup('save', storage()).then((res) => {
        if (!res || res.cancel) return;
        if (res.error) return host.toast(t('about.data.failed'));
        host.react('success');
        host.sound('success');
        host.toast(t('about.data.saved'));
      }).catch(() => host.toast(t('about.data.failed')));
    }

    function pick() {
      bridge.backup('pick').then((res) => {
        if (!res || res.cancel) return;
        if (res.error) {
          host.sound('info');
          host.react('dizzy');
          return host.toast(t('about.data.bad.' + res.error));
        }
        pending = res.summary;
        draw();
        host.sound('drawer');
      }).catch(() => host.toast(t('about.data.failed')));
    }

    // what's in the file, then yes or no
    function drawConfirm() {
      const s = pending;
      const parts = [];
      ['tasks', 'habits', 'notes', 'reminders'].forEach((k) => {
        if (s[k]) parts.push(s[k] === 1 ? t('about.data.one.' + k) : t('about.data.n.' + k).replace('{n}', s[k]));
      });
      if (s.look) parts.push(t('about.data.n.look'));
      return h('div.ab-card',
        h('div.ab-cardtitle', { text: t('about.data.from').replace('{d}', s.created ? dateText(s.created) : '?').replace('{v}', s.app || '?') }),
        h('div.ab-text', { text: parts.length ? parts.join(' · ') : t('about.data.empty') }),
        h('div.ab-text.ab-faint', { text: t('about.data.replace') }),
        h('div.ab-actions',
          button('btn small ok', t('about.data.restoreNow'), restore),
          button('btn small', t('about.cancel'), () => { pending = null; draw(); })));
    }

    function restore() {
      bridge.backup('restore', storage()).then((res) => {
        if (!res || res.error) return host.toast(t('about.data.failed'));
        replaceStorage(res.storage);
        host.react('success');
        host.toast(t('about.data.restarting'));
        setTimeout(() => bridge.restart(), 900);
      }).catch(() => host.toast(t('about.data.failed')));
    }

    function drawErase() {
      return h('div.ab-card.ab-warn',
        h('div.ab-cardtitle', { text: t('about.data.eraseTitle') }),
        h('div.ab-text', { text: t('about.data.eraseBody') }),
        h('div.ab-actions',
          button('btn small ab-dangerbtn', t('about.data.eraseNow'), erase),
          button('btn small', t('about.cancel'), () => { erasing = false; draw(); })));
    }

    function erase() {
      bridge.backup('erase').then((res) => {
        if (!res || !res.erased) return host.toast(t('about.data.failed'));
        replaceStorage({});
        host.react('cancel');
        host.toast(t('about.data.erased'));
        setTimeout(() => bridge.restart(), 900);
      }).catch(() => host.toast(t('about.data.failed')));
    }

    return {
      root,
      open(seed) {
        const s = String(seed || '').toLowerCase();
        tab = /backup|restore|data/.test(s) ? 'data' : /privacy/.test(s) ? 'privacy' : 'about';
        pending = null;
        erasing = false;
        draw();
        if (bridge.backup) refreshStatus();
      },
      escape() {
        if (pending || erasing) { pending = null; erasing = false; draw(); return true; }
        return false;
      },
    };
  }

  Y.miniapps.define('about', mount);
  Y.backupCoach = { start, storage };
})((window.Yo = window.Yo || {}));
