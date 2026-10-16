(function (Y) {
  'use strict';

  // English is the only maintained language for now. FR and AR are kept from v0.3
  // (names updated) and fall back to English for every newer string.
  const dict = {
    en: {
      dir: 'ltr', chip: 'EN',
      placeholder: 'Open, play, lock, remind me…',
      welcome: "Hi, I'm YO. Press {key} to call me.",
      noMatch: 'Nothing for that yet',
      noMatchHint: 'press ↓ to see everything',
      browse: 'All actions',
      listening: 'Listening…', working: 'Working…', needsOk: 'Needs your OK', done: 'Done',
      stop: 'Stop', deny: 'Deny', allow: 'Allow', always: 'Always',
      copy: 'Copy', close: 'Close', denied: 'Cancelled', voiceLabel: 'Voice',
      actions: 'Actions',
      risk: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
      cmd: {
        open: 'Open an app, folder or site', remind: 'Remind me', timer: 'Start a timer',
        play: 'Play / pause', next: 'Next track', prev: 'Previous track',
        volup: 'Volume up', voldown: 'Volume down', mute: 'Mute / unmute', lock: 'Lock this PC',
      },
      short: {
        open: 'Open…', remind: 'Remind me…', timer: 'Timer…',
        play: 'Play', next: 'Next', prev: 'Prev', volup: 'Vol +', voldown: 'Vol −', mute: 'Mute',
        lock: 'Lock PC',
      },
      cat: { apps: 'Apps', time: 'Time', media: 'Media', tools: 'Tools', system: 'System' },
      tool: { math: 'Calculator', uuid: 'UUID', time: 'Timestamp', color: 'Color', base64: 'Base64', units: 'Units' },
      quick: {
        hex: 'Hex', rgb: 'RGB', hsl: 'HSL', uuid: 'New UUID', unix: 'Unix time', iso: 'ISO 8601', local: 'Local time',
        base64: 'Base64', decoded: 'Decoded',
      },
      copied: 'Copied {v}',
      drop: {
        one: 'Yum, a file!', many: 'Yum, {n} files!', files: '{name} and {n} more', text: 'Yum, some text!',
        copyPath: 'Copy path', reveal: 'Show in folder', open: 'Open', openLink: 'Open link', remind: 'Remind me',
        count: '{w} words · {c} characters',
      },
      unlock: { title: 'New: {name}!', body: 'You unlocked it by using YO. Want to try it on?', tryOn: 'Try it on', wearing: 'Looking good!' },
      lock: {
        actions: 'Run {need} actions ({have}/{need})', pets: 'Pet YO {need} times ({have}/{need})',
        nights: 'Use YO after midnight', answers: 'Copy {need} quick answers ({have}/{need})',
        days: 'Use YO on {need} different days ({have}/{need})',
      },
      target: { app: 'App', folder: 'Folder', site: 'Website' },
      copyFailed: "Couldn't copy that",
      example: {
        open: 'open spotify', remind: 'remind me in 20 min to stretch', timer: 'timer 25 min',
        play: 'play', next: 'next', prev: 'previous', volup: 'louder', voldown: 'quieter', mute: 'mute', lock: 'lock',
      },
      lockTitle: 'Lock this PC', lockBody: 'YO wants to lock your workstation.',
      lockedDone: 'PC would lock now (demo)',
      mediaDone: '{title} (demo)',
      openDone: 'Would open “{arg}” (demo)',
      openWhat: 'Open what? Try “open spotify”',
      needWhen: 'When? Try “in 10 min”',
      reminderSet: "Okay, I'll remind you in {when}",
      timerSet: 'Timer set for {when}',
      timerDone: "Time's up",
      reminderBody: 'You asked {when} ago.',
      hint: 'Try “open spotify”, “play” or “remind me in 10 min”',
      customize: 'Customize YO', done: 'Done', surprise: 'Surprise me', reset: 'Reset',
      heroTip: 'Click to type · Hold to pet · Right-click to customize',
      custom: {
        color: 'Color', eyes: 'Eyes', hat: 'Hat', glasses: 'Glasses', item: 'Holding',
        seasonal: 'Seasonal', voice: 'Voice', volume: 'Volume',
      },
      look: {
        color: { mint: 'Mint', sky: 'Sky', coral: 'Coral', lilac: 'Lilac', lemon: 'Lemon', bubblegum: 'Bubblegum', snow: 'Snow', graphite: 'Graphite', gold: 'Gold' },
        eyeColor: { mint: 'Mint eyes', white: 'White eyes', amber: 'Amber eyes', pink: 'Pink eyes', cyan: 'Cyan eyes' },
        eyes: { classic: 'Classic', round: 'Round', pixel: 'Pixel' },
        hat: {
          none: 'None', winter: 'Beanie', party: 'Party', witch: 'Witch', crown: 'Crown', cap: 'Cap', headphones: 'Headphones', bow: 'Bow',
          propeller: 'Propeller', nightcap: 'Nightcap', halo: 'Halo', grad: 'Grad cap',
        },
        glasses: { none: 'None', sun: 'Sunglasses', round: 'Round' },
        item: { none: 'Nothing', lantern: 'Lantern', mug: 'Mug', controller: 'Controller' },
      },
      voice: { robot: 'Robot', soft: 'Soft', retro: 'Retro', off: 'Off' },
      volume: { 1: 'Low', 2: 'Mid', 3: 'High' },
      seasonOn: 'On', seasonOff: 'Off',
      season: { lantern: 'Ramadan lantern', party: 'party hat', witch: 'Halloween witch hat', winter: 'winter beanie', sun: 'summer sunglasses' },
      seasonToday: 'Today: {name}', seasonNone: 'Nothing today', seasonNext: 'next: {name} on {date}',
      seasonAll: 'Includes Ramadan lantern, Eid & New Year party hat, Halloween witch hat, winter beanie, summer sunglasses.',
      seasonRule: 'A seasonal outfit only fills what you left empty: your own picks always win.',
    },
    fr: {
      dir: 'ltr', chip: 'FR',
      placeholder: {
        assistant: 'Demande à YO ou tape une commande',
        browser: 'Cherche ou pose une question sur le web',
        dev: 'Pose une question sur le code ou lance une commande',
      },
      mode: { assistant: 'Assistant', browser: 'Web', dev: 'Dev' },
      welcome: "Je suis là. Appuie sur {key} pour m'appeler.",
      tabHint: 'Ctrl+Tab pour changer',
      listening: "J'écoute…", working: 'Je travaille…', needsOk: 'Besoin de ton accord', done: 'Terminé',
      stop: 'Arrêter', deny: 'Refuser', allow: 'Autoriser', always: 'Toujours',
      copy: 'Copier', close: 'Fermer', denied: 'Annulé', voiceLabel: 'Voix',
      risk: { low: 'Risque faible', medium: 'Risque moyen', high: 'Risque élevé' },
      lockTitle: 'Verrouiller ce PC', lockBody: 'YO veut verrouiller ton ordinateur.',
      lockedDone: 'Le PC se verrouillerait maintenant (démo)', musicDone: 'Lecture de lofi (démo)',
      testTitle: 'Lancer les tests', testBody: 'YO veut exécuter : npm test',
      testResultTitle: 'Tests réussis', testResultBody: 'Résultat de démo : les 14 tests passent.',
      explainTitle: 'Code expliqué', explainBody: "Résultat de démo : l'explication apparaîtra ici.",
      steps: {
        search: 'Recherche sur le web…', read: 'Lecture de 3 sources…', write: 'Rédaction du résumé…',
        test: 'Exécution des tests…', readCode: 'Lecture du code…',
      },
      summaryTitle: 'Résumé prêt',
      summaryBody: 'Résultat de démo : la réponse de YO apparaîtra ici.',
      sources: '3 sources',
      hint: {
        assistant: 'Démo : essaie « verrouille le pc » ou « joue de la musique »',
        dev: 'Démo : essaie « lance les tests » ou « explique ce code »',
      },
    },
    ar: {
      dir: 'rtl', chip: 'ع',
      placeholder: {
        assistant: 'اسأل يو أو اكتب أمرًا',
        browser: 'ابحث أو اسأل عن شيء في الويب',
        dev: 'اسأل عن الكود أو شغّل أمرًا',
      },
      mode: { assistant: 'المساعد', browser: 'الويب', dev: 'المطوّر' },
      welcome: 'أنا هنا. اضغط {key} لاستدعائي.',
      tabHint: 'Ctrl+Tab للتبديل',
      listening: 'أنا أسمع…', working: 'أعمل على ذلك…', needsOk: 'أحتاج موافقتك', done: 'تم',
      stop: 'إيقاف', deny: 'رفض', allow: 'سماح', always: 'دائمًا',
      copy: 'نسخ', close: 'إغلاق', denied: 'تم الإلغاء', voiceLabel: 'صوت',
      risk: { low: 'خطر منخفض', medium: 'خطر متوسط', high: 'خطر مرتفع' },
      lockTitle: 'قفل هذا الكمبيوتر', lockBody: 'يو يريد قفل جهازك.',
      lockedDone: 'سيتم قفل الجهاز الآن (تجريبي)', musicDone: 'تشغيل موسيقى لوفي (تجريبي)',
      testTitle: 'تشغيل الاختبارات', testBody: 'يو يريد تنفيذ: npm test',
      testResultTitle: 'نجحت الاختبارات', testResultBody: 'نتيجة تجريبية: نجحت كل الاختبارات الأربعة عشر.',
      explainTitle: 'تم شرح الكود', explainBody: 'نتيجة تجريبية: سيظهر الشرح هنا.',
      steps: {
        search: 'جارٍ البحث في الويب…', read: 'جارٍ قراءة 3 مصادر…', write: 'جارٍ كتابة الملخص…',
        test: 'جارٍ تشغيل الاختبارات…', readCode: 'جارٍ قراءة الكود…',
      },
      summaryTitle: 'الملخص جاهز',
      summaryBody: 'نتيجة تجريبية: هنا ستظهر إجابة يو.',
      sources: '3 مصادر',
      hint: {
        assistant: 'تجريبي: جرّب «اقفل الكمبيوتر» أو «شغل موسيقى»',
        dev: 'تجريبي: جرّب «شغّل الاختبارات» أو «اشرح هذا الكود»',
      },
    },
  };

  const LANGS = ['en', 'fr', 'ar'];
  let current = 'en';

  function lookup(lang, key) {
    return key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), dict[lang]);
  }

  function t(key) {
    const value = lookup(current, key);
    return typeof value === 'string' ? value : lookup('en', key) || key;
  }

  function setLang(code) {
    if (!dict[code]) return;
    current = code;
    document.documentElement.lang = code;
    document.documentElement.dir = dict[code].dir;
  }

  function fromLocale(locale) {
    const base = String(locale || '').slice(0, 2).toLowerCase();
    return dict[base] ? base : 'en';
  }

  Y.i18n = {
    LANGS,
    t,
    setLang,
    getLang: () => current,
    nextLang: () => LANGS[(LANGS.indexOf(current) + 1) % LANGS.length],
    fromLocale,
    hasArabicScript: (text) => /[\u0600-\u06FF]/.test(text),
  };
})((window.Yo = window.Yo || {}));
