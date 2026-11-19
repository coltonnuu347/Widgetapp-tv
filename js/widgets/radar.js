// Rain radar: a looping map of the rain expected near you over the next few hours (it shows the future, not the past).
//
// Forecast frames come from NOAA's HRRR weather model, served as free map pictures by the Iowa Environmental Mesonet (Iowa State
// University), see js/forecastradar.js. It is a model forecast, not a measurement, and covers the lower 48 states. If that service
// cannot be reached (or you are outside the US), the radar shows one picture of the rain right now from RainViewer
// (https://www.rainviewer.com; their free service is for personal and educational use and asks for the credit shown on the map).
// The base map is a Mapbox static image (it uses the same Mapbox token as the commute widget); without a token the radar is
// drawn on a plain backdrop with range rings. The tile maths is in js/radarmath.js.
//
// Not tested on a real TV by the author, only on a computer.
(function (TV) {
  var INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';
  var ZOOM = 7, ZOOM_FORECAST = 8, FRAMES = 8, STEP_MIN = 30;   // 8 pictures, 30 minutes apart: now and the next 3.5 hours
  var STALE_MS = 40 * 60 * 1000;     // hide the radar when the data is older than this (a failed refresh must not leave an old picture)
  var data = null;                    // { mode: 'forecast' | 'now', host, frames: [{ time, path, minute }], key, at }
  var idx = 0, playing = true, timer = null;
  var tileEl = null, detailEl = null;

  function token() { return TV_CONFIG.mapboxToken || (TV_CONFIG.commute || {}).mapboxToken || ''; }
  function isDark() { return document.body.classList.contains('mode-dark'); }
  function fresh() { return !!(data && data.frames.length && Date.now() - data.at < STALE_MS); }
  function located() { return !!(TV.location && TV.location.lat != null && TV.location.lon != null); }
  function zoom() { return data && data.mode === 'forecast' ? ZOOM_FORECAST : ZOOM; }   // the forecast pictures can be drawn at any zoom, so they are closer in
  function restIdx() { return 0; }   // the picture the loop rests on and starts from: the first one, which is "now"

  // Frames of the HRRR forecast, from now on. Resolves to a data object, or rejects when the service has nothing usable.
  function loadForecast() {
    var fr = TV.forecastradar;
    if (!fr || !fr.covers(TV.location.lat, TV.location.lon)) return Promise.reject(new Error('Outside the forecast area'));
    return TV.fetchJSON(fr.metaUrl(0)).then(function (j) {
      var init = fr.parseUtc(j && j.model_init_utc);
      var frames = fr.pickFrames(init, Date.now(), FRAMES, STEP_MIN);
      if (frames.length < 2) throw new Error('No forecast frames');
      return { mode: 'forecast', frames: frames, key: 'f' + init + ':' + frames[0].minute, at: Date.now() };
    });
  }
  // One picture of the rain right now (RainViewer), when the forecast is not available.
  function loadNow() {
    return TV.fetchJSON(INDEX_URL).then(function (j) {
      var frames = TV.radarmath.pickFrames(j && j.radar, 1, 0);
      if (!j || !j.host || !frames.length) throw new Error('No radar frames');
      return { mode: 'now', host: j.host, frames: frames, key: 'n' + frames[0].time, at: Date.now() };
    });
  }

  function load() {
    if (!located()) return;
    loadForecast().catch(function (e) {
      TV.log('Forecast radar unavailable:', e.message);
      return loadNow();
    }).then(function (d) {
      var changed = !data || data.key !== d.key;
      data = d;
      if (changed) idx = restIdx();
      TV.widgets.update('radar');
    }).catch(function (e) {
      TV.log('Radar failed:', e.message);
      TV.widgets.update('radar');   // (hides the tile if the last good data is now too old)
    });
  }

  function forecastSrc(frame, i, w, h) {
    if (TV.demoForecastImage) return TV.demoForecastImage(i, w, h);
    return TV.forecastradar.mapUrl(frame.minute, TV.radarmath.bbox(TV.location.lat, TV.location.lon, zoom(), w, h), w, h);
  }
  function tileSrc(frame, i, t) {
    if (TV.demoRadarTile) return TV.demoRadarTile(i, t.x, t.y, ZOOM);
    return TV.radarmath.tileUrl(data.host, frame, 256, ZOOM, t.x, t.y, 2, '1_1');
  }
  function baseSrc(w, h) {
    if (token() === 'demo') return TV.demoBaseMap ? TV.demoBaseMap(isDark(), w, h) : '';
    return TV.mapurl.baseMapUrl({ token: token(), dark: isDark(), lon: TV.location.lon, lat: TV.location.lat, z: zoom(), width: w, height: h }) || '';
  }

  // The map picture: a base layer, one layer per radar frame (shown one at a time), and a pin on your place.
  function canvasHtml(w, h) {
    var g = data.mode === 'forecast' ? null : TV.radarmath.grid(TV.location.lat, TV.location.lon, ZOOM, w, h), base = baseSrc(w, h);
    var frames = data.frames.map(function (f, i) {
      if (!g) return '<div class="rd-frame" data-i="' + i + '"><img src="' + TV.esc(forecastSrc(f, i, w, h)) + '" style="left:0;top:0;width:' + w + 'px;height:' + h + 'px" alt="" draggable="false"></div>';
      return '<div class="rd-frame" data-i="' + i + '">' + g.tiles.map(function (t) {
        return '<img src="' + TV.esc(tileSrc(f, i, t)) + '" style="left:' + t.left + 'px;top:' + t.top + 'px" alt="" draggable="false">';
      }).join('') + '</div>';
    }).join('');
    return '<div class="rd-canvas" style="width:' + w + 'px;height:' + h + 'px;margin:' + (-h / 2) + 'px 0 0 ' + (-w / 2) + 'px">' +
      (base ? '<div class="rd-base" style="background-image:url(&quot;' + TV.esc(base) + '&quot;)"></div>' : '<div class="rd-plain"></div>') + frames + '</div>' +
      '<span class="rd-pin"></span>';
  }
  function dotsHtml() { return '<span class="rd-dots">' + data.frames.map(function (f) { return '<i></i>'; }).join('') + '</span>'; }
  function credit() { return '<span class="rd-credit">' + (data.mode === 'forecast' ? 'Forecast: NOAA HRRR model' : 'Weather data by RainViewer') + '</span>'; }

  // The picture is drawn at a fixed size and scaled to fill the tile (which can be anywhere from about 600 to 1200 px wide)
  function fit(root) {
    var map = root && TV.$('.rd-map', root), canvas = map && TV.$('.rd-canvas', map);
    if (!canvas) return;
    var w = parseFloat(canvas.style.width), h = parseFloat(canvas.style.height);
    var s = Math.max(1, map.clientWidth / w, map.clientHeight / h);
    canvas.style.transform = s > 1.001 ? 'scale(' + s.toFixed(3) + ')' : '';
  }

  // Show frame i on the tile and in the full-screen view
  function show(i) {
    if (!data) return;
    idx = (i + data.frames.length) % data.frames.length;
    [tileEl, detailEl].forEach(function (root) {
      if (!root || !document.body.contains(root)) return;
      fit(root);
      TV.$$('.rd-frame', root).forEach(function (f, k) { f.className = 'rd-frame' + (k === idx ? ' on' : ''); });
      TV.$$('.rd-dots i', root).forEach(function (d, k) { d.className = k === idx ? 'on' : ''; });
      var lab = TV.$('.rd-time', root), f = data.frames[idx];
      // The first forecast picture is the one valid closest to now (within about 8 minutes either way), so it just says Now
      if (lab) lab.textContent = data.mode === 'forecast' && idx === 0 ? 'Now' : TV.radarmath.ageText(f.time, Date.now());
    });
  }

  // The loop: a pause on the newest picture, then round again. It stops when nobody can see it, in Ambient Mode,
  // and when animations are not Full (then the newest picture just stays).
  function schedule() {
    clearTimeout(timer);
    if (!data) return;
    timer = setTimeout(function () {
      var visibleNow = (tileEl && document.body.contains(tileEl) && !document.body.classList.contains('ambient')) || (detailEl && !detailEl.hidden && document.body.contains(detailEl));
      if (visibleNow && playing && TV.motionOn()) show(idx + 1);
      schedule();
    }, idx === restIdx() ? 1900 : 650);
  }

  function still() { return !TV.motionOn() || !playing; }

  TV.widgets.register({
    id: 'radar',
    name: 'Rain Radar',
    span: 2,
    slot: 'top',   // drawn beside the weather card (see the registry and #top-row), not in the grid of tiles
    visible: function () { return fresh() && located(); },
    init: function () {
      TV.on('location', load);
      setInterval(load, 10 * 60 * 1000);
      TV.on('prefs', function () { if (data) { if (!TV.motionOn()) idx = restIdx(); TV.widgets.update('radar'); } });
    },
    render: function (el) {
      if (!data) return;
      var key = data.key + '|' + isDark() + '|' + (token() ? 1 : 0);
      if (el.getAttribute('data-built') !== key) {
        el.setAttribute('data-built', key);
        el.innerHTML = TV.widgetHeader('radar', data.mode === 'forecast' ? 'Rain Forecast' : 'Rain Radar') + '<span class="rd-time"></span><div class="rd-map">' + canvasHtml(768, 512) + credit() + dotsHtml() +
          (token() ? '' : '<span class="rd-note">Add a Mapbox token for a map</span>') + '</div>';
      }
      tileEl = el;
      fit(el);
      show(still() ? restIdx() : idx);
      schedule();
    },
    detail: function (el) {
      if (!data) { el.innerHTML = '<h2>Rain Radar</h2><div class="empty-note">No radar right now.</div>'; return; }
      var key = data.key + '|' + isDark() + '|' + (token() ? 1 : 0);
      if (el.getAttribute('data-built') !== key) {
        el.setAttribute('data-built', key);
        el.innerHTML = '<h2>' + (data.mode === 'forecast' ? 'Rain Forecast' : 'Rain Radar') + '</h2><span class="rd-time"></span><div class="rd-map big">' + canvasHtml(1280, 640) + credit() + dotsHtml() + '</div>' +
          '<div class="player-controls rd-controls">' +
            '<button class="player-btn" data-focus data-action="rd-prev" aria-label="Earlier">' + TV.icon('prev') + '</button>' +
            '<button class="player-btn main" data-focus data-autofocus data-action="rd-toggle" aria-label="Play or pause">' + TV.icon(playing ? 'pause' : 'play') + '</button>' +
            '<button class="player-btn" data-focus data-action="rd-next" aria-label="Later">' + TV.icon('next') + '</button></div>' +
          '<div class="hint">' + (data.mode === 'forecast' ? 'OK plays or pauses · Left and right step through the next few hours · A weather-model forecast, not a measurement · Stronger colors mean heavier rain' : 'OK plays or pauses · The latest picture of the rain right now · Stronger colors mean heavier rain') + '</div>';
      }
      detailEl = el;
      fit(el);
      show(idx);
    },
    detailAction: function (action) {
      if (action === 'rd-toggle') {
        playing = !playing;
        var b = detailEl && TV.$('[data-action="rd-toggle"]', detailEl);
        if (b) b.innerHTML = TV.icon(playing ? 'pause' : 'play');
      } else if (action === 'rd-prev') { playing = false; show(idx - 1); var t = detailEl && TV.$('[data-action="rd-toggle"]', detailEl); if (t) t.innerHTML = TV.icon('play'); }
      else if (action === 'rd-next') { playing = false; show(idx + 1); var t2 = detailEl && TV.$('[data-action="rd-toggle"]', detailEl); if (t2) t2.innerHTML = TV.icon('play'); }
    }
  });

  // for tests
  TV.radar = { show: show, state: function () { return { idx: idx, playing: playing, frames: data ? data.frames.length : 0 }; }, reload: load };
})(window.TV);
