# YO v0.5: a little robot with real hands

A small desktop companion that hangs from the top of your screen in a black pill.
It stays hidden until you call it, or until something you asked for needs you.
Its actions are real: it opens your apps, folders and sites, controls your music and volume,
locks your PC (after asking) and keeps your reminders, even across restarts.

## Run it (Windows)

1. Install Node.js LTS from https://nodejs.org
2. In this folder:

       npm install
       npm start

YO slides down once to say hello, then hides in the tray (bottom right).

## How it behaves

1. Call it with `Ctrl+Space` (fallback `Ctrl+Alt+Y`). The black pill slides down from the top
   edge and the robot drops in.
2. Click the robot, or just start typing. Matching actions appear under the bar as you type.
   `↑` `↓` pick, `Enter` runs. Actions that need more ("open …", "remind me in …") fill the bar first.
   The grid button (or `↓` / `Enter` on an empty bar) shows every action, grouped by category.
3. `Esc` closes. If you do nothing, YO leaves after 7 seconds.

When something needs you (a reminder, an approval), YO comes back alone and says it inside the pill.
Click it, or press the shortcut, to open the card. If you're busy typing, it waits until you're done.

## What it does

- Open: `open spotify` finds the app among those installed (normal and Store apps; `vsc` works too),
  `open downloads` / `documents` / `desktop`..., `open github.com`, or `open C:\some\folder`.
  Typing `open spo` already suggests Spotify by name.
- Time: `remind me in 20 min to stretch`, `timer 25 min`. Saved to disk: they survive a restart,
  and one that came due while YO was closed is delivered when it starts, marked as missed.
- Media: `play`, `next`, `previous`, `louder`, `quieter`, `mute` press the real media keys.
- System: `lock` locks the PC after your OK. "Always" is remembered on disk.

Safety: the page never runs anything itself. It asks the main process, which checks every request
again. Opening a program or script file (.exe, .bat, .ps1...) always asks first and never offers
"Always". Sites open only as http/https.

### Drop things on YO

Drag a file or some text onto YO: it opens its mouth, then eats it.

- A file: copy its path, show it in its folder, or open it (programs still ask first).
- Text: turn it into a reminder ("remind me in 10 min to ..."), or copy it. A link: open it.

### Quick answers

Type and the answer shows up as the first row; `Enter` copies it. They're also in the Tools row of the
actions panel.

- Math: `12*7`, `= sqrt(16) + 2`, `2^10`, `20% of 150` (worked out by YO's own parser; nothing you type is run as code)
- Units: `5 km in miles`, `100 f to c`, `3 kg in lb`, `1 gb in mb`, `60 mph in km/h`
- Colors: `#ff6600` or `rgb(255, 102, 0)` gives hex, RGB and HSL with a preview
- `uuid`, `timestamp`, `timestamp 1700000000`, `base64 hello`, `unbase64 aGVsbG8=`

YO changes its look with what it's doing: teal for system, blue with a ring for media,
coral with ears for apps, violet with bells for time.

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
- Seasonal outfits, automatic by date: Ramadan lantern, Eid and New Year party hat, Halloween
  witch hat, winter beanie, summer sunglasses. They only fill what you left empty.

### Music

While YO is on screen it knows what's playing (Spotify, YouTube in the browser, any app that shows
up in Windows' media controls). It bops along, shows the song when it peeks out, and names the new
song after `next` or `previous`. It only asks Windows while YO is visible and keeps nothing.

### Walk on the taskbar

Type `walk` (or use the tray: Walk on the taskbar). When the pill is away, YO walks along the top
of your taskbar: it strolls, looks around, naps, and waves when your pointer comes close.
Hold it to pet it, boop its antenna, double-click it to open the pill. It steps aside while a
fullscreen app (a game, a video) is in front, and while the pill is open.

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

- Color: 8 body colors. Eyes: classic, round or pixel, in 5 colors.
- Hat: beanie, party, witch, crown, cap, headphones, bow.
- Glasses: sunglasses or round "dev" glasses. Holding: lantern, coffee mug, game controller.
- Seasonal outfits on or off, with what's on today and what comes next.
- Voice: Robot, Soft or Retro (8-bit), or Off; volume low, mid or high.
- "Surprise me" picks a random look; Reset goes back to the start.

Sounds are made in code too (`renderer/sound.js`): 21 sounds, each with variants and a small random
pitch change so they never repeat exactly. They play on key moments (arriving, opening, success,
reminders, approvals, petting, waking up...) and never on every keypress. The tray has a Sounds switch.

## Other things

- English only for now (French and Arabic strings are kept in `i18n.js` for later).
- Quit with `/quit` in the bar or from the tray menu.
- The mic button only shows the listening look for 3 seconds. Real voice comes later.
- A popup never steals focus from the app you are typing in.
- "Reduce motion" in Windows replaces the animations with short fades.

## Files

    main.js            hidden window, transparent, always on top, click-through
    main/              agent.js (YO's hands: checks, approvals, actions, reminders),
                       apps.js (installed apps), keys.js (media keys), store.js (JSON files),
                       watch.js (what's playing, fullscreen check), walker.js (the taskbar walk)
    preload.js         the only bridge to Electron (no Node in the page)
    renderer/          index.html, style.css, i18n.js, app.js,
                       mascot.js (YO's body and motion), sound.js (its voice),
                       commands.js (the action list), quick.js (quick answers), unlocks.js,
                       walker.html / walker.js / walker.css (YO on the taskbar),
                       agent.js (asks the main process), mock-agent.js (demo, for a plain browser)
    tests/             npm test (nothing real happens: Electron, keys, launching and lock are faked)

YO keeps its files in %APPDATA%\YO: settings.json (what you allowed "Always"), reminders.json,
apps.json (the installed apps it found). Your look and sound choices are in the same folder.

## Next

- An inbox for missed messages (reminders are already kept until you see them).
- Stage 4: tray settings (start at login, shortcut picker), Windows installer, tests.

