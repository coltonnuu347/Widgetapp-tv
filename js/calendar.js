// Loads your iCloud calendars and draws the "Up Next" list.
(function (TV) {
  var APPLE_COLORS = ['#FF3B30', '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FFCC00', '#A2845E'];
  var CACHE_KEY = 'tvdash.calendar.cache';
  var LOOKAHEAD_DAYS = 60; // kept for the Birthdays widget; the list itself shows calendarDays

  TV.calendarEvents = []; // occurrences for the next 60 days, shared with widgets
  var errors = [];

  function toHttps(url) {
    return url.trim().replace(/^webcals?:\/\//i, 'https://');
  }

  function fetchUrl(url) {
    var proxy = (TV_CONFIG.corsProxy || '').trim();
    return proxy ? proxy + encodeURIComponent(url) : url;
  }

  function loadOne(cal, index) {
    var url = toHttps(cal.url);
    return TV.fetchWithTimeout(fetchUrl(url), { cache: 'no-store' }, 20000).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (text) {
      if (text.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('Not a calendar file');
      var parsed = TV.ics.parse(text);
      var name = cal.name || parsed.name || 'Calendar';
      var color = cal.color || parsed.color || APPLE_COLORS[index % APPLE_COLORS.length];
      var from = TV.startOfDay(new Date());
      var to = TV.addDays(from, LOOKAHEAD_DAYS);
      return TV.ics.expand(parsed, from, to).map(function (o) {
        o.calendar = name;
        o.color = color;
        return o;
      });
    }).catch(function (e) {
      errors.push({ name: cal.name || url.replace(/^https:\/\//, '').slice(0, 30) + '…', message: e.message });
      return null;
    });
  }

  function saveCache(events) {
    TV.storage.set(CACHE_KEY, events.map(function (o) {
      return { t: o.title, l: o.location, a: o.allDay, s: o.start.getTime(), e: o.end.getTime(), c: o.calendar, k: o.color };
    }));
  }
  function loadCache() {
    return (TV.storage.get(CACHE_KEY, []) || []).map(function (o) {
      return { title: o.t, location: o.l, allDay: o.a, start: new Date(o.s), end: new Date(o.e), calendar: o.c, color: o.k };
    });
  }

  TV.refreshCalendar = function () {
    var cals = TV.getCalendars();
    errors = [];
    if (!cals.length) {
      TV.calendarEvents = [];
      render();
      TV.emit('calendar', TV.calendarEvents);
      return Promise.resolve();
    }
    return Promise.all(cals.map(loadOne)).then(function (lists) {
      var ok = lists.filter(Boolean);
      var all = [];
      ok.forEach(function (l) { all = all.concat(l); });
      all.sort(function (a, b) { return (a.start - b.start) || (a.allDay === b.allDay ? 0 : (a.allDay ? -1 : 1)); });
      if (ok.length === 0) {
        all = loadCache(); // nothing loaded: keep showing the last good copy
      } else if (ok.length === cals.length) {
        saveCache(all);
      }
      TV.calendarEvents = all;
      render();
      TV.emit('calendar', all);
    });
  };

  // The two lines of the time column: [top, bottom].
  function timeCells(o, dayStart, dayEnd) {
    if (o.allDay) return ['All day', ''];
    var startsToday = o.start >= dayStart, endsToday = o.end <= dayEnd;
    if (startsToday && endsToday) return [TV.fmtTime(o.start), TV.fmtTime(o.end)];
    if (startsToday) return [TV.fmtTime(o.start), 'onward'];
    if (endsToday) return ['Until', TV.fmtTime(o.end)];
    return ['All day', ''];
  }

  function render() {
    var list = TV.$('#calendar-list');
    var cals = TV.getCalendars();
    if (!cals.length) {
      TV.$('#cal-sub').textContent = '';
      list.innerHTML = '<div class="empty-note">No calendars yet.<br>Add your iCloud calendar link in Settings or in config.local.js.</div>';
      return;
    }
    list.innerHTML = buildList(Math.max(1, TV.settings.prefs.calDays || 7));
    TV.$('#cal-sub').textContent = TV.smart.todayText(TV.calendarEvents, new Date());
    trimToFit(list);
  }

  // HTML for the next `days` days of events (used by the card and the full-screen view).
  function buildList(days) {
    var now = new Date();
    var today = TV.startOfDay(now);
    var html = '';
    var total = 0;
    // The next timed event gets a countdown ("in 25 min") when it is today and not too far off.
    var upNext = (TV.calendarEvents || []).filter(function (o) { return !o.allDay && o.start > now; })[0];
    for (var i = 0; i < days; i++) {
      var dayStart = TV.addDays(today, i), dayEnd = TV.addDays(today, i + 1);
      var items = TV.calendarEvents.filter(function (o) {
        var end = o.end > o.start ? o.end : new Date(o.start.getTime() + 1);
        if (!(o.start < dayEnd && end > dayStart)) return false;
        if (i === 0 && !o.allDay && end <= now) return false; // already finished today
        return true;
      });
      if (!items.length) continue;
      html += '<div class="day-group"><div class="day-label">' + TV.esc(TV.dayLabel(dayStart, now)) + '</div>';
      items.forEach(function (o) {
        var isNow = i === 0 && !o.allDay && o.start <= now && o.end > now;
        var t = timeCells(o, dayStart, dayEnd);
        var place = o.location ? TV.esc(o.location.split('\n')[0]) : '';
        var isNext = o === upNext && i === 0 && o.start - now < 6 * 3600000;
        var countdown = isNext ? '<span class="countdown' + (o.start - now <= 10 * 60000 ? ' soon' : '') + '">' + TV.esc(TV.smart.inText(o.start - now)) + '</span>' : '';
        html += '<div class="event' + (isNow ? ' now' : '') + '">' +
          '<div class="tl-time"><div class="tl-start">' + t[0] + '</div><div class="tl-end">' + t[1] + '</div></div>' +
          '<div class="tl-rail"><span class="tl-dot" style="background:' + TV.esc(o.color) + '"></span></div>' +
          '<div class="event-body">' +
            '<div class="event-title">' + TV.esc(o.title) + '</div>' +
            ((isNow || place || isNext) ? '<div class="event-meta">' + (isNow ? '<span class="now-tag">Now</span>' : '') + countdown + (countdown && place ? ' · ' : '') + place + '</div>' : '') +
            (isNow ? '<div class="ev-progress"><span style="width:' + (TV.smart.progress(o.start, o.end, now) * 100).toFixed(1) + '%"></span></div>' : '') +
          '</div></div>';
        total++;
      });
      html += '</div>';
    }
    // Only say "nothing scheduled" when the calendars actually loaded; otherwise the error below explains.
    if (!total) html = errors.length ? '' : '<div class="empty-note">Nothing scheduled for the next ' + days + ' days.</div>';
    if (errors.length) {
      html += '<div class="cal-errors">' + errors.map(function (e) {
        return 'Couldn’t load “' + TV.esc(e.name) + '” (' + TV.esc(e.message) + ')';
      }).join('<br>') + '</div>';
    }
    return html;
  }

  // Remove events from the bottom until the list fits the card, then say how many are hidden.
  function trimToFit(list) {
    var hidden = 0;
    var errorsEl = TV.$('.cal-errors', list);
    var guard = 200;
    while (list.scrollHeight > list.clientHeight + 1 && guard-- > 0) {
      var events = TV.$$('.event', list);
      if (events.length <= 1) break;
      var last = events[events.length - 1];
      var group = last.parentNode;
      group.removeChild(last);
      hidden++;
      if (!TV.$('.event', group)) group.parentNode.removeChild(group);
      var more = TV.$('.more-note', list);
      if (!more) {
        more = document.createElement('div');
        more.className = 'more-note';
        list.insertBefore(more, errorsEl);
      }
      more.textContent = '+' + hidden + ' more';
    }
  }

  TV.renderCalendar = render;

  // Full-screen view: the next 14 days, no trimming.
  TV.details.calendar = {
    title: 'Up Next',
    render: function (el) {
      el.innerHTML = '<h2>Up Next</h2><div class="detail-cal">' +
        (TV.getCalendars().length ? buildList(14) : '<div class="empty-note">No calendars yet. Add one in Settings.</div>') +
        '</div><div class="hint">Use ▲ ▼ to scroll · Back to close</div>';
    }
  };
})(window.TV);
