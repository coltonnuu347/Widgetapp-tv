// Forecast radar: what rain the weather model expects over the next few hours, as map pictures laid over the base map.
//
// Source: the Iowa Environmental Mesonet (Iowa State University) serves NOAA/NCEP's HRRR model "simulated reflectivity" as a free
// WMS map service (https://mesonet.agron.iastate.edu/cgi-bin/wms/hrrr/refd.cgi). Layers are named refd_<minutes> (0, 15, 30 ... ahead of the
// model run's start), and a small JSON file per layer says which model run it is from and the exact time it is valid for.
// It covers the lower 48 states (24-50 N, 126-66 W). This is a MODEL FORECAST, not a measurement. Pure functions: no network here.
(function (root) {
  var WMS = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/hrrr/refd.cgi';
  var META = 'https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/';
  var COVER = { minLat: 24, maxLat: 50, minLon: -126, maxLon: -66 };
  var STEP_MAX = 1080;   // the 15-minute layers run to 18 hours; after that they are hourly

  function pad4(n) { var s = String(Math.round(n)); while (s.length < 4) s = '0' + s; return s; }
  function layerName(minute) { return 'refd_' + pad4(minute); }
  // The JSON with { model_init_utc, forecast_minute, model_forecast_utc } for a layer
  function metaUrl(minute) { return META + layerName(minute) + '.json'; }
  function covers(lat, lon) { return lat >= COVER.minLat && lat <= COVER.maxLat && lon >= COVER.minLon && lon <= COVER.maxLon; }

  // A transparent PNG of one forecast layer for a Web Mercator box (see radarmath.bbox) at w x h pixels.
  function mapUrl(minute, bbox, w, h) {
    if (!bbox) return '';
    return WMS + '?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=' + layerName(minute) + '&STYLES=&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=true' +
      '&BBOX=' + [bbox.minx, bbox.miny, bbox.maxx, bbox.maxy].map(function (v) { return v.toFixed(2); }).join(',') +
      '&WIDTH=' + Math.round(w) + '&HEIGHT=' + Math.round(h);
  }

  // Which layers to show: the one valid closest to now, then every `stepMin` minutes after it, `count` in all.
  // initSec: when the model run started (seconds since 1970); nowMs: the current time. Returns [{ minute, time }] with time in seconds.
  function pickFrames(initSec, nowMs, count, stepMin) {
    if (!(initSec > 0)) return [];
    var ahead = (nowMs / 1000 - initSec) / 60;             // minutes since the run started
    var first = Math.max(0, Math.round(ahead / 15) * 15);  // the layer valid right now (layers are 15 minutes apart)
    var out = [], step = Math.max(15, Math.round((stepMin || 30) / 15) * 15);
    for (var i = 0; i < count; i++) {
      var m = first + i * step;
      if (m > STEP_MAX) break;
      out.push({ minute: m, time: initSec + m * 60 });
    }
    return out;
  }

  // "2026-11-19T14:00:00Z" -> seconds since 1970 (NaN when it is not a date)
  function parseUtc(s) { var t = Date.parse(s); return isNaN(t) ? NaN : t / 1000; }

  var api = { layerName: layerName, metaUrl: metaUrl, mapUrl: mapUrl, covers: covers, pickFrames: pickFrames, parseUtc: parseUtc, COVER: COVER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.forecastradar = api; }
})(typeof window !== 'undefined' ? window : this);
