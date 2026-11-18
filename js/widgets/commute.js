// Drive time with current traffic (Mapbox, free tier). Only shown during your commute window.
// With a Mapbox token it also draws a small map of the route (Mapbox Static Images). If the picture cannot be loaded,
// the tile simply stays text-only.
(function (TV) {
  var result = null; // { minutes, miles, at, geometry }
  var lastMinutes = null; // to brighten the number briefly when it changes
  var coords = null; // { from: [lon,lat], to: [lon,lat] }
  var mapFailedAt = 0;   // when a map picture last failed to load (we try again after 30 minutes)

  function cfg() { return TV_CONFIG.commute || {}; }
  function configured() { var c = cfg(); return !!(c.mapboxToken && c.from && c.to); }

  function minutesOf(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function inWindow() {
    var c = cfg(), from = minutesOf(c.showFrom), until = minutesOf(c.showUntil);
    if (from === null || until === null) return true;
    var now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    return from <= until ? (cur >= from && cur < until) : (cur >= from || cur < until);
  }

  function geocode(place) {
    var m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(place);
    if (m) return Promise.resolve([+m[2], +m[1]]); // 'lat,lon' -> [lon,lat]
    var url = 'https://api.mapbox.com/search/geocode/v6/forward?limit=1&q=' + encodeURIComponent(place) +
      '&access_token=' + encodeURIComponent(cfg().mapboxToken);
    return TV.fetchJSON(url).then(function (j) {
      if (!j.features || !j.features.length) throw new Error('Address not found: ' + place);
      return j.features[0].geometry.coordinates;
    });
  }

  function refresh() {
    if (!configured() || !inWindow()) { TV.widgets.update('commute'); return; }
    var c = cfg();
    var ready = coords ? Promise.resolve(coords) : Promise.all([geocode(c.from), geocode(c.to)]).then(function (r) {
      coords = { from: r[0], to: r[1] };
      return coords;
    });
    ready.then(function (cc) {
      // overview=simplified gives a short route line for the map (geometries=polyline is the compact encoding Mapbox's static maps accept)
      var url = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
        cc.from.join(',') + ';' + cc.to.join(',') +
        '?overview=simplified&geometries=polyline&access_token=' + encodeURIComponent(c.mapboxToken);
      return TV.fetchJSON(url);
    }).then(function (j) {
      if (!j.routes || !j.routes.length) throw new Error('No route found');
      var r = j.routes[0];
      result = { minutes: Math.round(r.duration / 60), miles: r.distance / 1609.344, at: new Date(), geometry: typeof r.geometry === 'string' ? r.geometry : '' };
      TV.widgets.update('commute');
    }).catch(function (e) {
      TV.log('Commute failed:', e.message);
      result = result || { error: e.message };
      TV.widgets.update('commute');
    });
  }

  // ---- the map picture
  function isDark() { return document.body.classList.contains('mode-dark'); }
  function mapAllowed() { return !!(result && !result.error && coords && Date.now() - mapFailedAt > 30 * 60000); }

  // The picture is asked for at about twice the size it is shown, so it stays sharp.
  function mapUrl(w, h) {
    if (!mapAllowed()) return '';
    if (cfg().mapboxToken === 'demo') return TV.demoRouteMap ? TV.demoRouteMap(isDark(), w, h) : '';
    var m = TV.mapurl.routeMapUrl({ token: cfg().mapboxToken, dark: isDark(), polyline: result.geometry, from: coords.from, to: coords.to, width: w * 2, height: h * 2 });
    return m ? m.url : '';
  }
  // How big the map is on this tile, from the layout it is in (the CSS decides where it sits)
  function tileMapSize(el) {
    var large = document.body.getAttribute('data-clock-size') === 'l';
    if (el.classList.contains('w-wide')) return [340, 270];
    if (el.classList.contains('w-narrow')) return [331, large ? 80 : 120];
    return [150, 112];   // the small square in the compact grid
  }
  function watchMap(el, url) {
    var img = new Image();
    img.onerror = function () { mapFailedAt = Date.now(); el.classList.remove('has-map'); var m = TV.$('.cm-map', el); if (m) m.parentNode.removeChild(m); };
    img.src = url;
  }

  TV.widgets.register({
    id: 'commute',
    name: 'Commute Time',
    visible: function () { return configured() && inWindow(); },
    init: function () {
      if (!configured()) return;
      refresh();
      setInterval(refresh, 10 * 60 * 1000);
      TV.on('prefs', function () { TV.widgets.update('commute'); });
    },
    render: function (el) {
      var c = cfg(), body, url = '';
      if (!result) body = '<div class="empty-note">Checking traffic…</div>';
      else if (result.error) body = '<div class="empty-note">Couldn’t get drive time.<br>' + TV.esc(result.error) + '</div>';
      else {
        var leaveBy = new Date(Date.now() + result.minutes * 60000);
        var size = tileMapSize(el);
        url = mapUrl(size[0], size[1]);
        body = (url ? '<div class="cm-map" style="background-image:url(&quot;' + TV.esc(url) + '&quot;)"></div>' : '') +
          '<div class="commute-time">' + result.minutes + '<span> min</span></div>' +
          '<div class="commute-sub">to ' + TV.esc(c.label || 'Work') + ' · ' + result.miles.toFixed(1) + ' mi</div>' +
          '<div class="commute-sub">Leave now, arrive about ' + TV.fmtTime(leaveBy) + '</div>' +
          '<div class="commute-updated">Updated ' + TV.fmtTime(result.at) + ' with live traffic</div>';
      }
      el.classList.toggle('has-map', !!url);
      el.innerHTML = TV.widgetHeader('car', 'Commute') + body;
      if (url) watchMap(el, url);
      if (result && !result.error) {
        if (lastMinutes !== null && lastMinutes !== result.minutes) TV.play(TV.$('.commute-time', el), 'bump');
        lastMinutes = result.minutes;
      }
    },
    detail: function (el) {
      var c = cfg();
      var html = '<h2>Commute to ' + TV.esc(c.label || 'Work') + '</h2>';
      if (result && !result.error) {
        var arrive = new Date(Date.now() + result.minutes * 60000), url = mapUrl(640, 200);
        html += (url ? '<div class="dc-map" style="background-image:url(&quot;' + TV.esc(url) + '&quot;)"></div>' : '') +
          '<div class="dc-time">' + result.minutes + '<span> min</span></div>' +
          '<div class="dsm-label">' + result.miles.toFixed(1) + ' miles · with live traffic</div>' +
          '<div class="dsm-label">Leave now and arrive about ' + TV.fmtTime(arrive) + '</div>' +
          '<div class="dsm-label">Updated ' + TV.fmtTime(result.at) + '</div>';
      } else {
        html += '<div class="empty-note">' + (result ? 'Couldn’t get drive time: ' + TV.esc(result.error) : 'Checking traffic…') + '</div>';
      }
      html += '<button class="btn primary" data-focus data-action="refresh">Update Now</button>';
      el.innerHTML = html;
    },
    detailAction: function (action) { if (action === 'refresh') refresh(); }
  });
})(window.TV);
