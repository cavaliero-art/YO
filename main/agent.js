'use strict';

// YO's hands. The page sends { id, text }; everything is checked again here before anything runs.
// It answers with the same typed events the demo agent used:
//   { type: 'state', state: 'working', text, category }
//   { type: 'approval_needed', id, tool, risk, title, body, allowAlways, category }
//   { type: 'message', text, category, tone }        tone: ok, set, cancel, info, media, error
//   { type: 'result', title, body, category, sticky?, background?, alarm? }
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { app, shell } = require('electron');
const store = require('./store');
const keys = require('./keys');
const apps = require('./apps');

const MAX_TEXT = 300;
const MAX_DELAY_S = 24 * 3600;
const STEP_PRESSES = 5; // "louder" = 5 key presses, about 10%

// the words an action may start with (same as renderer/commands.js), longest first
const WORDS = {
  open: ['open', 'launch', 'start', 'go to'],
  remind: ['remind me', 'remind', 'reminder'],
  timer: ['set a timer', 'timer', 'countdown'],
};
const CATEGORY = {
  open: 'apps', remind: 'time', timer: 'time', lock: 'system',
  play: 'media', next: 'media', prev: 'media', volup: 'media', voldown: 'media', mute: 'media',
};
const MEDIA_TEXT = {
  play: 'Play / pause', next: 'Next track', prev: 'Previous track', volup: 'Volume up', voldown: 'Volume down', mute: 'Mute / unmute',
};
const FOLDERS = {
  downloads: 'downloads', download: 'downloads', documents: 'documents', docs: 'documents', desktop: 'desktop',
  pictures: 'pictures', photos: 'pictures', music: 'music', videos: 'videos', home: 'home',
};
// opening these runs code, so YO always asks first and never offers "Always"
const RUNS_CODE = /\.(exe|bat|cmd|com|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|msi|msc|scr|lnk|reg|hta|cpl|jar|appref-ms)$/i;

const UNITS = { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600 };

const normalize = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();

function argOf(id, text) {
  const raw = String(text || '').trim().replace(/\s+/g, ' ');
  const low = raw.toLowerCase();
  const word = (WORDS[id] || []).find((w) => low === w || low.startsWith(w + ' '));
  return word ? raw.slice(word.length).trim() : '';
}

function parseDelay(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|hr|h)?\b/i.exec(text);
  if (!m) return null;
  const secs = parseFloat(m[1].replace(',', '.')) * (UNITS[(m[2] || 'min').toLowerCase()] || 60);
  return secs > 0 && secs <= MAX_DELAY_S ? Math.round(secs * 1000) : null;
}

function formatDelay(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.round(s / 60) + ' min';
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  return min ? h + ' h ' + min + ' min' : h + ' h';
}

// what "open <arg>" points at: a folder, a site, a path, or an installed app
function resolveOpen(arg) {
  const word = normalize(arg);
  if (!word) return null;
  if (FOLDERS[word]) {
    const name = FOLDERS[word];
    return { kind: 'folder', target: app.getPath(name), label: name[0].toUpperCase() + name.slice(1) };
  }
  if (/^https?:\/\/\S+$/i.test(arg) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(arg)) {
    try {
      const url = new URL(/^https?:/i.test(arg) ? arg : 'https://' + arg);
      if (url.protocol === 'https:' || url.protocol === 'http:') return { kind: 'site', target: url.href, label: url.host };
    } catch (err) { /* not a URL */ }
  }
  if (/^[a-z]:[\\/]/i.test(arg)) {
    const target = path.normalize(arg);
    if (fs.existsSync(target)) {
      const isDir = fs.statSync(target).isDirectory();
      return { kind: isDir ? 'folder' : 'file', target, label: path.basename(target) || target, runsCode: !isDir && RUNS_CODE.test(target) };
    }
    return null;
  }
  const best = apps.find(arg, 1)[0];
  if (best && apps.score(best.name, apps.normalize(arg)) >= 30) return { kind: 'app', target: best, label: best.name };
  return null;
}

// suggestions for "open <arg>" while typing: folders, a site, then apps
function suggestOpen(arg) {
  const word = normalize(arg);
  if (!word || word.length > 120) return [];
  const out = [];
  Object.keys(FOLDERS).forEach((key) => {
    const name = FOLDERS[key];
    if (key === name && key.startsWith(word)) out.push({ kind: 'folder', label: name[0].toUpperCase() + name.slice(1) });
  });
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(arg) || /^https?:\/\//i.test(arg)) out.push({ kind: 'site', label: arg.trim() });
  apps.find(arg, 5).forEach((a) => out.push({ kind: 'app', label: a.name }));
  return out.slice(0, 5);
}

function lockPc() {
  return new Promise((resolve, reject) => {
    childProcess.execFile('rundll32.exe', ['user32.dll,LockWorkStation'], { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

function create(emit) {
  const settings = store.load('settings', { trusted: [] });
  const trusted = new Set(Array.isArray(settings.trusted) ? settings.trusted : []);
  const reminders = new Map(); // id -> { entry, timer }
  let pending = null;
  let counter = 0;

  const say = (text, category, tone) => emit({ type: 'message', text, category, tone });

  // ---------- reminders and timers: saved, so they survive a restart ----------
  function saveReminders() {
    store.save('reminders', Array.from(reminders.values()).map((r) => r.entry));
  }

  function fire(entry, late) {
    reminders.delete(entry.id);
    saveReminders();
    const when = formatDelay(entry.at - entry.created);
    const missed = late ? ' Missed at ' + new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.' : '';
    emit({
      type: 'result', category: 'time', sticky: true, background: true, alarm: entry.kind === 'timer',
      title: entry.note || "Time's up",
      body: 'You asked ' + when + ' before.' + missed,
    });
  }

  function arm(entry) {
    const delay = entry.at - Date.now();
    const timer = setTimeout(() => fire(entry, delay < -5000), Math.max(delay, 0));
    reminders.set(entry.id, { entry, timer });
  }

  // after a restart: everything still waiting, and anything that came due while YO was closed
  function restore() {
    const saved = store.load('reminders', []);
    (Array.isArray(saved) ? saved : []).forEach((entry) => {
      if (entry && typeof entry.at === 'number' && typeof entry.id === 'string') arm(entry);
    });
  }

  function schedule(id, text) {
    const ms = parseDelay(argOf(id, text));
    if (!ms) return say('When? Try “in 10 min”', 'time', 'info');
    const m = /\bto\s+(.+)$/i.exec(text);
    const entry = {
      id: 'r' + Date.now() + '-' + ++counter,
      kind: id,
      note: id === 'remind' && m ? m[1].trim().slice(0, 120) : '',
      created: Date.now(),
      at: Date.now() + ms,
    };
    arm(entry);
    saveReminders();
    say((id === 'remind' ? "Okay, I'll remind you in " : 'Timer set for ') + formatDelay(ms), 'time', 'set');
  }

  // ---------- running an action ----------
  async function run(id, text, target) {
    if (id === 'lock') {
      await lockPc();
      return say('Locked', 'system', 'ok');
    }
    if (MEDIA_TEXT[id]) {
      keys.tap(id, id === 'volup' || id === 'voldown' ? STEP_PRESSES : 1);
      return say(MEDIA_TEXT[id], 'media', 'media');
    }
    if (id === 'remind' || id === 'timer') return schedule(id, text);
    if (id === 'open') {
      const what = target || resolveOpen(argOf('open', text));
      if (!what) {
        const arg = argOf('open', text);
        return say(arg ? 'I couldn’t find “' + arg.slice(0, 40) + '”' : 'Open what? Try “open spotify”', 'apps', 'info');
      }
      if (what.kind === 'app') apps.launch(what.target);
      else if (what.kind === 'site') await shell.openExternal(what.target);
      else {
        const problem = await shell.openPath(what.target);
        if (problem) throw new Error(problem);
      }
      return say('Opening ' + what.label, 'apps', 'ok');
    }
    return say('Try “open spotify”, “play” or “remind me in 10 min”', 'system', 'info');
  }

  // which actions need your OK: [risk, title, body, allowAlways]
  function needsOk(id, text) {
    if (id === 'lock') return { risk: 'medium', title: 'Lock this PC', body: 'YO wants to lock your workstation.', allowAlways: true };
    if (id === 'open') {
      const what = resolveOpen(argOf('open', text));
      if (what && what.runsCode) {
        return { risk: 'high', title: 'Run ' + what.label + '?', body: 'This file runs a program: ' + what.target, allowAlways: false, target: what };
      }
    }
    return null;
  }

  async function attempt(id, text, target) {
    try {
      await run(id, text, target);
    } catch (err) {
      say('That didn’t work: ' + String(err && err.message ? err.message : err).slice(0, 80), CATEGORY[id] || 'system', 'error');
    }
  }

  return {
    restore,
    suggestOpen,

    send(request) {
      pending = null;
      const text = typeof request.text === 'string' ? request.text.slice(0, MAX_TEXT) : '';
      let id = typeof request.id === 'string' && CATEGORY[request.id] ? request.id : null;
      // no action picked: guess from the first word, the way the bar does
      if (!id) {
        const low = normalize(text);
        id = Object.keys(WORDS).find((key) => WORDS[key].some((w) => low === w || low.startsWith(w + ' '))) || null;
      }
      if (!id) return say('Try “open spotify”, “play” or “remind me in 10 min”', 'system', 'info');
      const ask = needsOk(id, text);
      if (ask && !(ask.allowAlways && trusted.has(id))) {
        pending = { id: 'req-' + ++counter, action: id, text, target: ask.target, allowAlways: ask.allowAlways };
        return emit({
          type: 'approval_needed', id: pending.id, tool: id, risk: ask.risk, category: CATEGORY[id],
          title: ask.title, body: ask.body, allowAlways: ask.allowAlways,
        });
      }
      attempt(id, text);
    },

    respond(reqId, decision) {
      if (!pending || pending.id !== reqId) return;
      const { action, text, target, allowAlways } = pending;
      pending = null;
      if (decision === 'deny') return say('Cancelled', CATEGORY[action], 'cancel');
      if (decision === 'always' && allowAlways) {
        trusted.add(action);
        // read the file again: other settings (like the walk) live in it too
        store.save('settings', Object.assign(store.load('settings', {}), { trusted: Array.from(trusted) }));
      }
      attempt(action, text, target);
    },

    stop() {
      pending = null;
      say('Cancelled', 'system', 'cancel');
    },
  };
}

module.exports = { create, parseDelay, formatDelay, argOf, resolveOpen };
