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
  // a clipboard a test can set; formats are the private markers password managers add
  clipboard: {
    text: '',
    formats: new Map(),
    readText() { return this.text; },
    writeText(text) { this.text = text; this.formats = new Map(); },
    has(format) { return this.formats.has(format); },
    readBuffer(format) { return this.formats.get(format) || Buffer.alloc(0); },
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
