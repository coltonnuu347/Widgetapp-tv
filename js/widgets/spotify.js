// Spotify Now Playing (needs Spotify Premium for the play/pause/skip buttons).
// Sign-in happens once on your Mac with tools/spotify-login.mjs; the TV then refreshes its own access.
(function (TV) {
  var TOKEN_KEY = 'tvdash.spotify.token';
  var access = null; // { token, expires }
  var state = null;  // last playback state
  var stateAt = 0;   // when state was fetched (ms)
  var pollTimer = null;

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

  function api(method, path) {
    return getToken().then(function (token) {
      return TV.fetchWithTimeout('https://api.spotify.com/v1' + path, {
        method: method,
        headers: { Authorization: 'Bearer ' + token }
      }, 10000);
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
      colorize();
      stateAt = Date.now();
      TV.widgets.update('spotify');
    }).catch(function (e) {
      TV.log('Spotify:', e.message);
    }).then(function () {
      pollTimer = setTimeout(poll, state && state.is_playing ? 5000 : 15000);
    });
  }

  function control(action) {
    if (!state) return;
    var req;
    if (action === 'toggle') req = api('PUT', state.is_playing ? '/me/player/pause' : '/me/player/play');
    else if (action === 'next') req = api('POST', '/me/player/next');
    else if (action === 'prev') req = api('POST', '/me/player/previous');
    else return;
    if (action === 'toggle') { // update the button right away
      if (state.is_playing) state.progress_ms = progressNow();
      state.is_playing = !state.is_playing;
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
  var artUrl = '';
  function colorize() {
    var url = state ? trackInfo(state.item).art : '';
    if (url === artUrl) return;
    artUrl = url;
    var st = document.body.style;
    function clear() { st.removeProperty('--sp-c-dark'); st.removeProperty('--sp-c-light'); st.removeProperty('--sp-glow'); }
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

  TV.widgets.register({
    id: 'spotify',
    name: 'Spotify Now Playing',
    // The player is two tiles wide (Settings > Layout > Wide Spotify Tile turns that off).
    span: function () { return TV.settings.prefs.spotifyWide ? 2 : 1; },
    visible: function () { return configured() && !!state; },
    init: function () {
      if (!configured()) return;
      poll();
      setInterval(function () { // smooth progress bar between polls
        if (state && state.is_playing) TV.widgets.update('spotify');
      }, 1000);
    },
    // Card: a simple "now playing" view. Press OK on it for the player.
    render: function (el) {
      var info = trackInfo(state.item);
      var key = state.item.id + '|' + state.is_playing;
      if (el.getAttribute('data-built') !== key) {
        el.setAttribute('data-built', key);
        el.innerHTML = TV.widgetHeader('music', state.is_playing ? 'Now Playing' : 'Paused') +
          '<span class="eq' + (state.is_playing ? '' : ' paused') + '"><i></i><i></i><i></i><i></i></span>' +
          '<div class="sp-body">' +
            '<div class="sp-top">' +
              '<div class="sp-art"' + (info.art ? ' style="background-image:url(&quot;' + TV.esc(info.art) + '&quot;)"' : '') + '></div>' +
              '<div class="sp-state">' + TV.icon(state.is_playing ? 'pause' : 'play') + '</div>' +
            '</div>' +
            '<div class="sp-info">' +
              '<div class="sp-title">' + TV.esc(info.title) + '</div>' +
              '<div class="sp-artist">' + TV.esc(info.artist) + '</div>' +
              '<div class="sp-device">' + TV.esc(state.device ? state.device.name : '') + '</div>' +
            '</div>' +
          '</div>' +
          progressHtml() +
          '<div class="card-hint">OK for controls</div>';
      }
      updateProgress(el);
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
