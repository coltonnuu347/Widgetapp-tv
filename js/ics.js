// Small iCalendar (.ics) parser with recurring-event support.
// Handles: VEVENT, all-day and timed events, TZID / UTC / floating times, line folding,
// RRULE (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYMONTH, BYSETPOS, WKST),
// EXDATE, RDATE, RECURRENCE-ID overrides and cancelled events.
(function (root) {
  var DAY_MS = 86400000;
  var WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // Windows time-zone names some calendars use instead of IANA names.
  var WINDOWS_TZ = {
    'Eastern Standard Time': 'America/New_York',
    'Central Standard Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver',
    'US Mountain Standard Time': 'America/Phoenix',
    'Pacific Standard Time': 'America/Los_Angeles',
    'Alaskan Standard Time': 'America/Anchorage',
    'Hawaiian Standard Time': 'Pacific/Honolulu',
    'Atlantic Standard Time': 'America/Halifax',
    'GMT Standard Time': 'Europe/London',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Romance Standard Time': 'Europe/Paris',
    'Central European Standard Time': 'Europe/Warsaw',
    'UTC': 'UTC'
  };

  // ---------- Time zones ----------
  var fmtCache = {};
  function tzValid(tz) {
    if (fmtCache[tz] !== undefined) return !!fmtCache[tz];
    try {
      fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      });
    } catch (e) {
      fmtCache[tz] = null;
    }
    return !!fmtCache[tz];
  }

  // Offset (ms) of time zone tz at the instant utcMs: local wall time minus UTC.
  function tzOffset(utcMs, tz) {
    var parts = fmtCache[tz].formatToParts(new Date(utcMs));
    var v = {};
    parts.forEach(function (p) { v[p.type] = p.value; });
    var asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, (+v.hour) % 24, +v.minute, +v.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  }

  // Convert a wall-clock time in time zone tz (given as ms where the wall time is read as UTC) to a real instant.
  function zonedToUtc(wallMs, tz) {
    var guess = wallMs - tzOffset(wallMs, tz);
    var off = tzOffset(guess, tz);
    var result = wallMs - off;
    var off2 = tzOffset(result, tz);
    if (off2 !== off) result = wallMs - off2; // wall time falls in a DST gap or overlap
    return result;
  }

  // ---------- Date values ----------
  // A date value is { wall: ms (wall time read as UTC), allDay: bool, tz: 'UTC' | IANA name | null (floating) }
  function parseDateValue(value, params) {
    value = value.trim();
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
    if (!m) return null;
    var allDay = !m[4] || params.VALUE === 'DATE';
    var wall = Date.UTC(+m[1], +m[2] - 1, +m[3], allDay ? 0 : +m[4], allDay ? 0 : +m[5], allDay ? 0 : +m[6]);
    var tz = null;
    if (!allDay) {
      if (m[7]) tz = 'UTC';
      else if (params.TZID) {
        var name = params.TZID.replace(/^"|"$/g, '').replace(/^\//, '');
        if (WINDOWS_TZ[name]) name = WINDOWS_TZ[name];
        tz = tzValid(name) ? name : null; // unknown zone -> treat as the TV's local time
      }
    }
    return { wall: wall, allDay: allDay, tz: tz };
  }

  // Wall time (ms, read as UTC) -> real JS Date.
  function wallToDate(wall, allDay, tz) {
    var d = new Date(wall);
    if (allDay || !tz) {
      // All-day and floating times are in the TV's own local time.
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    }
    if (tz === 'UTC') return d;
    return new Date(zonedToUtc(wall, tz));
  }

  function toDate(dv) { return wallToDate(dv.wall, dv.allDay, dv.tz); }

  function parseDuration(s) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s.trim());
    if (!m) return null;
    var sign = m[1] === '-' ? -1 : 1;
    var days = (+m[2] || 0) * 7 + (+m[3] || 0);
    var ms = ((+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
    return { days: sign * days, ms: sign * ms };
  }

  function unescapeText(s) {
    return s.replace(/\\([\\;,nN])/g, function (_, c) { return (c === 'n' || c === 'N') ? '\n' : c; });
  }

  // ---------- Lines ----------
  function parseLine(line) {
    // NAME;PARAM=value;PARAM="quoted:value":VALUE
    var inQuote = false, colon = -1;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '"') inQuote = !inQuote;
      else if (ch === ':' && !inQuote) { colon = i; break; }
    }
    if (colon < 0) return null;
    var head = line.slice(0, colon), value = line.slice(colon + 1);
    var segs = [], cur = '', q = false;
    for (var j = 0; j < head.length; j++) {
      var c = head.charAt(j);
      if (c === '"') q = !q;
      if (c === ';' && !q) { segs.push(cur); cur = ''; } else cur += c;
    }
    segs.push(cur);
    var params = {};
    segs.slice(1).forEach(function (p) {
      var eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
    });
    return { name: segs[0].toUpperCase(), params: params, value: value };
  }

  function parseRRule(value) {
    var r = {};
    value.split(';').forEach(function (part) {
      var kv = part.split('=');
      if (kv.length === 2) r[kv[0].toUpperCase()] = kv[1];
    });
    var rule = {
      freq: r.FREQ,
      interval: Math.max(1, parseInt(r.INTERVAL || '1', 10) || 1),
      count: r.COUNT ? parseInt(r.COUNT, 10) : null,
      until: r.UNTIL ? parseDateValue(r.UNTIL, {}) : null,
      wkst: WEEKDAYS[r.WKST] !== undefined ? WEEKDAYS[r.WKST] : 1,
      byday: null, bymonthday: null, bymonth: null, bysetpos: null
    };
    if (r.BYDAY) {
      rule.byday = r.BYDAY.split(',').map(function (s) {
        var m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(s.trim());
        return m ? { n: m[1] ? parseInt(m[1], 10) : 0, wd: WEEKDAYS[m[2]] } : null;
      }).filter(Boolean);
    }
    if (r.BYMONTHDAY) rule.bymonthday = r.BYMONTHDAY.split(',').map(function (s) { return parseInt(s, 10); });
    if (r.BYMONTH) rule.bymonth = r.BYMONTH.split(',').map(function (s) { return parseInt(s, 10); });
    if (r.BYSETPOS) rule.bysetpos = r.BYSETPOS.split(',').map(function (s) { return parseInt(s, 10); });
    return rule;
  }

  // ---------- Parse a whole file ----------
  function parse(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    var unfolded = [];
    lines.forEach(function (l) {
      if ((l.charAt(0) === ' ' || l.charAt(0) === '\t') && unfolded.length) unfolded[unfolded.length - 1] += l.slice(1);
      else unfolded.push(l);
    });

    var cal = { name: '', color: '', events: [] };
    var ev = null, depth = 0;
    unfolded.forEach(function (raw) {
      if (!raw) return;
      var p = parseLine(raw);
      if (!p) return;
      if (p.name === 'BEGIN') {
        if (p.value.toUpperCase() === 'VEVENT' && depth === 0) ev = { exdates: [], rdates: [] };
        else if (ev) depth++; // nested block such as VALARM
        return;
      }
      if (p.name === 'END') {
        if (ev && depth > 0) { depth--; return; }
        if (ev && p.value.toUpperCase() === 'VEVENT') { cal.events.push(ev); ev = null; }
        return;
      }
      if (!ev) {
        if (p.name === 'X-WR-CALNAME') cal.name = unescapeText(p.value);
        if (p.name === 'X-APPLE-CALENDAR-COLOR' && /^#[0-9a-f]{6}/i.test(p.value)) cal.color = p.value.slice(0, 7);
        return;
      }
      if (depth > 0) return;
      switch (p.name) {
        case 'UID': ev.uid = p.value; break;
        case 'SUMMARY': ev.summary = unescapeText(p.value); break;
        case 'LOCATION': ev.location = unescapeText(p.value); break;
        case 'STATUS': ev.status = p.value.toUpperCase(); break;
        case 'DTSTART': ev.start = parseDateValue(p.value, p.params); break;
        case 'DTEND': ev.end = parseDateValue(p.value, p.params); break;
        case 'DURATION': ev.duration = parseDuration(p.value); break;
        case 'RRULE': ev.rrule = parseRRule(p.value); break;
        case 'RECURRENCE-ID': ev.recurrenceId = parseDateValue(p.value, p.params); break;
        case 'EXDATE':
          p.value.split(',').forEach(function (v) { var d = parseDateValue(v, p.params); if (d) ev.exdates.push(d); });
          break;
        case 'RDATE':
          if (p.params.VALUE !== 'PERIOD') p.value.split(',').forEach(function (v) { var d = parseDateValue(v, p.params); if (d) ev.rdates.push(d); });
          break;
      }
    });
    cal.events = cal.events.filter(function (e) { return e.start; });
    return cal;
  }

  // ---------- Recurrence ----------
  function daysInMonth(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }

  // Days (UTC ms at 00:00) in month (y, m0) matching a BYDAY entry.
  function weekdaysInMonth(y, m0, bd) {
    var list = [], dim = daysInMonth(y, m0);
    for (var d = 1; d <= dim; d++) {
      var t = Date.UTC(y, m0, d);
      if (new Date(t).getUTCDay() === bd.wd) list.push(t);
    }
    return pickNth(list, bd.n);
  }
  function weekdaysInYear(y, bd) {
    var list = [];
    for (var t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += DAY_MS) {
      if (new Date(t).getUTCDay() === bd.wd) list.push(t);
    }
    return pickNth(list, bd.n);
  }
  function pickNth(list, n) {
    if (!n) return list;
    var i = n > 0 ? n - 1 : list.length + n;
    return (i >= 0 && i < list.length) ? [list[i]] : [];
  }

  function monthCandidates(y, m0, rule, startDay) {
    var dim = daysInMonth(y, m0), days = [];
    if (rule.bymonthday) {
      rule.bymonthday.forEach(function (md) {
        var d = md > 0 ? md : dim + md + 1;
        if (d >= 1 && d <= dim) days.push(Date.UTC(y, m0, d));
      });
      if (rule.byday) {
        days = days.filter(function (t) {
          var wd = new Date(t).getUTCDay();
          return rule.byday.some(function (bd) { return bd.wd === wd; });
        });
      }
    } else if (rule.byday) {
      rule.byday.forEach(function (bd) { days = days.concat(weekdaysInMonth(y, m0, bd)); });
    } else if (startDay <= dim) {
      days.push(Date.UTC(y, m0, startDay));
    }
    return days;
  }

  function applySetPos(days, setpos) {
    days.sort(function (a, b) { return a - b; });
    days = days.filter(function (t, i) { return i === 0 || t !== days[i - 1]; });
    if (!setpos) return days;
    var out = [];
    setpos.forEach(function (p) {
      var i = p > 0 ? p - 1 : days.length + p;
      if (i >= 0 && i < days.length) out.push(days[i]);
    });
    return out.sort(function (a, b) { return a - b; });
  }

  // Returns wall times (ms) of occurrences, in order, from the event start until stopWall.
  function expandRule(ev, stopWall) {
    var rule = ev.rrule, start = ev.start;
    var s = new Date(start.wall);
    var sy = s.getUTCFullYear(), sm = s.getUTCMonth(), sd = s.getUTCDate();
    var timeOfDay = start.wall - Date.UTC(sy, sm, sd);
    var out = [], count = 0;
    var untilCheck = null;
    if (rule.until) {
      var u = rule.until;
      if (start.allDay || u.allDay) {
        var ud = new Date(u.wall);
        var lastDay = Date.UTC(ud.getUTCFullYear(), ud.getUTCMonth(), ud.getUTCDate());
        untilCheck = function (wall) { return wall - ((wall % DAY_MS) + DAY_MS) % DAY_MS <= lastDay; };
      } else {
        var untilReal = toDate(u.tz ? u : { wall: u.wall, allDay: false, tz: start.tz }).getTime();
        untilCheck = function (wall) { return wallToDate(wall, false, start.tz).getTime() <= untilReal; };
      }
    }

    var MAX_PERIODS = 50000;
    var weekStart = Date.UTC(sy, sm, sd) - ((s.getUTCDay() - rule.wkst + 7) % 7) * DAY_MS;

    for (var i = 0; i < MAX_PERIODS; i++) {
      var days = [];
      if (rule.freq === 'DAILY') {
        var t = Date.UTC(sy, sm, sd + i * rule.interval);
        var dt = new Date(t);
        var ok = true;
        if (rule.bymonth && rule.bymonth.indexOf(dt.getUTCMonth() + 1) < 0) ok = false;
        if (rule.byday && !rule.byday.some(function (bd) { return bd.wd === dt.getUTCDay(); })) ok = false;
        if (rule.bymonthday && rule.bymonthday.indexOf(dt.getUTCDate()) < 0) ok = false;
        if (ok) days.push(t);
      } else if (rule.freq === 'WEEKLY') {
        var ws = weekStart + i * rule.interval * 7 * DAY_MS;
        var wds = rule.byday ? rule.byday.map(function (bd) { return bd.wd; }) : [s.getUTCDay()];
        wds.forEach(function (wd) { days.push(ws + ((wd - rule.wkst + 7) % 7) * DAY_MS); });
        if (rule.bymonth) days = days.filter(function (t2) { return rule.bymonth.indexOf(new Date(t2).getUTCMonth() + 1) >= 0; });
        days = applySetPos(days, rule.bysetpos);
      } else if (rule.freq === 'MONTHLY') {
        var mi = sm + i * rule.interval;
        var y = sy + Math.floor(mi / 12), m0 = ((mi % 12) + 12) % 12;
        if (!rule.bymonth || rule.bymonth.indexOf(m0 + 1) >= 0) days = monthCandidates(y, m0, rule, sd);
        days = applySetPos(days, rule.bysetpos);
      } else if (rule.freq === 'YEARLY') {
        var yy = sy + i * rule.interval;
        if (rule.byday && !rule.bymonth && !rule.bymonthday) {
          rule.byday.forEach(function (bd) { days = days.concat(weekdaysInYear(yy, bd)); });
        } else {
          var months = rule.bymonth ? rule.bymonth.map(function (n) { return n - 1; }) : [sm];
          var useRule = (rule.byday || rule.bymonthday) ? rule : { byday: null, bymonthday: null };
          months.forEach(function (mm) { days = days.concat(monthCandidates(yy, mm, useRule, sd)); });
        }
        days = applySetPos(days, rule.bysetpos);
      } else {
        break; // unsupported frequency (e.g. HOURLY) -> only the first occurrence is shown
      }

      if (rule.freq === 'DAILY') days = applySetPos(days, null);
      for (var k = 0; k < days.length; k++) {
        var wall = days[k] + timeOfDay;
        if (wall < start.wall) continue;
        if (untilCheck && !untilCheck(wall)) return out;
        count++;
        if (rule.count && count > rule.count) return out;
        if (wall > stopWall) return out;
        out.push(wall);
      }
      // Stop once whole periods are past the range (cheap guard).
      var periodStart = days.length ? days[0] : null;
      if (periodStart !== null && periodStart > stopWall) return out;
      if (rule.freq === 'YEARLY' && Date.UTC(sy + i * rule.interval, 0, 1) > stopWall) return out;
      if (rule.freq === 'MONTHLY' && Date.UTC(sy, sm + i * rule.interval, 1) > stopWall) return out;
      if ((rule.freq === 'WEEKLY') && weekStart + i * rule.interval * 7 * DAY_MS > stopWall) return out;
      if (rule.freq === 'DAILY' && Date.UTC(sy, sm, sd + i * rule.interval) > stopWall) return out;
    }
    return out;
  }

  function wallDayKey(wall) {
    var d = new Date(wall);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  // Event length: { days } for all-day, { ms } for timed.
  function eventLength(ev) {
    if (ev.start.allDay) {
      if (ev.end) return { days: Math.max(1, Math.round((ev.end.wall - ev.start.wall) / DAY_MS)) };
      if (ev.duration) return { days: Math.max(1, ev.duration.days) };
      return { days: 1 };
    }
    if (ev.end) return { ms: Math.max(0, toDate(ev.end).getTime() - toDate(ev.start).getTime()) };
    if (ev.duration) return { ms: ev.duration.days * DAY_MS + ev.duration.ms };
    return { ms: 0 };
  }

  function makeOccurrence(ev, wall, len) {
    var start = wallToDate(wall, ev.start.allDay, ev.start.tz);
    var end;
    if (ev.start.allDay) end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + len.days);
    else end = new Date(start.getTime() + len.ms);
    return {
      uid: ev.uid || '',
      title: ev.summary || '(No title)',
      location: ev.location || '',
      allDay: ev.start.allDay,
      start: start,
      end: end
    };
  }

  // All occurrences overlapping [rangeStart, rangeEnd) (JS Dates), sorted by start.
  function expand(cal, rangeStart, rangeEnd) {
    var results = [];
    // Wall-time stop point with a 2-day margin for time-zone differences.
    var stopWall = Date.UTC(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate() + 2);

    var overrides = {}; // uid -> list of override events
    cal.events.forEach(function (ev) {
      if (ev.recurrenceId) (overrides[ev.uid] = overrides[ev.uid] || []).push(ev);
    });

    function keep(occ) {
      var endMs = occ.end.getTime() > occ.start.getTime() ? occ.end.getTime() : occ.start.getTime() + 1;
      return endMs > rangeStart.getTime() && occ.start.getTime() < rangeEnd.getTime();
    }

    cal.events.forEach(function (ev) {
      if (ev.recurrenceId) return;
      var len = eventLength(ev);
      var masterCancelled = ev.status === 'CANCELLED';
      var walls;
      if (ev.rrule) walls = expandRule(ev, stopWall);
      else walls = [ev.start.wall];
      ev.rdates.forEach(function (r) { if (walls.indexOf(r.wall) < 0) walls.push(r.wall); });

      // Remove EXDATEs and occurrences replaced by overrides.
      var removed = ev.exdates.concat((overrides[ev.uid] || []).map(function (o) { return o.recurrenceId; }));
      walls = walls.filter(function (w) {
        return !removed.some(function (x) {
          if (x.allDay || ev.start.allDay) return wallDayKey(x.wall) === wallDayKey(w);
          if (x.tz === ev.start.tz) return x.wall === w;
          return toDate(x).getTime() === wallToDate(w, false, ev.start.tz).getTime();
        });
      });

      if (masterCancelled) return;
      walls.forEach(function (w) {
        var occ = makeOccurrence(ev, w, len);
        if (keep(occ)) results.push(occ);
      });
    });

    // Changed single occurrences.
    Object.keys(overrides).forEach(function (uid) {
      overrides[uid].forEach(function (ev) {
        if (ev.status === 'CANCELLED') return;
        var occ = makeOccurrence(ev, ev.start.wall, eventLength(ev));
        if (keep(occ)) results.push(occ);
      });
    });

    results.sort(function (a, b) {
      if (a.start - b.start !== 0) return a.start - b.start;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.title < b.title ? -1 : 1;
    });
    return results;
  }

  var api = { parse: parse, expand: expand, _zonedToUtc: zonedToUtc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.ics = api; }
})(typeof window !== 'undefined' ? window : this);
