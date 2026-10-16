(function (Y) {
  'use strict';

  // What YO remembers about how you use it, on this PC only (window storage):
  //   history  the last things you ran (↑ in an empty bar brings them back)
  //   usage    how often each action runs (the ones you use most come first)
  //   pins     commands you pinned in the Recent row
  //   inbox    reminders, timers and unlocks, with what you haven't seen yet
  const MAX_HISTORY = 30;
  const MAX_INBOX = 30;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* just not remembered */ }
  }

  const list = (key) => (Array.isArray(read(key, [])) ? read(key, []) : []);

  const history = {
    // newest first, no duplicates
    add(text, id) {
      const clean = String(text || '').trim().slice(0, 200);
      if (!clean) return;
      const items = list('yo.history').filter((h) => h && h.text !== clean);
      items.unshift({ text: clean, id: id || null });
      write('yo.history', items.slice(0, MAX_HISTORY));
    },
    list: () => list('yo.history').filter((h) => h && typeof h.text === 'string'),
  };

  const usage = {
    bump(id) {
      if (!id) return;
      const counts = read('yo.usage', {});
      counts[id] = (Number(counts[id]) || 0) + 1;
      write('yo.usage', counts);
    },
    count: (id) => Number(read('yo.usage', {})[id]) || 0,
  };

  const pins = {
    list: () => list('yo.pins').filter((p) => p && typeof p.text === 'string'),
    has: (text) => pins.list().some((p) => p.text === text),
    toggle(entry) {
      const items = pins.list();
      const next = items.some((p) => p.text === entry.text) ? items.filter((p) => p.text !== entry.text) : [entry].concat(items).slice(0, 6);
      write('yo.pins', next);
      return next.some((p) => p.text === entry.text);
    },
  };

  const inbox = {
    add(entry) {
      const items = inbox.list();
      const id = 'n' + Date.now() + Math.floor(Math.random() * 1000);
      items.unshift({ id, title: String(entry.title || '').slice(0, 120), kind: entry.kind || 'note', at: Date.now(), read: false });
      write('yo.inbox', items.slice(0, MAX_INBOX));
      return id;
    },
    list: () => list('yo.inbox').filter((n) => n && typeof n.title === 'string'),
    unread: () => inbox.list().filter((n) => !n.read).length,
    markRead(id) {
      write('yo.inbox', inbox.list().map((n) => (!id || n.id === id ? Object.assign({}, n, { read: true }) : n)));
    },
    clear: () => write('yo.inbox', []),
  };

  Y.memory = { history, usage, pins, inbox };
})((window.Yo = window.Yo || {}));
