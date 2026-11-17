// Air quality and UV index from Open-Meteo's air-quality service (free, no key).
// Two simple gauges with the level written out in words (the colors are only a bonus).
// If the service does not offer a value for your area, that row is simply left out.
(function (TV) {
  var data = null; // { aqi, pm25, uv }

  // Gauge scales: where each level starts, as a share of the bar (UV runs to 12, AQI to 300).
  var UV_MAX = 12, AQI_MAX = 300;
  var COLORS = { good: '#30d158', moderate: '#ffd60a', high: '#ff9f0a', bad: '#ff453a', severe: '#bf5af2' };
  function track(stops) {
    var keys = ['good', 'moderate', 'high', 'bad', 'severe'], css = [], from = 0;
    stops.forEach(function (to, i) { css.push(COLORS[keys[i]] + ' ' + (from * 100).toFixed(2) + '% ' + (to * 100).toFixed(2) + '%'); from = to; });
    return 'linear-gradient(to right,' + css.join(',') + ')';
  }
  var UV_TRACK = track([3 / UV_MAX, 6 / UV_MAX, 8 / UV_MAX, 11 / UV_MAX, 1]);
  var AQI_TRACK = track([50 / AQI_MAX, 100 / AQI_MAX, 150 / AQI_MAX, 200 / AQI_MAX, 1]);

  function url(loc, withUv) {
    return 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + loc.lat.toFixed(4) + '&longitude=' + loc.lon.toFixed(4) +
      '&current=us_aqi,pm2_5' + (withUv ? ',uv_index' : '') + '&timezone=auto';
  }

  function load() {
    var loc = TV.location;
    if (!loc || loc.lat == null) return;
    // Ask for UV too; if the service refuses that combination, still get the air quality.
    TV.fetchJSON(url(loc, true)).catch(function () { return TV.fetchJSON(url(loc, false)); }).then(function (j) {
      var c = (j && j.current) || {};
      var next = { aqi: c.us_aqi == null ? null : +c.us_aqi, pm25: c.pm2_5 == null ? null : +c.pm2_5, uv: c.uv_index == null ? null : +c.uv_index };
      data = (next.aqi == null && next.uv == null) ? null : next;
      TV.widgets.update('air');
    }).catch(function (e) { TV.log('Air quality failed:', e.message); });
  }

  function rows() {
    var out = [];
    if (!data) return out;
    var uv = TV.smart.uvLevel(data.uv), aqi = TV.smart.aqiLevel(data.aqi);
    if (uv) out.push({ id: 'uv', name: 'UV Index', lv: uv, pct: Math.min(1, data.uv / UV_MAX), track: UV_TRACK, scale: [['0', 0], ['3', 3 / UV_MAX], ['6', 6 / UV_MAX], ['8', 8 / UV_MAX], ['11+', 11 / UV_MAX]] });
    if (aqi) out.push({ id: 'aqi', name: 'Air Quality', lv: aqi, pct: Math.min(1, data.aqi / AQI_MAX), track: AQI_TRACK, scale: [['0', 0], ['50', 50 / AQI_MAX], ['100', 100 / AQI_MAX], ['150', 150 / AQI_MAX], ['200', 200 / AQI_MAX], ['300+', 1]] });
    return out;
  }

  function gauge(r) {
    return '<div class="gauge" style="background:' + r.track + '"><i style="left:' + (r.pct * 100).toFixed(1) + '%"></i></div>';
  }

  TV.widgets.register({
    id: 'air',
    name: 'Air & UV',
    visible: function () { return rows().length > 0; },
    init: function () {
      TV.on('location', load);
      setInterval(load, 30 * 60 * 1000);
    },
    render: function (el) {
      el.innerHTML = TV.widgetHeader('air', 'Air & UV') +
        '<div class="air-body">' + rows().map(function (r) {
          return '<div class="air-row"><div class="air-top"><span class="air-name">' + r.name + '</span>' +
            '<span class="air-val">' + r.lv.value + '</span><span class="air-level">' + TV.esc(r.lv.short || r.lv.label) + '</span></div>' + gauge(r) + '</div>';
        }).join('') + '</div>';
    },
    detail: function (el) {
      var rs = rows();
      el.innerHTML = '<h2>Air &amp; UV</h2>' + (rs.length ? rs.map(function (r) {
        return '<div class="air-big"><div class="air-big-top"><span class="air-big-val">' + r.lv.value + '</span>' +
          '<div><div class="air-big-name">' + r.name + '</div><div class="air-big-level">' + TV.esc(r.lv.label) + '</div></div></div>' +
          '<div class="air-big-tip">' + TV.esc(r.lv.tip) + '</div>' + gauge(r) +
          '<div class="gauge-scale">' + r.scale.map(function (s, i) {
          // each number sits exactly where that level starts on the bar
          return '<span style="left:' + (s[1] * 100).toFixed(2) + '%;transform:translateX(' + (i === 0 ? '0' : s[1] >= 1 ? '-100%' : '-50%') + ')">' + s[0] + '</span>';
        }).join('') + '</div></div>';
      }).join('') + (data && data.pm25 != null ? '<div class="hint">Fine particles (PM2.5): ' + data.pm25.toFixed(1) + ' µg/m³</div>' : '') +
        '<div class="hint">Air quality uses the US scale. UV is the level right now, and it is highest around midday. Modelled data from Open-Meteo.</div>'
        : '<div class="empty-note">No air quality data for this area.</div>');
    }
  });
})(window.TV);
