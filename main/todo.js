'use strict';

// To-do: your tasks, saved in tasks.json. Lives in the main process so that a task's due time
// brings YO back even while it's hidden (the same way reminders do).
//   parse("math homework friday 18:00 #math !")  -> { text, due, time, tags, star, exam }
// Dates: today, tonight, tomorrow, monday..sunday, next week, in 3 days, 12/11 (day/month), 12 nov,
// 2026-11-12. Times: 18:00, 18h, 18h30, 6pm, 6:30pm. #tags, ! for important, "exam ..." for an exam.
const store = require('./store');

const CHECK_MS = 30 * 1000; // how often due times are checked
const MAX_TASKS = 500;
const MAX_TEXT = 200;
const KEEP_DONE_DAYS = 30;
const EXAM_HEADS_UP = '18:00'; // an exam is announced the evening before, at this time

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_SHORT = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function validDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

// a day and month without a year: this year; next year only if it's more than a month gone
// (a date from last week is a late task, not one for next year)
function upcoming(m, d, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = validDate(now.getFullYear(), m, d);
  if (!date) return null;
  return today - date > 31 * 86400000 ? validDate(now.getFullYear() + 1, m, d) : date;
}

function monthOf(word) {
  const i = MONTHS.indexOf(String(word).slice(0, 3).toLowerCase());
  return i === -1 ? null : i + 1;
}

// each rule: a pattern on the remaining text, and what it means; matched parts are removed
const DATE_RULES = [
  [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, (m) => validDate(+m[1], +m[2], +m[3])],
  [/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/, (m) => validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])],
  [/\b(\d{1,2})\/(\d{1,2})\b/, (m, now) => upcoming(+m[2], +m[1], now)],
  [/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i, (m, now) => upcoming(monthOf(m[2]), +m[1], now)],
  [/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i, (m, now) => upcoming(monthOf(m[1]), +m[2], now)],
  [/\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i, (m, now) => addDays(now, +m[1] * (/week/i.test(m[2]) ? 7 : 1))],
  [/\bnext\s+week\b/i, (m, now) => addDays(now, 7)],
  [/\b(today|tonight)\b/i, (m, now) => new Date(now)],
  [/\b(tomorrow|tmrw|tmr)\b/i, (m, now) => addDays(now, 1)],
  [/\b(?:on\s+)?(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)\b/i, (m, now) => {
    const word = m[1].toLowerCase();
    const day = DAYS.indexOf(word) !== -1 ? DAYS.indexOf(word) : DAY_SHORT[word];
    return addDays(now, (day - now.getDay() + 7) % 7); // today counts: "friday" on a friday is today
  }],
];

const TIME_RULES = [
  [/\b(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i, (m) => clock(+m[1], +m[2], m[3])],
  [/\b(?:at\s+)?(\d{1,2})h(\d{2})?\b/i, (m) => clock(+m[1], +(m[2] || 0))],
  [/\b(?:at\s+)?(\d{1,2})\s*(am|pm)\b/i, (m) => clock(+m[1], 0, m[2])],
];

function clock(h, min, half) {
  let hour = h;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (/pm/i.test(half) ? 12 : 0);
  }
  return hour <= 23 && min <= 59 ? pad(hour) + ':' + pad(min) : null;
}

function take(text, rules, now) {
  for (const [re, read] of rules) {
    const m = re.exec(text);
    if (!m) continue;
    const value = read(m, now);
    if (value) return { value, rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)) };
  }
  return { value: null, rest: text };
}

function parse(input, now) {
  const at = now || new Date();
  let text = ' ' + String(input || '').replace(/\s+/g, ' ').slice(0, 400) + ' ';
  let exam = false;
  const lead = /^\s*exam\b:?/i.exec(text);
  if (lead) {
    exam = true;
    text = ' ' + text.slice(lead[0].length);
  }
  const tags = [];
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]{1,24})/gu, (m, sp, tag) => {
    if (tags.indexOf(tag.toLowerCase()) === -1) tags.push(tag.toLowerCase());
    return ' ';
  });
  let star = false;
  text = text.replace(/(^|\s)!+(?=\s)/g, () => { star = true; return ' '; });
  const date = take(text, DATE_RULES, at);
  text = date.rest;
  const time = take(text, TIME_RULES, at);
  text = time.rest;
  let due = date.value ? ymd(date.value) : null;
  let hhmm = time.value;
  if (!hhmm && /\btonight\b/i.test(input)) hhmm = '20:00';
  if (hhmm && !due) {
    // a time alone: today, or tomorrow if that time has already passed
    const [h, mm] = hhmm.split(':').map(Number);
    const today = new Date(at.getFullYear(), at.getMonth(), at.getDate(), h, mm);
    due = ymd(today <= at ? addDays(at, 1) : at);
  }
  const clean = text.replace(/\s+/g, ' ').replace(/^\s*(?:to|on|at|by)\s+/i, '').replace(/\s+(?:on|at|by|due)\s*$/i, '').trim().slice(0, MAX_TEXT);
  return { text: clean, due, time: hhmm, tags, star, exam };
}

// when a task should bring YO back: its due time; an exam, the evening before
function alertAt(task) {
  if (task.done || !task.due) return null;
  const [y, m, d] = task.due.split('-').map(Number);
  if (task.exam) {
    const [h, min] = EXAM_HEADS_UP.split(':').map(Number);
    return new Date(y, m - 1, d - 1, h, min).getTime();
  }
  if (!task.time) return null;
  const [h, min] = task.time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

function create(emit) {
  let tasks = load();
  let timer = null;
  let counter = 0;

  function load() {
    const saved = store.load('tasks', []);
    return (Array.isArray(saved) ? saved : []).filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string');
  }

  function save() {
    // finished tasks are kept a month, then forgotten
    const cutoff = Date.now() - KEEP_DONE_DAYS * 86400000;
    tasks = tasks.filter((t) => !t.done || (t.doneAt || 0) > cutoff);
    store.save('tasks', tasks);
  }

  const list = () => tasks.map((t) => Object.assign({}, t));

  // due tasks bring YO back (once); anything that came due while YO was closed says so
  function check() {
    const now = Date.now();
    let changed = false;
    tasks.forEach((task) => {
      const at = alertAt(task);
      if (!at || task.notified || at > now) return;
      task.notified = true;
      changed = true;
      const late = now - at > 120000;
      const when = task.time ? ' at ' + task.time : '';
      emit({
        type: 'result', category: 'time', sticky: true, background: true, alarm: false, todo: task.id,
        title: task.exam ? 'Exam tomorrow: ' + task.text : task.text,
        body: (task.exam ? 'Good luck! You have it on your list for tomorrow.' : 'On your to-do list' + when + '.') +
          (late ? ' Missed while YO was closed.' : '') + (task.tags.length ? '  #' + task.tags.join(' #') : ''),
      });
    });
    if (changed) save();
  }

  function start() {
    if (!timer) timer = setInterval(check, CHECK_MS);
    check();
  }

  function find(id) {
    return tasks.find((t) => t.id === id) || null;
  }

  // the page asks for one of these; anything else is ignored
  function act(action, arg) {
    if (action === 'list') return list();
    if (action === 'parse') return parse(String(arg || ''));
    if (action === 'add') {
      const p = parse(String(arg || ''));
      if (!p.text || tasks.length >= MAX_TASKS) return { error: p.text ? 'full' : 'empty', tasks: list() };
      const task = {
        id: 't' + Date.now().toString(36) + (++counter).toString(36), text: p.text, due: p.due, time: p.time, tags: p.tags,
        star: p.star, exam: p.exam, done: false, doneAt: null, created: Date.now(), notified: false,
      };
      // already past when added (a time earlier today): no alert for it
      const at = alertAt(task);
      if (at && at <= Date.now()) task.notified = true;
      tasks.push(task);
      save();
      return { added: task.id, tasks: list() };
    }
    if (action === 'clearDone') {
      tasks = tasks.filter((t) => !t.done);
      save();
      return { tasks: list() };
    }
    const task = find(String(arg || ''));
    if (!task) return { error: 'missing', tasks: list() };
    if (action === 'toggle') {
      task.done = !task.done;
      task.doneAt = task.done ? Date.now() : null;
    } else if (action === 'star') {
      task.star = !task.star;
    } else if (action === 'remove') {
      tasks = tasks.filter((t) => t !== task);
    } else {
      return { error: 'action', tasks: list() };
    }
    save();
    return { tasks: list() };
  }

  return { start, stop: () => { clearInterval(timer); timer = null; }, act, check, list };
}

module.exports = { create, parse, alertAt };
