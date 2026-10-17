(function (Y) {
  'use strict';

  // Prayer times, worked out on this PC from where the sun is (no internet, nothing sent anywhere).
  // The classic method used by prayer-time tables: Fajr and Isha when the sun is a set angle below the
  // horizon, Dhuhr at solar noon, Asr when a shadow reaches its length (x1 or x2) plus its noon shadow,
  // Maghrib at sunset. Each city has its own time zone, so Tunis shows Tunis time on any PC.
  //   times(date, place, options) -> { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects

  // [Fajr angle, Isha angle or minutes after Maghrib]
  const METHODS = {
    tunisia: { name: 'Tunisia', fajr: 18, isha: 18 },
    mwl: { name: 'Muslim World League', fajr: 18, isha: 17 },
    makkah: { name: 'Umm al-Qura (Makkah)', fajr: 18.5, ishaMin: 90 },
    egypt: { name: 'Egypt', fajr: 19.5, isha: 17.5 },
    morocco: { name: 'Morocco', fajr: 19, isha: 17 },
    algeria: { name: 'Algeria', fajr: 18, isha: 17 },
    france: { name: 'France (UOIF)', fajr: 12, isha: 12 },
    turkey: { name: 'Turkey (Diyanet)', fajr: 18, isha: 17 },
    isna: { name: 'North America (ISNA)', fajr: 15, isha: 15 },
    karachi: { name: 'Karachi', fajr: 18, isha: 18 },
    gulf: { name: 'Gulf', fajr: 19.5, ishaMin: 90 },
    dubai: { name: 'Dubai', fajr: 18.2, isha: 18.2 },
  };
  const NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  // [name, country, latitude, longitude, time zone]
  const CITIES = [
    ['Tunis', 'Tunisia', 36.8065, 10.1815, 'Africa/Tunis'], ['Ariana', 'Tunisia', 36.8625, 10.1956, 'Africa/Tunis'],
    ['Ben Arous', 'Tunisia', 36.7531, 10.2189, 'Africa/Tunis'], ['La Manouba', 'Tunisia', 36.8101, 10.0956, 'Africa/Tunis'],
    ['Bizerte', 'Tunisia', 37.2744, 9.8739, 'Africa/Tunis'], ['Nabeul', 'Tunisia', 36.4561, 10.7376, 'Africa/Tunis'],
    ['Hammamet', 'Tunisia', 36.4000, 10.6167, 'Africa/Tunis'], ['Zaghouan', 'Tunisia', 36.4029, 10.1429, 'Africa/Tunis'],
    ['Béja', 'Tunisia', 36.7256, 9.1817, 'Africa/Tunis'], ['Jendouba', 'Tunisia', 36.5011, 8.7802, 'Africa/Tunis'],
    ['Le Kef', 'Tunisia', 36.1742, 8.7049, 'Africa/Tunis'], ['Siliana', 'Tunisia', 36.0849, 9.3708, 'Africa/Tunis'],
    ['Sousse', 'Tunisia', 35.8256, 10.6411, 'Africa/Tunis'], ['Monastir', 'Tunisia', 35.7643, 10.8113, 'Africa/Tunis'],
    ['Mahdia', 'Tunisia', 35.5047, 11.0622, 'Africa/Tunis'], ['Kairouan', 'Tunisia', 35.6781, 10.0963, 'Africa/Tunis'],
    ['Kasserine', 'Tunisia', 35.1676, 8.8365, 'Africa/Tunis'], ['Sidi Bouzid', 'Tunisia', 35.0382, 9.4849, 'Africa/Tunis'],
    ['Sfax', 'Tunisia', 34.7406, 10.7603, 'Africa/Tunis'], ['Gafsa', 'Tunisia', 34.4250, 8.7842, 'Africa/Tunis'],
    ['Tozeur', 'Tunisia', 33.9197, 8.1335, 'Africa/Tunis'], ['Kébili', 'Tunisia', 33.7044, 8.9690, 'Africa/Tunis'],
    ['Gabès', 'Tunisia', 33.8815, 10.0982, 'Africa/Tunis'], ['Médenine', 'Tunisia', 33.3549, 10.5055, 'Africa/Tunis'],
    ['Djerba (Houmt Souk)', 'Tunisia', 33.8756, 10.8575, 'Africa/Tunis'], ['Tataouine', 'Tunisia', 32.9297, 10.4518, 'Africa/Tunis'],
    ['Algiers', 'Algeria', 36.7538, 3.0588, 'Africa/Algiers'], ['Oran', 'Algeria', 35.6971, -0.6308, 'Africa/Algiers'],
    ['Constantine', 'Algeria', 36.3650, 6.6147, 'Africa/Algiers'], ['Casablanca', 'Morocco', 33.5731, -7.5898, 'Africa/Casablanca'],
    ['Rabat', 'Morocco', 34.0209, -6.8416, 'Africa/Casablanca'], ['Marrakesh', 'Morocco', 31.6295, -7.9811, 'Africa/Casablanca'],
    ['Fes', 'Morocco', 34.0181, -5.0078, 'Africa/Casablanca'], ['Tripoli', 'Libya', 32.8872, 13.1913, 'Africa/Tripoli'],
    ['Cairo', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo'], ['Alexandria', 'Egypt', 31.2001, 29.9187, 'Africa/Cairo'],
    ['Makkah', 'Saudi Arabia', 21.3891, 39.8579, 'Asia/Riyadh'], ['Madinah', 'Saudi Arabia', 24.5247, 39.5692, 'Asia/Riyadh'],
    ['Riyadh', 'Saudi Arabia', 24.7136, 46.6753, 'Asia/Riyadh'], ['Jeddah', 'Saudi Arabia', 21.4858, 39.1925, 'Asia/Riyadh'],
    ['Dubai', 'UAE', 25.2048, 55.2708, 'Asia/Dubai'], ['Abu Dhabi', 'UAE', 24.4539, 54.3773, 'Asia/Dubai'],
    ['Doha', 'Qatar', 25.2854, 51.5310, 'Asia/Qatar'], ['Kuwait City', 'Kuwait', 29.3759, 47.9774, 'Asia/Kuwait'],
    ['Amman', 'Jordan', 31.9454, 35.9284, 'Asia/Amman'], ['Beirut', 'Lebanon', 33.8938, 35.5018, 'Asia/Beirut'],
    ['Jerusalem', 'Palestine', 31.7683, 35.2137, 'Asia/Jerusalem'], ['Istanbul', 'Turkey', 41.0082, 28.9784, 'Europe/Istanbul'],
    ['Ankara', 'Turkey', 39.9334, 32.8597, 'Europe/Istanbul'], ['Paris', 'France', 48.8566, 2.3522, 'Europe/Paris'],
    ['Lyon', 'France', 45.7640, 4.8357, 'Europe/Paris'], ['Marseille', 'France', 43.2965, 5.3698, 'Europe/Paris'],
    ['Toulouse', 'France', 43.6047, 1.4442, 'Europe/Paris'], ['Nice', 'France', 43.7102, 7.2620, 'Europe/Paris'],
    ['Lille', 'France', 50.6292, 3.0573, 'Europe/Paris'], ['Brussels', 'Belgium', 50.8503, 4.3517, 'Europe/Brussels'],
    ['Geneva', 'Switzerland', 46.2044, 6.1432, 'Europe/Zurich'], ['Montreal', 'Canada', 45.5019, -73.5674, 'America/Toronto'],
    ['London', 'United Kingdom', 51.5072, -0.1276, 'Europe/London'], ['Birmingham', 'United Kingdom', 52.4862, -1.8904, 'Europe/London'],
    ['Manchester', 'United Kingdom', 53.4808, -2.2426, 'Europe/London'], ['Glasgow', 'United Kingdom', 55.8642, -4.2518, 'Europe/London'],
    ['Dublin', 'Ireland', 53.3498, -6.2603, 'Europe/Dublin'], ['Amsterdam', 'Netherlands', 52.3676, 4.9041, 'Europe/Amsterdam'],
    ['Berlin', 'Germany', 52.5200, 13.4050, 'Europe/Berlin'], ['Frankfurt', 'Germany', 50.1109, 8.6821, 'Europe/Berlin'],
    ['Munich', 'Germany', 48.1351, 11.5820, 'Europe/Berlin'], ['Rome', 'Italy', 41.9028, 12.4964, 'Europe/Rome'],
    ['Milan', 'Italy', 45.4642, 9.1900, 'Europe/Rome'], ['Madrid', 'Spain', 40.4168, -3.7038, 'Europe/Madrid'],
    ['Barcelona', 'Spain', 41.3874, 2.1686, 'Europe/Madrid'], ['Vienna', 'Austria', 48.2082, 16.3738, 'Europe/Vienna'],
    ['Stockholm', 'Sweden', 59.3293, 18.0686, 'Europe/Stockholm'], ['Oslo', 'Norway', 59.9139, 10.7522, 'Europe/Oslo'],
    ['Copenhagen', 'Denmark', 55.6761, 12.5683, 'Europe/Copenhagen'], ['Sarajevo', 'Bosnia', 43.8563, 18.4131, 'Europe/Sarajevo'],
    ['New York', 'United States', 40.7128, -74.0060, 'America/New_York'], ['Chicago', 'United States', 41.8781, -87.6298, 'America/Chicago'],
    ['Los Angeles', 'United States', 34.0522, -118.2437, 'America/Los_Angeles'], ['Toronto', 'Canada', 43.6532, -79.3832, 'America/Toronto'],
    ['Karachi', 'Pakistan', 24.8607, 67.0011, 'Asia/Karachi'], ['Lahore', 'Pakistan', 31.5204, 74.3587, 'Asia/Karachi'],
    ['Dhaka', 'Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka'], ['Jakarta', 'Indonesia', -6.2088, 106.8456, 'Asia/Jakarta'],
    ['Kuala Lumpur', 'Malaysia', 3.1390, 101.6869, 'Asia/Kuala_Lumpur'], ['Dakar', 'Senegal', 14.7167, -17.4677, 'Africa/Dakar'],
    ['Khartoum', 'Sudan', 15.5007, 32.5599, 'Africa/Khartoum'], ['Nouakchott', 'Mauritania', 18.0735, -15.9582, 'Africa/Nouakchott'],
  ].map(([name, country, lat, lon, tz]) => ({ name, country, lat, lon, tz }));

  // ---------- the sun ----------
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const fix = (a, b) => { const v = a - b * Math.floor(a / b); return v < 0 ? v + b : v; };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sun(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
    return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - fix(RA, 24) };
  }

  // a time zone's offset from UTC (hours) at a moment, from the browser's own time zone data
  function zoneOffset(tz, at) {
    if (!tz) return -at.getTimezoneOffset() / 60;
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(at).reduce((acc, p) => { acc[p.type] = Number(p.value); return acc; }, {});
      const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
      return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000) / 60;
    } catch (err) {
      return -at.getTimezoneOffset() / 60;
    }
  }

  // the calendar day it is in that place right now: [year, month, day]
  function dayIn(tz, at) {
    const shifted = new Date(at.getTime() + zoneOffset(tz, at) * 3600000);
    return [shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()];
  }

  // place: { lat, lon, tz }   options: { method, asr: 'shafi' | 'hanafi', adjust: { fajr: minutes, ... } }
  // day: [y, m, d] in that place (default: today there)
  function times(place, options, day) {
    const opts = options || {};
    const method = METHODS[opts.method] || METHODS.tunisia;
    const [y, m, d] = day || dayIn(place.tz, new Date());
    const lat = place.lat;
    const lon = place.lon;
    const jDate = julian(y, m, d) - lon / (15 * 24);
    const noonUtc = Date.UTC(y, m - 1, d, 12);
    const tz = zoneOffset(place.tz, new Date(noonUtc));

    const midDay = (t) => fix(12 - sun(jDate + t).eqt, 24);
    const angleTime = (angle, t, before) => {
      const { decl } = sun(jDate + t);
      const noon = midDay(t);
      const x = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
      const T = deg(Math.acos(Math.max(-1, Math.min(1, x)))) / 15;
      return Number.isFinite(x) && Math.abs(x) <= 1 ? noon + (before ? -T : T) : NaN;
    };
    const asrTime = (factor, t) => {
      const { decl } = sun(jDate + t);
      const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - decl))))));
      return angleTime(angle, t);
    };

    // two passes: the first guesses, the second uses the sun at those times
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (let pass = 0; pass < 2; pass += 1) {
      const p = {};
      Object.keys(t).forEach((k) => { p[k] = t[k] / 24; });
      t = {
        fajr: angleTime(method.fajr, p.fajr, true),
        sunrise: angleTime(0.833, p.sunrise, true),
        dhuhr: midDay(p.dhuhr),
        asr: asrTime(opts.asr === 'hanafi' ? 2 : 1, p.asr),
        sunset: angleTime(0.833, p.sunset),
        isha: method.ishaMin ? NaN : angleTime(method.isha, p.isha),
      };
    }
    // far north in summer the sky never gets dark enough: use a share of the night instead
    const night = fix(t.sunrise - t.sunset, 24);
    const ishaAngle = method.ishaMin ? null : method.isha;
    if (!Number.isFinite(t.fajr) || fix(t.sunrise - t.fajr, 24) > (method.fajr / 60) * night) t.fajr = t.sunrise - (method.fajr / 60) * night;
    if (method.ishaMin) t.isha = t.sunset + method.ishaMin / 60;
    else if (!Number.isFinite(t.isha) || fix(t.isha - t.sunset, 24) > (ishaAngle / 60) * night) t.isha = t.sunset + (ishaAngle / 60) * night;

    const shift = tz - lon / 15; // from the sun's time to the place's clock
    const adjust = opts.adjust || {};
    const out = {};
    NAMES.forEach((name) => {
      const hours = (name === 'maghrib' ? t.sunset : t[name]) + shift + (Number(adjust[name]) || 0) / 60;
      const minutes = Math.round(hours * 60); // to the nearest minute (matches published tables within a minute)
      out[name] = new Date(Date.UTC(y, m - 1, d, 0, minutes) - tz * 3600000);
    });
    return out;
  }

  // "16:28" in the place's own time zone
  function clock(date, tz) {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    } catch (err) {
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }
  }

  // the Islamic (Hijri) date, and whether it's Ramadan
  function hijri(date) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      const month = Number(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(date));
      return { text: f.format(date).replace(/\s*AH$/, ' AH'), ramadan: month === 9 };
    } catch (err) {
      return { text: '', ramadan: false };
    }
  }

  function findCity(query) {
    const q = String(query || '').trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    if (!q) return CITIES.slice(0, 8);
    const plain = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return CITIES.filter((c) => plain(c.name).includes(q) || plain(c.country).includes(q))
      .sort((a, b) => (plain(a.name).startsWith(q) ? 0 : 1) - (plain(b.name).startsWith(q) ? 0 : 1)).slice(0, 8);
  }

  Y.prayerCalc = { METHODS, CITIES, NAMES, PRAYERS, times, clock, hijri, findCity, zoneOffset, dayIn };
})((window.Yo = window.Yo || {}));
