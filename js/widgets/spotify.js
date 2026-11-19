// Spotify Now Playing (needs Spotify Premium for the play/pause/skip buttons).
// Sign-in happens once on your Mac with tools/spotify-login.mjs; the TV then refreshes its own access.
(function (TV) {
  var TOKEN_KEY = 'tvdash.spotify.token';
  var access = null; // { token, expires }
  var state = null;  // last playback state
  var stateAt = 0;   // when state was fetched (ms)
  var pollTimer = null;
  var loaded = false;   // the first answer from Spotify has arrived (so "Connecting" can become "Nothing playing")
  var note = '';        // a short message on the tile (for example, no device to play on)

  function cfg() { return TV_CONFIG.spotify || {}; }
  function configured() { return !!(cfg().clientId && cfg().refreshToken); }

  // Spotify may hand back a new refresh token each time. Keep the newest one, but start over
  // if you re-ran the login tool (the config token changed).
  function currentRefreshToken() {
    var saved = TV.storage.get(TOKEN_KEY, null);
    if (saved && saved.seed === cfg().refreshToken && saved.current) return saved.current;
    return cfg().refreshToken;
  }

  function refreshAccess() {
    var body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(currentRefreshToken()) +
      '&client_id=' + encodeURIComponent(cfg().clientId);
    return TV.fetchJSON('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(function (j) {
      access = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
      if (j.refresh_token) TV.storage.set(TOKEN_KEY, { seed: cfg().refreshToken, current: j.refresh_token });
      return access.token;
    });
  }

  function getToken() {
    if (access && Date.now() < access.expires) return Promise.resolve(access.token);
    return refreshAccess();
  }

  function api(method, path, body) {
    return getToken().then(function (token) {
      var o = { method: method, headers: { Authorization: 'Bearer ' + token } };
      if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
      return TV.fetchWithTimeout('https://api.spotify.com/v1' + path, o, 10000);
    }).then(function (res) {
      if (res.status === 401) { access = null; throw new Error('Spotify sign-in expired'); }
      if (res.status === 204 || res.status === 202) return null;
      if (!res.ok) throw new Error('Spotify HTTP ' + res.status);
      var type = res.headers.get('content-type') || '';
      return type.indexOf('json') >= 0 ? res.json() : null;
    });
  }

  function poll() {
    clearTimeout(pollTimer);
    api('GET', '/me/player?additional_types=episode').then(function (j) {
      state = (j && j.item) ? j : null;
      if (state && !state.is_playing) { if (!pausedSince) pausedSince = Date.now(); } else pausedSince = 0;
      colorize();
      syncAlbum();
      stateAt = Date.now();
      loaded = true;
      TV.widgets.update('spotify');
    }).catch(function (e) {
      TV.log('Spotify:', e.message);
      if (!loaded) { loaded = true; note = /expired/.test(e.message) ? 'Spotify sign-in expired: run Spotify Sign-In.command again.' : 'Can\u2019t reach Spotify right now.'; TV.widgets.update('spotify'); }
    }).then(function () {
      pollTimer = setTimeout(poll, state && state.is_playing ? 5000 : 15000);
    });
  }

  // Nothing is playing: wake up a device. Spotify needs a device that is open somewhere (phone, computer, speaker).
  function startOnDevice() {
    note = 'Starting\u2026'; TV.widgets.update('spotify');
    api('GET', '/me/player/devices').then(function (j) {
      var ds = (j && j.devices) || [], d = ds.filter(function (x) { return x.is_active; })[0] || ds[0];
      if (!d) throw new Error('no device');
      return api('PUT', '/me/player', { device_ids: [d.id], play: true });
    }).then(function () { note = ''; setTimeout(poll, 800); })
      .catch(function (e) {
        note = e.message === 'no device' ? 'Open Spotify on a phone or computer first, then press play.' : 'Couldn\u2019t start playback (' + e.message + ').';
        TV.widgets.update('spotify');
      });
  }

  function control(action) {
    if (!state) { if (action === 'toggle' && configured()) startOnDevice(); return; }
    var req;
    if (action === 'toggle') req = api('PUT', state.is_playing ? '/me/player/pause' : '/me/player/play');
    else if (action === 'next') req = api('POST', '/me/player/next');
    else if (action === 'prev') req = api('POST', '/me/player/previous');
    else return;
    if (action === 'toggle') { // update the button right away
      if (state.is_playing) state.progress_ms = progressNow();
      state.is_playing = !state.is_playing;
      pausedSince = state.is_playing ? 0 : Date.now();
      stateAt = Date.now();
      TV.widgets.update('spotify');
    }
    req.catch(function (e) { TV.log('Spotify control failed:', e.message); }).then(function () { setTimeout(poll, 600); });
  }
  TV.spotifyControl = control;

  function progressNow() {
    if (!state) return 0;
    var p = state.progress_ms + (state.is_playing ? Date.now() - stateAt : 0);
    return Math.min(p, state.item.duration_ms || p);
  }

  // The album's main color, for a soft glow behind the art, the progress line and the equalizer bars.
  // Cover art comes from Spotify's CDN, which allows reading its pixels; if it ever refuses, we simply
  // keep the theme's own accent.
  var artUrl = '', palette = null, pausedSince = 0;

  // The whole screen takes the album's colors while a song plays (or for 3 minutes after you pause it).
  function syncAlbum() {
    // a picture you chose as the background (photo, artwork, NASA, slideshow) always wins over the album colors
    var want = TV.settings.prefs.albumBg && !(TV.photoThemeActive && TV.photoThemeActive()) && state && palette && (state.is_playing || (pausedSince && Date.now() - pausedSince < 3 * 60000));
    TV.setAlbumBackground(want ? palette : null);
  }
  TV.syncAlbum = syncAlbum;
  TV.on('prefs', syncAlbum);
  setInterval(syncAlbum, 30 * 1000);

  // What Ambient Mode shows under its clock
  TV.nowPlaying = function () {
    if (!state || !state.is_playing) return null;
    var info = trackInfo(state.item);
    return { title: info.title, artist: info.artist };
  };

  function colorize() {
    var url = state ? trackInfo(state.item).art : '';
    if (url === artUrl) return;
    artUrl = url;
    var st = document.body.style;
    function clear() { st.removeProperty('--sp-c-dark'); st.removeProperty('--sp-c-light'); st.removeProperty('--sp-glow'); palette = null; syncAlbum(); }
    if (!url) { clear(); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = clear;
    img.onload = function () {
      if (artUrl !== url) return; // the song changed while this loaded
      try {
        var N = 24, cv = document.createElement('canvas'); cv.width = cv.height = N;
        var g = cv.getContext('2d'); g.drawImage(img, 0, 0, N, N);
        var d = g.getImageData(0, 0, N, N).data, bins = [], i;
        for (i = 0; i < 12; i++) bins.push({ w: 0, hue: 0 });
        for (i = 0; i < d.length; i += 4) {
          var r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
          var max = Math.max(r, gg, b), min = Math.min(r, gg, b), v = max, s = max ? (max - min) / max : 0;
          if (s < 0.25 || v < 0.2) continue; // skip greys, blacks and whites
          var h = max === r ? ((gg - b) / (max - min) + (gg < b ? 6 : 0)) : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
          h *= 60;
          var bin = bins[Math.floor(h / 30) % 12], w = s * v;
          bin.w += w; bin.hue += h * w;
        }
        var best = bins.reduce(function (a, c) { return c.w > a.w ? c : a; }, bins[0]);
        if (best.w < 3) { clear(); return; } // grey or very dark art: keep the theme accent
        var H = best.hue / best.w;
        st.setProperty('--sp-c-dark', TV.ensureContrast(TV.hslToHex(H, 0.7, 0.66), '#5c5636', 3.2, true));
        st.setProperty('--sp-c-light', TV.ensureContrast(TV.hslToHex(H, 0.65, 0.42), '#d7bff2', 3.2, false));
        st.setProperty('--sp-glow', 'hsla(' + Math.round(H) + ', 80%, 55%, 0.55)');
        palette = TV.palette.albumPalette(d, N, TV.maxBlobLum);   // four corner colors for the background
        syncAlbum();
      } catch (e) { clear(); }
    };
    img.src = url;
  }

  function progressHtml() {
    return '<div class="sp-progress"><div class="sp-bar"><div class="sp-fill"></div></div>' +
      '<div class="sp-times"><span class="sp-pos"></span><span class="sp-dur"></span></div></div>';
  }
  function updateProgress(el) {
    var pos = progressNow(), dur = state.item.duration_ms || 1;
    TV.$('.sp-fill', el).style.width = Math.min(100, pos / dur * 100).toFixed(2) + '%';
    TV.$('.sp-pos', el).textContent = mmss(pos);
    TV.$('.sp-dur', el).textContent = '-' + mmss(Math.max(0, dur - pos));
  }

  function mmss(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + TV.pad(s % 60); }

  // Spotify lists album images largest first (640px, 300px, 64px).
  function trackInfo(item, large) {
    if (item.type === 'episode') {
      return { title: item.name, artist: item.show ? item.show.name : '', art: item.images && item.images[0] ? item.images[0].url : '' };
    }
    var imgs = item.album && item.album.images ? item.album.images : [];
    return {
      title: item.name,
      artist: (item.artists || []).map(function (a) { return a.name; }).join(', '),
      art: imgs.length ? (large ? imgs[0] : (imgs[1] || imgs[0])).url : ''
    };
  }

  // The buttons on the tile (the full-screen player's own buttons are handled by detailAction)
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document && !(el.getAttribute && /^sp-/.test(el.getAttribute('data-action') || ''))) el = el.parentNode;
    if (!el || el === document) return;
    var a = el.getAttribute('data-action');
    if (a === 'sp-open') TV.openDetail('spotify');
    else control(a === 'sp-toggle' ? 'toggle' : a === 'sp-next' ? 'next' : 'prev');
  });

  TV.widgets.register({
    id: 'spotify',
    name: 'Spotify Now Playing',
    // The player is two tiles wide (Settings > Layout > Wide Spotify Tile turns that off).
    span: function () { return TV.settings.prefs.spotifyWide ? 2 : 1; },
    visible: function () { return true; },   // always on screen (it explains itself when it is not connected or nothing is playing)
    noFocus: true,                           // the card itself is not selectable: its buttons are
    init: function () {
      if (!configured()) return;
      poll();
      setInterval(function () { // smooth progress bar between polls
        if (state && state.is_playing) TV.widgets.update('spotify');
      }, 1000);
    },
    // The tile: always there. Art, title, progress and three buttons (previous, play or pause, next).
    // States: not signed in / connecting / nothing playing / playing or paused. The expand button opens the full-screen player.
    render: function (el) {
      var mode = !configured() ? 'off' : !loaded ? 'wait' : !state ? 'idle' : 'song';
      var info = state ? trackInfo(state.item) : null;
      var playing = !!(state && state.is_playing);
      var key = mode + '|' + (state ? state.item.id : '') + '|' + playing + '|' + note, hadFocus = null;
      if (el.getAttribute('data-built') !== key) {
        el.setAttribute('data-built', key);
        // the tile is redrawn when the song or play state changes: keep the remote on the same button
        hadFocus = el.contains(document.activeElement) ? document.activeElement.getAttribute('data-action') : null;
        var title, sub;
        if (mode === 'off') { title = 'Spotify is not connected'; sub = 'On your Mac, double-click Spotify Sign-In.command, then reload.'; }
        else if (mode === 'wait') { title = 'Connecting…'; sub = ''; }
        else if (mode === 'idle') { title = 'Nothing playing'; sub = note || 'Press play, or start a song in Spotify.'; }
        else { title = info.title; sub = info.artist; }
        var art = info && info.art ? ' style="background-image:url(&quot;' + TV.esc(info.art) + '&quot;)"' : '';
        var btn = function (action, icon, label, cls) { return '<button class="sp-btn' + (cls ? ' ' + cls : '') + '" data-focus data-action="' + action + '" aria-label="' + label + '">' + TV.icon(icon) + '</button>'; };
        el.innerHTML = TV.widgetHeader('music', 'Spotify') +
          (playing ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : '') +
          '<div class="sp2">' +
            '<div class="sp2-art' + (art ? '' : ' empty') + '"' + art + '>' + (art ? '' : TV.icon('music')) + '</div>' +
            '<div class="sp2-main">' +
              '<div class="sp2-title">' + TV.esc(title) + '</div>' +
              '<div class="sp2-sub">' + TV.esc(sub) + '</div>' +
              (mode === 'song' ? progressHtml() : '') +
            '</div>' +
            (mode === 'off' || mode === 'wait' ? '' : '<div class="sp2-controls">' +
              btn('sp-prev', 'prev', 'Previous') + btn('sp-toggle', playing ? 'pause' : 'play', playing ? 'Pause' : 'Play', 'main') + btn('sp-next', 'next', 'Next') +
              (mode === 'song' ? btn('sp-open', 'expand', 'Open the full-screen player', 'small') : '') + '</div>') +
          '</div>';
      }
      if (hadFocus) { var again = TV.$('[data-action="' + hadFocus + '"]', el); if (again) again.focus(); }
      if (state) updateProgress(el);
    },

    // Full-screen player: big art and three big buttons.
    detail: function (el) {
      if (!state) { el.innerHTML = '<h2>Spotify</h2><div class="empty-note">Nothing is playing right now.</div>'; return; }
      var info = trackInfo(state.item, true);
      var key = state.item.id + '|' + state.is_playing;
      if (el.getAttribute('data-built') !== key) {
        el.setAttribute('data-built', key);
        el.innerHTML = '<div class="player">' +
          '<div class="player-art"' + (info.art ? ' style="background-image:url(&quot;' + TV.esc(info.art) + '&quot;)"' : '') + '></div>' +
          '<div class="player-main">' +
            '<div class="player-title">' + TV.esc(info.title) + '</div>' +
            '<div class="player-artist">' + TV.esc(info.artist) + '</div>' +
            '<div class="sp-device">' + (state.device ? 'Playing on ' + TV.esc(state.device.name) : '') + '</div>' +
            progressHtml() +
            '<div class="player-controls">' +
              '<button class="player-btn" data-focus data-action="prev">' + TV.icon('prev') + '</button>' +
              '<button class="player-btn main" data-focus data-autofocus data-action="toggle">' + TV.icon(state.is_playing ? 'pause' : 'play') + '</button>' +
              '<button class="player-btn" data-focus data-action="next">' + TV.icon('next') + '</button>' +
            '</div>' +
            '<div class="hint">The play/pause and skip buttons on your remote work anywhere in the app.</div>' +
          '</div></div>';
      }
      updateProgress(el);
    },
    detailAction: function (action) { control(action); }
  });
})(window.TV);
