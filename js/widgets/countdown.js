// Countdowns to the days you are looking forward to.
// Two ways to add one (the widget stays hidden until there is at least one):
//   1. In your calendar, make an event titled  "Countdown: Beach trip"  (or start the title with the
//      hourglass emoji). It is picked up automatically, up to a year ahead, and you can add it from your phone.
//   2. In config.local.js:  c.countdowns = [{ name: 'Beach trip', date: '2026-12-20' }, { name: 'Anniversary', date: '06-14' }]
//      ('MM-DD' repeats every year).
(function (TV) {
  function items() {
    var events = (TV.calendarEvents || []).concat(TV.farEvents || []);
    return TV.smart.countdownItems(TV_CONFIG.countdowns || [], events, new Date());
  }
  function whenText(it) {
    return TV.DAYS[it.date.getDay()].slice(0, 3) + ', ' + TV.MONTHS[it.date.getMonth()].slice(0, 3) + ' ' + it.date.getDate();
  }
  function big(it) {
    if (it.days === 0) return '<div class="cd-num word">Today</div>';
    if (it.days === 1) return '<div class="cd-num word">Tomorrow</div>';
    return '<div class="cd-num">' + it.days + '</div><div class="cd-unit">days</div>';
  }

  TV.widgets.register({
    id: 'countdown',
    name: 'Countdowns',
    visible: function () { return items().length > 0; },
    init: function () {
      TV.on('calendar', function () { TV.widgets.update('countdown'); });
      setInterval(function () { TV.widgets.update('countdown'); }, 10 * 60 * 1000); // the day count changes at midnight
    },
    render: function (el) {
      var list = items(), first = list[0];
      el.innerHTML = TV.widgetHeader('hourglass', 'Countdown') +
        '<div class="cd-body"><div class="cd-hero">' + big(first) + '</div>' +
        '<div class="cd-info"><div class="cd-name">' + TV.esc(first.name) + '</div><div class="cd-date">' + TV.esc(whenText(first)) + '</div>' +
        '<div class="cd-others">' + list.slice(1, 3).map(function (it) {
          return '<div class="cd-other"><span class="cd-other-name">' + TV.esc(it.name) + '</span><span class="cd-other-when">' + TV.esc(TV.inDaysText(it.days)) + '</span></div>';
        }).join('') + '</div></div></div>';
    },
    detail: function (el) {
      var list = items();
      el.innerHTML = '<h2>Countdowns</h2><div class="hint">Next 12 months</div><div class="dates-list big">' +
        list.map(function (it) {
          return '<div class="date-row"><span class="date-dot ' + (it.source === 'calendar' ? 'holiday' : 'birthday') + '"></span>' +
            '<span class="date-name">' + TV.esc(it.name) + '</span><span class="date-day">' + TV.esc(whenText(it)) + '</span>' +
            '<span class="date-when">' + TV.esc(TV.inDaysText(it.days)) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="hint">Add one from your phone: make a calendar event titled “Countdown: Beach trip”.</div>';
    }
  });
})(window.TV);
