(function (Y) {
  'use strict';

  // Notes: a scratchpad that saves itself. A list on the left (pinned first, then newest), the note
  // on the right. The first line is its title. Kept on this PC, in YO's own storage.
  // Typed: "note call the dentist 0612345678" makes a note with that text.
  const { h, button } = Y.miniapps;
  const KEY = 'yo.notes';
  const MAX_NOTES = 200;
  const MAX_TEXT = 5000;
  const SAVE_MS = 400; // after the last key

  function load() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter((n) => n && typeof n.id === 'string' && typeof n.text === 'string') : [];
    } catch (err) {
      return [];
    }
  }

  const titleOf = (text) => (text.split('\n').find((line) => line.trim()) || '').trim();

  // "now", "14:05", "Tue", "12 Oct": short, like a phone's notes
  function when(at, t) {
    const d = new Date(at);
    const now = new Date();
    if (now - d < 60000) return t('notes.now');
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (now - d < 6 * 86400000) return d.toLocaleDateString('en', { weekday: 'short' });
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
  }

  function mount(host) {
    const { t } = host;
    let notes = load();
    let current = null; // id of the open note
    let saveTimer = null;
    let confirmDelete = false;

    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (err) { host.toast(t('notes.notSaved')); }
    };

    const search = h('input.nt-q', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('notes.search'), 'aria-label': t('notes.search') });
    const list = h('div.nt-list', { role: 'listbox', 'aria-label': t('cmd.notes') });
    const add = button('btn small ok nt-new', '+ ' + t('notes.new'), () => newNote(''));
    const editor = h('textarea.nt-text', { spellcheck: true, maxLength: MAX_TEXT, placeholder: t('notes.placeholder'), 'aria-label': t('notes.placeholder') });
    const status = h('span.nt-status');
    const pin = button('row-act nt-pin', '★', () => togglePin(), { title: t('notes.pin'), 'aria-label': t('notes.pin') });
    const del = button('link nt-del', t('notes.delete'), () => remove());
    const empty = h('div.nt-empty', h('div.nt-empty-title', { text: t('notes.emptyTitle') }), h('div', { text: t('notes.emptyBody') }));
    const page = h('div.nt-page', editor, h('div.nt-foot', status, pin, del));

    const root = h('div.notes',
      h('div.nt-side', h('div.nt-head', search, add), list),
      h('div.nt-main', page, empty));

    const find = (id) => notes.find((n) => n.id === id) || null;
    const ordered = () => notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);

    function drawList() {
      const q = search.value.trim().toLowerCase();
      const shown = ordered().filter((n) => !q || n.text.toLowerCase().includes(q));
      if (!notes.length) {
        list.replaceChildren(h('div.side-empty', { text: t('notes.none') }));
      } else if (!shown.length) {
        list.replaceChildren(h('div.side-empty', { text: t('notes.noMatch') }));
      } else {
        list.replaceChildren(...shown.map((n) => {
          const title = titleOf(n.text) || t('notes.untitled');
          const rest = n.text.slice(n.text.indexOf(title) + title.length).replace(/\s+/g, ' ').trim();
          const row = h('button.nt-item' + (n.id === current ? '.on' : '') + (n.pinned ? '.pinned' : ''),
            { type: 'button', role: 'option', 'aria-selected': String(n.id === current) },
            h('span.nt-title', { text: (n.pinned ? '★ ' : '') + title }),
            h('span.nt-line', h('span.nt-when', { text: when(n.at, t) }), h('span.nt-snip', { text: rest })));
          row.addEventListener('click', () => openNote(n.id));
          return row;
        }));
      }
    }

    function drawPage() {
      const n = find(current);
      page.hidden = !n;
      empty.hidden = Boolean(n);
      if (!n) return;
      if (editor.value !== n.text) editor.value = n.text;
      pin.classList.toggle('on', Boolean(n.pinned));
      pin.title = t(n.pinned ? 'notes.unpin' : 'notes.pin');
      pin.setAttribute('aria-label', pin.title);
      setDelete(false);
      status.textContent = t('notes.saved') + ' · ' + when(n.at, t);
    }

    function setDelete(on) {
      confirmDelete = on;
      del.textContent = t(on ? 'notes.sure' : 'notes.delete');
      del.classList.toggle('warn', on);
    }

    function openNote(id) {
      flush();
      current = id;
      drawList();
      drawPage();
      host.sound('tick');
      setTimeout(() => editor.focus(), 30);
    }

    function newNote(text) {
      flush();
      // an untouched empty note is reused, not stacked up
      const blank = notes.find((n) => !n.text.trim());
      if (blank && !text) {
        current = blank.id;
      } else {
        if (notes.length >= MAX_NOTES) {
          host.toast(t('notes.full'));
          return;
        }
        const n = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: String(text || '').slice(0, MAX_TEXT), pinned: false, at: Date.now() };
        notes.push(n);
        current = n.id;
        save();
      }
      search.value = '';
      drawList();
      drawPage();
      host.react('note');
      host.sound('set');
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }, 40);
    }

    // typing saves a moment after you stop; the list follows (new title, moves to the top)
    function flush() {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      commit();
    }

    function commit() {
      const n = find(current);
      if (!n || n.text === editor.value) return;
      n.text = editor.value;
      n.at = Date.now();
      save();
      drawList();
      status.textContent = t('notes.saved') + ' · ' + when(n.at, t);
    }

    function togglePin() {
      const n = find(current);
      if (!n) return;
      n.pinned = !n.pinned;
      save();
      drawList();
      drawPage();
      if (n.pinned) host.react('heart');
      host.sound('tick');
    }

    // delete asks once ("Delete?"), then it's gone
    function remove() {
      const n = find(current);
      if (!n) return;
      if (!confirmDelete && n.text.trim()) return setDelete(true);
      clearTimeout(saveTimer);
      saveTimer = null;
      notes = notes.filter((x) => x !== n);
      save();
      const next = ordered()[0];
      current = next ? next.id : null;
      drawList();
      drawPage();
      host.react('cancel');
      host.sound('close');
    }

    editor.addEventListener('input', () => {
      if (confirmDelete) setDelete(false);
      status.textContent = t('notes.saving');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { saveTimer = null; commit(); }, SAVE_MS);
      host.react('type');
    });
    editor.addEventListener('keydown', (event) => {
      if (event.key === 'n' && event.ctrlKey) { event.preventDefault(); newNote(''); }
    });
    search.addEventListener('input', drawList);
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = list.querySelector('.nt-item');
        if (first) first.click();
      }
    });

    return {
      root,
      open(seed) {
        notes = load();
        const text = String(seed || '').trim();
        if (text) return newNote(text);
        if (!find(current)) current = ordered()[0] ? ordered()[0].id : null;
        drawList();
        drawPage();
        setTimeout(() => (current ? editor : add).focus(), 60);
      },
      escape() {
        if (confirmDelete) { setDelete(false); return true; }
        if (search.value) { search.value = ''; drawList(); return true; }
        return false;
      },
      drop(text) {
        newNote(text);
        return true;
      },
      close() {
        flush();
      },
    };
  }

  Y.miniapps.define('notes', mount);
})((window.Yo = window.Yo || {}));
