'use strict';

// Backup and restore: everything that is yours, in one file ("YO backup 2026-10-18.yo").
//   files:   tasks, reminders and settings (the JSON files in %APPDATA%\YO)
//   storage: what the page keeps (habits, notes, Focus, prayer settings, looks...), every "yo.*" entry
// Caches YO rebuilds by itself (the installed apps) are left out. A file is checked before anything
// is replaced, and the current data is saved aside first, so a restore can be undone.
// The weekly backup goes to Documents\YO backups and keeps the last 4.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FILES = ['tasks', 'reminders', 'settings']; // yours; apps.json is a cache
const OLD_FILES = ['apps', 'clips']; // also removed by "delete all my data"
const FORMAT = 1;
const MAX_BYTES = 20 * 1024 * 1024;
const AUTO_PREFIX = 'YO auto backup ';
const AUTO_KEEP = 4;
const AUTO_EVERY_MS = 7 * 86400000;

const pad = (n) => String(n).padStart(2, '0');
const day = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dataFile = (name) => path.join(app.getPath('userData'), name + '.json');
const folder = () => path.join(app.getPath('documents'), 'YO backups');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return undefined;
  }
}

// the page's storage: only "yo.*" names with text values
function cleanStorage(storage) {
  const out = {};
  if (!storage || typeof storage !== 'object') return out;
  Object.keys(storage).forEach((key) => {
    if (/^yo\.[A-Za-z0-9._-]{1,60}$/.test(key) && typeof storage[key] === 'string') out[key] = storage[key];
  });
  return out;
}

// everything, as one object
function make(storage, now) {
  const files = {};
  FILES.forEach((name) => {
    const value = readJson(dataFile(name));
    if (value !== undefined) files[name] = value;
  });
  return { yo: 'backup', format: FORMAT, app: app.getVersion(), created: (now || new Date()).toISOString(), files, storage: cleanStorage(storage) };
}

function write(target, storage) {
  const data = make(storage);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = target + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 1));
  fs.renameSync(temp, target);
  return data;
}

// a file from disk -> a checked backup, or { error }
function read(file) {
  let text;
  try {
    if (fs.statSync(file).size > MAX_BYTES) return { error: 'big' };
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { error: 'read' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { error: 'notYo' };
  }
  return check(data);
}

function check(data) {
  if (!data || data.yo !== 'backup' || typeof data.files !== 'object' || data.files === null) return { error: 'notYo' };
  if (data.format > FORMAT) return { error: 'newer' };
  const files = {};
  FILES.forEach((name) => { if (data.files[name] !== undefined) files[name] = data.files[name]; });
  if (files.tasks !== undefined && !Array.isArray(files.tasks)) return { error: 'notYo' };
  if (files.reminders !== undefined && !Array.isArray(files.reminders)) return { error: 'notYo' };
  if (files.settings !== undefined && (typeof files.settings !== 'object' || Array.isArray(files.settings))) return { error: 'notYo' };
  return { backup: { created: String(data.created || ''), app: String(data.app || ''), files, storage: cleanStorage(data.storage) } };
}

// what's inside, to show before you say yes
function summary(backup) {
  const count = (key) => {
    try {
      const v = JSON.parse(backup.storage[key] || '[]');
      return Array.isArray(v) ? v.length : 0;
    } catch (err) {
      return 0;
    }
  };
  return {
    created: backup.created,
    app: backup.app,
    tasks: Array.isArray(backup.files.tasks) ? backup.files.tasks.length : 0,
    reminders: Array.isArray(backup.files.reminders) ? backup.files.reminders.length : 0,
    habits: count('yo.habits'),
    notes: count('yo.notes'),
    look: Boolean(backup.storage['yo.prefs']),
  };
}

// put a backup's files in place (the page writes its own storage); missing files are removed
function restoreFiles(backup) {
  FILES.forEach((name) => {
    const target = dataFile(name);
    if (backup.files[name] === undefined) {
      try { fs.unlinkSync(target); } catch (err) { /* wasn't there */ }
      return;
    }
    const temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(backup.files[name], null, 2));
    fs.renameSync(temp, target);
  });
}

// delete all my data: the files (the page clears its storage)
function eraseFiles() {
  FILES.concat(OLD_FILES).forEach((name) => {
    try { fs.unlinkSync(dataFile(name)); } catch (err) { /* wasn't there */ }
  });
}

// ---------- the weekly backup ----------
function autoList(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.startsWith(AUTO_PREFIX) && f.endsWith('.yo')).sort();
  } catch (err) {
    return [];
  }
}

function lastAuto(dir) {
  const list = autoList(dir || folder());
  if (!list.length) return null;
  try {
    return fs.statSync(path.join(dir || folder(), list[list.length - 1])).mtimeMs;
  } catch (err) {
    return null;
  }
}

// a backup if the last one is a week old (or there is none); the oldest beyond 4 are removed
function auto(storage, now, dir) {
  const at = now || new Date();
  const where = dir || folder();
  const last = lastAuto(where);
  if (last && at.getTime() - last < AUTO_EVERY_MS) return { skipped: true, last };
  const target = path.join(where, AUTO_PREFIX + day(at) + '.yo');
  write(target, storage);
  const list = autoList(where);
  list.slice(0, Math.max(0, list.length - AUTO_KEEP)).forEach((f) => {
    try { fs.unlinkSync(path.join(where, f)); } catch (err) { /* left there */ }
  });
  return { saved: target, last: at.getTime() };
}

module.exports = { FILES, make, write, read, check, summary, restoreFiles, eraseFiles, auto, lastAuto, folder, day, cleanStorage };
