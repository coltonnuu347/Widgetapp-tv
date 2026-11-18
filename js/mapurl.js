// Builds the Mapbox Static Images URLs used for the commute map and the radar's base map. Pure functions, so they
// are easy to test. Nothing here talks to the network.
//
// Mapbox's Static Images format (from their docs and examples):
//   /styles/v1/{user}/{style}/static/{overlays}/{lon},{lat},{zoom},{bearing},{pitch}|auto/{w}x{h}[@2x]?access_token=...
//   path overlay:  path-{strokeWidth}+{hexColor}-{opacity}({encoded polyline})   (the polyline must be URL-encoded)
//   marker:        pin-s-a+{hexColor}({lon},{lat})
// Requests are limited to 8,192 characters, so a very long route falls back to the two pins.
(function (root) {
  var HOST = 'https://api.mapbox.com/styles/v1/mapbox/';
  var MAX_URL = 8000;   // a safety margin under Mapbox's 8,192 character limit

  function pt(p) { return (+p[0]).toFixed(5) + ',' + (+p[1]).toFixed(5); }
  function size(w, h) { return Math.max(1, Math.min(1280, Math.round(w))) + 'x' + Math.max(1, Math.min(1280, Math.round(h))); }
  function styleFor(dark) { return dark ? 'dark-v11' : 'light-v11'; }

  // o: { token, dark, polyline (encoded, precision 5, may be ''), from: [lon, lat], to: [lon, lat], width, height, color (hex without #), padding }
  // Returns { url, usedPath } or null when there is nothing to draw.
  function routeMapUrl(o) {
    if (!o || !o.token || !o.from || !o.to) return null;
    var pins = 'pin-s-a+ffffff(' + pt(o.from) + '),pin-s-b+ffffff(' + pt(o.to) + ')';
    var tail = '/auto/' + size(o.width || 640, o.height || 400) + '?padding=' + (o.padding == null ? 48 : o.padding) + '&access_token=' + encodeURIComponent(o.token);
    var base = HOST + styleFor(o.dark) + '/static/';
    if (o.polyline) {
      var path = 'path-6+' + (o.color || 'ff9f0a') + '-0.9(' + encodeURIComponent(o.polyline) + ')';
      var withPath = base + path + ',' + pins + tail;
      if (withPath.length <= MAX_URL) return { url: withPath, usedPath: true };
    }
    return { url: base + pins + tail, usedPath: false };
  }

  // The plain base map for the radar: centered on a point at a tile zoom level z (256 px tiles).
  // Mapbox's zoom for 512 px tiles is one lower, so the same ground fills the same pixels as the radar tiles.
  function baseMapUrl(o) {
    if (!o || !o.token) return null;
    var glZoom = Math.max(0, o.z - 1);
    return HOST + styleFor(o.dark) + '/static/' + (+o.lon).toFixed(5) + ',' + (+o.lat).toFixed(5) + ',' + glZoom + ',0/' + size(o.width, o.height) + '?access_token=' + encodeURIComponent(o.token);
  }

  var api = { routeMapUrl: routeMapUrl, baseMapUrl: baseMapUrl, styleFor: styleFor, MAX_URL: MAX_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.mapurl = api; }
})(typeof window !== 'undefined' ? window : this);
