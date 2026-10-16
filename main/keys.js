'use strict';

// Media and volume keys, pressed the way a keyboard would (Windows keybd_event).
// One PowerShell process stays open so each press takes ~30 ms instead of ~1.7 s.
const { spawn } = require('child_process');

const VK = { play: 0xB3, next: 0xB0, prev: 0xB1, mute: 0xAD, voldown: 0xAE, volup: 0xAF };
const SETUP =
  "Add-Type -Namespace Yo -Name Keys -MemberDefinition " +
  "'[DllImport(\"user32.dll\")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);'";
const DOWN = 1; // KEYEVENTF_EXTENDEDKEY
const UP = 3; // KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP

let ps = null;

function shell() {
  if (ps) return ps;
  ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'], {
    windowsHide: true,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  ps.on('exit', () => { ps = null; });
  ps.on('error', () => { ps = null; });
  ps.stdin.on('error', () => { ps = null; });
  ps.stdin.write(SETUP + '\n');
  return ps;
}

// start PowerShell ahead of time so the first key is quick too
function warm() {
  if (process.platform === 'win32') shell();
}

function tap(name, times) {
  const vk = VK[name];
  if (vk === undefined) throw new Error('Unknown key ' + name);
  if (process.platform !== 'win32') throw new Error('Media keys need Windows');
  const press = '[Yo.Keys]::keybd_event(' + vk + ',0,' + DOWN + ',[UIntPtr]::Zero); [Yo.Keys]::keybd_event(' + vk + ',0,' + UP + ',[UIntPtr]::Zero)';
  shell().stdin.write(new Array(times || 1).fill(press).join('; ') + '\n');
}

// Ctrl+V in whatever window has focus (after YO hides, that's the one you were in)
function paste() {
  if (process.platform !== 'win32') throw new Error('Paste needs Windows');
  const key = (vk, flags) => '[Yo.Keys]::keybd_event(' + vk + ',0,' + flags + ',[UIntPtr]::Zero)';
  shell().stdin.write([key(0x11, 0), key(0x56, 0), key(0x56, 2), key(0x11, 2)].join('; ') + '\n');
}

function stop() {
  if (ps) ps.kill();
  ps = null;
}

module.exports = { tap, paste, warm, stop, KEYS: Object.keys(VK) };
