'use strict';

// Clipboard history: the text you copy, newest first.
// Kept in memory only (gone when YO quits); the ones you pin are saved in clips.json.
// Password managers mark what they copy as private; YO skips those, the way Windows' own history does.
const { clipboard } = require('electron');
const store = require('./store');

const POLL_MS = 1000; // Electron has no "clipboard changed" event; reading the text once a second is cheap
const MAX_ITEMS = 50;
const MAX_PINS = 20;
const MAX_TEXT = 20000;

let items = []; // { id, text, at, pinned }
let last = null;
let timer = null;
let paused = false;
let changed = () => {};

const newId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

function isPrivate() {
  try {
    if (clipboard.has('ExcludeClipboardContentFromMonitorProcessing')) return true;
    if (clipboard.has('CanIncludeInClipboardHistory')) {
      const flag = clipboard.readBuffer('CanIncludeInClipboardHistory');
      return flag.length >= 4 && flag.readUInt32LE(0) === 0;
    }
  } catch (err) { /* unknown format: treat as normal text */ }
  return false;
}

function savePins() {
  store.save('clips', items.filter((c) => c.pinned).map(({ text, at }) => ({ text, at })));
}

// newest first; copying something again moves it back to the top
function add(text) {
  const clean = text.slice(0, MAX_TEXT);
  const old = items.find((c) => c.text === clean);
  items = items.filter((c) => c !== old);
  items.unshift({ id: newId(), text: clean, at: Date.now(), pinned: Boolean(old && old.pinned) });
  let loose = 0;
  items = items.filter((c) => c.pinned || ++loose <= MAX_ITEMS);
  changed();
}

function tick() {
  if (paused) return;
  let text = '';
  try { text = clipboard.readText(); } catch (err) { return; }
  if (!text || text === last) return;
  last = text;
  if (!text.trim() || isPrivate()) return;
  add(text);
}

function start(onChange) {
  if (timer) return;
  changed = onChange || (() => {});
  const pins = store.load('clips', []);
  items = (Array.isArray(pins) ? pins : [])
    .filter((p) => p && typeof p.text === 'string' && p.text)
    .slice(0, MAX_PINS)
    .map((p) => ({ id: newId(), text: p.text.slice(0, MAX_TEXT), at: Number(p.at) || Date.now(), pinned: true }));
  // what was copied before YO started stays out of the history
  try { last = clipboard.readText(); } catch (err) { last = null; }
  timer = setInterval(tick, POLL_MS);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

const find = (id) => items.find((c) => c.id === id) || null;

// the page asks for one of these; anything else is ignored
function act(action, id) {
  const item = id ? find(id) : null;
  if (action === 'pause' || action === 'resume') {
    paused = action === 'pause';
    if (!paused) try { last = clipboard.readText(); } catch (err) { /* fine */ }
    return { paused };
  }
  if (action === 'clear') {
    items = items.filter((c) => c.pinned);
    changed();
    return true;
  }
  if (!item) return false;
  if (action === 'pin') {
    if (!item.pinned && items.filter((c) => c.pinned).length >= MAX_PINS) return false;
    item.pinned = !item.pinned;
    savePins();
    changed();
    return true;
  }
  if (action === 'remove') {
    items = items.filter((c) => c !== item);
    if (item.pinned) savePins();
    changed();
    return true;
  }
  if (action === 'copy') {
    clipboard.writeText(item.text);
    last = item.text;
    items = [item].concat(items.filter((c) => c !== item));
    item.at = Date.now();
    changed();
    return true;
  }
  return false;
}

const list = () => ({ paused, items: items.map((c) => Object.assign({}, c)) });

module.exports = { start, stop, list, act, tick, MAX_ITEMS };
