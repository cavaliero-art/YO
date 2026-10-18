'use strict';

// Tests for backup and restore (main/backup.js): one file with everything, checked before it replaces
// anything, the weekly backup keeping the last 4, and "delete all my data". Electron is faked; all files
// live in a temp folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return path.join(__dirname, 'fake-electron.js');
  return resolve.call(this, request, ...rest);
};
const electron = require('electron');
const backup = require('../main/backup');

const data = (name) => path.join(electron.userData, name + '.json');
const put = (name, value) => fs.writeFileSync(data(name), JSON.stringify(value));
const tasks = [{ id: 't1', text: 'math homework' }, { id: 't2', text: 'read' }];

test('a backup has your files and the page storage, and leaves caches and strangers out', () => {
  put('tasks', tasks);
  put('reminders', [{ id: 'r1' }]);
  put('settings', { shortcut: 'Control+Space' });
  put('apps', [{ name: 'Spotify' }]); // a cache: not in the backup
  const b = backup.make({ 'yo.habits': '[{"id":"h1"}]', 'yo.prefs': '{}', 'other.key': 'x', 'yo.bad': 42 });
  assert.strictEqual(b.yo, 'backup');
  assert.strictEqual(b.app, '0.10.0');
  assert.deepStrictEqual(Object.keys(b.files).sort(), ['reminders', 'settings', 'tasks']);
  assert.deepStrictEqual(Object.keys(b.storage).sort(), ['yo.habits', 'yo.prefs']);
});

test('write, read back, and a summary of what is inside', () => {
  const file = path.join(electron.userData, 'out', 'my backup.yo');
  backup.write(file, { 'yo.habits': '[{"id":"h1"},{"id":"h2"}]', 'yo.notes': '[{"id":"n1"}]', 'yo.prefs': '{"look":{}}' });
  const res = backup.read(file);
  assert.ok(res.backup);
  const s = backup.summary(res.backup);
  assert.deepStrictEqual([s.tasks, s.reminders, s.habits, s.notes, s.look, s.app], [2, 1, 2, 1, true, '0.10.0']);
});

test('files that are not YO backups are refused, and nothing is touched', () => {
  const dir = path.join(electron.userData, 'odd');
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, text) => { fs.writeFileSync(path.join(dir, name), text); return path.join(dir, name); };
  assert.deepStrictEqual(backup.read(write('a.yo', 'hello')), { error: 'notYo' });
  assert.deepStrictEqual(backup.read(write('b.yo', '{"yo":"backup"}')), { error: 'notYo' });
  assert.deepStrictEqual(backup.read(write('c.yo', '{"yo":"backup","format":99,"files":{}}')), { error: 'newer' });
  assert.deepStrictEqual(backup.read(write('d.yo', '{"yo":"backup","format":1,"files":{"tasks":"oops"}}')), { error: 'notYo' });
  assert.deepStrictEqual(backup.read(path.join(dir, 'missing.yo')), { error: 'read' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(data('tasks'), 'utf8')), tasks);
});

test('restore puts the files back; a file the backup does not have is removed', () => {
  const b = backup.check({ yo: 'backup', format: 1, files: { tasks: [{ id: 'x', text: 'from backup' }], settings: { shortcut: 'Alt+Shift+Y' } }, storage: {} }).backup;
  backup.restoreFiles(b);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(data('tasks'), 'utf8')), [{ id: 'x', text: 'from backup' }]);
  assert.strictEqual(JSON.parse(fs.readFileSync(data('settings'), 'utf8')).shortcut, 'Alt+Shift+Y');
  assert.strictEqual(fs.existsSync(data('reminders')), false);
});

test('the weekly backup: one a week, the last 4 kept', () => {
  const dir = path.join(electron.userData, 'weekly');
  const day = (n) => new Date(2026, 9, 1 + n, 12);
  assert.ok(backup.auto({}, day(0), dir).saved);
  assert.ok(backup.auto({}, day(3), dir).skipped); // not a week yet
  const set = (file, d) => fs.utimesSync(path.join(dir, file), d, d); // the file's date is what counts
  set('YO auto backup 2026-10-01.yo', day(0));
  for (let week = 1; week <= 5; week += 1) {
    const res = backup.auto({}, day(week * 7), dir);
    assert.ok(res.saved, 'week ' + week);
    set(path.basename(res.saved), day(week * 7));
  }
  const left = fs.readdirSync(dir).filter((f) => f.endsWith('.yo')).sort();
  assert.deepStrictEqual(left, ['YO auto backup 2026-10-15.yo', 'YO auto backup 2026-10-22.yo', 'YO auto backup 2026-10-29.yo', 'YO auto backup 2026-11-05.yo']);
});

test('delete all my data removes your files, old ones included', () => {
  put('clips', []);
  put('apps', []);
  backup.eraseFiles();
  ['tasks', 'reminders', 'settings', 'apps', 'clips'].forEach((name) => assert.strictEqual(fs.existsSync(data(name)), false, name));
});
