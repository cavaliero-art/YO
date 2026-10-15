(function (Y) {
  'use strict';

  // Demo agent until Stage 3 moves the real actions into the main process.
  // It speaks the typed events the real one will send, so the UI won't change:
  //   { type: 'state',           state: 'working', text, category }
  //   { type: 'step',            text }
  //   { type: 'approval_needed', id, tool, risk, title, body, allowAlways, category }
  //   { type: 'message',         text, ms?, category }                  short line, auto-closes
  //   { type: 'result',          title, body, sources?, category,
  //                              sticky?, background? }                card
  // background: news YO brings on its own (a reminder), queued while you're busy.
  // Reminders and timers are real: they fire even in the demo.
  const t = (key) => Y.i18n.t(key);
  const UNITS = { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600 };
  const MAX_DELAY_S = 24 * 3600;

  function parseDelay(text) {
    const m = /(\d+(?:[.,]\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|hr|h)?\b/i.exec(text);
    if (!m) return null;
    const secs = parseFloat(m[1].replace(',', '.')) * (UNITS[(m[2] || 'min').toLowerCase()] || 60);
    return secs > 0 && secs <= MAX_DELAY_S ? Math.round(secs * 1000) : null;
  }

  function formatDelay(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.round(s / 60) + ' min';
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return min ? h + ' h ' + min + ' min' : h + ' h';
  }

  // "remind me in 20 min to stretch" -> "stretch"
  function reminderNote(text) {
    const m = /\bto\s+(.+)$/i.exec(text);
    return m ? m[1].trim() : '';
  }

  function create(emit) {
    const trusted = new Set();
    let timers = [];
    let pending = null;
    let counter = 0;

    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    // tone tells YO how to react: ok, set, cancel, info, media, error
    const say = (text, category, tone) => emit({ type: 'message', text, category, tone });

    function schedule(cmd, text) {
      const ms = parseDelay(Y.commands.argOf(cmd, text));
      if (!ms) return say(t('needWhen'), 'time', 'info');
      const note = cmd.id === 'remind' ? reminderNote(text) : '';
      const when = formatDelay(ms);
      setTimeout(() => emit({
        type: 'result', category: 'time', sticky: true, background: true, alarm: cmd.id === 'timer',
        title: note || t('timerDone'),
        body: t('reminderBody').replace('{when}', when),
      }), ms);
      say(t(cmd.id === 'remind' ? 'reminderSet' : 'timerSet').replace('{when}', when), 'time', 'set');
    }

    function run(cmd, text) {
      if (cmd.id === 'lock') return later(400, () => say(t('lockedDone'), 'system', 'ok'));
      if (cmd.id === 'remind' || cmd.id === 'timer') return schedule(cmd, text);
      if (cmd.id === 'open') {
        const arg = Y.commands.argOf(cmd, text);
        if (!arg) return say(t('openWhat'), 'apps', 'info');
        return later(300, () => say(t('openDone').replace('{arg}', arg), 'apps', 'ok'));
      }
      later(250, () => say(t('mediaDone').replace('{title}', t('cmd.' + cmd.id)), cmd.category, 'media'));
    }

    return {
      send(text, id) {
        clearTimers();
        pending = null;
        const cmd = Y.commands.byId(id) || Y.commands.match(text, 1)[0];
        if (!cmd) return say(t('hint'), 'system', 'info');
        if (cmd.risk && !trusted.has(cmd.id)) {
          pending = { id: 'req-' + ++counter, cmd, text };
          return emit({
            type: 'approval_needed', id: pending.id, tool: cmd.id, risk: cmd.risk, category: cmd.category,
            title: t('lockTitle'), body: t('lockBody'), allowAlways: cmd.risk !== 'high',
          });
        }
        run(cmd, text);
      },
      respond(id, decision) {
        if (!pending || pending.id !== id) return;
        const { cmd, text } = pending;
        pending = null;
        if (decision === 'deny') return say(t('denied'), cmd.category, 'cancel');
        if (decision === 'always' && cmd.risk !== 'high') trusted.add(cmd.id);
        run(cmd, text);
      },
      stop() {
        clearTimers();
        pending = null;
        say(t('denied'), undefined, 'cancel');
      },
    };
  }

  Y.mockAgent = { create, parseDelay, formatDelay };
})((window.Yo = window.Yo || {}));
