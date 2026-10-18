'use strict';

// Tests for Habits (renderer/apps/habits.js): reading a habit from one sentence, the packs,
// and the days: the chain, runs and "never miss twice". Run in a sandbox, no page needed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { Yo: {} };
const ctx = { window, document: {}, Node: function Node() {}, localStorage: { getItem: () => null, setItem() {} }, JSON, Math, Date, setTimeout, setInterval };
['i18n.js', 'miniapps.js', 'apps/habits.js'].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', file), 'utf8'), ctx);
});
const H = window.Yo.miniapps.habitsCore;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('one sentence: when, what, the tiny version, who you become', () => {
  assert.deepStrictEqual(plain(H.parse("After Fajr I will read 2 pages because I'm a reader")),
    { name: 'Read', cue: { type: 'prayer', prayer: 'fajr', when: 'after' }, tiny: '2 pages', identity: 'a reader' });
  assert.deepStrictEqual(plain(H.parse('at 17:00 I will walk 10 min')),
    { name: 'Walk', cue: { type: 'time', at: '17:00' }, tiny: '10 min', identity: '' });
  assert.deepStrictEqual(plain(H.parse('At 6pm I will stretch')).cue, { type: 'time', at: '18:00' });
  assert.deepStrictEqual(plain(H.parse('before maghreb I will make dua 2 min')).cue, { type: 'prayer', prayer: 'maghrib', when: 'before' });
  assert.strictEqual(H.parse('After Fajr I will read 1 page of Quran').name, 'Read Quran');
  assert.strictEqual(H.parse('After Dhuhr I will drink 1 glass of water').name, 'Drink water');
  assert.deepStrictEqual([H.parse('at 7am I will do 10 pushups').name, H.parse('at 7am I will do 10 pushups').tiny], ['Do pushups', '10 pushups']);
  assert.strictEqual(H.parse('I will make 2 min of dua').name, 'Make dua');
});

test('everyday moments as cues, and habits with no cue at all', () => {
  const coffee = plain(H.parse('With my morning coffee I will drink 1 glass of water'));
  assert.deepStrictEqual(coffee.cue, { type: 'moment', text: 'With my morning coffee' });
  assert.strictEqual(coffee.name, 'Drink water');
  const loose = plain(H.parse('meditate 5 min'));
  assert.strictEqual(loose.cue, null);
  assert.deepStrictEqual([loose.name, loose.tiny], ['Meditate', '5 min']);
  assert.strictEqual(H.parse('   ').name, '');
});

test('every pack sentence reads into a habit with a name and a cue', () => {
  Object.keys(H.PACKS).forEach((pack) => H.PACKS[pack].forEach((sentence) => {
    const p = H.parse(sentence);
    assert.ok(p.name && p.cue && p.identity, pack + ': ' + sentence);
  }));
});

test('cue times: after a prayer is ten minutes after it, before is twenty before; a clock time is itself', () => {
  const day = new Date(2026, 9, 18);
  const times = null; // no city set: rough times
  const fajr = H.cueAt({ cue: { type: 'prayer', prayer: 'fajr', when: 'after' } }, day, times);
  assert.deepStrictEqual([fajr.getHours(), fajr.getMinutes()], [5, 40]);
  const before = H.cueAt({ cue: { type: 'prayer', prayer: 'fajr', when: 'before' } }, day, times);
  assert.deepStrictEqual([before.getHours(), before.getMinutes()], [5, 10]);
  const at = H.cueAt({ cue: { type: 'time', at: '17:30' } }, day, times);
  assert.deepStrictEqual([at.getHours(), at.getMinutes()], [17, 30]);
  assert.strictEqual(H.cueAt({ cue: null }, day, times), null);
});

test('the days: the chain, runs, and never miss twice', () => {
  const today = new Date(2026, 9, 18, 12);
  const created = new Date(2026, 9, 10).getTime();
  const log = {
    '2026-10-10': 'done', '2026-10-11': 'done', '2026-10-12': 'tiny', '2026-10-13': 'done',
    // 14 missed
    '2026-10-15': 'done', '2026-10-16': 'done',
    // 17 missed (yesterday)
  };
  const habit = { created, log };
  assert.strictEqual(H.dayState(habit, new Date(2026, 9, 12), today), 'tiny');
  assert.strictEqual(H.dayState(habit, new Date(2026, 9, 17), today), 'missed');
  assert.strictEqual(H.dayState(habit, new Date(2026, 9, 18), today), 'open');
  assert.strictEqual(H.dayState(habit, new Date(2026, 9, 9), today), 'before');
  assert.strictEqual(H.bestRun(habit), 4); // 10 to 13; the tiny version counts
  assert.strictEqual(H.currentRun(habit, today), 0); // yesterday was missed
  assert.strictEqual(H.missState(habit, today), 'once');
  assert.strictEqual(H.neverMissedTwice(habit, new Date(2026, 9, 10), today), true);
  log['2026-10-18'] = 'done';
  assert.strictEqual(H.missState(habit, today), 'ok'); // done today: back on track
  delete log['2026-10-16'];
  delete log['2026-10-18'];
  assert.strictEqual(H.missState(habit, today), 'twice'); // 16 and 17 both missed: make it smaller?
  delete log['2026-10-15'];
  log['2026-10-17'] = undefined;
  assert.strictEqual(H.neverMissedTwice(habit, new Date(2026, 9, 10), today), false); // 14 and 15 in a row
});
