'use strict';

// What's playing, asked only while YO is on screen: the song Windows' media controls know about.
// One PowerShell stays open (~1.8 s to start, then ~30 ms per question). Nothing is stored or sent anywhere.
const { spawn } = require('child_process');
const readline = require('readline');

const TIMEOUT_MS = 4000;
const SETUP = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  "$yoAsTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
  'function YoAwait($op, $type) { $t = $yoAsTask.MakeGenericMethod($type).Invoke($null, @($op)); $null = $t.Wait(2000); $t.Result }',
  '$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]',
  'function YoNow { $m = YoAwait ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]); ' +
    '$s = $m.GetCurrentSession(); if (-not $s) { return @{ playing = $false; title = ""; artist = "" } }; ' +
    '$p = YoAwait ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]); ' +
    'return @{ playing = ([int]$s.GetPlaybackInfo().PlaybackStatus -eq 4); title = [string]$p.Title; artist = [string]$p.Artist } }',
  "function YoAsk($id, $kind) { try { $r = YoNow; Write-Output ('@@' + $id + '|' + ($r | ConvertTo-Json -Compress)) } catch { Write-Output ('@@' + $id + '|null') } }",
];

let ps = null;
let seq = 0;
const waiting = new Map();

function shell() {
  if (ps) return ps;
  ps = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  readline.createInterface({ input: ps.stdout }).on('line', (line) => {
    const m = /^@@(\w+)\|(.*)$/.exec(line.trim());
    if (!m || !waiting.has(m[1])) return;
    let value = null;
    try { value = m[2] ? JSON.parse(m[2]) : null; } catch (err) { value = null; }
    waiting.get(m[1])(value);
  });
  const reset = () => { ps = null; };
  ps.on('exit', reset);
  ps.on('error', reset);
  ps.stdin.on('error', reset);
  ps.stdin.write(SETUP.join('\n') + '\n');
  return ps;
}

function ask(kind) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    const id = 'q' + ++seq;
    const timer = setTimeout(() => { waiting.delete(id); resolve(null); }, TIMEOUT_MS);
    waiting.set(id, (value) => {
      clearTimeout(timer);
      waiting.delete(id);
      resolve(value);
    });
    try {
      shell().stdin.write("YoAsk '" + id + "' '" + kind + "'\n");
    } catch (err) {
      clearTimeout(timer);
      waiting.delete(id);
      resolve(null);
    }
  });
}

async function nowPlaying() {
  const r = await ask('media');
  if (!r || typeof r !== 'object') return null;
  return { playing: Boolean(r.playing), title: String(r.title || '').slice(0, 120), artist: String(r.artist || '').slice(0, 120) };
}

function stop() {
  if (ps) ps.kill();
  ps = null;
}

module.exports = { nowPlaying, stop };
