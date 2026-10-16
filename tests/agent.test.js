'use strict';

// Tests for YO's hands (main/agent.js). Nothing real happens: Electron and app launching
// are replaced by recorders.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// "electron" -> the fake
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return path.join(__dirname, 'fake-electron.js');
  return resolve.call(this, request, ...rest);
};
const electron = require('electron');

// a known list of installed apps, saved where main/apps.js reads it
fs.writeFileSync(path.join(electron.userData, 'apps.json'), JSON.stringify([
  { name: 'Spotify', id: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify' },
  { name: 'Visual Studio Code', id: 'Microsoft.VisualStudioCode' },
  { name: 'Notepad', id: 'Microsoft.WindowsNotepad_8wekyb3d8bbwe!App' },
]));

const apps = require('../main/apps');
const Agent = require('../main/agent');

const launched = [];
apps.launch = (entry) => launched.push(entry.name);
apps.refresh = () => Promise.resolve([]); // never run PowerShell in tests

function agentWithEvents() {
  const events = [];
  const agent = Agent.create((event) => events.push(event));
  return { agent, events, last: () => events[events.length - 1] };
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));

test('reads delays the way people type them', () => {
  assert.strictEqual(Agent.parseDelay('in 2m'), 120000);
  assert.strictEqual(Agent.parseDelay('in 20 min to stretch'), 1200000);
  assert.strictEqual(Agent.parseDelay('25'), 1500000); // no unit means minutes
  assert.strictEqual(Agent.parseDelay('1.5h'), 5400000);
  assert.strictEqual(Agent.parseDelay('30 s'), 30000);
  assert.strictEqual(Agent.parseDelay('0 min'), null);
  assert.strictEqual(Agent.parseDelay('48 hours'), null); // more than a day
  assert.strictEqual(Agent.parseDelay('soon'), null);
});

test('works out what "open" points at', () => {
  assert.strictEqual(Agent.argOf('open', 'open   Spotify'), 'Spotify');
  assert.strictEqual(Agent.argOf('open', 'go to github.com'), 'github.com');
  assert.deepStrictEqual(Agent.resolveOpen('downloads').kind, 'folder');
  const site = Agent.resolveOpen('github.com/cavaliero-art');
  assert.strictEqual(site.kind, 'site');
  assert.strictEqual(site.target, 'https://github.com/cavaliero-art');
  assert.strictEqual(Agent.resolveOpen('spo').target.name, 'Spotify');
  assert.strictEqual(Agent.resolveOpen('vsc').target.name, 'Visual Studio Code'); // initials
  assert.strictEqual(Agent.resolveOpen('xyzzy'), null);
  assert.strictEqual(Agent.resolveOpen('javascript:alert(1)'), null);
  assert.strictEqual(Agent.resolveOpen('file:///C:/Windows'), null);
});

test('a program on disk always asks first, and never offers "Always"', { skip: process.platform !== 'win32' }, () => {
  const exe = Agent.resolveOpen('C:\\Windows\\notepad.exe');
  assert.strictEqual(exe.runsCode, true);
  const { agent, last } = agentWithEvents();
  agent.send({ id: 'open', text: 'open C:\\Windows\\notepad.exe' });
  assert.strictEqual(last().type, 'approval_needed');
  assert.strictEqual(last().risk, 'high');
  assert.strictEqual(last().allowAlways, false);
  agent.respond(last().id, 'deny');
  assert.strictEqual(last().tone, 'cancel');
  assert.ok(!electron.calls.some(([, target]) => /notepad\.exe$/i.test(target)));
});

test('opens apps, folders and sites', async () => {
  const { agent, last } = agentWithEvents();
  agent.send({ id: 'open', text: 'open spo' });
  await tick();
  assert.strictEqual(launched.pop(), 'Spotify');
  assert.strictEqual(last().text, 'Opening Spotify');
  agent.send({ id: null, text: 'open github.com' }); // no action picked: guessed from "open"
  await tick();
  assert.deepStrictEqual(electron.calls.pop(), ['openExternal', 'https://github.com/']);
  agent.send({ id: 'open', text: 'open nothing-like-this' });
  await tick();
  assert.strictEqual(last().tone, 'info');
});

test('media and lock are gone: YO says what it can do instead', () => {
  const { agent, last } = agentWithEvents();
  ['play', 'next', 'volup', 'lock'].forEach((id) => {
    agent.send({ id, text: id });
    assert.strictEqual(last().tone, 'info');
  });
});

test('ignores unknown actions and too-long text', () => {
  const { agent, last } = agentWithEvents();
  agent.send({ id: 'format-c', text: 'format c:' });
  assert.strictEqual(last().tone, 'info');
  agent.send({ id: 'open', text: 'open ' + 'a'.repeat(5000) });
  assert.ok(last());
});

test('reminders fire, and are saved for after a restart', async () => {
  const { agent, last } = agentWithEvents();
  agent.send({ id: 'remind', text: 'remind me in 1 s to drink water' });
  assert.strictEqual(last().tone, 'set');
  const saved = JSON.parse(fs.readFileSync(path.join(electron.userData, 'reminders.json'), 'utf8'));
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].note, 'drink water');
  await tick(1200);
  assert.strictEqual(last().type, 'result');
  assert.strictEqual(last().title, 'drink water');
  assert.strictEqual(last().background, true);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(electron.userData, 'reminders.json'), 'utf8')), []);
});

test('a reminder that came due while YO was closed is delivered as missed', async () => {
  const now = Date.now();
  fs.writeFileSync(path.join(electron.userData, 'reminders.json'), JSON.stringify([
    { id: 'old', kind: 'remind', note: 'call mom', created: now - 600000, at: now - 60000 },
    { id: 'later', kind: 'timer', note: '', created: now, at: now + 60000 },
  ]));
  const { agent, events } = agentWithEvents();
  agent.restore();
  await tick(50);
  const missed = events.find((e) => e.type === 'result');
  assert.strictEqual(missed.title, 'call mom');
  assert.match(missed.body, /Missed at/);
  const left = JSON.parse(fs.readFileSync(path.join(electron.userData, 'reminders.json'), 'utf8'));
  assert.deepStrictEqual(left.map((r) => r.id), ['later']);
});
