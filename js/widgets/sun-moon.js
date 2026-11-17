// Sunrise / sunset (from the weather data) and the moon phase (calculated on the TV).
(function (TV) {
  var SYNODIC = 29.530588853;               // average days between new moons
  var REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

  TV.moonPhase = function (date) {
    var age = (((date.getTime() - REF_NEW_MOON) / 86400000) % SYNODIC + SYNODIC) % SYNODIC;
    var illum = (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;
    var names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    var idx = Math.floor((age / SYNODIC) * 8 + 0.5) % 8;
    return { age: age, illumination: illum, name: names[idx], waxing: age < SYNODIC / 2 };
  };

  // Moon drawing: lit part as seen from the Northern Hemisphere (waxing = lit on the right).
  function moonSvg(p) {
    var r = 40, cx = 50, cy = 50, k = p.illumination;
    var rx = Math.abs(1 - 2 * k) * r;
    var outerSweep = p.waxing ? 1 : 0;
    var innerSweep = p.waxing ? (k < 0.5 ? 0 : 1) : (k < 0.5 ? 1 : 0);
    var lit = '';
    if (k > 0.995) lit = '<circle cx="50" cy="50" r="40" style="fill:var(--moon-lit)"/>';
    else if (k > 0.005) {
      lit = '<path style="fill:var(--moon-lit)" d="M' + cx + ' ' + (cy - r) +
        ' A' + r + ' ' + r + ' 0 0 ' + outerSweep + ' ' + cx + ' ' + (cy + r) +
        ' A' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + innerSweep + ' ' + cx + ' ' + (cy - r) + 'Z"/>';
    }
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" style="fill:var(--moon-dark)"/>' + lit + '</svg>';
  }

  function dayLength(a, b) {
    var mins = Math.round((b - a) / 60000);
    return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  }

  // "Sunset in 1 h 20 min" within 90 minutes of sunrise or sunset, otherwise the length of the day.
  function sunLine(w) {
    var hint = TV.smart.sunHint(w.today, w.tomorrow, new Date());
    return sunArc(w) + '<span>' + (hint ? '<b>' + hint.text + '</b>' : dayLength(w.today.sunrise, w.today.sunset) + ' of daylight') + '</span>';
  }

  // A small arc of the sun's path: the part already travelled is lit, and the sun sits where it is now.
  function sunArc(w) {
    var p = TV.smart.sunProgress(w.today, new Date()), up = p > 0 && p < 1;
    var x = 32 - 28 * Math.cos(Math.PI * p), y = 30 - 28 * Math.sin(Math.PI * p);
    return '<svg class="sun-arc" viewBox="0 0 64 34" aria-hidden="true">' +
      '<path d="M4 30 A28 28 0 0 1 60 30" fill="none" style="stroke:var(--chip-strong)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M4 30 A28 28 0 0 1 60 30" fill="none" style="stroke:var(--accent2)" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="' + (p * 100).toFixed(1) + ' 100"/>' +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (up ? 5 : 3.5) + '" style="fill:var(--sun-dot)" ' + (up ? '' : 'opacity="0.6"') + '/></svg>';
  }

  function nextDate(daysAhead) {
    var d = new Date(Date.now() + daysAhead * 86400000);
    return TV.dayLabel(d, new Date()) + (daysAhead >= 2 ? '' : ' ' + TV.fmtTime(d));
  }

  TV.widgets.register({
    id: 'sunmoon',
    name: 'Sunrise, Sunset & Moon',
    visible: function () { return true; },
    init: function () {
      TV.on('weather', function () { TV.widgets.update('sunmoon'); });
      setInterval(function () { TV.widgets.update('sunmoon'); }, 60 * 1000); // keep the countdown current
    },
    render: function (el) {
      var w = TV.weather, p = TV.moonPhase(new Date());
      var sun = w && w.today
        ? '<div class="sm-row"><span class="icon sm-icon">' + TV.icon('sunrise') + '</span><span class="sm-label">Sunrise</span><span class="sm-value">' + TV.fmtTime(w.today.sunrise) + '</span></div>' +
          '<div class="sm-row"><span class="icon sm-icon">' + TV.icon('sunset') + '</span><span class="sm-label">Sunset</span><span class="sm-value">' + TV.fmtTime(w.today.sunset) + '</span></div>' +
          '<div class="sm-sub">' + sunLine(w) + '</div>'
        : '<div class="sm-sub">Waiting for weather…</div>';
      el.innerHTML = TV.widgetHeader('sunrise', 'Sun & Moon') +
        '<div class="sm-body"><div class="sm-sun">' + sun + '</div>' +
        '<div class="sm-moon"><div class="moon-art">' + moonSvg(p) + '</div>' +
        '<div class="moon-name">' + p.name + '</div>' +
        '<div class="sm-sub">' + Math.round(p.illumination * 100) + '% lit</div></div></div>';
    },
    detail: function (el) {
      var w = TV.weather, p = TV.moonPhase(new Date());
      var toFull = ((SYNODIC / 2 - p.age) % SYNODIC + SYNODIC) % SYNODIC;
      var toNew = SYNODIC - p.age;
      el.innerHTML = '<h2>Sun &amp; Moon</h2><div class="dsm">' +
        '<div class="dsm-sun">' +
          (w && w.today ?
            '<div class="dsm-row"><span class="icon dsm-icon">' + TV.icon('sunrise') + '</span><div><div class="dsm-label">Sunrise</div><div class="dsm-big">' + TV.fmtTime(w.today.sunrise) + '</div></div></div>' +
            '<div class="dsm-row"><span class="icon dsm-icon">' + TV.icon('sunset') + '</span><div><div class="dsm-label">Sunset</div><div class="dsm-big">' + TV.fmtTime(w.today.sunset) + '</div></div></div>' +
            '<div class="dsm-label">' + dayLength(w.today.sunrise, w.today.sunset) + ' of daylight today</div>' +
            (w.tomorrow ? '<div class="dsm-label">Tomorrow: sunrise ' + TV.fmtTime(w.tomorrow.sunrise) + ' · sunset ' + TV.fmtTime(w.tomorrow.sunset) + '</div>' : '')
          : '<div class="empty-note">Waiting for weather…</div>') +
        '</div>' +
        '<div class="dsm-moon"><div class="dsm-moon-art">' + moonSvg(p) + '</div>' +
          '<div class="dsm-big">' + p.name + '</div>' +
          '<div class="dsm-label">' + Math.round(p.illumination * 100) + '% lit · day ' + Math.floor(p.age) + ' of 29.5</div>' +
          '<div class="dsm-label">Next full moon: about ' + TV.esc(nextDate(toFull)) + '</div>' +
          '<div class="dsm-label">Next new moon: about ' + TV.esc(nextDate(toNew)) + '</div>' +
        '</div></div>';
    }
  });
})(window.TV);
