// The demo data the reels use, written into a throwaway session before YO loads:
// three habits on a run (water at 6 days, so ticking it unlocks the sprout), a note, Tunis for prayer times.
module.exports = function seedScript() {
  return `(() => {
    localStorage.clear();
    localStorage.setItem('yo.welcomed', '1');
    localStorage.setItem('yo.greeted', new Date().toISOString().slice(0, 10));
    localStorage.setItem('yo.prefs', JSON.stringify({ sound: true, volume: 3, voice: 'robot' }));
    const P = Yo.miniapps.habitsCore;
    const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    const habit = (id, said, pack, days) => {
      const p = P.parse(said);
      const log = {};
      for (let i = 1; i <= days; i += 1) log[ymd(back(i))] = 'done';
      return Object.assign({ id, said, name: p.name, cue: p.cue, tiny: p.tiny, identity: p.identity, created: Date.now() - 40 * 864e5, log }, pack ? { pack } : {});
    };
    localStorage.setItem('yo.habits', JSON.stringify([
      habit('hwater', 'After Fajr I will drink 2 glasses of water', 'water', 6),
      habit('hwalk', 'After Asr I will walk 20 minutes', 'body', 3),
      habit('hread', 'Before bed I will read 2 pages', null, 5),
    ]));
    localStorage.setItem('yo.prayer', JSON.stringify({ place: { name: 'Tunis', country: 'Tunisia', lat: 36.8065, lon: 10.1815, tz: 'Africa/Tunis' } }));
    localStorage.setItem('yo.notes', JSON.stringify([
      { id: 'n1', text: 'Bac plan\\nMaths: chapter 4 + exercises\\nPhysics: revise optics', at: Date.now() - 3600e3, pinned: true },
    ]));
  })()`;
};
