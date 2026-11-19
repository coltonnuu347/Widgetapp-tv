// Weather from Open-Meteo (free, no key). °F, 24-hour times.
(function (TV) {
  // WMO weather codes -> [description, day icon, night icon]
  var WMO = {
    0: ['Clear', 'wx-sun', 'wx-moon'],
    1: ['Mostly Clear', 'wx-sun', 'wx-moon'],
    2: ['Partly Cloudy', 'wx-partly-day', 'wx-partly-night'],
    3: ['Cloudy', 'wx-cloud', 'wx-cloud'],
    45: ['Fog', 'wx-fog', 'wx-fog'],
    48: ['Freezing Fog', 'wx-fog', 'wx-fog'],
    51: ['Light Drizzle', 'wx-drizzle', 'wx-drizzle'],
    53: ['Drizzle', 'wx-drizzle', 'wx-drizzle'],
    55: ['Heavy Drizzle', 'wx-drizzle', 'wx-drizzle'],
    56: ['Freezing Drizzle', 'wx-sleet', 'wx-sleet'],
    57: ['Freezing Drizzle', 'wx-sleet', 'wx-sleet'],
    61: ['Light Rain', 'wx-rain', 'wx-rain'],
    63: ['Rain', 'wx-rain', 'wx-rain'],
    65: ['Heavy Rain', 'wx-rain', 'wx-rain'],
    66: ['Freezing Rain', 'wx-sleet', 'wx-sleet'],
    67: ['Freezing Rain', 'wx-sleet', 'wx-sleet'],
    71: ['Light Snow', 'wx-snow', 'wx-snow'],
    73: ['Snow', 'wx-snow', 'wx-snow'],
    75: ['Heavy Snow', 'wx-snow', 'wx-snow'],
    77: ['Snow Grains', 'wx-snow', 'wx-snow'],
    80: ['Rain Showers', 'wx-rain', 'wx-rain'],
    81: ['Rain Showers', 'wx-rain', 'wx-rain'],
    82: ['Heavy Showers', 'wx-rain', 'wx-rain'],
    85: ['Snow Showers', 'wx-snow', 'wx-snow'],
    86: ['Heavy Snow Showers', 'wx-snow', 'wx-snow'],
    95: ['Thunderstorms', 'wx-thunder', 'wx-thunder'],
    96: ['Thunderstorms with Hail', 'wx-thunder', 'wx-thunder'],
    99: ['Thunderstorms with Hail', 'wx-thunder', 'wx-thunder']
  };
  function wmo(code, isDay) {
    var w = WMO[code] || ['—', 'wx-cloud', 'wx-cloud'];
    return { text: w[0], icon: isDay ? w[1] : w[2] };
  }
  TV.weatherInfo = wmo;

  TV.weather = null; // latest data, shared with widgets

  function deg(n) { return Math.round(n) + '°'; }

  function buildUrl(loc) {
    return 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code,is_day,precipitation_probability' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset' +
      (TV.settings.prefs.unit === 'C' ? '&temperature_unit=celsius&wind_speed_unit=kmh' : '&temperature_unit=fahrenheit&wind_speed_unit=mph') +
      '&precipitation_unit=inch' +
      '&timezone=auto&timeformat=unixtime&forecast_days=3';
  }

  function parse(j) {
    var c = j.current, h = j.hourly, d = j.daily;
    var nowSec = Date.now() / 1000;
    var hourStart = Math.floor(nowSec / 3600) * 3600;
    var hours = [];
    for (var i = 0; i < h.time.length && hours.length < 12; i++) {
      if (h.time[i] < hourStart) continue;
      hours.push({
        time: new Date(h.time[i] * 1000),
        temp: h.temperature_2m[i],
        code: h.weather_code[i],
        isDay: h.is_day[i] === 1,
        pop: h.precipitation_probability ? h.precipitation_probability[i] : null
      });
    }
    var days = d.time.map(function (t, k) {
      return {
        date: new Date(t * 1000),
        code: d.weather_code[k],
        max: d.temperature_2m_max[k],
        min: d.temperature_2m_min[k],
        sunrise: new Date(d.sunrise[k] * 1000),
        sunset: new Date(d.sunset[k] * 1000)
      };
    });
    // With timezone=auto, Open-Meteo's first daily entry is "today" at the forecast location.
    return {
      current: {
        temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m,
        wind: c.wind_speed_10m, code: c.weather_code, isDay: c.is_day === 1
      },
      windUnit: (j.current_units && j.current_units.wind_speed_10m) === 'km/h' ? 'km/h' : 'mph',
      hours: hours,
      days: days,
      today: days[0],
      tomorrow: days[1],
      fetchedAt: new Date()
    };
  }

  function stat(label, value, cls) {
    return '<div class="wx-stat' + (cls ? ' ' + cls : '') + '"><div class="wx-stat-label">' + label + '</div><div class="wx-stat-value">' + value + '</div></div>';
  }

  function render(data, loc) {
    var cur = data.current, info = wmo(cur.code, cur.isDay), p = TV.settings.prefs;
    TV.$('#weather-now').innerHTML =
      '<div class="wx-temp">' + deg(cur.temp) + '</div>' +
      '<div class="wx-icon-big">' + TV.icon(info.icon, TV.motionOn()) + '</div>' +
      '<div class="wx-main">' +
        '<div class="wx-cond">' + TV.esc(info.text) + '</div>' +
        '<div class="wx-place"><span class="icon">' + TV.icon('location') + '</span>' + TV.esc(TV.placeLabel(loc) || 'Your location') + '</div>' +
      '</div>' +
      '<div class="wx-stats">' +
        (p.statHilo ? stat('High · Low', deg(data.today.max) + ' · ' + deg(data.today.min)) : '') +
        (p.statFeels ? stat('Feels Like', deg(cur.feels)) : '') +
        (p.statHumidity ? stat('Humidity', Math.round(cur.humidity) + '%', 'extra') : '') +
        (p.statWind ? stat('Wind', Math.round(cur.wind) + ' ' + data.windUnit, 'extra') : '') +
      '</div>';

    // With the radar beside it the card is narrower, so it shows up to 8 hours (and drops Humidity and Wind, see the CSS)
    var narrow = !!TV.$('#top-row.has-radar');
    TV.$('#weather-hourly').innerHTML = hourlyHtml(data, narrow ? Math.min(p.hours, 8) : p.hours);
    // Brighten the temperature briefly when it changes
    var tempText = deg(cur.temp);
    if (lastTemp !== null && lastTemp !== tempText) { var t = TV.$('#weather-now .wx-temp'); if (t) TV.play(t, 'bump'); }
    lastTemp = tempText;
  }
  var lastTemp = null;

  // Redraw with the data we already have (after an option changes).
  TV.rerenderWeather = function () {
    if (TV.weather && TV.location) render(TV.weather, TV.location);
  };

  // 12 hourly columns with the temperatures drawn as a soft curve underneath.
  var CURVE_H = 72, CURVE_W = 1200;
  function hourlyHtml(data, count) {
    var hours = data.hours.slice(0, count || 12), n = hours.length;
    if (!n) return '';
    var temps = hours.map(function (h) { return h.temp; });
    var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps);
    // Height of each dot above the bottom of the curve area (px).
    var lift = temps.map(function (t) { return 8 + (hi > lo ? (t - lo) / (hi - lo) : 0.5) * 24; });

    var cols = hours.map(function (hr, i) {
      var hi2 = wmo(hr.code, hr.isDay);
      var pop = (hr.pop != null && hr.pop >= 20) ? Math.round(hr.pop) + '%' : '';
      return '<div class="hr' + (i === 0 ? ' now' : '') + '">' +
        '<div class="hr-head"><div class="hr-time">' + (i === 0 ? 'Now' : TV.fmtHour(hr.time)) + '</div>' +
        '<div class="hr-icon">' + TV.icon(hi2.icon) + '</div></div>' +
        '<div class="hr-pop">' + pop + '</div>' +
        '<div class="hr-curve"><div class="hr-temp" style="bottom:' + (lift[i] + 12).toFixed(1) + 'px">' + deg(hr.temp) + '</div>' +
        '<span class="hr-dot" style="bottom:' + (lift[i] - 5).toFixed(1) + 'px"></span></div>' +
      '</div>';
    }).join('');

    // Smooth line through the dots (Catmull-Rom spline as cubic Béziers).
    var pts = lift.map(function (l, i) { return [(i + 0.5) / n * CURVE_W, CURVE_H - l]; });
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' +
        p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    var area = d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + CURVE_H + ' L' + pts[0][0].toFixed(1) + ' ' + CURVE_H + ' Z';
    var svg = '<svg class="wx-curve" viewBox="0 0 ' + CURVE_W + ' ' + CURVE_H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="wxfill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" style="stop-color:var(--accent2);stop-opacity:0.34"/>' +
      '<stop offset="1" style="stop-color:var(--accent2);stop-opacity:0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#wxfill)"/>' +
      '<path d="' + d + '" fill="none" style="stroke:var(--accent2)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
    return svg + cols;
  }

  // Full-screen view: big current conditions, 12 hours, and the next 3 days.
  TV.details.weather = {
    render: function (el) {
      var data = TV.weather;
      if (!data) { el.innerHTML = '<h2>Weather</h2><div class="empty-note">Weather is still loading…</div>'; return; }
      var cur = data.current, info = wmo(cur.code, cur.isDay);
      var now = new Date();
      el.innerHTML = '<h2>' + TV.esc(TV.placeLabel(TV.location) || 'Weather') + '</h2>' +
        '<div class="dw-now"><div class="dw-icon">' + TV.icon(info.icon, TV.motionOn()) + '</div>' +
        '<div class="dw-temp">' + deg(cur.temp) + '</div>' +
        '<div class="dw-info"><div class="wx-cond">' + TV.esc(info.text) + '</div>' +
        '<div class="wx-hilo">H:' + deg(data.today.max) + '&nbsp;&nbsp;L:' + deg(data.today.min) + '</div>' +
        '<div class="wx-extra">Feels like ' + deg(cur.feels) + ' · Humidity ' + Math.round(cur.humidity) + '% · Wind ' + Math.round(cur.wind) + ' ' + data.windUnit + '</div>' +
        '<div class="wx-extra">Sunrise ' + TV.fmtTime(data.today.sunrise) + ' · Sunset ' + TV.fmtTime(data.today.sunset) + '</div></div></div>' +
        '<div class="section-label">Next 12 Hours</div><div class="dw-hourly hourly">' + hourlyHtml(data) + '</div>' +
        '<div class="section-label">Next ' + data.days.length + ' Days</div>' +
        data.days.map(function (d) {
          var di = wmo(d.code, true);
          return '<div class="dw-day"><span class="dw-day-name">' + TV.esc(TV.dayLabel(d.date, now)) + '</span>' +
            '<span class="dw-day-icon">' + TV.icon(di.icon) + '</span><span class="dw-day-cond">' + TV.esc(di.text) + '</span>' +
            '<span class="dw-day-lo">' + deg(d.min) + '</span><span class="dw-day-hi">' + deg(d.max) + '</span></div>';
        }).join('');
    }
  };

  function renderError(msg) {
    TV.$('#weather-now').innerHTML = '<div class="empty-note">' + TV.esc(msg) + '</div>';
    TV.$('#weather-hourly').innerHTML = '';
  }

  TV.refreshWeather = function () {
    return TV.getLocation().then(function (loc) {
      TV.location = loc;
      TV.emit('location', loc);
      return TV.fetchJSON(buildUrl(loc)).then(function (j) {
        var data = parse(j);
        TV.weather = data;
        render(data, loc);
        TV.emit('weather', data);
      });
    }).catch(function (e) {
      TV.log('Weather failed:', e.message);
      if (!TV.weather) renderError(/location/i.test(e.message) ? e.message : 'Weather unavailable right now. Retrying soon…');
    });
  };
})(window.TV);
