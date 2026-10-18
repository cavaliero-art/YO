(function (Y) {
  'use strict';

  // To-do: your tasks and exams. Type a task with its date, time and #subject in plain words; YO shows
  // what it understood as you type. Tasks live in the main process (main/todo.js, tasks.json), so a
  // task's due time brings YO back even while it's hidden.
  //   Today: late + today + tasks with no date   Upcoming: dated later   Done: ticked (kept a month)
  const { h, button, fly, pop } = Y.miniapps;
  const VIEWS = ['today', 'upcoming', 'done'];
  const EXAM_DAYS = 30; // exams this close show in the countdown strip

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayOf = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  // "every day", "weekdays", "Mon, Wed": how a repeating task says when it comes back
  function repeatText(days, t) {
    const set = (days || []).slice().sort().join('');
    if (set === '0123456') return t('todo.repeat.daily');
    if (set === '12345') return t('todo.repeat.weekdays');
    if (set === '06') return t('todo.repeat.weekend');
    const base = new Date(2026, 9, 18); // a Sunday
    return days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday first
      .map((d) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + d).toLocaleDateString('en', { weekday: 'short' })).join(', ');
  }
  const daysFrom = (s, now) => Math.round((dayOf(s) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

  // tasks waiting today (late, today, or no date): the To-do tile's count
  function todayCount(tasks, now) {
    return tasks.filter((x) => !x.done && (!x.due || daysFrom(x.due, now) <= 0)).length;
  }
  Y.miniapps.live.todoToday = (tasks) => todayCount(Array.isArray(tasks) ? tasks : [], new Date());

  function mount(host) {
    const { t } = host;
    let tasks = [];
    let view = 'today';
    let tag = null;
    let fresh = null; // the task just added: it glows for a moment
    let parseAsk = 0;
    let parseTimer = null;

    const input = h('input.todo-in', { type: 'text', spellcheck: false, autocomplete: 'off', placeholder: t('todo.placeholder'), maxLength: 300, 'aria-label': t('todo.placeholder') });
    const understood = h('div.todo-parse');
    const exams = h('div.todo-exams');
    const tabs = h('div.ctabs.todo-tabs', { role: 'tablist' });
    const tags = h('div.todo-tags');
    const list = h('div.todo-list');
    const foot = h('div.todo-foot', { text: t('todo.hint') });

    const root = h('div.todoapp', h('div.todo-add', input, understood), exams, h('div.todo-bar', tabs, tags), list, foot);

    const ask = (action, arg) => (host.bridge.todo ? host.bridge.todo(action, arg) : Promise.resolve(null));

    function refresh() {
      if (!host.bridge.todo) {
        list.replaceChildren(h('div.side-empty', { text: t('todo.app') }));
        return Promise.resolve();
      }
      return ask('list').then((all) => {
        tasks = Array.isArray(all) ? all : [];
        draw();
      });
    }

    // ---------- what each task shows: a short date ----------
    function when(task, now) {
      if (!task.due) return '';
      const n = daysFrom(task.due, now);
      let label;
      if (n === 0) label = task.time ? '' : t('todo.when.today');
      else if (n === 1) label = t('todo.when.tomorrow');
      else if (n === -1) label = t('todo.when.yesterday');
      else if (n > 1 && n < 7) label = dayOf(task.due).toLocaleDateString('en', { weekday: 'short' });
      else label = dayOf(task.due).toLocaleDateString('en', { day: 'numeric', month: 'short' });
      return [label, task.time || ''].filter(Boolean).join(' ');
    }

    function inView(task, now) {
      if (view === 'done') return task.done;
      if (task.done) return false;
      if (view === 'today') return !task.due || daysFrom(task.due, now) <= 0;
      return Boolean(task.due) && daysFrom(task.due, now) > 0;
    }

    // late first, then by date and time; important ones first within the same day
    function order(a, b) {
      if (view === 'done') return (b.doneAt || 0) - (a.doneAt || 0);
      const ka = (a.due || '9999') + ' ' + (a.time || '99') + (a.star ? '0' : '1');
      const kb = (b.due || '9999') + ' ' + (b.time || '99') + (b.star ? '0' : '1');
      return ka < kb ? -1 : ka > kb ? 1 : a.created - b.created;
    }

    function draw() {
      const now = new Date();
      // the exam countdown strip
      const soon = tasks.filter((x) => x.exam && !x.done && x.due && daysFrom(x.due, now) >= 0 && daysFrom(x.due, now) <= EXAM_DAYS)
        .sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 3);
      exams.replaceChildren(...soon.map((x) => {
        const n = daysFrom(x.due, now);
        const whenText = n === 0 ? t('todo.soonToday') : n === 1 ? t('todo.soonTomorrow') : t('todo.inDays').replace('{n}', n);
        return h('span.todo-exam' + (n <= 1 ? '.close' : ''), { text: t('todo.examIn').replace('{name}', x.text).replace('{when}', whenText) });
      }));

      // tabs with counts
      tabs.replaceChildren(...VIEWS.map((name) => {
        const count = tasks.filter((x) => (name === 'done' ? x.done : !x.done && (name === 'today' ? (!x.due || daysFrom(x.due, now) <= 0) : x.due && daysFrom(x.due, now) > 0))).length;
        const tab = button('ctab', t('todo.' + name) + (count ? '  ' + count : ''), () => {
          view = name;
          draw();
          host.sound('tick');
        }, { role: 'tab', 'aria-selected': String(view === name) });
        tab.dataset.view = name;
        return tab;
      }));

      // subjects
      const allTags = [];
      tasks.forEach((x) => (x.tags || []).forEach((g) => { if (allTags.indexOf(g) === -1) allTags.push(g); }));
      if (tag && allTags.indexOf(tag) === -1) tag = null;
      tags.replaceChildren(...(allTags.length ? [null].concat(allTags.slice(0, 6)) : []).map((g) => button('opt todo-tag', g ? '#' + g : t('todo.all'), () => {
        tag = g;
        draw();
      }, { 'aria-pressed': String(tag === g) })));

      const shown = tasks.filter((x) => inView(x, now) && (!tag || (x.tags || []).indexOf(tag) !== -1)).sort(order);
      if (!shown.length) {
        list.replaceChildren(h('div.side-empty', { text: t(view === 'today' ? 'todo.emptyToday' : view === 'upcoming' ? 'todo.emptyUpcoming' : 'todo.emptyDone') }));
      } else {
        list.replaceChildren(...shown.map((x) => row(x, now)));
      }
      if (view === 'done' && shown.length) list.append(button('link todo-clear', t('todo.clear'), () => act('clearDone')));
    }

    function row(x, now) {
      const late = !x.done && x.due && (daysFrom(x.due, now) < 0 || (daysFrom(x.due, now) === 0 && x.time && x.time < pad(now.getHours()) + ':' + pad(now.getMinutes())));
      const meta = h('span.todo-meta');
      const whenText = when(x, now);
      if (x.exam) meta.append(h('span.todo-badge', { text: t('todo.exam') }));
      if (x.repeat) meta.append(h('span.todo-rep', { text: '↻', title: t('todo.repeat.title').replace('{days}', repeatText(x.repeat, t)) }));
      if (whenText) meta.append(h('span.todo-when' + (late ? '.late' : ''), { text: whenText }));
      (x.tags || []).forEach((g) => meta.append(h('span.todo-t', { text: '#' + g })));
      const node = h('div.todo-row',
        button('todo-check', '', (event) => { event.stopPropagation(); toggle(x, node); }, { 'aria-label': x.text, 'aria-pressed': String(x.done) }),
        h('span.todo-text', { text: x.text }),
        meta,
        button('row-act todo-star' + (x.star ? ' on' : ''), '★', () => act('star', x.id), { title: t(x.star ? 'todo.unstar' : 'todo.star'), 'aria-label': t(x.star ? 'todo.unstar' : 'todo.star') }),
        button('row-act', '×', () => { act('remove', x.id); host.react('cancel'); }, { title: t('todo.remove'), 'aria-label': t('todo.remove') }));
      if (x.done) node.classList.add('done');
      if (x.star) node.classList.add('starred');
      if (x.id === fresh) node.classList.add('fresh');
      return node;
    }

    // ticking: the check draws, a line strikes the task through, then the row travels into the
    // Done tab and its count pops, so you see where it went
    function toggle(x, node) {
      const finishing = !x.done;
      node.classList.toggle('done', finishing);
      host.sound(finishing ? 'tick' : 'cancel');
      if (finishing) host.react('work');
      ask('toggle', x.id).then((res) => {
        if (!res || !res.tasks) return;
        setTimeout(() => {
          const into = finishing && view !== 'done' ? tabs.querySelector('[data-view="done"]') : null;
          fly(into && node, into).then(() => {
            tasks = res.tasks;
            draw();
            if (into) pop(tabs.querySelector('[data-view="done"]'), 1.15);
          });
          const now = new Date();
          const left = todayCount(tasks, now);
          if (finishing && left === 0 && view === 'today') {
            host.react('success');
            host.sound('success');
            host.toast(t('todo.allDone'));
          }
        }, finishing ? 520 : 0);
      });
    }

    function act(action, id) {
      return ask(action, id).then((res) => {
        if (!res || !res.tasks) return;
        tasks = res.tasks;
        draw();
        if (action === 'star' && tasks.some((x) => x.id === id && x.star)) host.react('heart');
      });
    }

    function add(text) {
      return ask('add', text).then((res) => {
        if (!res) return false;
        if (res.error) {
          if (res.error === 'empty') host.sound('info');
          return false;
        }
        tasks = res.tasks;
        fresh = res.added;
        const task = tasks.find((x) => x.id === fresh);
        // show the task where it went
        if (task && view !== 'today' && (!task.due || daysFrom(task.due, new Date()) <= 0)) view = 'today';
        else if (task && task.due && daysFrom(task.due, new Date()) > 0) view = 'upcoming';
        draw();
        host.react('note');
        host.sound('set');
        host.toast(t('todo.added'));
        setTimeout(() => { fresh = null; }, 1500);
        return true;
      });
    }

    // what YO understood, under the box, as you type
    function preview() {
      const text = input.value.trim();
      const id = ++parseAsk;
      if (!text) return understood.replaceChildren();
      ask('parse', text).then((p) => {
        if (id !== parseAsk || !p) return;
        const now = new Date();
        const bits = [];
        if (p.exam) bits.push(t('todo.exam'));
        const whenText = p.due ? when({ due: p.due, time: p.time }, now) || t('todo.when.today') : '';
        if (whenText) bits.push(whenText);
        if (p.repeat) bits.push('↻ ' + repeatText(p.repeat, t));
        p.tags.forEach((g) => bits.push('#' + g));
        if (p.star) bits.push('★');
        understood.replaceChildren(...bits.map((b) => h('span.todo-chip', { text: b })));
      });
    }

    input.addEventListener('input', () => {
      clearTimeout(parseTimer);
      parseTimer = setTimeout(preview, 120);
      host.react('type');
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      add(text).then((ok) => {
        if (!ok) return;
        input.value = '';
        understood.replaceChildren();
      });
    });

    return {
      root,
      open(seed) {
        input.value = '';
        understood.replaceChildren();
        refresh().then(() => {
          // "todo math homework friday": added right away; "exam " alone waits in the box
          const text = String(seed || '').trim();
          if (!text) return;
          add(text).then((ok) => {
            if (!ok) {
              input.value = seed;
              preview();
            }
          });
        });
        setTimeout(() => input.focus(), 60);
      },
      escape() {
        if (!input.value) return false;
        input.value = '';
        understood.replaceChildren();
        return true;
      },
      drop(text) {
        input.value = text.replace(/\s+/g, ' ').slice(0, 200);
        preview();
        return true;
      },
    };
  }

  Y.miniapps.define('todo', mount);
})((window.Yo = window.Yo || {}));
