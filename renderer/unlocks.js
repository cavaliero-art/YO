(function (Y) {
  'use strict';

  // Things YO earns by being used, unlocked quietly (one small "new!" moment, never a nag).
  // Counts stay on this PC (window storage), like the rest of YO's look.
  const KEY = 'yo.stats';
  const RULES = [
    { slot: 'hat', value: 'propeller', stat: 'actions', need: 50 },
    { slot: 'hat', value: 'halo', stat: 'pets', need: 10 },
    { slot: 'hat', value: 'nightcap', stat: 'nights', need: 1 },
    { slot: 'hat', value: 'grad', stat: 'answers', need: 20 },
    { slot: 'color', value: 'gold', stat: 'days', need: 7 },
    { slot: 'tip', value: 'sprout', stat: 'habitRun', need: 7 },
    // the Habits packs: each one's own reward, for the best run of a habit from that pack
    { slot: 'item', value: 'bottle', stat: 'habitWater', need: 7 },
    { slot: 'hat', value: 'sweatband', stat: 'habitBody', need: 7 },
    { slot: 'neck', value: 'backpack', stat: 'habitBac', need: 7 },
    { slot: 'item', value: 'fanous', stat: 'habitRamadan', need: 29 },
  ];
  const FRESH = { actions: 0, pets: 0, nights: 0, answers: 0, habitRun: 0, habitWater: 0, habitBody: 0, habitBac: 0, habitRamadan: 0, days: [], unlocked: [] };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign(JSON.parse(JSON.stringify(FRESH)), saved);
    } catch (err) {
      return JSON.parse(JSON.stringify(FRESH));
    }
  }

  let stats = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (err) { /* counts just won't persist */ }
  }

  const have = (rule) => (rule.stat === 'days' ? stats.days.length : stats[rule.stat] || 0);
  const id = (rule) => rule.slot + ':' + rule.value;
  const ruleFor = (slot, value) => RULES.find((r) => r.slot === slot && r.value === value) || null;

  // something happened: 'actions', 'pets', 'answers', 'visit' (a day, and a night after midnight),
  // or 'habitRun' / 'habitWater' / 'habitBody' / 'habitBac' / 'habitRamadan' with the longest run of a habit
  // so far, overall or from that pack (Habits); returns the rules it just unlocked
  function record(kind, date, value) {
    const now = date || new Date();
    if (/^habit(Run|Water|Body|Bac|Ramadan)$/.test(kind)) {
      stats[kind] = Math.max(stats[kind] || 0, Number(value) || 0);
    } else if (kind === 'visit') {
      const day = now.toLocaleDateString('en-CA'); // local date, YYYY-MM-DD
      if (stats.days.indexOf(day) === -1) stats.days.push(day);
      if (stats.days.length > 60) stats.days = stats.days.slice(-60);
      if (now.getHours() < 5) stats.nights += 1;
    } else if (kind in stats && typeof stats[kind] === 'number') {
      stats[kind] += 1;
    }
    const fresh = RULES.filter((rule) => stats.unlocked.indexOf(id(rule)) === -1 && have(rule) >= rule.need);
    fresh.forEach((rule) => stats.unlocked.push(id(rule)));
    save();
    return fresh;
  }

  function isUnlocked(slot, value) {
    const rule = ruleFor(slot, value);
    return !rule || stats.unlocked.indexOf(id(rule)) !== -1;
  }

  function progress(slot, value) {
    const rule = ruleFor(slot, value);
    if (!rule) return null;
    return { stat: rule.stat, have: Math.min(have(rule), rule.need), need: rule.need };
  }

  function reload() {
    stats = load();
  }

  Y.unlocks = { RULES, record, isUnlocked, progress, reload };
})((window.Yo = window.Yo || {}));
