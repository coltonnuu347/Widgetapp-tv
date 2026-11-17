// The line under the clock: at most two items, most important first (see js/smart.js).
// Also the greeting above the date.
(function (TV) {
  var lastTexts = [];
  TV.glanceTexts = function () { return lastTexts; };
  function render() {
    var now = new Date(), w = TV.weather;
    var items = TV.smart.glanceItems({
      now: now,
      events: TV.calendarEvents || [],
      hours: w ? w.hours : [],
      today: w ? w.today : null,
      tomorrow: w ? w.tomorrow : null,
      tomorrowText: w && w.tomorrow ? 'Tomorrow ' + Math.round(w.tomorrow.max) + '°/' + Math.round(w.tomorrow.min) + '° ' + TV.weatherInfo(w.tomorrow.code, true).text : '',
      weatherText: w ? Math.round(w.current.temp) + '° ' + TV.weatherInfo(w.current.code, w.current.isDay).text : '',
      fmt: TV.fmtTime,
      dayLabel: TV.dayLabel
    });
    lastTexts = items.map(function (it) { return (it.label ? it.label + ' ' : '') + it.text; });
    var html = items.map(function (it) {
      return '<span class="gl-item' + (it.urgent ? ' urgent' : '') + '">' + (it.label ? '<b>' + TV.esc(it.label) + '</b> ' : '') + TV.esc(it.text) + '</span>';
    }).join('<span class="glance-sep">·</span>');
    var el = TV.$('#glance');
    if (el.getAttribute('data-html') !== html) {
      el.setAttribute('data-html', html);
      el.innerHTML = html;
      TV.play(el, 'swap'); // fade the new line in
    }
    var g = TV.$('#greeting');
    if (g) g.textContent = TV.smart.greeting(now);
  }

  TV.on('weather', render);
  TV.on('calendar', render);
  TV.on('prefs', render);
  setInterval(render, 30 * 1000);
  TV.renderGlance = render;
})(window.TV);
