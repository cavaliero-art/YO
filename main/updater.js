'use strict';

// Updates from YO's GitHub releases (github.com/cavaliero-art/YO): checked a little after YO starts and
// every few hours, downloaded quietly, then YO peeks: "Update ready", with Restart now or Later.
// Later: it installs the next time YO quits. Only the installed app updates (not `npm start`).
// Each download is checked against its sha512 from the release (latest.yml), over HTTPS.
const { app } = require('electron');

const FIRST_CHECK_MS = 45 * 1000;
const EVERY_MS = 6 * 3600000;

function create(send) {
  let updater = null;
  let ready = null; // { version, notes } once downloaded
  let asked = false; // a check you asked for from the tray: say "up to date" too

  function load() {
    if (updater || !app.isPackaged) return updater;
    try {
      ({ autoUpdater: updater } = require('electron-updater'));
    } catch (err) {
      console.warn('Updates unavailable:', err.message);
      return null;
    }
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.logger = null;
    updater.on('update-downloaded', (info) => {
      ready = { version: info.version, notes: plainNotes(info.releaseNotes) };
      send({ type: 'ready', version: ready.version, notes: ready.notes });
    });
    updater.on('update-not-available', () => {
      if (asked) send({ type: 'none', version: app.getVersion() });
      asked = false;
    });
    updater.on('error', (err) => {
      if (asked) send({ type: 'error' });
      asked = false;
      console.warn('Update check failed:', err && err.message);
    });
    return updater;
  }

  // the release notes come as HTML: the first few lines, as plain text
  function plainNotes(notes) {
    const text = Array.isArray(notes) ? notes.map((n) => n.note || '').join('\n') : String(notes || '');
    return text.replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"').replace(/\n{2,}/g, '\n').trim().split('\n').slice(0, 3).join('\n').slice(0, 300);
  }

  function check(byYou) {
    const u = load();
    if (!u) {
      if (byYou) send({ type: app.isPackaged ? 'error' : 'dev' });
      return;
    }
    if (ready) {
      if (byYou) send({ type: 'ready', version: ready.version, notes: ready.notes });
      return;
    }
    asked = Boolean(byYou);
    u.checkForUpdates().catch(() => {});
  }

  function start() {
    if (!app.isPackaged) return;
    setTimeout(() => check(false), FIRST_CHECK_MS);
    setInterval(() => check(false), EVERY_MS);
  }

  // Restart now: quit, install silently, start the new YO
  function install() {
    if (!ready || !updater) return false;
    setImmediate(() => updater.quitAndInstall(true, true));
    return true;
  }

  return { start, check, install, ready: () => ready };
}

module.exports = { create };
