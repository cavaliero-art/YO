'use strict';

// Tests for the mini apps: their main-process side (clipboard history, translate) with Electron
// faked, and the renderer helpers (calculator, translate parsing, clipboard kinds) in a sandbox.
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
const clips = require('../main/clipboard');
const translator = require('../main/translate');

const plain = (value) => JSON.parse(JSON.stringify(value));
const copy = (text, formats) => {
  electron.clipboard.writeText(text);
  if (formats) electron.clipboard.formats = new Map(Object.entries(formats));
  clips.tick();
};
const texts = () => clips.list().items.map((c) => c.text);

test('clipboard: keeps what you copy, newest first, without what was there before YO', () => {
  electron.clipboard.writeText('before YO started');
  clips.start(() => {});
  clips.stop(); // the test drives tick() itself
  copy('first');
  copy('second');
  copy('first'); // copied again: back on top, once
  assert.deepStrictEqual(texts(), ['first', 'second']);
});

test('clipboard: skips what password managers mark as private', () => {
  copy('hunter2', { ExcludeClipboardContentFromMonitorProcessing: Buffer.alloc(0) });
  copy('s3cret', { CanIncludeInClipboardHistory: Buffer.from([0, 0, 0, 0]) });
  copy('fine', { CanIncludeInClipboardHistory: Buffer.from([1, 0, 0, 0]) });
  assert.deepStrictEqual(texts(), ['fine', 'first', 'second']);
});

test('clipboard: pause, pin (saved to disk), remove, clear keeps pins', () => {
  assert.deepStrictEqual(clips.act('pause'), { paused: true });
  copy('while paused');
  assert.ok(!texts().includes('while paused'));
  clips.act('resume');
  const second = clips.list().items.find((c) => c.text === 'second');
  assert.strictEqual(clips.act('pin', second.id), true);
  const saved = JSON.parse(fs.readFileSync(path.join(electron.userData, 'clips.json'), 'utf8'));
  assert.deepStrictEqual(saved.map((c) => c.text), ['second']);
  const fine = clips.list().items.find((c) => c.text === 'fine');
  clips.act('remove', fine.id);
  assert.ok(!texts().includes('fine'));
  clips.act('clear');
  assert.deepStrictEqual(texts(), ['second']);
  assert.strictEqual(clips.act('pin', 'nope'), false);
});

test('clipboard: copy puts it back on the clipboard without adding it twice', () => {
  const item = clips.list().items[0];
  copy('new thing');
  assert.strictEqual(clips.act('copy', item.id), true);
  assert.strictEqual(electron.clipboard.readText(), 'second');
  clips.tick();
  assert.deepStrictEqual(texts(), ['second', 'new thing']);
});

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
  ['i18n.js', 'quick.js', 'miniapps.js', 'apps/calc.js', 'apps/translate.js', 'apps/clipboard.js'].forEach((file) => {
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

test('clipboard: what kind of thing was copied', () => {
  const kind = Y.miniapps.clipKind;
  assert.strictEqual(kind('https://example.com/a?b=1'), 'link');
  assert.strictEqual(kind('#ff6600'), 'color');
  assert.strictEqual(kind('me@example.com'), 'email');
  assert.strictEqual(kind('1 234,50'), 'number');
  assert.strictEqual(kind('const a = 1;\nconsole.log(a);'), 'code');
  assert.strictEqual(kind('just some words'), 'text');
});
