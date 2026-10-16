'use strict';

// Tests for renderer/unlocks.js, run in a sandbox with a fake window storage.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// objects made inside the sandbox have their own Object/Array: compare plain copies
const plain = (value) => JSON.parse(JSON.stringify(value));
const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'unlocks.js'), 'utf8');

function fresh(saved) {
  const data = new Map(saved ? [['yo.stats', JSON.stringify(saved)]] : []);
  const localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
  const window = { Yo: {} };
  vm.runInNewContext(SOURCE, { window, localStorage, JSON, Date });
  return { unlocks: window.Yo.unlocks, data };
}

test('everything not in a rule is always available', () => {
  const { unlocks } = fresh();
  assert.strictEqual(unlocks.isUnlocked('hat', 'crown'), true);
  assert.strictEqual(unlocks.isUnlocked('color', 'mint'), true);
  assert.strictEqual(unlocks.isUnlocked('hat', 'halo'), false);
  assert.deepStrictEqual(plain(unlocks.progress('hat', 'halo')), { stat: 'pets', have: 0, need: 10 });
});

test('petting 10 times unlocks the halo, once', () => {
  const { unlocks } = fresh();
  for (let i = 0; i < 9; i++) assert.deepStrictEqual(plain(unlocks.record('pets').map((r) => r.value)), []);
  assert.deepStrictEqual(plain(unlocks.record('pets').map((r) => r.value)), ['halo']);
  assert.strictEqual(unlocks.isUnlocked('hat', 'halo'), true);
  assert.deepStrictEqual(plain(unlocks.record('pets')), []); // never announced twice
});

test('a visit after midnight unlocks the nightcap; days count once each', () => {
  const { unlocks } = fresh();
  assert.deepStrictEqual(plain(unlocks.record('visit', new Date(2026, 9, 16, 14, 0)).map((r) => r.value)), []);
  assert.deepStrictEqual(plain(unlocks.record('visit', new Date(2026, 9, 16, 15, 0))), []);
  assert.deepStrictEqual(plain(unlocks.progress('color', 'gold')), { stat: 'days', have: 1, need: 7 });
  assert.deepStrictEqual(plain(unlocks.record('visit', new Date(2026, 9, 17, 1, 30)).map((r) => r.value)), ['nightcap']);
});

test('seven different days unlock gold', () => {
  const { unlocks } = fresh();
  let got = [];
  for (let d = 1; d <= 7; d++) got = got.concat(unlocks.record('visit', new Date(2026, 9, d, 12, 0)));
  assert.deepStrictEqual(plain(got.map((r) => r.value)), ['gold']);
});

test('counts survive a restart; broken storage starts fresh', () => {
  const first = fresh();
  for (let i = 0; i < 3; i++) first.unlocks.record('answers');
  const saved = JSON.parse(first.data.get('yo.stats'));
  assert.strictEqual(saved.answers, 3);
  const again = fresh(saved);
  assert.deepStrictEqual(plain(again.unlocks.progress('hat', 'grad')), { stat: 'answers', have: 3, need: 20 });
  const data = new Map([['yo.stats', '{not json']]);
  const window = { Yo: {} };
  vm.runInNewContext(SOURCE, { window, localStorage: { getItem: (k) => data.get(k), setItem() {} }, JSON, Date });
  assert.strictEqual(window.Yo.unlocks.isUnlocked('hat', 'propeller'), false);
});
