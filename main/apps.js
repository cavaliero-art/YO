'use strict';

// The apps installed on this PC, from Windows' own Start list (normal and Store apps).
// Read in the background (~4 s), kept on disk so suggestions work right away next time.
const { execFile, spawn } = require('child_process');
const store = require('./store');

const REFRESH_MS = 30 * 60 * 1000;
const LIST_APPS =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' +
  'Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress';

let apps = store.load('apps', []);
let loadedAt = 0;
let loading = null;

const normalize = (text) =>
  String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// skip uninstallers and web links that sit in the Start menu
function keep(entry) {
  return entry && typeof entry.Name === 'string' && typeof entry.AppID === 'string' &&
    !/uninstall|désinstaller/i.test(entry.Name) && !/^https?:/i.test(entry.AppID);
}

function refresh() {
  if (process.platform !== 'win32') return Promise.resolve(apps);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', LIST_APPS],
      { windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        loading = null;
        if (!err) {
          try {
            const list = JSON.parse(String(stdout).replace(/^﻿/, ''));
            apps = (Array.isArray(list) ? list : [list]).filter(keep).map((a) => ({ name: a.Name, id: a.AppID }));
            loadedAt = Date.now();
            store.save('apps', apps);
          } catch (parseErr) { /* keep the list we had */ }
        }
        resolve(apps);
      });
  });
  return loading;
}

function score(name, q) {
  const n = normalize(name);
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  const words = n.split(/[\s\-_.]+/);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (q.length >= 3 && n.includes(q)) return 40;
  const initials = words.map((w) => w[0] || '').join('');
  if (q.length >= 2 && initials.startsWith(q)) return 30; // "vsc" -> Visual Studio Code
  return 0;
}

function find(query, max) {
  const q = normalize(query);
  if (!q) return [];
  if (Date.now() - loadedAt > REFRESH_MS) refresh();
  return apps
    .map((a) => ({ a, s: score(a.name, q) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.a.name.length - y.a.name.length)
    .slice(0, max || 5)
    .map((x) => x.a);
}

// opens it the way the Start menu does
function launch(entry) {
  spawn('explorer.exe', ['shell:AppsFolder\\' + entry.id], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

module.exports = { refresh, find, launch, score, normalize };
