# YO v0.7: a little robot with real hands

A small desktop companion that hangs from the top of your screen in a black pill.
It stays hidden until you call it, or until something you asked for needs you.
It has small daily apps built in (Translate, Calculator, Clipboard history), opens your apps,
folders and sites, and keeps your reminders, even across restarts. No buttons for things Windows
already does well (media keys, Win+L).

## Install it (Windows 10/11)

Run `YO Setup 0.7.0.exe`. It installs for you only (no admin rights), adds YO to the Start menu and
starts it. The first time, a welcome card shows the few things worth knowing.

Windows may say "Windows protected your PC", because the installer isn't signed yet (a code-signing
certificate costs money every year). Click *More info*, then *Run anyway*.

Uninstall from Settings > Apps like any app. Your looks and settings in %APPDATA%\YO are kept, in
case you install YO again; delete that folder to remove them too.

### The tray menu (right-click YO's icon, bottom right)

- Open YO
- Start with Windows: YO starts quietly in the tray when you log in.
- Shortcut: Ctrl+Space, Ctrl+Shift+Space, Ctrl+Alt+Y or Alt+Shift+Y. If another app already uses
  the one you pick, YO takes the next free one and tells you.
- Sounds on or off
- Quit

## Run it from the code

1. Install Node.js LTS from https://nodejs.org
2. In this folder:

       npm install
       npm start

## Make the installer

       npm run icons    (only after changing YO's look: redraws build/icon.png and the tray icons)
       npm run dist     (writes dist/YO Setup <version>.exe)

Release checklist:

1. Bump "version" in package.json and the title of this README.
2. `npm test` passes.
3. `npm run dist`, then install the new exe on a normal (non-admin) account.
4. Try: the shortcut, every tile of the home panel, a reminder in 1 min, Clipboard paste,
   Translate (online), Customize, Start with Windows (sign out and in), the tray menu.
5. Uninstall: YO is gone from the Start menu and from Startup apps.
6. Commit, tag (`git tag v0.7.0`), push, and attach the exe to a GitHub release.

## How it behaves

1. Call it with `Ctrl+Space` (fallback `Ctrl+Alt+Y`). The black pill slides down from the top
   edge and the robot drops in.
2. Click the robot, or just start typing. Matching actions appear under the bar as you type.
   `↑` `↓` pick, `Enter` runs. Actions that need more ("open …", "remind me in …") fill the bar first.
   The grid button (or `↓` / `Enter` on an empty bar) opens the home panel: big tiles for Translate,
   Calculator, Clipboard, Open, Remind me, Timer, Inbox (with a count of what's new) and Customize,
   and a row of YO's moves. Arrow keys move over the tiles, `Enter` opens one.
3. `Esc` closes. If you do nothing, YO leaves after 7 seconds.
4. `↑` in an empty bar brings back what you ran before. The actions you use most come first, and the
   panel starts with a Recent row (right-click a chip there to pin it).

Reminders, timers and unlocks also go to the inbox: a small dot on YO means something new.
Type `inbox` to see the last ones.

When something needs you (a reminder, an approval), YO comes back alone and says it inside the pill.
Click it, or press the shortcut, to open the card. If you're busy typing, it waits until you're done.

## What it does

- Open: `open spotify` finds the app among those installed (normal and Store apps; `vsc` works too),
  `open downloads` / `documents` / `desktop`..., `open github.com`, or `open C:\some\folder`.
  Typing `open spo` already suggests Spotify by name.
- Time: `remind me in 20 min to stretch`, `timer 25 min`. Saved to disk: they survive a restart,
  and one that came due while YO was closed is delivered when it starts, marked as missed.

Safety: the page never runs anything itself. It asks the main process, which checks every request
again. Opening a program or script file (.exe, .bat, .ps1...) always asks first. Sites open only as http/https.

### Mini apps

The top of the actions panel has three app tiles. Each one opens inside the pill, with YO in the
corner, `← All apps` to go back and `Esc` to close. You can also type their name; what you type after
it fills the app in.

- Translate: `tr hola to english`, `translate bonjour`, or open it right after copying some text and
  it starts with that. Pick languages from chips (From can detect the language); `⇄` swaps.
  `Ctrl+Enter` copies. The text is sent to MyMemory (a free translation service, no account) and
  needs internet; nothing else is sent.
- Calculator: type or tap; the answer shows as you go and `Enter` keeps it in the history.
  `84 + 20%` = 100.8 like a real calculator, and it also does `20% of 150`, `5 km in miles`.
  `Ctrl+C` with nothing selected copies the answer.
- Clipboard: everything you copied (text), newest first, searchable. `Enter` pastes it into the
  window you were in, `Ctrl+Enter` only copies it, ★ keeps one. Kept in memory only and cleared when YO
  quits, except ★ ones (saved in clips.json). Text a password manager marks as private is skipped,
  like Windows does. Pause it any time.

Dropping text on YO while Translate or the Calculator is open puts it in there.

### Drop things on YO

Drag a file or some text onto YO: its whole visor becomes a big open mouth ("gimme!"), then it
snaps shut, chews, and licks its lips.

- A file: copy its path, show it in its folder, or open it (programs still ask first).
- Text: turn it into a reminder ("remind me in 10 min to ..."), or copy it. A link: open it.

### Quick answers

Type and the answer shows up as the first row; `Enter` copies it (the Calculator app does math with
a history).

- Math: `12*7`, `= sqrt(16) + 2`, `2^10`, `20% of 150` (worked out by YO's own parser; nothing you type is run as code)
- Units: `5 km in miles`, `100 f to c`, `3 kg in lb`, `1 gb in mb`, `60 mph in km/h`
- Colors: `#ff6600` or `rgb(255, 102, 0)` gives hex, RGB and HSL with a preview
- `uuid`, `timestamp`, `timestamp 1700000000`, `base64 hello`, `unbase64 aGVsbG8=`

One color runs through the whole pill: YO's own (the one you pick in Customize). The panel's icons
are drawn in one ink and made of YO's parts (its eyes, visor, antenna, party hat); only those small
details take YO's color, and they blink or bob when you point at a tile.

## YO itself

YO is drawn and moved in code (`renderer/mascot.js`); nothing is an image file.

- It has springs: it squashes when it lands, its antenna wobbles, and its ears, bells and hats lag behind.
- It has little arms: it waves hello, cheers on success, raises a hand to ask, covers its eyes on errors.
- Its eyes blink, follow your pointer and look at what you type. There are 9 eye shapes
  (happy, wide, squint, sleepy, heart, star, dizzy and more).
- Particles: sparks, hearts, music notes, z's, a sweat drop.
- Hold YO to pet it. Boop its antenna three times and it gets dizzy.
- Leave the bar open and untouched for 20 seconds and YO dozes off. Move or type to wake it.
- The first time it shows up each day it says a proper hello.
- While it waits it lives a little: it yawns, stretches, looks around, hums, winks, or reads a tiny book.
- Emotes: type `dance`, `jump`, `hi yo`, `flip`, `spin` or `love you` (also YO's moves in the panel).
- Seasonal outfits, automatic by date: Ramadan lantern, Eid and New Year party hat, Halloween
  witch hat, winter beanie, summer sunglasses. They only fill what you left empty.

### Music

While YO is on screen it knows what's playing (Spotify, YouTube in the browser, any app that shows
up in Windows' media controls). It bops along and shows the song when it peeks out. It only asks Windows
while YO is visible and keeps nothing.

### Unlockables

Some looks are earned by using YO; you get one small "New!" moment, never a nag.

| Unlock | How |
|---|---|
| Propeller hat | Run 50 actions |
| Halo | Pet YO 10 times |
| Nightcap | Use YO after midnight |
| Grad cap | Copy 20 quick answers |
| Gold color | Use YO on 7 different days |

Locked items show a lock in Customize; click one to see how far you are.

### Customize YO (right-click the robot)

A live preview on the left, choices on the right. Everything saves as you click:

- Body: 8 colors (and gold, to earn); eyes classic, round or pixel in 5 colors; antenna tip
  (ball, heart, star, bolt, flower); a sticker (freckles, stripes, bolt, heart).
- Outfit: hat (beanie, party, witch, crown, cap, headphones, bow, plus the ones to earn); neck
  (scarf with a swinging tail, bow tie, a cape that flutters); glasses (sunglasses, round);
  holding (lantern, coffee mug, game controller); seasonal outfits.
- Pill: style (dark, smoke, tinted with YO's color, light), position (left, center, right), size.
- Sound: voice and volume.
- Saved: three outfit slots, and a look code (like `YO-3RF`) to share your YO with friends:
  paste one to wear it (anything you haven't unlocked yet falls back to the default).
- Seasonal outfits on or off, with what's on today and what comes next.
- Voice: Robot, Soft or Retro (8-bit), or Off; volume low, mid or high.
- "Surprise me" picks a random look; Reset goes back to the start.

Sounds are made in code too (`renderer/sound.js`): 21 sounds, each with variants and a small random
pitch change so they never repeat exactly. They play on key moments (arriving, opening, success,
reminders, approvals, petting, waking up...) and never on every keypress. The tray has a Sounds switch.

## Other things

- English only for now (French and Arabic strings are kept in `i18n.js` for later).
- Quit with `/quit` in the bar or from the tray menu.
- Hidden, YO uses almost nothing: about 0.2% of one CPU core (no animation runs while it's hidden)
  and about 150 MB of memory. The paste helper for the Clipboard app starts only when you open it.
- The mic button only shows the listening look for 3 seconds. Real voice comes later.
- A popup never steals focus from the app you are typing in.
- "Reduce motion" in Windows replaces the animations with short fades.

## Files

    main.js            hidden window, transparent, always on top, click-through
    main/              agent.js (YO's hands: checks, approvals, actions, reminders),
                       apps.js (installed apps), keys.js (the paste key), store.js (JSON files),
                       watch.js (what's playing), clipboard.js (clipboard history),
                       translate.js (asks MyMemory)
    preload.js         the only bridge to Electron (no Node in the page)
    renderer/          index.html, style.css, i18n.js, app.js,
                       mascot.js (YO's body and motion), sound.js (its voice),
                       commands.js (the action list), quick.js (quick answers), unlocks.js,
                       agent.js (asks the main process), mock-agent.js (demo, for a plain browser),
                       miniapps.js (what every mini app shares), apps/ (translate, calc, clipboard)
    scripts/           make-icons.js (draws the icons from the real YO)
    build/             icon.png and installer.nsh (installer settings)
    tests/             npm test (nothing real happens: Electron, keys, launching and the network are faked)

YO keeps its files in %APPDATA%\YO: settings.json (what you allowed "Always"), reminders.json,
apps.json (the installed apps it found), clips.json (clipboard items you kept with ★). Your look and sound choices are in the same folder.

## Next

- More mini apps (text tools, images, notes, QR, focus) once the first three have been tried.

