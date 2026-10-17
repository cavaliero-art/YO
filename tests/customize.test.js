'use strict';

// Tests for renderer/customize.js: look codes (YO-XXXX) that friends paste to wear your look.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LOOKS = {
  color: ['mint', 'sky', 'peach'], eyeColor: ['mint', 'white'], eyes: ['round', 'happy', 'sleepy'],
  hat: ['none', 'cap', 'crown'], glasses: ['none', 'round'], item: ['none', 'mug'],
  neck: ['none', 'scarf'], tip: ['ball', 'star'], sticker: ['none', 'heart'],
};
const window = { Yo: { mascot: { LOOKS } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'customize.js'), 'utf8'), { window, Math, Number, parseInt });
const C = window.Yo.customize;
const plain = (value) => JSON.parse(JSON.stringify(value)); // objects made inside the sandbox have its own prototypes

test('a look survives the trip through its code', () => {
  const look = { color: 'peach', eyeColor: 'white', eyes: 'sleepy', hat: 'crown', glasses: 'round', item: 'mug', neck: 'scarf', tip: 'star', sticker: 'heart' };
  const code = C.encodeLook(look);
  assert.match(code, /^YO-[0-9A-Z]+$/);
  assert.deepStrictEqual(plain(C.decodeLook(code)), look);
  assert.deepStrictEqual(plain(C.decodeLook(' ' + code.toLowerCase() + ' ')), look); // pasted with spaces, any case
});

test('codes that are not looks are refused', () => {
  assert.strictEqual(C.decodeLook('hello'), null);
  assert.strictEqual(C.decodeLook('YO-'), null);
  assert.strictEqual(C.decodeLook('YO-ZZZZZZZZ'), null); // past the last look
  assert.strictEqual(C.decodeLook(''), null);
});
