// Turns album art into four background colors. Pure functions, so they are easy to test.
// The colors are kept inside the same brightness range the theme backgrounds use, so the readability
// checks that cover every theme also cover album backgrounds.
(function (root) {
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255].reduce(function (sum, v, i) {
      v /= 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      return sum + v * [0.2126, 0.7152, 0.0722][i];
    }, 0);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, out = '#';
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    [f(h + 1 / 3), f(h), f(h - 1 / 3)].forEach(function (v) { var x = Math.round(v * 255); out += (x < 16 ? '0' : '') + x.toString(16); });
    return out;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Move a color toward black until its brightness (relative luminance) is at most maxLum.
  function capLum(hex, maxLum) {
    var i = 0;
    while (i++ < 40 && lum(hex) > maxLum) {
      var n = parseInt(hex.slice(1), 16);
      hex = '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v = Math.round(v * 0.94); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
    }
    return hex;
  }

  // data: RGBA bytes of an n x n picture. Returns { base, colors: [4 hex], hue } (top-left, top-right,
  // bottom-left, bottom-right), or null when the art is grey or nearly black/white (keep the theme then).
  function albumPalette(data, n, maxLum) {
    var half = n / 2, q = [0, 1, 2, 3].map(function () { return { r: 0, g: 0, b: 0, w: 0 }; }), x, y;
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        var i = (y * n + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
        var hsl = rgbToHsl(r, g, b), s = hsl[1], v = Math.max(r, g, b) / 255;
        var w = 0.05 + s * v * (1 - Math.abs(hsl[2] - 0.5));       // prefer vivid, mid-bright pixels
        var k = (y >= half ? 2 : 0) + (x >= half ? 1 : 0);
        q[k].r += r * w; q[k].g += g * w; q[k].b += b * w; q[k].w += w;
      }
    }
    var hsls = q.map(function (c) { return rgbToHsl(c.r / c.w, c.g / c.w, c.b / c.w); });
    var maxS = Math.max.apply(null, hsls.map(function (h) { return h[1]; }));
    if (maxS < 0.14) return null;
    var best = hsls.reduce(function (a, c) { return c[1] > a[1] ? c : a; }, hsls[0]);
    var colors = hsls.map(function (h) {
      var hue = h[1] < 0.1 ? best[0] : h[0];                       // a grey corner borrows the main hue
      return capLum(hslToHex(hue, clamp(h[1] * 1.2, 0.4, 0.95), clamp(h[2], 0.28, 0.56)), maxLum);
    });
    return { base: hslToHex(best[0], 0.6, 0.1), colors: colors, hue: Math.round(best[0]) };
  }

  var api = { albumPalette: albumPalette, capLum: capLum, lum: lum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.palette = api; }
})(typeof window !== 'undefined' ? window : this);
