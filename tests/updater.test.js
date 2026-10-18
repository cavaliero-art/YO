'use strict';

// Tests for updates (main/updater.js): only the installed app checks; running from the code says so
// when you ask, and never tries to install anything. Electron is faked (not packaged).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Module = require('module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return path.join(__dirname, 'fake-electron.js');
  return resolve.call(this, request, ...rest);
};
const Updater = require('../main/updater');

test('from the code (not installed): no checks, a clear answer when you ask, nothing to install', () => {
  const told = [];
  const u = Updater.create((event) => told.push(event));
  u.start(); // does nothing outside the installed app
  u.check(false);
  assert.deepStrictEqual(told, []);
  u.check(true);
  assert.deepStrictEqual(told, [{ type: 'dev' }]);
  assert.strictEqual(u.install(), false);
  assert.strictEqual(u.ready(), null);
});
