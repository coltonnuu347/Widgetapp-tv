// Birthdays (from your calendar + config) and public holidays (Nager.Date, free).
(function (TV) {
  var holidays = []; // { date: Date, name }
  var loadedYears = {};
  var LOOKAHEAD = 60;

  function loadHolidays() {
    var country = (TV_CONFIG.holidayCountry || (TV.location && TV.location.country) || 'US').toUpperCase();
    var y = new Date().getFullYear();
    var years = [y, y + 1].filter(function (yy) { return !loadedYears[country + yy]; });
    if (!years.length) return;
    Promise.all(years.map(function (yy) {
      loadedYears[country + yy] = true; // mark now so a second call doesn't load the same year twice
      return TV.fetchJSON('https://date.nager.at/api/v3/PublicHolidays/' + yy + '/' + country).catch(function (e) {
        loadedYears[country + yy] = false; // try again next time
        TV.log('Holidays failed:', e.message);
        return [];
      });
    })).then(function (lists) {
      lists.forEach(function (list) {
        list.forEach(function (h) {
          if (h.global === false) return; // skip holidays that only apply to some states/regions
          if (holidays.some(function (x) { return x.iso === h.date && x.name === h.name; })) return;
          var p = h.date.split('-');
          holidays.push({ iso: h.date, date: new Date(+p[0], +p[1] - 1, +p[2]), name: h.name, kind: 'holiday' });
        });
      });
      TV.widgets.update('dates');
    });
  }

  function upcoming(all) {
    var today = TV.startOfDay(new Date());
    var items = [];
    holidays.forEach(function (h) {
      var n = TV.daysBetween(today, h.date);
      if (n >= 0 && n <= LOOKAHEAD) items.push({ name: h.name, days: n, date: h.date, kind: 'holiday' });
    });
    // Calendar events with "birthday" in the title.
    var seen = {};
    (TV.calendarEvents || []).forEach(function (o) {
      if (!/birthday/i.test(o.title)) return;
      var n = TV.daysBetween(today, o.start);
      var key = o.title + n;
      if (n >= 0 && !seen[key]) { seen[key] = true; items.push({ name: o.title, days: n, date: o.start, kind: 'birthday' }); }
    });
    // Birthdays from config ('MM-DD').
    (TV_CONFIG.birthdays || []).forEach(function (b) {
      var m = /^(\d{1,2})-(\d{1,2})$/.exec(b.date || '');
      if (!m) return;
      var d = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
      if (d < today) d = new Date(today.getFullYear() + 1, +m[1] - 1, +m[2]);
      var n = TV.daysBetween(today, d);
      if (n <= LOOKAHEAD) items.push({ name: b.name + '’s Birthday', days: n, date: d, kind: 'birthday' });
    });
    items.sort(function (a, b) { return a.days - b.days; });
    return all ? items : items.slice(0, 4);
  }

  TV.widgets.register({
    id: 'dates',
    name: 'Birthdays & Holidays',
    visible: function () { return upcoming().length > 0; },
    init: function () {
      TV.on('location', loadHolidays);
      TV.on('calendar', function () { TV.widgets.update('dates'); });
      setInterval(loadHolidays, 6 * 3600 * 1000);
    },
    render: function (el) {
      el.innerHTML = TV.widgetHeader('gift', 'Birthdays & Holidays') +
        '<div class="dates-list">' + upcoming().map(function (it) {
          return '<div class="date-row"><span class="date-dot ' + it.kind + '"></span>' +
            '<span class="date-name">' + TV.esc(it.name) + '</span>' +
            '<span class="date-when">' + TV.esc(TV.inDaysText(it.days)) + '</span></div>';
        }).join('') + '</div>';
    },
    detail: function (el) {
      var items = upcoming(true);
      el.innerHTML = '<h2>Birthdays &amp; Holidays</h2><div class="hint">Next ' + LOOKAHEAD + ' days</div><div class="dates-list big">' +
        (items.length ? items.map(function (it) {
          return '<div class="date-row"><span class="date-dot ' + it.kind + '"></span>' +
            '<span class="date-name">' + TV.esc(it.name) + '</span>' +
            '<span class="date-day">' + TV.esc(TV.DAYS[it.date.getDay()].slice(0, 3) + ', ' + TV.MONTHS[it.date.getMonth()].slice(0, 3) + ' ' + it.date.getDate()) + '</span>' +
            '<span class="date-when">' + TV.esc(TV.inDaysText(it.days)) + '</span></div>';
        }).join('') : '<div class="empty-note">Nothing coming up.</div>') + '</div>';
    }
  });
})(window.TV);
