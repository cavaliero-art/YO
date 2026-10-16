(function (Y) {
  'use strict';

  // The actions YO knows. Each one belongs to a category, and the category picks YO's look.
  //   words: what the user may type first (longest first, so "remind me" wins over "remind")
  //   arg:   'text' needs something after the word, 'time' needs a number
  //   fill:  what the bar is filled with when the action is picked without its argument
  const svg = (paths) =>
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';

  const LIST = [
    { id: 'open', category: 'apps', words: ['open', 'launch', 'start', 'go to'], arg: 'text', fill: 'open ',
      icon: svg('<path d="M14 4.5h-7a3 3 0 0 0-3 3v9.5a3 3 0 0 0 3 3h9.5a3 3 0 0 0 3-3V10"/><path class="al" d="M11 13l9-9M14.5 4H20v5.5"/>') },
    { id: 'remind', category: 'time', words: ['remind me', 'remind', 'reminder'], arg: 'time', fill: 'remind me in ',
      icon: svg('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10.5 20.5h3"/><g class="bob"><path d="M12 5.5V3.6"/><circle class="a" cx="12" cy="2.6" r="1.5"/></g>') },
    { id: 'timer', category: 'time', words: ['set a timer', 'timer', 'countdown'], arg: 'time', fill: 'timer ',
      icon: svg('<circle cx="12" cy="13.5" r="7"/><g class="bob"><path d="M12 6.5V4"/><circle class="a" cx="12" cy="3" r="1.5"/></g><path class="al" d="M12 13.5V10M12 13.5l2.5 1.5"/>') },
  ];
  // The home-panel icons are made of YO: its eyes, visor, antenna and party hat, drawn in one ink.
  // In them, class "a" is filled with YO's own color and "al" is a line in it; "blink" and "bob" move on hover.
  // icons for what "open" found: an app, a folder, a site
  const TARGET_ICONS = {
    app: svg('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>'),
    folder: svg('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    site: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>'),
  };
  LIST.push({ id: 'inbox', category: 'system', words: ['inbox', 'messages', 'notifications', 'missed'],
    icon: svg('<path d="M3.5 13.5l2.4-7a2 2 0 0 1 1.9-1.5h8.4a2 2 0 0 1 1.9 1.5l2.4 7v4.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5"/><rect class="a blink" x="9" y="8.4" width="1.8" height="3" rx=".9"/><rect class="a blink" x="13.2" y="8.4" width="1.8" height="3" rx=".9"/>') });
  // mini apps: each opens inside the pill (renderer/apps/); what you type after the word fills it in
  //   tint: the app's color (a category color)
  LIST.push(
    { id: 'translate', category: 'tools', app: 'translate', tint: 'media', words: ['translate', 'translator', 'tr'],
      icon: svg('<path d="M4 6.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-4 3.5v-3.5a3 3 0 0 1-3-3z"/><rect class="a blink" x="8.6" y="8" width="1.8" height="3.4" rx=".9"/><rect class="a blink" x="13.6" y="8" width="1.8" height="3.4" rx=".9"/>') },
    { id: 'calc', category: 'tools', app: 'calc', tint: 'tools', words: ['calculator', 'calculate', 'calc'],
      icon: svg('<rect x="4" y="3.5" width="16" height="17" rx="5"/><rect x="7" y="7" width="10" height="5.5" rx="2.75"/><path class="al" d="M9.5 9h5M9.5 10.6h5"/><path d="M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>') },
    { id: 'clipboard', category: 'tools', app: 'clipboard', tint: 'system', words: ['clipboard', 'paste history', 'clips', 'clip'],
      icon: svg('<rect x="5.5" y="6" width="13" height="15" rx="3"/><g class="bob"><path d="M12 6V3.6"/><circle class="a" cx="12" cy="2.6" r="1.5"/></g><path d="M9 11h6M9 14h6M9 17h3.5"/>') }
  );
  // emotes: YO does them right away, nothing leaves the page
  LIST.push(
    { id: 'dance', category: 'fun', words: ['dance', 'boogie'], icon: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>') },
    { id: 'jump', category: 'fun', words: ['jump', 'hop'], icon: svg('<path d="M12 19V5M6 11l6-6 6 6"/>') },
    { id: 'wave', category: 'fun', words: ['hi yo', 'wave', 'hello', 'hi'], icon: svg('<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-12 4l-2.5-3a1.5 1.5 0 0 1 2.3-2L7 12"/>') },
    { id: 'flip', category: 'fun', words: ['backflip', 'flip'], icon: svg('<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>') },
    { id: 'spin', category: 'fun', words: ['spin', 'twirl'], icon: svg('<path d="M12 3a9 9 0 1 0 9 9M21 3v6h-6"/>') },
    { id: 'love', category: 'fun', words: ['love you', 'love', 'hug'], icon: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>') }
  );
  // Customize: opens YO's look (right-click does the same); a tile on the home panel
  LIST.push({ id: 'customize', category: 'system', words: ['customize', 'customise', 'outfit', 'look'],
    icon: svg('<path d="M12 3.5l6.5 14.5h-13z"/><path d="M8 13l3 1.5M10 8.6l3 1.6M6.6 16l4.6 2"/><circle class="a bob" cx="12" cy="3" r="1.7"/><path d="M4 19.5h16"/>') });
  const STARTERS = ['open', 'translate', 'calc', 'remind', 'timer'];
  const CATEGORIES = ['system', 'apps', 'time', 'tools', 'fun'];

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const byId = (id) => LIST.find((c) => c.id === id) || null;

  function score(cmd, q) {
    let best = 0;
    for (const w of cmd.words) {
      if (q === w) best = Math.max(best, 6);
      else if (q.startsWith(w + ' ')) best = Math.max(best, 5);
      else if (w.startsWith(q)) best = Math.max(best, 4);
      else if (w.includes(q)) best = Math.max(best, 2);
    }
    if (!best && normalize(Y.i18n.t('cmd.' + cmd.id)).includes(q)) best = 1;
    return best;
  }

  // best matches first; an empty bar shows a few starters
  function match(text, max, rank) {
    const q = normalize(text);
    if (!q) return STARTERS.map(byId).slice(0, max);
    return LIST
      .map((c, i) => ({ c, s: score(c, q), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || (rank ? rank(b.c.id) - rank(a.c.id) : 0) || a.i - b.i)
      .slice(0, max)
      .map((x) => x.c);
  }

  // the word the text starts with, if any ("open spotify" -> "open")
  function leadWord(cmd, text) {
    const low = normalize(text);
    return cmd.words.find((w) => low === w || low.startsWith(w + ' ')) || null;
  }

  // what comes after the word ("open spotify" -> "spotify")
  function argOf(cmd, text) {
    const raw = String(text || '').trim().replace(/\s+/g, ' ');
    const word = leadWord(cmd, raw);
    return word ? raw.slice(word.length).trim() : '';
  }

  function ready(cmd, text) {
    if (!cmd.arg) return true;
    const arg = argOf(cmd, text);
    return cmd.arg === 'time' ? /\d/.test(arg) : arg.length > 0;
  }

  Y.commands = { LIST, CATEGORIES, TARGET_ICONS, byId, match, leadWord, argOf, ready, normalize };
})((window.Yo = window.Yo || {}));
