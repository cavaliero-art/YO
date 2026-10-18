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
    // Documents is inside the temp folder too: tests never write to the real one
    getPath: (name) => (name === 'userData' ? userData : name === 'documents' ? path.join(userData, 'Documents') : path.join(os.homedir(), name)),
    getVersion: () => '0.10.0',
  },
  shell: {
    openExternal: async (url) => { calls.push(['openExternal', url]); },
    openPath: async (target) => { calls.push(['openPath', target]); return ''; },
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
