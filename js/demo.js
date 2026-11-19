// Preview mode (open index.html?demo=1 in a browser). Every network request is answered with
// SAMPLE data so you can see the layout without any accounts. Nothing here is real.
(function (TV) {
  var now = new Date();
  function ymd(d) { return d.getFullYear() + TV.pad(d.getMonth() + 1) + TV.pad(d.getDate()); }
  function local(d, h, m) { return ymd(d) + 'T' + TV.pad(h) + TV.pad(m || 0) + '00'; }
  var d40 = TV.addDays(TV.startOfDay(now), 40);
  var today = TV.startOfDay(now), tmr = TV.addDays(today, 1), d2 = TV.addDays(today, 2), d3 = TV.addDays(today, 3), d5 = TV.addDays(today, 5);
  var h = now.getHours();

  var ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Home', 'X-APPLE-CALENDAR-COLOR:#FF9500',
    'BEGIN:VEVENT', 'UID:d1', 'DTSTART;VALUE=DATE:' + ymd(today), 'DTEND;VALUE=DATE:' + ymd(tmr), 'SUMMARY:Trash & recycling day', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d2', 'DTSTART:' + local(today, Math.max(0, h - 1), 0), 'DTEND:' + local(today, Math.min(23, h + 1), 0), 'SUMMARY:Work from home', 'LOCATION:Office nook', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d3', 'DTSTART:' + local(today, Math.min(22, h + 2), 30), 'DTEND:' + local(today, Math.min(23, h + 3), 0), 'SUMMARY:Dentist appointment', 'LOCATION:Bright Smiles Dental', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d4', 'DTSTART:' + local(tmr, 7, 0), 'DTEND:' + local(tmr, 8, 0), 'SUMMARY:Gym', 'RRULE:FREQ=DAILY;COUNT=3', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d5', 'DTSTART:' + local(tmr, 18, 30), 'DTEND:' + local(tmr, 20, 0), 'SUMMARY:Dinner with Sam & Alex', 'LOCATION:Luca’s Trattoria', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d6', 'DTSTART;VALUE=DATE:' + ymd(d2), 'DTEND;VALUE=DATE:' + ymd(TV.addDays(d2, 1)), 'SUMMARY:Jordan’s Birthday', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d7', 'DTSTART:' + local(d3, 10, 0), 'DTEND:' + local(d3, 11, 0), 'SUMMARY:Car service', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d8', 'DTSTART;VALUE=DATE:' + ymd(d5), 'DTEND;VALUE=DATE:' + ymd(TV.addDays(d5, 2)), 'SUMMARY:Weekend trip', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d9', 'DTSTART;VALUE=DATE:' + ymd(d40), 'DTEND;VALUE=DATE:' + ymd(TV.addDays(d40, 1)), 'SUMMARY:Countdown: Concert night', 'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  var nowSec = Math.floor(now.getTime() / 1000), hourSec = Math.floor(nowSec / 3600) * 3600;
  var hourly = { time: [], temperature_2m: [], weather_code: [], is_day: [], precipitation_probability: [] };
  var codes = [1, 1, 2, 2, 3, 3, 61, 63, 61, 2, 1, 0];
  for (var i = 0; i < 24; i++) {
    var t = hourSec + i * 3600, hh = new Date(t * 1000).getHours();
    hourly.time.push(t);
    hourly.temperature_2m.push(64 + 8 * Math.sin((hh - 9) / 24 * 2 * Math.PI));
    hourly.weather_code.push(codes[i % codes.length]);
    hourly.is_day.push(hh >= 7 && hh < 18 ? 1 : 0);
    hourly.precipitation_probability.push(codes[i % codes.length] >= 61 ? 60 : 5);
  }
  function at(d, hh, mm) { return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime() / 1000); }
  var weather = {
    current: { time: nowSec, temperature_2m: 68.4, apparent_temperature: 67.1, relative_humidity_2m: 41, weather_code: 2, is_day: (h >= 7 && h < 18) ? 1 : 0, wind_speed_10m: 7.8 },
    hourly: hourly,
    daily: {
      time: [at(today, 0, 0), at(tmr, 0, 0), at(d2, 0, 0)],
      weather_code: [2, 61, 1], temperature_2m_max: [73.2, 66, 70], temperature_2m_min: [52.6, 50, 51],
      sunrise: [at(today, 7, 12), at(tmr, 7, 13), at(d2, 7, 14)], sunset: [at(today, 18, 4), at(tmr, 18, 3), at(d2, 18, 1)]
    }
  };

  var space = 'images/demo-space.svg';
  var art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5e7e"/><stop offset="1" stop-color="#5b6cff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>');

  var routes = [
    [/ipapi\.co/, { city: 'Denver', region_code: 'CO', country_code: 'US', latitude: 39.7392, longitude: -104.9903 }],
    [/air-quality-api\.open-meteo\.com/, { current: { us_aqi: 42, pm2_5: 9.6, uv_index: 6.4 } }],
    [/api\.open-meteo\.com/, weather],
    [/api\.rainviewer\.com/, (function () {
      var step = 600, last = Math.floor(nowSec / step) * step, past = [], nowcast = [], k;
      for (k = 12; k >= 0; k--) past.push({ time: last - k * step, path: '/v2/radar/' + (last - k * step) });
      for (k = 1; k <= 3; k++) nowcast.push({ time: last + k * step, path: '/v2/radar/nowcast_' + k });
      return { version: '2.0', generated: nowSec, host: 'https://tilecache.rainviewer.com', radar: { past: past, nowcast: nowcast } };
    })()],
    [/mesonet\.agron\.iastate\.edu/, { model_init_utc: new Date(Math.floor(nowSec / 3600) * 3600 * 1000 - 3600000).toISOString().replace('.000Z', 'Z'), forecast_minute: 0, model_forecast_utc: '' }],
    [/api\.weather\.gov/, { features: [{ properties: { event: 'Wind Advisory (sample)', severity: 'Moderate', headline: 'Sample alert for preview mode', description: 'This is sample text. On your TV this shows the full alert from the National Weather Service.', instruction: 'Sample instructions appear here.', senderName: 'NWS (sample)', ends: new Date(now.getTime() + 6 * 3600000).toISOString() } }] }],
    [/date\.nager\.at/, (function () {
      var t = TV.addDays(today, 9), y = TV.addDays(today, 30);
      function iso(d) { return d.getFullYear() + '-' + TV.pad(d.getMonth() + 1) + '-' + TV.pad(d.getDate()); }
      return [{ date: iso(t), name: 'Sample Holiday', global: true }, { date: iso(y), name: 'Another Holiday', global: true }];
    })()],
    [/api\.nasa\.gov/, [{ media_type: 'image', url: space, title: 'Sample: A Field of Stars', copyright: 'Sample image', date: '', explanation: 'This is placeholder text for preview mode. On your TV this area shows NASA’s own explanation of the day’s astronomy photo.' }]],
    [/accounts\.spotify\.com/, { access_token: 'demo', expires_in: 3600 }],
    [/api\.spotify\.com\/v1\/me\/player\?/, {
      is_playing: true, progress_ms: 72000, device: { name: 'Living Room HomePod (sample)' },
      item: { id: 'demo', type: 'track', name: 'Sample Song Title', duration_ms: 214000, artists: [{ name: 'Sample Artist' }], album: { images: [{ url: art }] } }
    }],
    [/api\.spotify\.com/, null],
    [/mapbox\.com\/directions/, { routes: [{ duration: 1380, distance: 18200 }] }]
  ];

  var demoPlayer = routes.filter(function (r) { return String(r[0]).indexOf('me') >= 0 && r[1] && r[1].item; })[0][1];

  window.fetch = function (url, opts) {
    url = String(url);
    // Pretend Spotify: remember play/pause like the real service does.
    var m = /api\.spotify\.com\/v1\/me\/player\/(pause|play)/.exec(url);
    if (m) {
      demoPlayer.is_playing = m[1] === 'play';
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (/\.ics|icloud|demo-calendar/.test(url)) {
      return Promise.resolve(new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar' } }));
    }
    if (/api\.open-meteo\.com/.test(url) && /temperature_unit=celsius/.test(url)) {
      var c = JSON.parse(JSON.stringify(weather)), toC = function (f) { return (f - 32) * 5 / 9; };
      ['temperature_2m', 'apparent_temperature'].forEach(function (k) { c.current[k] = toC(c.current[k]); });
      c.current.wind_speed_10m *= 1.609; c.current_units = { wind_speed_10m: 'km/h' };
      c.hourly.temperature_2m = c.hourly.temperature_2m.map(toC);
      c.daily.temperature_2m_max = c.daily.temperature_2m_max.map(toC);
      c.daily.temperature_2m_min = c.daily.temperature_2m_min.map(toC);
      return Promise.resolve(new Response(JSON.stringify(c), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    for (var i = 0; i < routes.length; i++) {
      if (routes[i][0].test(url)) {
        var body = routes[i][1];
        if (body === null) return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    }
    return Promise.reject(new Error('Preview mode: no sample data for ' + url));
  };

  // Sample settings (only in preview; your real config is not touched).
  TV_CONFIG.calendars = [{ url: 'webcal://demo-calendar.ics', name: 'Home' }];
  TV_CONFIG.location = { name: '', lat: null, lon: null };
  TV_CONFIG.wifi = { ssid: 'Guest Network', password: 'sample-password', security: 'WPA' };
  TV_CONFIG.commute = { mapboxToken: 'demo', from: '39.7392,-104.9903', to: '39.6,-104.9', label: 'Work', showFrom: '00:00', showUntil: '23:59' };
  TV_CONFIG.spotify = { clientId: 'demo', refreshToken: 'demo' };
  TV_CONFIG.countdowns = [{ name: 'Beach trip', date: (function (d) { return d.getFullYear() + '-' + TV.pad(d.getMonth() + 1) + '-' + TV.pad(d.getDate()); })(TV.addDays(today, 23)) }];
  TV.settings.manualLocation = null;
  TV.settings.widgets.disabled = []; // the general preview shows every widget
  TV.saveSettings = function () { /* preview: don't save */ };
  try { window.localStorage.clear(); } catch (e) { /* ignore */ }

  // A drawn stand-in for the commute map (preview only): streets, water, a park and the route with two pins.
  TV.demoRouteMap = function (dark, w, h) {
    var bg = dark ? '#1b1f2a' : '#ebe8e1', road = dark ? '#303749' : '#ffffff', minor = dark ? '#262b39' : '#f7f5f0', water = dark ? '#173650' : '#bcd9ee', park = dark ? '#1d3b2f' : '#cfe5c4';
    var sw = Math.max(4, Math.round(w * 0.016)), x = function (f) { return Math.round(w * f); }, y = function (f) { return Math.round(h * f); };
    var r = Math.max(8, Math.round(Math.min(w, h) * 0.07));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="' + w + '" height="' + h + '" fill="' + bg + '"/>' +
      '<path d="M0 ' + y(0.86) + 'C' + x(0.25) + ' ' + y(0.74) + ' ' + x(0.5) + ' ' + y(1) + ' ' + x(1) + ' ' + y(0.82) + 'V' + h + 'H0Z" fill="' + water + '"/>' +
      '<rect x="' + x(0.66) + '" y="' + y(0.5) + '" width="' + x(0.26) + '" height="' + y(0.2) + '" rx="' + r + '" fill="' + park + '"/>' +
      '<g stroke="' + minor + '" stroke-width="' + Math.max(2, Math.round(sw * 0.45)) + '">' +
        [0.12, 0.28, 0.46, 0.6, 0.78, 0.9].map(function (f) { return '<line x1="' + x(f) + '" y1="0" x2="' + x(f) + '" y2="' + h + '"/>'; }).join('') +
        [0.15, 0.32, 0.55, 0.7].map(function (f) { return '<line x1="0" y1="' + y(f) + '" x2="' + w + '" y2="' + y(f) + '"/>'; }).join('') + '</g>' +
      '<g stroke="' + road + '" stroke-width="' + Math.max(3, Math.round(sw * 0.8)) + '"><line x1="' + x(0.35) + '" y1="0" x2="' + x(0.35) + '" y2="' + h + '"/><line x1="0" y1="' + y(0.45) + '" x2="' + w + '" y2="' + y(0.45) + '"/><line x1="' + x(0.62) + '" y1="0" x2="' + x(0.62) + '" y2="' + h + '"/></g>' +
      '<polyline points="' + x(0.16) + ',' + y(0.72) + ' ' + x(0.35) + ',' + y(0.72) + ' ' + x(0.35) + ',' + y(0.45) + ' ' + x(0.62) + ',' + y(0.45) + ' ' + x(0.62) + ',' + y(0.26) + ' ' + x(0.84) + ',' + y(0.26) + '" fill="none" stroke="#ff9f0a" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>' +
      '<g stroke="#000" stroke-opacity="0.5" stroke-width="2" fill="#fff"><circle cx="' + x(0.16) + '" cy="' + y(0.72) + '" r="' + r + '"/><circle cx="' + x(0.84) + '" cy="' + y(0.26) + '" r="' + r + '"/></g>' +
      '<g font-family="sans-serif" font-weight="700" font-size="' + Math.round(r * 1.2) + '" text-anchor="middle" fill="#111"><text x="' + x(0.16) + '" y="' + (y(0.72) + Math.round(r * 0.42)) + '">A</text><text x="' + x(0.84) + '" y="' + (y(0.26) + Math.round(r * 0.42)) + '">B</text></g></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  // Preview-only radar: soft storm cells drawn in map space, so neighbouring tiles join up and the cells drift east frame by frame.
  TV.demoRadarTile = function (frame, tx, ty, z) {
    var here = TV.location && TV.location.lat != null ? TV.location : { lat: 39.7392, lon: -104.9903 };   // the sample storms sit around wherever you are
    var cx0 = TV.radarmath.tileX(here.lon, z), cy0 = TV.radarmath.tileY(here.lat, z);
    var cells = [[-2.4 + frame * 0.28, -0.5, 0.62], [-1.5 + frame * 0.28, 0.5, 0.42], [0.9 + frame * 0.2, -1.0, 0.4], [1.8 + frame * 0.2, 0.9, 0.5], [-0.2 + frame * 0.24, 0.1, 0.22]];
    var defs = '<radialGradient id="g"><stop offset="0" stop-color="#ff3b30" stop-opacity="0.9"/><stop offset="0.3" stop-color="#ff9f0a" stop-opacity="0.85"/><stop offset="0.55" stop-color="#ffd60a" stop-opacity="0.7"/><stop offset="0.78" stop-color="#30d158" stop-opacity="0.6"/><stop offset="1" stop-color="#30d158" stop-opacity="0"/></radialGradient>';
    var body = cells.map(function (c) {
      var px = (cx0 + c[0] - tx) * 256, py = (cy0 + c[1] - ty) * 256, r = c[2] * 256;
      return (px + r < 0 || px - r > 256 || py + r < 0 || py - r > 256) ? '' : '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="url(#g)"/>';
    }).join('');
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs>' + defs + '</defs>' + body + '</svg>');
  };
  // Preview-only forecast picture (what the forecast service would return for one frame): storm cells around the middle that drift east.
  TV.demoForecastImage = function (frame, w, h) {
    var cells = [[-0.34 + frame * 0.05, -0.1, 0.2], [-0.2 + frame * 0.05, 0.12, 0.15], [0.1 + frame * 0.04, -0.2, 0.15], [0.24 + frame * 0.04, 0.18, 0.18], [-0.02 + frame * 0.045, 0.02, 0.08]];
    var defs = '<radialGradient id="g"><stop offset="0" stop-color="#ff3b30" stop-opacity="0.9"/><stop offset="0.3" stop-color="#ff9f0a" stop-opacity="0.85"/><stop offset="0.55" stop-color="#ffd60a" stop-opacity="0.7"/><stop offset="0.78" stop-color="#30d158" stop-opacity="0.6"/><stop offset="1" stop-color="#30d158" stop-opacity="0"/></radialGradient>';
    var body = cells.map(function (c) { return '<circle cx="' + (w / 2 + c[0] * w).toFixed(1) + '" cy="' + (h / 2 + c[1] * h).toFixed(1) + '" r="' + (c[2] * w).toFixed(1) + '" fill="url(#g)"/>'; }).join('');
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><defs>' + defs + '</defs>' + body + '</svg>');
  };
  // A drawn stand-in for the base map: land with a coastline and a few roads.
  TV.demoBaseMap = function (dark, w, h) {
    var land = dark ? '#1d2230' : '#e9e6df', sea = dark ? '#142f48' : '#b9d7ec', line = dark ? '#2b3347' : '#fbfaf7', town = dark ? '#2a3146' : '#dcd8cf';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><rect width="' + w + '" height="' + h + '" fill="' + land + '"/>' +
      '<path d="M' + Math.round(w * 0.72) + ' 0C' + Math.round(w * 0.62) + ' ' + Math.round(h * 0.3) + ' ' + Math.round(w * 0.8) + ' ' + Math.round(h * 0.55) + ' ' + Math.round(w * 0.7) + ' ' + h + 'H' + w + 'V0Z" fill="' + sea + '"/>' +
      '<g fill="' + town + '"><circle cx="' + Math.round(w * 0.5) + '" cy="' + Math.round(h * 0.5) + '" r="' + Math.round(h * 0.09) + '"/><circle cx="' + Math.round(w * 0.22) + '" cy="' + Math.round(h * 0.3) + '" r="' + Math.round(h * 0.05) + '"/><circle cx="' + Math.round(w * 0.35) + '" cy="' + Math.round(h * 0.8) + '" r="' + Math.round(h * 0.06) + '"/></g>' +
      '<g stroke="' + line + '" stroke-width="3" fill="none"><path d="M0 ' + Math.round(h * 0.62) + 'L' + w + ' ' + Math.round(h * 0.4) + '"/><path d="M' + Math.round(w * 0.3) + ' 0L' + Math.round(w * 0.46) + ' ' + h + '"/><path d="M0 ' + Math.round(h * 0.2) + 'L' + Math.round(w * 0.6) + ' ' + Math.round(h * 0.28) + '"/></g></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  TV.demo = {
    start: function () {
      var badge = document.createElement('div');
      badge.id = 'demo-badge';
      badge.textContent = 'PREVIEW · SAMPLE DATA';
      TV.$('#stage').appendChild(badge);
      TV.refreshWeather();
      TV.refreshCalendar();
      setInterval(TV.renderCalendar, 60000);
    }
  };
})(window.TV);
