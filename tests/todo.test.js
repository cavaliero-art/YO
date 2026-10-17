'use strict';

// Tests for To-do (main/todo.js): reading tasks typed in plain words, saving them, and the due-time alerts.
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
const Todo = require('../main/todo');

// Wednesday 14 October 2026, 10:00
const NOW = new Date(2026, 9, 14, 10, 0);
const p = (text) => Todo.parse(text, NOW);

test('reads a task: text, date, time, subjects, important', () => {
  assert.deepStrictEqual(p('math homework friday 18:00 #math !'),
    { text: 'math homework', due: '2026-10-16', time: '18:00', tags: ['math'], star: true, exam: false });
  assert.deepStrictEqual(p('read chapter 3'), { text: 'read chapter 3', due: null, time: null, tags: [], star: false, exam: false });
  assert.strictEqual(p('call mom tomorrow').due, '2026-10-15');
  assert.strictEqual(p('gym today').due, '2026-10-14');
  assert.strictEqual(p('essay in 3 days').due, '2026-10-17');
  assert.strictEqual(p('project next week').due, '2026-10-21');
  assert.strictEqual(p('lab on wednesday').due, '2026-10-14'); // today counts
  assert.strictEqual(p('lab tue').due, '2026-10-20');
});

test('reads dates the European way, and times in every usual form', () => {
  assert.strictEqual(p('exam 12/11').due, '2026-11-12'); // day/month
  assert.strictEqual(p('trip 3/1').due, '2027-01-03'); // long gone this year: next year
  assert.strictEqual(p('forgot this 10/10').due, '2026-10-10'); // a few days ago: a late task
  assert.strictEqual(p('party 24 dec').due, '2026-12-24');
  assert.strictEqual(p('party dec 24').due, '2026-12-24');
  assert.strictEqual(p('report 2026-11-02').due, '2026-11-02');
  assert.strictEqual(p('report 02.11.2026').due, '2026-11-02');
  assert.strictEqual(p('bad date 31/02').due, null);
  assert.strictEqual(p('meet 18h').time, '18:00');
  assert.strictEqual(p('meet 18h30').time, '18:30');
  assert.strictEqual(p('meet 6pm').time, '18:00');
  assert.strictEqual(p('meet 6:30 pm').time, '18:30');
  assert.strictEqual(p('meet 12am').time, '00:00');
  // a time alone: today, or tomorrow once it has passed
  assert.strictEqual(p('call 15:00').due, '2026-10-14');
  assert.strictEqual(p('call 08:00').due, '2026-10-15');
  assert.deepStrictEqual([p('movie tonight').due, p('movie tonight').time], ['2026-10-14', '20:00']);
});

test('exams, and words around the date are tidied away', () => {
  assert.deepStrictEqual(p('exam physics 12/11 #physics'),
    { text: 'physics', due: '2026-11-12', time: null, tags: ['physics'], star: false, exam: true });
  assert.strictEqual(p('hand in essay by friday').text, 'hand in essay');
  assert.strictEqual(p('dentist at 15:00').text, 'dentist');
  assert.strictEqual(p('révision #français').tags[0], 'français');
  assert.strictEqual(p('   ').text, '');
});

test('when a task brings YO back: its time; an exam, the evening before', () => {
  assert.strictEqual(Todo.alertAt({ due: '2026-10-16', time: '18:00' }), new Date(2026, 9, 16, 18, 0).getTime());
  assert.strictEqual(Todo.alertAt({ due: '2026-10-16', time: null }), null);
  assert.strictEqual(Todo.alertAt({ due: '2026-11-12', exam: true }), new Date(2026, 10, 11, 18, 0).getTime());
  assert.strictEqual(Todo.alertAt({ due: '2026-10-16', time: '18:00', done: true }), null);
});

test('add, tick, star, remove; saved to tasks.json', () => {
  const todo = Todo.create(() => {});
  const first = todo.act('add', 'math homework friday #math');
  assert.ok(first.added);
  assert.strictEqual(todo.act('add', '   ').error, 'empty');
  todo.act('add', 'read chapter 3');
  todo.act('toggle', first.added);
  todo.act('star', first.added);
  let saved = JSON.parse(fs.readFileSync(path.join(electron.userData, 'tasks.json'), 'utf8'));
  const math = saved.find((x) => x.id === first.added);
  assert.strictEqual(math.done, true);
  assert.strictEqual(math.star, true);
  assert.ok(math.doneAt > 0);
  todo.act('clearDone');
  saved = JSON.parse(fs.readFileSync(path.join(electron.userData, 'tasks.json'), 'utf8'));
  assert.deepStrictEqual(saved.map((x) => x.text), ['read chapter 3']);
  assert.strictEqual(todo.act('remove', saved[0].id).tasks.length, 0);
  assert.strictEqual(todo.act('toggle', 'nope').error, 'missing');
  assert.strictEqual(todo.act('format c:').error, 'missing');
});

test('a due task brings YO back once, with its card; one missed while closed says so', () => {
  const events = [];
  const due = new Date(Date.now() - 10 * 60000); // 10 minutes ago
  const tasks = [
    { id: 'a', text: 'call mom', due: localDay(due), time: hhmm(due), tags: ['family'], star: false, exam: false, done: false, created: 1, notified: false },
    { id: 'b', text: 'later', due: '2099-01-01', time: '09:00', tags: [], star: false, exam: false, done: false, created: 2, notified: false },
  ];
  fs.writeFileSync(path.join(electron.userData, 'tasks.json'), JSON.stringify(tasks));
  const todo = Todo.create((e) => events.push(e));
  todo.check();
  todo.check();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].title, 'call mom');
  assert.strictEqual(events[0].todo, 'a');
  assert.strictEqual(events[0].background, true);
  assert.match(events[0].body, /Missed while YO was closed/);
  assert.match(events[0].body, /#family/);
  // a task added for a time that already passed doesn't fire
  todo.act('add', 'past thing 00:00 ' + localDay(new Date()).split('-').reverse().slice(0, 2).join('/'));
  todo.check();
  assert.strictEqual(events.length, 1);
});

function localDay(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hhmm(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
