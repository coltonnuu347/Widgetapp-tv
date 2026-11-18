// Rain radar maths: which map tiles cover a picture of a given size centered on a place, and which radar frames to show.
// Pure functions, so they are easy to test. Nothing here talks to the network.
//
// Web Mercator tile maths (the "slippy map" scheme used by RainViewer's tiles and by Mapbox):
//   at zoom z there are 2^z by 2^z tiles of 256 px; x grows eastward, y grows southward.
(function (root) {
  var TILE = 256;

  function tileX(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
  function tileY(lat, z) {
    var r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  }

  // The tiles needed to fill a w x h picture centered on (lat, lon) at zoom z, with where each tile goes in the picture.
  // Returns { fx, fy, tiles: [{ x, y, left, top }] }. Tiles above/below the map are left out; x wraps around the world.
  function grid(lat, lon, z, w, h) {
    var n = Math.pow(2, z), fx = tileX(lon, z), fy = tileY(lat, z), tiles = [];
    var x0 = Math.floor(fx - w / 2 / TILE), x1 = Math.floor(fx + w / 2 / TILE);
    var y0 = Math.floor(fy - h / 2 / TILE), y1 = Math.floor(fy + h / 2 / TILE);
    for (var ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (var tx = x0; tx <= x1; tx++) {
        tiles.push({ x: ((tx % n) + n) % n, y: ty, left: Math.round(w / 2 + (tx - fx) * TILE), top: Math.round(h / 2 + (ty - fy) * TILE) });
      }
    }
    return { fx: fx, fy: fy, tiles: tiles };
  }

  // radar: the "radar" object of RainViewer's weather-maps.json: { past: [{ time, path }], nowcast: [{ time, path }] }.
  // Picks `count` frames from the past (evenly spread, ending with the newest) and, if asked, up to `forecast` nowcast frames.
  function pickFrames(radar, count, forecast) {
    var past = (radar && radar.past) || [], out = [], i;
    if (past.length) {
      var take = Math.min(count, past.length);
      for (i = 0; i < take; i++) {
        var idx = take === 1 ? past.length - 1 : Math.round(i * (past.length - 1) / (take - 1));
        out.push({ time: past[idx].time, path: past[idx].path, forecast: false });
      }
    }
    var now = (radar && radar.nowcast) || [];
    for (i = 0; i < now.length && i < (forecast || 0); i++) out.push({ time: now[i].time, path: now[i].path, forecast: true });
    return out;
  }

  // Where a radar tile image lives: {host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png
  function tileUrl(host, frame, size, z, x, y, color, options) {
    return host + frame.path + '/' + size + '/' + z + '/' + x + '/' + y + '/' + (color == null ? 2 : color) + '/' + (options || '1_1') + '.png';
  }

  // "Now", "20 min ago", "1 h 20 min ago", "in 10 min" for a frame time (seconds since 1970) compared with `nowMs`.
  function ageText(frameSec, nowMs) {
    var m = Math.round((nowMs / 1000 - frameSec) / 60);
    if (Math.abs(m) < 5) return 'Now';
    if (m < 0) return 'in ' + (-m) + ' min';
    if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '') + ' ago';
  }

  var api = { TILE: TILE, tileX: tileX, tileY: tileY, grid: grid, pickFrames: pickFrames, tileUrl: tileUrl, ageText: ageText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.radarmath = api; }
})(typeof window !== 'undefined' ? window : this);
