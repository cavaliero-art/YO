(function (Y) {
  'use strict';

  // English is the only maintained language for now. FR and AR are kept from v0.3
  // (names updated) and fall back to English for every newer string.
  const dict = {
    en: {
      dir: 'ltr', chip: 'EN',
      placeholder: 'Open, translate, calc, remind me…',
      welcome: "Hi, I'm YO. Press {key} to call me.",
      shortcutNow: 'Shortcut: {key}', shortcutTaken: '{wanted} is used by another app.',
      welcomeCard: {
        label: 'Welcome!',
        title: "Hi, I'm YO 👋",
        body: '•  Press {key} to call me, from anywhere.\n' +
          '•  The grid button has my apps: Translate, Calculator, Clipboard history.\n' +
          '•  Type what you want: "open spotify", "remind me in 10 min to stretch".\n' +
          '•  Right-click me to change my look. Drop a file or some text on me.\n' +
          'When you don\'t need me, I wait in the tray (bottom right). Its menu has Start with Windows and the shortcut.',
        apps: 'Show me the apps', ok: 'Got it',
      },
      noMatch: 'Nothing for that yet',
      noMatchHint: 'press ↓ to see everything',
      browse: 'All actions',
      listening: 'Listening…', working: 'Working…', needsOk: 'Needs your OK', done: 'Done',
      stop: 'Stop', deny: 'Deny', allow: 'Allow', always: 'Always',
      copy: 'Copy', close: 'Close', denied: 'Cancelled', voiceLabel: 'Voice',
      actions: 'Actions',
      risk: { low: 'Low risk', medium: 'Medium risk', high: 'High risk' },
      cmd: {
        open: 'Open an app, folder or site', remind: 'Remind me', timer: 'Start a timer', customize: 'Customize YO',
        dance: 'Dance', jump: 'Jump', wave: 'Wave hello', flip: 'Backflip', spin: 'Spin', love: 'Show some love',
        inbox: 'Inbox', translate: 'Translate', calc: 'Calculator', clipboard: 'Clipboard history',
        todo: 'To-do list', exam: 'Add an exam', focus: 'Focus (Pomodoro)', prayer: 'Prayer times',
      },
      short: {
        open: 'Open', remind: 'Remind me', timer: 'Timer', customize: 'Customize',
        dance: 'Dance', jump: 'Jump', wave: 'Wave', flip: 'Flip', spin: 'Spin', love: 'Love', inbox: 'Inbox',
        translate: 'Translate', calc: 'Calculator', clipboard: 'Clipboard', todo: 'To-do', exam: 'Exam', focus: 'Focus', prayer: 'Prayer',
      },
      // mini apps (renderer/apps/)
      app: {
        back: 'All apps', close: 'Close', copied: 'Copied!',
        sub: {
          translate: 'Any language', calc: 'Math, units, %', clipboard: 'What you copied',
          open: 'Apps, sites, folders', remind: 'Later, for you', timer: 'Countdown', inbox: 'Your news', todo: 'Tasks and exams', focus: 'Pomodoro with YO', prayer: 'Times and reminders',
          customize: 'Make YO yours',
        },
        moves: "YO's moves", unread: '{n} new', todoLeft: '{n} left today',
        translate: {
          detect: 'Detect', swap: 'Swap languages', placeholder: 'Type or paste text…', from: 'From', to: 'To',
          detected: 'Detected: {lang}', working: 'Translating…', fromClip: 'From your clipboard', cut: 'Only the first 500 characters',
          note: 'Sent to MyMemory to translate · needs internet', recent: 'Recent',
          error: {
            net: "Can't reach the translator. Are you online?", quota: 'Daily limit reached, try again tomorrow',
            service: "The translator couldn't do that one", lang: 'Pick a language', app: 'Translate works in the YO app',
          },
        },
        calc: { placeholder: '12 × 7, 20% of 150, 5 km in miles', history: 'History', empty: 'Press Enter to keep a result here', clear: 'Clear', bad: "Can't work that out" },
        clipboard: {
          search: 'Search what you copied…', pause: 'Pause', resume: 'Resume', clear: 'Clear', empty: 'Copy some text and it shows up here',
          none: 'Nothing matches', paused: 'Paused: new copies are not kept', hint: 'Enter pastes · Ctrl+Enter copies · ★ keeps it',
          privacy: 'Text only, on this PC. Cleared when YO quits, except ★. Passwords are skipped.',
          pin: 'Keep (★)', unpin: 'Unpin', remove: 'Remove', app: 'Clipboard history works in the YO app', full: 'Up to 20 ★',
          kind: { link: 'Link', color: 'Color', email: 'Email', number: 'Number', code: 'Code', text: 'Text' },
          now: 'now',
        },
      },
      cat: { recent: 'Recent', apps: 'Apps', time: 'Time', media: 'Media', tools: 'Tools', fun: 'Fun', system: 'System' },
      pinTip: 'Click to run · Right-click to pin',
      inbox: { title: 'Inbox', new: '{n} new', clear: 'Clear', empty: 'Nothing here yet. Reminders, timers and unlocks show up here.' },
      quick: {
        hex: 'Hex', rgb: 'RGB', hsl: 'HSL', uuid: 'New UUID', unix: 'Unix time', iso: 'ISO 8601', local: 'Local time',
        base64: 'Base64', decoded: 'Decoded',
      },
      copied: 'Copied {v}',
      prayer: {
        name: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
        next: 'Next: {name}', in: 'in {t}', now: 'now', suhoor: 'Suhoor ends', iftar: 'Iftar',
        prayed: 'Prayed', markPrayed: 'Mark as prayed', bellOn: 'Reminder on', bellOff: 'Reminder off',
        settings: 'Settings', back: 'Done', where: 'Where are you?', whereHint: 'Pick your city: prayer times are worked out on this PC, nothing is sent.',
        search: 'Search a city…', coords: 'Or coordinates: 36.80, 10.18', useCoords: 'Use these', badCoords: 'Write them like 36.80, 10.18',
        set: { place: 'Location', method: 'Method', asr: 'Asr', before: 'Heads-up before', sound: 'Sound', quiet: 'Quiet after prayer', adjust: 'Adjust (minutes)' },
        asr: { shafi: 'Standard', hanafi: 'Hanafi' }, off: 'Off', min: '{n} min', soft: 'Soft tone', silent: 'Silent',
        card: { title: 'Time for {name}', body: 'May Allah accept your prayer.', soon: '{name} in {n} minutes', soonBody: 'At {time} · {place}',
          prayed: 'I prayed ✓', snooze: 'Snooze 10 min', open: 'Prayer times' },
        localTime: 'Times in {place} time',
        quotes: [
          ['Indeed, prayer prohibits immorality and wrongdoing.', 'Qur\'an 29:45'],
          ['And seek help through patience and prayer.', 'Qur\'an 2:45'],
          ['Verily, in the remembrance of Allah do hearts find rest.', 'Qur\'an 13:28'],
        ],
      },
      focus: {
        phase: { focus: 'Focus time', short: 'Break time', long: 'Long break' },
        start: 'Start', pause: 'Pause', resume: 'Resume', skip: 'Skip', reset: 'Reset',
        rounds: 'Rounds', session: 'Session', today: 'Today', min: '{n} min', sessions: '{n} sessions · {m} min',
        on: 'Focus on', none: 'Nothing in particular', sound: 'Sound', settings: 'Settings', back: 'Done',
        snd: { off: 'Off', rain: 'Rain', deep: 'Deep' },
        set: { focus: 'Focus length', short: 'Short break', long: 'Long break', rounds: 'Rounds before a long break',
          autoBreak: 'Start breaks by itself', endSound: 'Sound when a session ends' },
        say: {
          ready: 'Ready when you are.', go: 'You got this!', half: 'Halfway there!', last: 'Last 5 minutes!',
          paused: 'Paused. Take your time.', breakShort: 'Take a break! Stretch, drink some water.',
          breakEyes: 'Break! Look at something far away for 20 seconds.', breakLong: 'Long break. You earned it!',
          back: 'Break over. Ready for the next one?', done: 'Focus complete!',
        },
        card: { title: 'Focus complete!', body: 'Great work! Time for a {n} min break.', bodyLong: 'Great work, all rounds done! Time for a long break.',
          task: 'Did you finish "{task}"?', breakOver: 'Break over', breakBody: 'Ready for the next focus session?',
          startBreak: 'Start break', markDone: 'Mark done', open: 'Open Focus', startFocus: 'Start focus' },
        status: { focus: 'Focus {t}', break: 'Break {t}' },
      },
      todo: {
        placeholder: 'Add a task: math homework friday 18:00 #math',
        today: 'Today', upcoming: 'Upcoming', done: 'Done', anytime: 'Anytime', late: 'Late',
        all: 'All', clear: 'Clear done', exam: 'Exam', star: 'Important', unstar: 'Not important', remove: 'Remove',
        added: 'Added!', allDone: 'All done for today!', nice: 'Nice, one less!', markDone: 'Mark done', openList: 'Open to-do',
        emptyToday: 'Nothing for today. Add one above, or enjoy the free time.',
        emptyUpcoming: 'Nothing planned yet. Try "essay next week" or "exam math 12/11".',
        emptyDone: 'Ticked tasks show up here for a month.',
        hint: 'Enter adds · dates like friday, tomorrow, 12/11 · 18:00 · #subject · ! important · "exam ..."',
        examIn: '{name} exam {when}', inDays: 'in {n} days', soonTomorrow: 'tomorrow', soonToday: 'today',
        when: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' },
        app: 'To-do works in the YO app',
      },
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
        open: 'open spotify', remind: 'remind me in 20 min to stretch', timer: 'timer 25 min', customize: 'customize',
        dance: 'dance', jump: 'jump', wave: 'hi yo', flip: 'flip', spin: 'spin', love: 'love you', inbox: 'inbox',
        translate: 'tr hola to english', calc: 'calc 12*7', clipboard: 'clip',
        todo: 'todo math homework friday 18:00 #math', exam: 'exam physics 12/11', focus: 'focus on math homework', prayer: 'prayer',
      },
      openDone: 'Would open “{arg}” (demo)',
      openWhat: 'Open what? Try “open spotify”',
      needWhen: 'When? Try “in 10 min”',
      reminderSet: "Okay, I'll remind you in {when}",
      timerSet: 'Timer set for {when}',
      timerDone: "Time's up",
      reminderBody: 'You asked {when} ago.',
      hint: 'Try “open spotify”, “translate hola” or “remind me in 10 min”',
      customize: 'Customize YO', done: 'Done', surprise: 'Surprise me', reset: 'Reset',
      heroTip: 'Click to type · Hold to pet · Right-click to customize',
      custom: {
        color: 'Color', eyes: 'Eyes', hat: 'Hat', glasses: 'Glasses', item: 'Holding',
        seasonal: 'Seasonal', voice: 'Voice', volume: 'Volume', tip: 'Antenna', sticker: 'Sticker', neck: 'Neck',
        pillStyle: 'Style', position: 'Position', size: 'Size',
      },
      tab: { body: 'Body', outfit: 'Outfit', pill: 'Pill', sound: 'Sound', saved: 'Saved' },
      pill: {
        pillStyle: { dark: 'Dark', smoke: 'Smoke', tint: 'Tinted', light: 'Light' },
        position: { left: 'Left', center: 'Center', right: 'Right' },
        size: { small: 'Small', normal: 'Normal', large: 'Large' },
      },
      saved: {
        empty: 'Empty', save: 'Save current', wear: 'Wear', replace: 'Save here', done: 'Saved!',
        wearing: 'Looking good!', code: 'Code', paste: 'Paste a code', apply: 'Use', applied: 'New look!',
        bad: "That code doesn't look right", locked: 'Some of it is still locked',
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
        neck: { none: 'None', scarf: 'Scarf', bowtie: 'Bow tie', cape: 'Cape' },
        tip: { ball: 'Ball', heart: 'Heart', star: 'Star', bolt: 'Bolt', flower: 'Flower' },
        sticker: { none: 'None', freckles: 'Freckles', stripes: 'Stripes', bolt: 'Bolt', heart: 'Heart' },
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
