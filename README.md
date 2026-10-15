# YO v0.4: one robot, real-looking actions

A small desktop companion that hangs from the top of your screen in a black pill.
It stays hidden until you call it, or until something you asked for needs you.
Still a demo: actions don't touch your PC yet (Stage 3). Reminders and timers are real.

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

## What it knows (demo)

- Apps: `open spotify` (also folders and sites later)
- Time: `remind me in 20 min to stretch`, `timer 25 min` (these really fire)
- Media: `play`, `next`, `previous`, `louder`, `quieter`, `mute`
- System: `lock` asks for your OK first; "Always" remembers it until you restart

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
    preload.js         the only bridge to Electron (no Node in the page)
    renderer/          index.html, style.css, i18n.js, app.js,
                       mascot.js (YO's body and motion), sound.js (its voice),
                       commands.js (the action list), mock-agent.js (demo agent)

## Next

- Stage 3: real actions in the main process (lock, media keys, volume, open apps/folders/sites),
  settings and an inbox saved to disk.
- Stage 4: tray settings (start at login, shortcut picker), Windows installer, tests.
