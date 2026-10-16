'use strict';

// Stands in for Electron in tests: a temp user-data folder, and a shell that only records calls.
const fs = require('fs');
const os = require('os');
const path = require('path');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'yo-test-'));
const calls = [];

module.exports = {
  userData,
  calls,
  app: {
    getPath: (name) => (name === 'userData' ? userData : path.join(os.homedir(), name)),
  },
  shell: {
    openExternal: async (url) => { calls.push(['openExternal', url]); },
    openPath: async (target) => { calls.push(['openPath', target]); return ''; },
  },
  // a clipboard a test can set; formats are the private markers password managers add.
  // Like Electron 44, its calls return promises.
  clipboard: {
    text: '',
    formats: new Set(),
    set(text, formats) { this.text = text; this.formats = new Set(formats || []); },
    readText() { return Promise.resolve(this.text); },
    writeText(text) { this.set(text); return Promise.resolve(); },
    has(format) { return Promise.resolve(this.formats.has(format)); },
  },
  // net.fetch answers with whatever the test puts in reply(url)
  net: {
    reply: () => ({ ok: false, status: 500, json: async () => ({}) }),
    fetch(url) {
      calls.push(['fetch', url]);
      return new Promise((resolve) => resolve(this.reply(url)));
    },
  },
};
