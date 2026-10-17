'use strict';

// Tests for renderer/prayer-calc.js: prayer times worked out on the PC, checked against published
// timetables (Tunisia method, Fajr and Isha at 18 degrees) to within a minute.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { Yo: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'prayer-calc.js'), 'utf8'), { window, Intl, Date, Math, Number, String });
const C = window.Yo.prayerCalc;
const tunis = C.CITIES.find((c) => c.name === 'Tunis');

const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function close(day, method, expected, place) {
  const at = C.times(place || tunis, { method }, day);
  C.NAMES.forEach((name, i) => {
    const got = C.clock(at[name], (place || tunis).tz);
    assert.ok(Math.abs(minutes(got) - minutes(expected[i])) <= 1, day.join('-') + ' ' + name + ': ' + got + ' vs ' + expected[i]);
  });
}

// reference: published Tunisia-method timetable for Tunis (fajr, sunrise, dhuhr, asr, maghrib, isha)
test('Tunis, Tunisia method: autumn, summer and winter within a minute', () => {
  close([2026, 10, 17], 'tunisia', ['05:02', '06:28', '12:05', '15:14', '17:40', '19:06']);
  close([2026, 6, 21], 'tunisia', ['03:08', '05:01', '12:21', '16:13', '19:42', '21:34']);
  close([2026, 12, 21], 'tunisia', ['05:55', '07:28', '12:17', '14:49', '17:07', '18:40']);
});

test('methods and Asr school change the right times', () => {
  const day = [2026, 10, 17];
  const tn = C.times(tunis, { method: 'tunisia' }, day);
  const makkah = C.times(tunis, { method: 'makkah' }, day);
  assert.strictEqual(makkah.isha - makkah.maghrib, 90 * 60000); // Isha 90 minutes after Maghrib
  assert.ok(makkah.fajr < tn.fajr); // 18.5 degrees: a little earlier
  const hanafi = C.times(tunis, { method: 'tunisia', asr: 'hanafi' }, day);
  assert.ok(hanafi.asr - tn.asr > 30 * 60000); // shadow twice its length: later
  assert.strictEqual(hanafi.dhuhr.getTime(), tn.dhuhr.getTime());
  const moved = C.times(tunis, { method: 'tunisia', adjust: { maghrib: 3, fajr: -2 } }, day);
  assert.strictEqual(moved.maghrib - tn.maghrib, 3 * 60000);
  assert.strictEqual(moved.fajr - tn.fajr, -2 * 60000);
});

test('each city keeps its own clock; far north in summer still gets a Fajr and an Isha', () => {
  const london = C.CITIES.find((c) => c.name === 'London');
  const at = C.times(london, { method: 'mwl' }, [2026, 6, 21]);
  C.NAMES.forEach((name) => assert.ok(Number.isFinite(at[name].getTime()), name));
  assert.ok(at.fajr < at.sunrise && at.isha > at.maghrib);
  assert.strictEqual(C.zoneOffset('Africa/Tunis', new Date(Date.UTC(2026, 6, 1, 12))), 1);
  assert.strictEqual(C.zoneOffset('Europe/London', new Date(Date.UTC(2026, 6, 1, 12))), 1);
  assert.strictEqual(C.zoneOffset('Europe/London', new Date(Date.UTC(2026, 0, 1, 12))), 0);
  // the same moment reads 13:05 in Tunis and 12:05 in London in winter
  const noonTunis = C.times(tunis, { method: 'tunisia' }, [2026, 12, 21]).dhuhr;
  assert.strictEqual(minutes(C.clock(noonTunis, 'Europe/London')) + 60, minutes(C.clock(noonTunis, 'Africa/Tunis')));
});

test('finding a city ignores accents and puts names first', () => {
  assert.strictEqual(C.findCity('tun')[0].name, 'Tunis');
  assert.strictEqual(C.findCity('beja')[0].name, 'Béja');
  assert.ok(C.findCity('tunisia').length > 5);
  assert.strictEqual(C.findCity('zzz').length, 0);
});
