// Weather effects behind everything: rain, snow, drifting clouds, fog, stars on a clear night, and a warm
// glow on a clear day. They are quiet on purpose (low opacity, thin, slow) and only use transform and
// opacity animation, which is the cheapest thing a TV browser can draw.
// Settings > Smart & Motion > Weather Effects turns them off; Animations "Reduced" keeps only the still
// ones (clouds, fog, stars, glow) and "Off" shows nothing.
(function (TV) {
  var current = '';

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Which effect fits the weather right now.
  function typeFor(code, isDay, dark) {
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return code === 65 || code === 82 || code >= 95 ? 'rain-heavy' : (code <= 57 ? 'drizzle' : 'rain');
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code === 45 || code === 48) return 'fog';
    if (code === 2 || code === 3) return 'clouds';
    if (code === 0 || code === 1) return !isDay && dark ? 'stars' : (isDay ? 'sun' : '');
    return '';
  }
  TV.weatherFxType = typeFor;

  function streaks(n, cls) {
    var h = '<div class="' + cls + '">', i;
    for (i = 0; i < n; i++) {
      var d = rnd(0.7, 1.5);
      h += '<i style="left:' + rnd(-5, 100).toFixed(1) + '%;animation-duration:' + d.toFixed(2) + 's;animation-delay:-' + rnd(0, d).toFixed(2) + 's;opacity:' + rnd(0.4, 1).toFixed(2) + '"></i>';
    }
    return h + '</div>';
  }
  function flakes(n) {
    var h = '<div class="fx-snow">', i;
    for (i = 0; i < n; i++) {
      var d = rnd(9, 18), s = rnd(4, 9);
      h += '<i style="left:' + rnd(0, 100).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) + 'px;animation-duration:' + d.toFixed(1) + 's;animation-delay:-' + rnd(0, d).toFixed(1) + 's;opacity:' + rnd(0.45, 1).toFixed(2) + '"></i>';
    }
    return h + '</div>';
  }
  function stars(n) {
    var h = '<div class="fx-stars">', i;
    for (i = 0; i < n; i++) {
      var s = rnd(2, 4);
      h += '<i style="left:' + rnd(0, 100).toFixed(1) + '%;top:' + rnd(0, 70).toFixed(1) + '%;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) + 'px;animation-duration:' + rnd(3, 8).toFixed(1) + 's;animation-delay:-' + rnd(0, 8).toFixed(1) + 's"></i>';
    }
    return h + '</div>';
  }
  function bands(cls, tops) {
    return '<div class="' + cls + '">' + tops.map(function (t, i) {
      return '<b style="top:' + t + '%;animation-duration:' + (90 + i * 25) + 's;animation-delay:-' + (i * 31) + 's"></b>';
    }).join('') + '</div>';
  }

  function html(type) {
    switch (type) {
      case 'drizzle': return streaks(18, 'fx-rain light');
      case 'rain': return streaks(30, 'fx-rain');
      case 'rain-heavy': return streaks(44, 'fx-rain heavy');
      case 'snow': return flakes(28);
      case 'fog': return bands('fx-fog', [8, 34, 60]);
      case 'clouds': return bands('fx-clouds', [-4, 22, 50, 72]);
      case 'stars': return stars(36);
      case 'sun': return '<div class="fx-sun"><b></b></div>';
    }
    return '';
  }

  // Redraw only when the kind of effect changes.
  TV.applyWeatherFx = function () {
    var el = TV.$('#bg-wx');
    if (!el) return;
    var p = TV.settings.prefs, w = TV.weather, type = '';
    if (p.wxfx && p.anim !== 'off' && w && w.current) {
      type = typeFor(w.current.code, w.current.isDay, document.body.classList.contains('mode-dark'));
    }
    if (type === current) return;
    current = type;
    el.innerHTML = html(type);
    el.setAttribute('data-fx', type);
  };

  TV.on('weather', TV.applyWeatherFx);
  TV.on('prefs', TV.applyWeatherFx);
  setInterval(TV.applyWeatherFx, 60 * 1000); // day/night and light/dark can change without new weather
})(window.TV);
