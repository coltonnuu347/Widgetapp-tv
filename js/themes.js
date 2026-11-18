// Background (gradients, photos, NASA) and Light/Dark appearance.
(function (TV) {
  // Slowly drifting, breathing gradients. Each theme has:
  //   base   - the deep background color      blobs - four bright "light" spots
  //   accent - buttons, toggles (white text on it is at least 4.5:1)
  //   tint   - color mixed into the card glass
  //   glow   - theme-colored text/icons on dark cards     ink - the same on light cards
  // Contrast for every theme is checked in both modes (see README, Design notes).
  TV.GRADIENTS = [
    // Single-color themes
    { id: 'purple', name: 'Purple', mono: true, base: '#2e0466', blobs: ['#a020f0', '#c64dff', '#7a00ff', '#e07bff'], accent: '#7B2CBF', tint: '#9b30ff', glow: '#e3c2ff', ink: '#560d96', tintDark: 0.26, tintLight: 0.20 },
    { id: 'red', name: 'Red', mono: true, base: '#4a0610', blobs: ['#ff2d2d', '#ff5e5e', '#e00030', '#ff8a80'], accent: '#D70015', tint: '#ff3b30', glow: '#ffa39e', ink: '#a10010' },
    { id: 'orange', name: 'Orange', mono: true, base: '#4a1a00', blobs: ['#ff8c00', '#ffa94d', '#ff6a00', '#ffc078'], accent: '#C93400', tint: '#ff9500', glow: '#ffc68a', ink: '#943500' },
    { id: 'yellow', name: 'Yellow', mono: true, base: '#3d2f00', blobs: ['#ffd60a', '#ffe14d', '#ffc300', '#fff07a'], accent: '#A05A00', tint: '#ffd60a', glow: '#ffe680', ink: '#6e4a00' },
    { id: 'green', name: 'Green', mono: true, base: '#06331a', blobs: ['#30d158', '#6ee7a0', '#00b341', '#a8f0b8'], accent: '#1E7B34', tint: '#30d158', glow: '#9af2b3', ink: '#17602a' },
    { id: 'mint', name: 'Mint', mono: true, base: '#003b36', blobs: ['#00e0c0', '#5cf2d6', '#00c7be', '#a6fff0'], accent: '#00796B', tint: '#00c7be', glow: '#8af7e8', ink: '#005c53' },
    { id: 'teal', name: 'Teal', mono: true, base: '#00323d', blobs: ['#00bcd4', '#4dd8f0', '#0097a7', '#8ef0ff'], accent: '#0071A4', tint: '#30b0c7', glow: '#9aeaf7', ink: '#005a75' },
    { id: 'blue', name: 'Blue', mono: true, base: '#04194d', blobs: ['#0a84ff', '#4da3ff', '#0055ff', '#80c4ff'], accent: '#0071E3', tint: '#0a84ff', glow: '#9ccbff', ink: '#004a9e' },
    { id: 'indigo', name: 'Indigo', mono: true, base: '#150f4d', blobs: ['#5e5ce6', '#8785ff', '#3d3ad8', '#b3b1ff'], accent: '#5856D6', tint: '#5e5ce6', glow: '#bdbcff', ink: '#33319c' },
    { id: 'pink', name: 'Pink', mono: true, base: '#4a0526', blobs: ['#ff2d78', '#ff7eb6', '#e6005c', '#ffaad0'], accent: '#D30F45', tint: '#ff2d78', glow: '#ffa6c9', ink: '#9c0038' },
    { id: 'coral', name: 'Coral', mono: true, base: '#4a1310', blobs: ['#ff6b5b', '#ff9580', '#ff4f3f', '#ffb8a8'], accent: '#C2412D', tint: '#ff6b5b', glow: '#ffb3a8', ink: '#9a2e1e' },
    { id: 'magenta', name: 'Magenta', mono: true, base: '#45063f', blobs: ['#ff2bd6', '#ff73e8', '#d100b1', '#ffb0f2'], accent: '#B0109A', tint: '#e831c8', glow: '#ffa8f2', ink: '#850a74' },
    { id: 'midnight', name: 'Midnight', mono: true, base: '#000000', blobs: ['#1c1c2e', '#2c2c3e', '#101018', '#3a3a50'], accent: '#48484A', tint: '#5a5a7a', glow: '#cfcfe6', ink: '#3a3a50' },
    // Colorful themes
    { id: 'sunrise', name: 'Sunrise', base: '#3a1460', blobs: ['#ff7a45', '#ffb347', '#d24dff', '#5b6cff'], accent: '#0071E3', tint: '#ff8a5c', glow: '#ffc4a3', ink: '#9a3412' },
    { id: 'neon', name: 'Neon', base: '#12002a', blobs: ['#ff00c8', '#00f0ff', '#8a00ff', '#00ff9c'], accent: '#C2007A', tint: '#ff00c8', glow: '#ff9ae9', ink: '#99006b' },
    { id: 'sunset', name: 'Sunset', base: '#3d0a2e', blobs: ['#ff6a00', '#ff2d78', '#9b30ff', '#ffb300'], accent: '#C93400', tint: '#ff6a3d', glow: '#ffb894', ink: '#9a2f08' },
    { id: 'ocean', name: 'Ocean', base: '#032a52', blobs: ['#00c2ff', '#0077ff', '#3de0ff', '#6a5cff'], accent: '#0071E3', tint: '#00b4d8', glow: '#9ae8ff', ink: '#005a8f' },
    { id: 'aurora', name: 'Aurora', base: '#061a33', blobs: ['#2ef5a0', '#00d4b0', '#5b8cff', '#b45cff'], accent: '#0071A4', tint: '#2ee59d', glow: '#99f7d1', ink: '#00664f' },
    { id: 'tropical', name: 'Tropical', base: '#003b3d', blobs: ['#00d4c0', '#b4f000', '#ffd400', '#00a8ff'], accent: '#00796B', tint: '#00d4c0', glow: '#99f7ea', ink: '#005e55' },
    { id: 'dusk', name: 'Dusk', base: '#2a0f45', blobs: ['#ff4d7a', '#ff9966', '#8a2ff7', '#ff1fb0'], accent: '#D30F45', tint: '#ff5e7e', glow: '#ffadbf', ink: '#9e1239' },
    { id: 'cottoncandy', name: 'Cotton Candy', base: '#3a1a4d', blobs: ['#ff9ad5', '#9ad5ff', '#ffb8e8', '#b8a8ff'], accent: '#C2185B', tint: '#ff9ad5', glow: '#ffc9ea', ink: '#a01650' },
    { id: 'meadow', name: 'Meadow', base: '#0b331d', blobs: ['#a6ff4d', '#00f0b0', '#ffe02e', '#2ec27e'], accent: '#1E7B34', tint: '#7ee05d', glow: '#bdf5a3', ink: '#28650f' },
    { id: 'graphite', name: 'Graphite', base: '#1c1c1e', blobs: ['#6e6e73', '#48484a', '#8e8e93', '#3a3a3c'], accent: '#636366', tint: '#8e8e93', glow: '#d8d8dc', ink: '#3a3a3c' }
  ];

  TV.nasaPhoto = null; // set by the NASA widget: { url, title }

  // Where a wallpaper file lives (the single-file preview supplies TV.wallData instead of real files)
  TV.wallUrl = function (f) { return (TV.wallData && TV.wallData[f]) || 'images/wallpapers/' + encodeURIComponent(f); };

  function gradientById(id) {
    for (var i = 0; i < TV.GRADIENTS.length; i++) if (TV.GRADIENTS[i].id === id) return TV.GRADIENTS[i];
    return TV.GRADIENTS[0];
  }

  TV.gradientPreview = function (g) {
    return 'radial-gradient(circle at 20% 25%, ' + g.blobs[0] + ' 0, transparent 55%),' +
      'radial-gradient(circle at 80% 30%, ' + g.blobs[1] + ' 0, transparent 55%),' +
      'radial-gradient(circle at 30% 85%, ' + g.blobs[2] + ' 0, transparent 55%),' +
      'radial-gradient(circle at 85% 85%, ' + g.blobs[3] + ' 0, transparent 55%),' + g.base;
  };

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ', ' + a + ')';
  }

  function mixHex(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = '#';
    [16, 8, 0].forEach(function (sh) {
      var v = Math.round(((x >> sh) & 255) * t + ((y >> sh) & 255) * (1 - t));
      out += (v < 16 ? '0' : '') + v.toString(16);
    });
    return out;
  }

  // Same color, hue turned by `deg` degrees (used for each theme's second accent).
  function hueShift(hex, deg) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    h = (h + deg + 360) % 360;
    function f(p, q, t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, hh = h / 360, out = '#';
    [f(p, q, hh + 1 / 3), f(p, q, hh), f(p, q, hh - 1 / 3)].forEach(function (v) {
      var x = Math.round(v * 255); out += (x < 16 ? '0' : '') + x.toString(16);
    });
    return out;
  }
  TV.hueShift = hueShift;

  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255].reduce(function (sum, v, i) {
      v /= 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      return sum + v * [0.2126, 0.7152, 0.0722][i];
    }, 0);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  // Color helpers shared with the Spotify tile
  TV.hslToHex = function (h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, out = '#';
    function f(t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
    [f(h + 1 / 3), f(h), f(h - 1 / 3)].forEach(function (v) { var x = Math.round(v * 255); out += (x < 16 ? '0' : '') + x.toString(16); });
    return out;
  };
  // Move a color toward white (lighten) or black until it has at least `min`:1 contrast with `ref`.
  TV.ensureContrast = function (hex, ref, min, lighten) {
    var i = 0;
    while (i++ < 30 && contrast(hex, ref) < min) hex = mixHex(hex, lighten ? '#FFFFFF' : '#000000', 0.9);
    return hex;
  };

  // The theme's second accent (the weather curve, progress lines): the theme color turned 35 degrees,
  // then nudged lighter (dark mode) or darker (light mode) until it stands out from the glass.
  TV.accent2 = function (theme, dark) {
    var c = hueShift(dark ? theme.glow : theme.ink, 35), ref = dark ? '#40384e' : '#f1e7fa', i = 0;
    while (i++ < 30 && contrast(c, ref) < 4.2) c = mixHex(c, dark ? '#FFFFFF' : '#000000', 0.9);
    return c;
  };

  function isDarkNow() {
    var mode = TV.settings.theme.mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    var now = new Date(), w = TV.weather;
    if (w && w.today) return now < w.today.sunrise || now >= w.today.sunset;
    var h = now.getHours();
    return h < 7 || h >= 19;
  }

  TV.applyTheme = function () {
    var t = TV.settings.theme;
    var dark = isDarkNow();
    document.body.classList.toggle('mode-dark', dark);
    document.body.classList.toggle('mode-light', !dark);

    // Theme colors apply everywhere (also when a photo is the background).
    var theme = gradientById(t.gradient), st = document.body.style;
    st.setProperty('--accent', theme.accent);
    st.setProperty('--glow', theme.glow);
    st.setProperty('--ink', theme.ink);
    // Tint strengths are part of the contrast check; Purple uses a stronger tint.
    st.setProperty('--tint-a', rgba(theme.tint, dark ? (theme.tintDark || 0.14) : (theme.tintLight || 0.12)));
    st.setProperty('--tint-orb', rgba(theme.glow, 0.18));
    // Bottom color of the lit clock digits: 45% theme color (dark mode), checked for contrast in every theme.
    st.setProperty('--clock-low', mixHex(theme.glow, '#FFFFFF', 0.45));
    st.setProperty('--clock-low-ink', mixHex(theme.ink, '#000000', 0.45));
    st.setProperty('--tint-b', rgba(theme.tint, 0.35));
    // Second accent: the theme color turned 35 degrees, for the weather curve and progress lines.
    st.setProperty('--accent2', TV.accent2(theme, dark));
    st.setProperty('--ol-theme', dark ? rgba(theme.glow, 0.60) : rgba(theme.accent, 0.66)); // outline color
    st.setProperty('--ol-top', dark ? rgba(theme.glow, 0.95) : rgba(theme.accent, 0.95)); // brighter top edge

    var gradEl = TV.$('#bg-gradient');
    var photoUrl = '', walls = TV_CONFIG.wallpapers || [], moving = false, chosen = false, art = TV.artById(t.art), scrim = null;
    if (t.style === 'photo' && t.photo && walls.indexOf(t.photo) >= 0) {
      photoUrl = TV.wallUrl(t.photo); chosen = true;
    } else if (t.style === 'art' && art) {
      photoUrl = TV.artUrl(art); chosen = true; scrim = art.scrim;
    } else if (t.style === 'nasa' && TV.nasaPhoto) {
      photoUrl = TV.nasaPhoto.url; chosen = true;
    } else {
      // Slideshow (artwork and your photos), or Ambient Mode's photo frame (your photos): one picture
      // after another, each with a slow pan
      var list = slideList();
      if (list.length) { var item = list[slideIndex % list.length]; photoUrl = item.url; scrim = item.scrim; moving = true; chosen = t.style === 'slideshow'; }
    }
    // A picture you chose as the background always wins over the album colors (see TV.setAlbumBackground)
    photoChosen = chosen && !!photoUrl;
    // Built-in artwork is mostly dark, so in Dark mode it needs a lighter readability layer than a random photo
    if (scrim != null && photoUrl && dark) st.setProperty('--scrim', 'rgba(0, 0, 0, ' + scrim + ')'); else st.removeProperty('--scrim');

    if (photoUrl) {
      showPhoto(photoUrl, moving);
      gradEl.style.opacity = '0';
    } else {
      var g = theme;
      gradEl.style.backgroundColor = g.base;
      TV.$$('.blob', gradEl).forEach(function (b, i) {
        b.style.background = 'radial-gradient(circle, ' + g.blobs[i] + ' 0%, ' + g.blobs[i] + ' 22%, transparent 68%)';
      });
      gradEl.style.opacity = '1';
      showPhoto('', false);
    }
    if (TV.syncAlbum) TV.syncAlbum();
  };

  // ---------- Photos: two layers, so one photo fades into the next ----------
  var photoFront = 0, shownUrl = '', slideIndex = 0, ambientSlides = false, photoChosen = false, SLIDE_MS = 120 * 1000;
  // True while the background is a picture you picked (photo, artwork, NASA or the slideshow)
  TV.photoThemeActive = function () { return photoChosen; };
  // What the slideshow cycles through: the Slideshow theme uses the artwork and your photos together;
  // Ambient Mode's photo frame uses only your own photos.
  function slideList() {
    var out = [], style = TV.settings.theme.style;
    if (style === 'slideshow') TV.ART.forEach(function (a) { out.push({ url: TV.artUrl(a), scrim: a.scrim }); });
    if (style === 'slideshow' || ambientSlides) (TV_CONFIG.wallpapers || []).forEach(function (f) { out.push({ url: TV.wallUrl(f), scrim: null }); });
    return out;
  }
  TV.slideCount = function () { return slideList().length; };
  function showPhoto(url, moving) {
    var layers = [TV.$('#bg-photo'), TV.$('#bg-photo2')], cur = layers[photoFront], next = layers[1 - photoFront];
    if (!url) { layers[0].style.opacity = '0'; layers[1].style.opacity = '0'; shownUrl = ''; return; }
    if (url === shownUrl) { cur.classList.toggle('kb', !!moving); return; }
    next.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
    // Each photo drifts toward a different corner
    next.style.transformOrigin = ['20% 30%', '80% 30%', '25% 75%', '75% 70%'][slideIndex % 4];
    next.classList.toggle('kb', false); void next.offsetWidth;
    if (moving) next.classList.add('kb');
    next.style.opacity = '1';
    if (shownUrl) cur.style.opacity = '0';
    photoFront = 1 - photoFront;
    shownUrl = url;
  }
  setInterval(function () { TV.nextSlide(); }, SLIDE_MS);
  // Used by Ambient Mode: show your photos as a slideshow while the screen is resting.
  TV.setAmbientSlides = function (on) { ambientSlides = !!on; TV.applyTheme(); };
  TV.nextSlide = function () {
    var n = slideList().length;
    if (n > 1) { slideIndex = (slideIndex + 1) % n; TV.applyTheme(); }
  };

  // ---------- Album background (Spotify) ----------
  // Four colors taken from the cover art replace the theme's colored lights. They are kept inside the
  // brightness range the themes use, so text stays as readable as on any theme.
  var maxBlobLum = 0;
  TV.GRADIENTS.forEach(function (g) { g.blobs.concat([g.base]).forEach(function (c) { maxBlobLum = Math.max(maxBlobLum, lum(c)); }); });
  TV.maxBlobLum = maxBlobLum;
  var albumKey = '', albumTimer = null;
  TV.setAlbumBackground = function (pal) {
    var el = TV.$('#bg-album');
    if (!el) return;
    clearTimeout(albumTimer);
    if (!pal) { el.classList.toggle('on', false); document.body.classList.toggle('album-on', false); albumKey = ''; return; }
    var key = pal.colors.join(',');
    if (key === albumKey && el.classList.contains('on')) return;
    function apply() {
      el.style.backgroundColor = pal.base;
      TV.$$('.blob', el).forEach(function (b, i) {
        b.style.background = 'radial-gradient(circle, ' + pal.colors[i] + ' 0%, ' + pal.colors[i] + ' 22%, transparent 68%)';
      });
      el.classList.add('on');
      document.body.classList.add('album-on');
    }
    // A new song: dim the old colors first, then fade the new ones in
    if (el.classList.contains('on') && albumKey && TV.settings.prefs.anim !== 'off') { el.classList.toggle('on', false); albumTimer = setTimeout(apply, 1300); }
    else apply();
    albumKey = key;
  };

  // ---------- Theme sheet ----------
  var nasaNote = '';
  function tile(opts) {
    return '<button class="tile' + (opts.selected ? ' selected' : '') + '" data-focus data-action="' + opts.action + '" data-value="' + TV.esc(opts.value) + '">' +
      '<div class="tile-swatch" style="' + opts.style + '">' + (opts.selected ? '<span class="tile-check">' + TV.icon('check') + '</span>' : '') + '</div>' +
      '<div class="tile-name">' + TV.esc(opts.name) + '</div></button>';
  }

  TV.renderThemeSheet = function () {
    var t = TV.settings.theme;
    var html = '<h2>Background</h2>';
    [['Single Color', true], ['Colorful', false]].forEach(function (group) {
      html += '<div class="section-label">' + group[0] + '</div><div class="tile-row">';
      TV.GRADIENTS.filter(function (g) { return !!g.mono === group[1]; }).forEach(function (g) {
        html += tile({ action: 'gradient', value: g.id, name: g.name, selected: t.style === 'gradient' && t.gradient === g.id, style: 'background:' + TV.gradientPreview(g) });
      });
      html += '</div>';
    });
    // Built-in artwork: always available, no setup. The Slideshow cycles through it (and your own photos).
    html += '<div class="section-label">Artwork</div><div class="tile-row">';
    TV.ART.forEach(function (a) {
      html += tile({
        action: 'art', value: a.id, name: a.name,
        selected: t.style === 'art' && t.art === a.id,
        style: 'background-image:url(&quot;' + TV.esc(TV.artUrl(a)) + '&quot;)'
      });
    });
    html += tile({
      action: 'slideshow', value: 'slideshow', name: 'Slideshow',
      selected: t.style === 'slideshow',
      style: 'background-image:url(&quot;' + TV.esc(TV.artUrl(TV.ART[0])) + '&quot;)'
    });
    html += '</div>';
    html += '<div class="section-label">Photos</div><div class="tile-row">';
    (TV_CONFIG.wallpapers || []).forEach(function (f) {
      html += tile({
        action: 'photo', value: f, name: f.replace(/\.[^.]+$/, ''),
        selected: t.style === 'photo' && t.photo === f,
        style: 'background-image:url(&quot;' + TV.esc(TV.wallUrl(f)) + '&quot;)'
      });
    });
    html += tile({
      action: 'nasa', value: 'nasa', name: TV.nasaPhoto ? 'NASA Photo' : 'NASA (not loaded)',
      selected: t.style === 'nasa',
      style: TV.nasaPhoto ? 'background-image:url(&quot;' + TV.esc(TV.nasaPhoto.url) + '&quot;)' : 'background:#0b0d17'
    });
    html += '</div>';
    if (nasaNote) html += '<div class="hint">' + TV.esc(nasaNote) + '</div>';
    if (!(TV_CONFIG.wallpapers || []).length) {
      html += '<div class="hint">Add your own photos: put them in images/wallpapers/ and list them in config.local.js.</div>';
    }
    html += '<div class="section-label">Appearance</div><div class="segmented">';
    [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(function (m) {
      html += '<button class="seg' + (t.mode === m[0] ? ' selected' : '') + '" data-focus data-action="mode" data-value="' + m[0] + '">' + m[1] + '</button>';
    });
    html += '</div><div class="hint">Auto switches to Dark at sunset and Light at sunrise.</div>';
    TV.$('#sheet-theme').innerHTML = html;
  };

  TV.handleThemeAction = function (action, value) {
    var t = TV.settings.theme;
    if (action === 'gradient') { t.style = 'gradient'; t.gradient = value; }
    else if (action === 'photo') { t.style = 'photo'; t.photo = value; }
    else if (action === 'art') { t.style = 'art'; t.art = value; }
    else if (action === 'nasa') {
      if (!TV.nasaPhoto) {
        // Nothing to show yet: say so (the shared NASA key is often busy) and try again, instead of doing nothing
        nasaNote = 'The NASA photo has not loaded yet (NASA’s shared key is sometimes busy). Trying again now; it also needs the TV to be online. A free key in config.local.js (c.nasaApiKey) makes this reliable.';
        if (TV.nasaRetry) TV.nasaRetry();
        TV.renderThemeSheet();
        var nt = TV.$('#sheet-theme [data-action="nasa"]');
        if (nt) nt.focus();
        return true;
      }
      t.style = 'nasa';
    }
    else if (action === 'slideshow') { t.style = 'slideshow'; }
    else if (action === 'mode') { t.mode = value; }
    else return false;
    TV.saveSettings();
    TV.applyTheme();
    TV.renderThemeSheet();
    var again = TV.$('#sheet-theme [data-action="' + action + '"][data-value="' + String(value).replace(/"/g, '\\"') + '"]');
    if (again) again.focus();
    return true;
  };

  // Time of day: a warm wash around sunrise and sunset, a cool one at night, and (optionally)
  // a dimmer screen after sunset. All of it sits under the readability scrim, and the contrast
  // check allows for the brightest case, so text stays readable.
  TV.applyNight = function () {
    var now = new Date(), w = TV.weather, st = document.body.style;
    var sunrise, sunset;
    if (w && w.today) { sunrise = w.today.sunrise; sunset = w.today.sunset; }
    else { sunrise = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7); sunset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19); }
    var HR = 3600000;
    function clamp(x) { return Math.min(1, Math.max(0, x)); }
    function tri(distance) { return clamp(1 - distance / HR); } // 1 at the moment, 0 an hour away
    var warm = Math.max(tri(Math.abs(now - sunrise)), tri(Math.abs(now - sunset)));
    // Night ramps in over the hour after sunset (and out over the hour before sunrise), so the moment of
    // sunset itself is all warm light and the dimming follows it.
    var night = now.getHours() < 12 ? clamp((sunrise - now) / HR) : clamp((now - sunset) / HR);
    st.setProperty('--tod-warm', (warm * 0.10).toFixed(3));
    st.setProperty('--tod-cool', (night * 0.16).toFixed(3));
    var dim = TV.settings.prefs.nightDim ? night : 0;
    st.setProperty('--night-dim', (dim * 0.26).toFixed(3));
  };
  setInterval(function () { TV.applyNight(); }, 60 * 1000);

  TV.on('weather', TV.applyTheme);
  TV.on('nasa', function () {
    nasaNote = '';
    if (TV.settings.theme.style === 'nasa') TV.applyTheme();
    if (!TV.$('#sheet-theme').hidden) TV.renderThemeSheet();   // the NASA tile gets its picture
  });
})(window.TV);
