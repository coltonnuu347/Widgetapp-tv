// The small bits of "smart" logic: countdown wording, a rain heads-up, sunrise/sunset countdowns, a greeting.
// Everything here is a pure function of the data we already have and a time you pass in, so it is easy to test.
(function (root) {
  var MIN = 60000;

  // "now", "in 25 min", "in 1 h 5 min", "in 3 h"
  function inText(ms) {
    var m = Math.round(ms / MIN);
    if (m < 1) return 'now';
    if (m < 60) return 'in ' + m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return 'in ' + h + ' h' + (r && h < 6 ? ' ' + r + ' min' : '');
  }

  // Length with no "in": "1 h 20 min"
  function lengthText(ms) {
    var m = Math.max(1, Math.round(ms / MIN));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  // Fraction of an event that has passed, 0 to 1.
  function progress(start, end, now) {
    var total = end - start;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, (now - start) / total));
  }

  // WMO weather codes that mean rain, snow or thunderstorms.
  function isWetCode(code) {
    return (code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 86) || code >= 95;
  }
  // An hour counts as wet at a 50% chance or more (or when the forecast code itself is precipitation).
  function isWet(h) {
    if (h.pop != null && h.pop >= 50) return true;
    return h.pop == null && isWetCode(h.code);
  }

  // Rain heads-up from the hourly forecast, or null when it is not relevant.
  // hours: [{ time: Date (start of the hour), pop, code }], fmt: formats a Date as a clock time.
  // The forecast is hour by hour, so the wording never claims minute precision.
  function rainHint(hours, now, fmt) {
    if (!hours || !hours.length) return null;
    var firstWet = -1, i;
    for (i = 0; i < hours.length; i++) { if (isWet(hours[i])) { firstWet = i; break; } }
    if (firstWet < 0) return null;
    if (firstWet === 0) {
      // Raining now: when does it stop?
      for (i = 1; i < hours.length; i++) {
        if (!isWet(hours[i])) return { kind: 'rain-now', text: 'Rain until about ' + fmt(hours[i].time) };
      }
      return { kind: 'rain-now', text: 'Rain for the rest of the forecast' };
    }
    var start = hours[firstWet].time, ahead = start - now;
    if (ahead > 6 * 60 * MIN) return null;               // too far off to be useful here
    if (ahead <= 60 * MIN) return { kind: 'rain-soon', text: 'Rain likely within the hour' };
    return { kind: 'rain-soon', text: 'Rain likely from ' + fmt(start) };
  }

  // "Sunset in 1 h 20 min" within 90 minutes before sunset (or sunrise); otherwise null.
  function sunHint(today, tomorrow, now) {
    var WINDOW = 90 * MIN;
    if (today && now < today.sunrise && today.sunrise - now <= WINDOW) return { kind: 'sun', text: 'Sunrise ' + inText(today.sunrise - now) };
    if (today && now >= today.sunrise && now < today.sunset && today.sunset - now <= WINDOW) return { kind: 'sun', text: 'Sunset ' + inText(today.sunset - now) };
    if (today && now >= today.sunset && tomorrow && tomorrow.sunrise - now <= WINDOW) return { kind: 'sun', text: 'Sunrise ' + inText(tomorrow.sunrise - now) };
    return null;
  }

  function greeting(now) {
    var h = now.getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 22) return 'Good evening';
    return 'Good night';
  }

  // The line under the clock: at most two items, most important first.
  // ctx: { now, events (timed, sorted), hours, today, tomorrow, weatherText, fmt, dayLabel }
  function glanceItems(ctx) {
    var now = ctx.now, items = [];
    var timed = (ctx.events || []).filter(function (o) { return !o.allDay && o.end > now; });
    var current = timed.filter(function (o) { return o.start <= now; })[0];
    var next = timed.filter(function (o) { return o.start > now; })[0];

    if (current) items.push({ rank: 1, label: 'Now', text: current.title + ' until ' + ctx.fmt(current.end) });
    var SOON = 10 * MIN;
    var rain = rainHint(ctx.hours, now, ctx.fmt);
    if (rain) items.push({ rank: 2, label: '', text: rain.text });
    if (next) {
      var day = ctx.dayLabel(next.start, now);
      var soon = day === 'Today' && next.start - now < 6 * 60 * MIN;
      var when = soon ? inText(next.start - now) : '· ' + (day === 'Today' ? '' : day + ' ') + ctx.fmt(next.start);
      // An event starting within 10 minutes moves up (ahead of the rain line) and is marked urgent.
      var urgent = next.start - now <= SOON;
      items.push({ rank: urgent ? 1.5 : 3, label: urgent ? 'Soon' : 'Next', urgent: urgent, text: next.title + ' ' + when });
    }
    var sun = sunHint(ctx.today, ctx.tomorrow, now);
    if (sun) items.push({ rank: 4, label: '', text: sun.text });
    // In the evening, tomorrow's weather is more useful than today's
    if (ctx.tomorrowText && now.getHours() >= 20) items.push({ rank: 4.5, label: '', text: ctx.tomorrowText });
    if (ctx.weatherText) items.push({ rank: 5, label: '', text: ctx.weatherText });

    items.sort(function (a, b) { return a.rank - b.rank; });
    return items.slice(0, 2);
  }

  // "2 left today" (timed events still to come or in progress), "Done for today", or "Nothing today".
  function todayText(events, now) {
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()), end = new Date(start.getTime() + 24 * 3600000);
    var today = (events || []).filter(function (o) { return o.start < end && o.end > start; });
    if (!today.length) return 'Nothing today';
    var left = today.filter(function (o) { return !o.allDay && o.end > now; }).length;
    return left ? left + ' left today' : 'Done for today';
  }

  // Where the sun is in its path, 0 at sunrise to 1 at sunset (0 before sunrise, 1 after sunset).
  function sunProgress(today, now) {
    if (!today) return 0;
    return Math.min(1, Math.max(0, (now - today.sunrise) / (today.sunset - today.sunrise)));
  }

  var api = { todayText: todayText, sunProgress: sunProgress, inText: inText, lengthText: lengthText, progress: progress, isWet: isWet, rainHint: rainHint, sunHint: sunHint, greeting: greeting, glanceItems: glanceItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.smart = api; }
})(typeof window !== 'undefined' ? window : this);
