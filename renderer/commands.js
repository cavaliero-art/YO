(function (Y) {
  'use strict';

  // The actions YO knows. Each one belongs to a category, and the category picks YO's look.
  //   words: what the user may type first (longest first, so "remind me" wins over "remind")
  //   arg:   'text' needs something after the word, 'time' needs a number
  //   fill:  what the bar is filled with when the action is picked without its argument
  const svg = (paths) =>
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const SPEAKER = '<path d="M4 9v6h4l5 4V5L8 9z"/>';

  const LIST = [
    { id: 'open', category: 'apps', words: ['open', 'launch', 'start', 'go to'], arg: 'text', fill: 'open ',
      icon: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>') },
    { id: 'remind', category: 'time', words: ['remind me', 'remind', 'reminder'], arg: 'time', fill: 'remind me in ',
      icon: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>') },
    { id: 'timer', category: 'time', words: ['set a timer', 'timer', 'countdown'], arg: 'time', fill: 'timer ',
      icon: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>') },
    { id: 'play', category: 'media', words: ['play', 'pause', 'resume', 'music'],
      icon: svg('<path d="M8 5v14l11-7z"/>') },
    { id: 'next', category: 'media', words: ['next', 'skip'],
      icon: svg('<path d="M6 6l8 6-8 6zM18 6v12"/>') },
    { id: 'prev', category: 'media', words: ['previous', 'prev', 'back'],
      icon: svg('<path d="M18 6l-8 6 8 6zM6 6v12"/>') },
    { id: 'volup', category: 'media', words: ['volume up', 'vol up', 'turn up', 'louder'],
      icon: svg(SPEAKER + '<path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>') },
    { id: 'voldown', category: 'media', words: ['volume down', 'vol down', 'turn down', 'quieter'],
      icon: svg(SPEAKER + '<path d="M16 9a4 4 0 0 1 0 6"/>') },
    { id: 'mute', category: 'media', words: ['unmute', 'mute', 'silence'],
      icon: svg(SPEAKER + '<path d="M17 9l5 6M22 9l-5 6"/>') },
    { id: 'lock', category: 'system', words: ['lock my pc', 'lock screen', 'lock pc', 'lock'], risk: 'medium',
      icon: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') },
  ];
  const STARTERS = ['open', 'remind', 'play', 'lock', 'timer'];
  const CATEGORIES = ['system', 'media', 'apps', 'time'];

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
  function match(text, max) {
    const q = normalize(text);
    if (!q) return STARTERS.map(byId).slice(0, max);
    return LIST
      .map((c, i) => ({ c, s: score(c, q), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
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

  Y.commands = { LIST, CATEGORIES, byId, match, leadWord, argOf, ready, normalize };
})((window.Yo = window.Yo || {}));
