// The Apps page: big tiles that open your streaming apps. (Matching and the app list are in js/appmatch.js.)
//
// Opening another app needs the TV: it uses Samsung's tizen.application API. In a browser (the preview) a tile
// only explains that. Nothing here is a copy of any app, and the tiles use plain brand colors, not the
// official logos. To use a logo, put a PNG at images/apps/<key>.png (for example images/apps/netflix.png).
(function (TV) {
  var FOUND_KEY = 'tvdash.apps.found';
  var found = TV.storage.get(FOUND_KEY, []) || [];    // what the TV said is installed: [{ id, name }]
  var lastError = '';
  var toastTimer = null;

  function onTv() { return !!(window.tizen && window.tizen.application && window.tizen.application.getAppsInfo); }
  function prefs() { return TV.settings.apps || { order: [], disabled: [] }; }

  TV.apps = {
    all: function () { return TV.appmatch.resolve(found, TV_CONFIG.apps || [], prefs()); },
    visible: function () { return TV.appmatch.visible(TV.apps.all()); },
    found: function () { return found; },
    lastError: function () { return lastError; },
    onTv: onTv
  };

  // Ask the TV what is installed. Calls done(count) or done(0, errorText).
  TV.apps.discover = function (done) {
    if (!onTv()) { lastError = 'This only works on the TV itself (not in a browser).'; if (done) done(0, lastError); return; }
    try {
      window.tizen.application.getAppsInfo(function (list) {
        found = (list || []).map(function (a) { return { id: a.id, name: a.name }; }).filter(function (a) { return a.id && a.name; });
        found.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
        TV.storage.set(FOUND_KEY, found);
        lastError = found.length ? '' : 'The TV did not list any apps.';
        TV.apps.render();
        if (done) done(found.length, lastError);
      }, function (e) {
        lastError = 'The TV would not list its apps (' + ((e && e.message) || (e && e.name) || 'no reason given') + ').';
        if (done) done(0, lastError);
      });
    } catch (e) {
      lastError = 'The TV would not list its apps (' + e.message + ').';
      if (done) done(0, lastError);
    }
  };

  function toast(msg) {
    var el = TV.$('#apps-toast');
    el.textContent = msg;
    el.className = 'on';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, 7000);
  }
  TV.apps.say = toast;

  TV.apps.launch = function (app) {
    if (!onTv() || !window.tizen.application.launch) { toast('Apps open when this runs on your TV.'); return; }
    if (!app.appId) { toast('This TV’s ID for ' + app.name + ' is not known yet. Open Settings > Apps > Find Apps on This TV.'); return; }
    function fail(why) {
      toast('Couldn’t open ' + app.name + ' (' + why + '). ' + (app.source === 'known' ? 'The built-in ID may not match your TV. ' : '') + 'Settings > Apps > Find Apps on This TV shows what the TV reports.');
    }
    try {
      window.tizen.application.launch(app.appId, function () { /* opened */ }, function (e) { fail((e && e.message) || (e && e.name) || 'no reason given'); });
    } catch (e) { fail(e.message); }
  };

  // Draw the tiles
  TV.apps.render = function () {
    var grid = TV.$('#apps-grid'), list = TV.apps.visible();
    if (!list.length) {
      grid.innerHTML = '<div class="empty-note apps-empty">No apps to show. Open Settings > Apps to turn some on' + (found.length ? '' : ', or add your own in config.local.js (c.apps)') + '.</div>';
      return;
    }
    grid.innerHTML = list.map(function (a) {
      return '<button class="app-tile" data-focus data-app="' + TV.esc(a.key) + '" style="background:linear-gradient(145deg,' + TV.esc(a.color[0]) + ',' + TV.esc(a.color[1]) + ')">' +
        '<span class="app-logo"></span><span class="app-emblem">' + TV.esc(a.mark || a.name.charAt(0)) + '</span><span class="app-name">' + TV.esc(a.name) + '</span></button>';
    }).join('');
    // Use your own logo where there is a PNG for it (images/apps/<key>.png); otherwise the name stays
    TV.$$('.app-tile', grid).forEach(function (tile) {
      var img = new Image(), key = tile.getAttribute('data-app');
      img.onload = function () {
        tile.classList.add('has-logo');
        TV.$('.app-logo', tile).style.backgroundImage = 'url("images/apps/' + encodeURIComponent(key) + '.png")';
      };
      img.src = 'images/apps/' + encodeURIComponent(key) + '.png';
    });
  };

  // A soft wash of the selected app's color behind the page (two layers that cross-fade)
  var washFlip = 0;
  function wash(color) {
    var layers = TV.$$('#apps-wash i');
    if (!layers.length) return;
    if (!color) { layers.forEach(function (l) { l.className = ''; }); return; }
    washFlip = 1 - washFlip;
    var next = layers[washFlip], prev = layers[1 - washFlip];
    next.style.setProperty('--wc', color);
    next.className = 'on';
    prev.className = '';
  }
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('app-tile')) {
      var app = TV.apps.all().filter(function (a) { return a.key === t.getAttribute('data-app'); })[0];
      wash(app ? app.color[0] : '');
    } else wash('');
  });

  // A small weather chip next to the clock, so the page feels connected to Home
  function weatherChip() {
    var w = TV.weather, el = TV.$('#apps-wx');
    if (!el || !w || !w.current) return;
    var info = TV.weatherInfo(w.current.code, w.current.isDay);
    el.innerHTML = '<span class="wx-i">' + TV.icon(info.icon) + '</span>' + Math.round(w.current.temp) + '\u00b0 ' + TV.esc(info.text);
  }
  TV.on('weather', weatherChip);
  TV.on('prefs', weatherChip);

  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document && !(el.classList && el.classList.contains('app-tile'))) el = el.parentNode;
    if (!el || el === document) return;
    var key = el.getAttribute('data-app');
    var app = TV.apps.all().filter(function (a) { return a.key === key; })[0];
    if (app) TV.apps.launch(app);
  });

  // The full list of what the TV reported, for Settings > Apps > Find Apps on This TV
  TV.details.appsfound = {
    render: function (el) {
      var matched = TV.appmatch.matchInstalled(found), byId = {};
      Object.keys(matched).forEach(function (k) { byId[matched[k].id] = k; });
      el.innerHTML = '<h2>Apps on This TV</h2>' +
        (found.length ? '<div class="hint">' + found.length + ' apps. The ones marked ✓ are in your Apps page.</div><div class="dates-list big">' +
          found.map(function (a) {
            return '<div class="date-row"><span class="date-name">' + (byId[a.id] ? '✓ ' : '') + TV.esc(a.name) + '</span><span class="date-when">' + TV.esc(a.id) + '</span></div>';
          }).join('') + '</div>'
          : '<div class="empty-note">' + TV.esc(lastError || 'Nothing found yet. Use Find Apps on This TV in Settings.') + '</div>') +
        '<div class="hint">Missing an app? Add it in config.local.js: c.apps = [{ name: \'Crunchyroll\', id: \'the ID shown here\' }]</div>';
    }
  };

  TV.on('ready', function () {
    TV.apps.render();
    if (onTv()) TV.apps.discover();   // learn this TV's real app IDs
  });
})(window.TV);
