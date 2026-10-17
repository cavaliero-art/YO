'use strict';

// Tests for the mini apps: their main-process side (translate) with Electron faked, and the
// renderer helpers (calculator, translate parsing) in a sandbox.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return path.join(__dirname, 'fake-electron.js');
  return resolve.call(this, request, ...rest);
};
const electron = require('electron');
const translator = require('../main/translate');

const plain = (value) => JSON.parse(JSON.stringify(value));
test('translate: asks MyMemory, decodes the answer, reports the language', async () => {
  electron.net.reply = () => ({
    ok: true,
    status: 200,
    json: async () => ({ responseStatus: 200, responseData: { translatedText: 'it&#39;s fine &amp; good', detectedLanguage: 'fr' } }),
  });
  const res = await translator.translate('c’est bien', 'auto', 'en');
  assert.deepStrictEqual(res, { text: "it's fine & good", detected: 'fr', cut: false });
  const url = electron.calls.filter((c) => c[0] === 'fetch').pop()[1];
  assert.ok(url.startsWith('https://api.mymemory.translated.net/get?'));
  assert.ok(url.includes('langpair=autodetect%7Cen'));
});

test('translate: errors, limits and odd input', async () => {
  electron.net.reply = () => ({ ok: true, status: 200, json: async () => ({ quotaFinished: true }) });
  assert.deepStrictEqual(await translator.translate('hi', 'en', 'fr'), { error: 'quota' });
  electron.net.reply = () => { throw new Error('offline'); };
  assert.deepStrictEqual(await translator.translate('hi', 'en', 'fr'), { error: 'net' });
  assert.deepStrictEqual(await translator.translate('hi', 'en', 'klingon'), { error: 'lang' });
  assert.deepStrictEqual(await translator.translate('hi', 'fr', 'fr'), { text: 'hi' });
  assert.deepStrictEqual(await translator.translate('   ', 'auto', 'fr'), { text: '' });
  electron.net.reply = (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ responseStatus: 200, responseData: { translatedText: String(new URL(url).searchParams.get('q').length) } }),
  });
  const long = await translator.translate('a'.repeat(900), 'en', 'fr');
  assert.strictEqual(long.text, '500');
  assert.strictEqual(long.cut, true);
});

// ---------- renderer helpers, in a sandbox ----------
function renderer() {
  const window = { Yo: {} };
  const ctx = {
    window, document: {}, Node: function Node() {}, localStorage: { getItem: () => null, setItem() {} },
    JSON, Math, Date, setTimeout, TextEncoder, TextDecoder, btoa, atob,
  };
  ['i18n.js', 'quick.js', 'miniapps.js', 'apps/calc.js', 'apps/translate.js'].forEach((file) => {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', file), 'utf8'), ctx);
  });
  return window.Yo;
}
const Y = renderer();

test('calculator: pad symbols, calculator-style percent, units', () => {
  assert.deepStrictEqual(plain(Y.miniapps.solveCalc('12 × 7 + 20%')), { value: '100.8' });
  assert.deepStrictEqual(plain(Y.miniapps.solveCalc('(3 + 4) ÷ 2 − 1')), { value: '2.5' });
  assert.deepStrictEqual(plain(Y.miniapps.solveCalc('50%')), { value: '0.5' });
  assert.strictEqual(Y.miniapps.solveCalc('20% of 150').value, '30');
  assert.strictEqual(Y.miniapps.solveCalc('100 f to c').value, '37.7777777778');
  assert.strictEqual(Y.miniapps.solveCalc('2 +'), null);
  assert.strictEqual(Y.miniapps.solveCalc('alert(1)'), null); // never run as code
});

test('translate: what was typed after the word', () => {
  assert.deepStrictEqual(plain(Y.miniapps.parseTranslate('hola amigo to english')), { text: 'hola amigo', to: 'en' });
  assert.deepStrictEqual(plain(Y.miniapps.parseTranslate('good morning in AR')), { text: 'good morning', to: 'ar' });
  assert.deepStrictEqual(plain(Y.miniapps.parseTranslate('how to cook')), { text: 'how to cook', to: null });
  assert.deepStrictEqual(plain(Y.miniapps.parseTranslate('')), { text: '', to: null });
});

