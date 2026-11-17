// Where the TV is. Order of preference:
// 1. a location typed in Settings, 2. config.local.js, 3. automatic (IP-based, city-level), 4. last known.
(function (TV) {
  var CACHE_KEY = 'tvdash.location.auto';

  function fromIpapi() {
    return TV.fetchJSON('https://ipapi.co/json/').then(function (j) {
      if (j.error || typeof j.latitude !== 'number') throw new Error('ipapi.co: ' + (j.reason || 'no location'));
      return { name: j.city || '', region: j.region_code || '', country: j.country_code || '', lat: j.latitude, lon: j.longitude };
    });
  }
  function fromGeojs() {
    return TV.fetchJSON('https://get.geojs.io/v1/ip/geo.json').then(function (j) {
      var lat = parseFloat(j.latitude), lon = parseFloat(j.longitude);
      if (isNaN(lat) || isNaN(lon)) throw new Error('geojs: no location');
      return { name: j.city || '', region: j.region || '', country: j.country_code || '', lat: lat, lon: lon };
    });
  }

  TV.getLocation = function () {
    var manual = TV.settings.manualLocation;
    if (manual && typeof manual.lat === 'number') return Promise.resolve(manual);
    var cfg = TV_CONFIG.location || {};
    if (typeof cfg.lat === 'number' && typeof cfg.lon === 'number') {
      return Promise.resolve({ name: cfg.name || '', region: cfg.region || '', country: cfg.country || 'US', lat: cfg.lat, lon: cfg.lon });
    }
    return fromIpapi().catch(function (e) {
      TV.log('Location lookup 1 failed:', e.message);
      return fromGeojs();
    }).then(function (loc) {
      TV.storage.set(CACHE_KEY, loc);
      return loc;
    }).catch(function (e) {
      TV.log('Location lookup 2 failed:', e.message);
      var cached = TV.storage.get(CACHE_KEY, null);
      if (cached) return cached;
      throw new Error('Could not find your location. Set it in Settings.');
    });
  };

  // Search a city name or ZIP code. Returns up to 5 matches.
  TV.searchPlace = function (query) {
    query = String(query || '').trim();
    if (query.length < 2) return Promise.resolve([]);
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=' + encodeURIComponent(query);
    return TV.fetchJSON(url).then(function (j) {
      var list = (j.results || []).map(function (r) {
        return {
          name: r.name, region: r.admin1 || '', country: r.country_code || '',
          lat: r.latitude, lon: r.longitude
        };
      });
      // A 5-digit number is almost certainly a US ZIP code: show US matches first.
      if (/^\d{5}$/.test(query)) {
        list.sort(function (a, b) { return (a.country === 'US' ? 0 : 1) - (b.country === 'US' ? 0 : 1); });
      }
      return list.slice(0, 5);
    });
  };

  TV.placeLabel = function (p) {
    if (!p) return '';
    return [p.name, p.region].filter(Boolean).join(', ');
  };
})(window.TV);
