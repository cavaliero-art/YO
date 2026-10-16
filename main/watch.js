'use strict';

// What is going on on the PC, asked only when YO needs it:
//   nowPlaying()   the song Windows' media controls know about (title, artist, playing?)
//   isFullscreen() whether the app in front fills the screen (a game, a video)
// One PowerShell stays open (~1.8 s to start, then ~100 ms per question). Nothing is stored or sent anywhere.
const { spawn } = require('child_process');
const readline = require('readline');

const TIMEOUT_MS = 4000;
const SETUP = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  'Add-Type -AssemblyName System.Windows.Forms',
  "$yoAsTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
  'function YoAwait($op, $type) { $t = $yoAsTask.MakeGenericMethod($type).Invoke($null, @($op)); $null = $t.Wait(2000); $t.Result }',
  '$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]',
  "Add-Type -Namespace YoW -Name U -MemberDefinition '[DllImport(\"user32.dll\")] public static extern System.IntPtr GetForegroundWindow(); " +
    '[DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out RECT r); ' +
    '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder s, int n); ' +
    '[DllImport("user32.dll")] public static extern bool IsZoomed(System.IntPtr h); ' +
    "[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }'",
  'function YoNow { $m = YoAwait ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]); ' +
    '$s = $m.GetCurrentSession(); if (-not $s) { return @{ playing = $false; title = ""; artist = "" } }; ' +
    '$p = YoAwait ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]); ' +
    'return @{ playing = ([int]$s.GetPlaybackInfo().PlaybackStatus -eq 4); title = [string]$p.Title; artist = [string]$p.Artist } }',
  'function YoFull { $h = [YoW.U]::GetForegroundWindow(); $c = New-Object System.Text.StringBuilder 256; $null = [YoW.U]::GetClassName($h, $c, 256); ' +
    "if (@('Progman', 'WorkerW', 'Shell_TrayWnd') -contains $c.ToString()) { return @{ full = $false } }; " +
    // a maximized window pokes a few pixels past the screen edges but is not fullscreen
    'if ([YoW.U]::IsZoomed($h)) { return @{ full = $false } }; ' +
    '$r = New-Object YoW.U+RECT; $null = [YoW.U]::GetWindowRect($h, [ref]$r); $b = [System.Windows.Forms.Screen]::FromHandle($h).Bounds; ' +
    'return @{ full = ($r.Left -le $b.Left -and $r.Top -le $b.Top -and $r.Right -ge $b.Right -and $r.Bottom -ge $b.Bottom) } }',
  "function YoAsk($id, $kind) { try { if ($kind -eq 'media') { $r = YoNow } else { $r = YoFull }; Write-Output ('@@' + $id + '|' + ($r | ConvertTo-Json -Compress)) } catch { Write-Output ('@@' + $id + '|null') } }",
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

async function isFullscreen() {
  const r = await ask('full');
  return Boolean(r && r.full);
}

function stop() {
  if (ps) ps.kill();
  ps = null;
}

module.exports = { nowPlaying, isFullscreen, stop };
