// The Apps page: big tiles that open your streaming apps. (The services, their looks and the matching are in js/appmatch.js,
// the icons in js/logos.js.)
//
// Opening another app needs the TV: it uses Samsung's tizen.application API. In a browser (the preview) a tile only
// explains that. Add or remove services with the Edit button (or Settings > Apps); apps the TV reports that are not in
// the list can be added there too. To use an official logo of your own, put a PNG at images/apps/<key>.png.
(function (TV) {
  var FOUND_KEY = 'tvdash.apps.found';
  var COLS = 4, ROWS = 3, ROW_H = 266;           // the tile grid, and one row's height (tile + gap)
  var found = TV.storage.get(FOUND_KEY, []) || [];    // what the TV said is installed: [{ id, name }]
  var lastError = '';
  var toastTimer = null, offsetRow = 0;

  function onTv() { return !!(window.tizen && window.tizen.application && window.tizen.application.getAppsInfo); }
  function prefs() {
    var a = TV.settings.apps || (TV.settings.apps = {});
    ['order', 'disabled', 'enabled', 'custom'].forEach(function (k) { if (!a[k]) a[k] = []; });
    return a;
  }
  function save() { TV.saveSettings(); }

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
    if (!app.appId) { toast('This TV’s ID for ' + app.name + ' is not known yet. Open Edit and use Find Apps on This TV.'); return; }
    function fail(why) {
      toast('Couldn’t open ' + app.name + ' (' + why + '). ' + (app.source === 'known' ? 'The built-in ID may not match your TV. ' : '') + 'Edit > Find Apps on This TV shows what the TV reports.');
    }
    try {
      window.tizen.application.launch(app.appId, function () { /* opened */ }, function (e) { fail((e && e.message) || (e && e.name) || 'no reason given'); });
    } catch (e) { fail(e.message); }
  };

  // ---------- how a tile looks ----------
  function logoSvg(a) {
    var d = TV.LOGOS && TV.LOGOS[a.logo];
    return d ? '<svg class="app-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + d + '"/></svg>' : '';
  }
  function wordHtml(a) {
    var w = a.word;
    if (!w) return '';
    if (w.style === 'prime') return '<span class="app-word w-prime"><b style="color:' + TV.esc(w.accent) + '">prime</b> video</span>';
    return '<span class="app-word w-' + TV.esc(w.style) + '">' + TV.esc(w.text) + '</span>';
  }
  function artHtml(a) { return logoSvg(a) || wordHtml(a) || '<span class="app-mark">' + TV.esc(a.mark) + '</span>'; }
  function gradient(a) { return 'linear-gradient(150deg,' + TV.esc(a.bg[0]) + ',' + TV.esc(a.bg[1]) + ')'; }

  function tileHtml(a, i) {
    return '<button class="app-tile' + (a.word ? ' is-word' : '') + '" data-focus data-app="' + TV.esc(a.key) + '" aria-label="' + TV.esc(a.name) + '" style="--i:' + i + ';background:' + gradient(a) + ';color:' + TV.esc(a.fg) + '">' +
      '<span class="app-art">' + artHtml(a) + '</span><span class="app-name">' + TV.esc(a.name) + '</span></button>';
  }

  // Draw the tiles
  TV.apps.render = function () {
    var grid = TV.$('#apps-grid'), list = TV.apps.visible();
    if (!list.length) {
      grid.innerHTML = '<div class="apps-empty">No apps on this page yet.<br><span>Press Up to reach <b>Edit</b>, then turn some on.</span></div>';
      offsetRow = 0;
      return;
    }
    grid.innerHTML = '<div class="apps-track" data-sy="0">' + list.map(tileHtml).join('') + '</div>';
    offsetRow = 0;
    markRows();
    // Use your own logo where there is a PNG for it (images/apps/<key>.png); otherwise the built-in artwork stays
    TV.$$('.app-tile', grid).forEach(function (tile) {
      var img = new Image(), key = tile.getAttribute('data-app');
      img.onload = function () {
        tile.classList.add('has-logo');
        TV.$('.app-art', tile).style.backgroundImage = 'url("images/apps/' + encodeURIComponent(key) + '.png")';
      };
      img.src = 'images/apps/' + encodeURIComponent(key) + '.png';
    });
  };

  // The grid box clips the rows that are out of view. Browsers scroll a clipped box by themselves to reveal a tile that gets
  // focus, which would add to the slide below and put the tile in the wrong place, so the box is held at zero.
  function pinGrid() { var g = TV.$('#apps-grid'); if (g) { g.scrollTop = 0; g.scrollLeft = 0; } }
  var gridBox = TV.$('#apps-grid');
  if (gridBox) gridBox.addEventListener('scroll', pinGrid);

  // Rows that are out of view fade away (so no sliver or cut shadow of them shows at the edges of the grid box)
  function markRows() {
    var track = TV.$('.apps-track');
    if (!track) return;
    [].forEach.call(track.children, function (tile, i) {
      var row = Math.floor(i / COLS);
      tile.classList.toggle('out', row < offsetRow || row > offsetRow + ROWS - 1);
    });
  }

  // Keep the selected tile's row on screen when there are more rows than fit (the rows slide)
  function scrollTo(tile) {
    var track = TV.$('.apps-track');
    if (!track) return;
    pinGrid();
    var row = Math.floor([].indexOf.call(track.children, tile) / COLS);
    if (row < offsetRow) offsetRow = row;
    else if (row > offsetRow + ROWS - 1) offsetRow = row - ROWS + 1;
    var y = -offsetRow * ROW_H;
    markRows();
    track.setAttribute('data-sy', String(y));
    track.style.transform = 'translate3d(0,' + y + 'px,0)';
    // The glow and the depth listen for focus too, and ran before this did, with the old scroll. Tell them again.
    if (TV.focusGlow) TV.focusGlow.sync();
    if (TV.depth) TV.depth.sync();
  }

  // ---------- the backdrop wash (two layers that cross-fade) ----------
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
      scrollTo(t);
      var app = TV.apps.all().filter(function (a) { return a.key === t.getAttribute('data-app'); })[0];
      wash(app ? TV.appmatch.washColor(app) : '');
    } else wash('');
  });

  // A small weather chip next to the clock, so the page feels connected to Home
  function weatherChip() {
    var w = TV.weather, el = TV.$('#apps-wx');
    if (!el || !w || !w.current) return;
    var info = TV.weatherInfo(w.current.code, w.current.isDay);
    el.innerHTML = '<span class="wx-i">' + TV.icon(info.icon) + '</span>' + Math.round(w.current.temp) + '° ' + TV.esc(info.text);
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

  // ---------- changing the list ----------
  function keyList() { return TV.apps.all().map(function (a) { return a.key; }); }
  TV.apps.setEnabled = function (key, on) {
    var p = prefs(), app = TV.apps.all().filter(function (a) { return a.key === key; })[0];
    if (!app) return;
    p.disabled = p.disabled.filter(function (k) { return k !== key; });
    p.enabled = p.enabled.filter(function (k) { return k !== key; });
    if (on) { if (!app.def) p.enabled.push(key); } else p.disabled.push(key);
    save(); TV.apps.render();
  };
  TV.apps.move = function (key, delta) {
    var keys = keyList(), at = keys.indexOf(key), to = at + delta;
    if (at < 0 || to < 0 || to >= keys.length) return;
    keys.splice(at, 1); keys.splice(to, 0, key);
    prefs().order = keys;
    save(); TV.apps.render();
  };
  // Add an app the TV reported (found list) as a tile of its own
  TV.apps.addFromTv = function (id) {
    var a = found.filter(function (x) { return x.id === id; })[0], p = prefs();
    if (!a || p.custom.some(function (c) { return c.id === id; })) return false;
    p.custom.push({ name: a.name, id: a.id });
    save(); TV.apps.render();
    return true;
  };
  TV.apps.removeCustom = function (key) {
    var p = prefs();
    p.custom = p.custom.filter(function (c) { return 'u_' + TV.appmatch.slug(c.name) !== key; });
    ['order', 'disabled', 'enabled'].forEach(function (k) { p[k] = p[k].filter(function (x) { return x !== key; }); });
    save(); TV.apps.render();
  };

  // ---------- the app editor (Edit button, or Settings > Apps > Add or Remove Apps) ----------
  function rowLogo(a) {
    return '<span class="row-logo" style="background:' + gradient(a) + ';color:' + TV.esc(a.fg) + '">' + (logoSvg(a) || '<span>' + TV.esc(a.mark) + '</span>') + '</span>';
  }
  function editorRow(a, i, n) {
    return '<div class="row">' + rowLogo(a) + '<span class="row-text">' + TV.esc(a.name) + (a.installed === false ? ' <small>(not on this TV)</small>' : '') + '</span>' +
      '<button class="btn toggle' + (a.enabled ? ' on' : '') + '" data-focus data-action="ae-toggle" data-value="' + TV.esc(a.key) + '">' + (a.enabled ? 'On' : 'Off') + '</button>' +
      '<button class="btn icon-btn" data-focus data-action="ae-up" data-value="' + TV.esc(a.key) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">' + TV.icon('up') + '</button>' +
      '<button class="btn icon-btn" data-focus data-action="ae-down" data-value="' + TV.esc(a.key) + '"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move down">' + TV.icon('down') + '</button>' +
      (a.removable ? '<button class="btn icon-btn" data-focus data-action="ae-remove" data-value="' + TV.esc(a.key) + '" aria-label="Remove">' + TV.icon('trash') + '</button>' : '') + '</div>';
  }

  TV.details.appsedit = {
    render: function (el) {
      var list = TV.apps.all(), extra = TV.appmatch.unmatched(found, list);
      var on = [], off = [];
      list.forEach(function (a, i) { (a.enabled && a.installed !== false ? on : off).push(editorRow(a, i, list.length)); });
      el.innerHTML = '<h2>Apps</h2><div class="hint">Turn a service on to put its tile on the Apps page. The arrows change the order.</div>' +
        '<div class="section-label">On the Apps page</div><div class="list">' + (on.join('') || '<div class="hint">Nothing yet.</div>') + '</div>' +
        '<div class="section-label">More services</div><div class="list">' + off.join('') + '</div>' +
        '<div class="section-label">On this TV</div>' +
        (found.length ? '<div class="hint">Other apps your TV reports. Add one to get a tile for it.</div><div class="list">' + (extra.length ? extra.slice(0, 80).map(function (a) {
          return '<div class="row"><span class="row-text">' + TV.esc(a.name) + '</span><button class="btn" data-focus data-action="ae-add" data-value="' + TV.esc(a.id) + '">Add</button></div>';
        }).join('') : '<div class="hint">Everything the TV reported is already in the list.</div>') + '</div>'
          : '<div class="hint">' + TV.esc(lastError || 'Not checked yet.') + '</div>') +
        '<div class="row"><span class="row-text">' + (found.length ? found.length + ' apps found on this TV' : 'Ask the TV what is installed') + '</span><button class="btn primary" data-focus data-action="ae-find">Find Apps on This TV</button></div>';
    },
    action: function (action, value) {
      var sheet = TV.$('#sheet-detail');
      function again(act, val) {
        TV.renderDetail();
        var el = TV.$('[data-action="' + act + '"][data-value="' + String(val).replace(/"/g, '\\"') + '"]', sheet);
        if (el && !el.disabled) el.focus();
        else { var f = TV.$('[data-action="' + act + '"]:not([disabled])', sheet); if (f) f.focus(); }
      }
      if (action === 'ae-toggle') {
        var app = TV.apps.all().filter(function (a) { return a.key === value; })[0];
        TV.apps.setEnabled(value, !(app && app.enabled));
        again('ae-toggle', value);
      } else if (action === 'ae-up' || action === 'ae-down') { TV.apps.move(value, action === 'ae-up' ? -1 : 1); again(action, value); }
      else if (action === 'ae-remove') { TV.apps.removeCustom(value); TV.renderDetail(); var f2 = TV.$('[data-action="ae-toggle"]', sheet); if (f2) f2.focus(); }
      else if (action === 'ae-add') { TV.apps.addFromTv(value); TV.renderDetail(); var f3 = TV.$('[data-action="ae-add"]', sheet); if (f3) f3.focus(); else { var f4 = TV.$('[data-action="ae-find"]', sheet); if (f4) f4.focus(); } }
      else if (action === 'ae-find') {
        TV.apps.discover(function () { TV.renderDetail(); var b = TV.$('[data-action="ae-find"]', sheet); if (b) b.focus(); });
      }
    }
  };

  // The full list of what the TV reported, for Settings > Apps > Show List
  TV.details.appsfound = {
    render: function (el) {
      var matched = TV.appmatch.matchInstalled(found), byId = {};
      Object.keys(matched).forEach(function (k) { byId[matched[k].id] = k; });
      el.innerHTML = '<h2>Apps on This TV</h2>' +
        (found.length ? '<div class="hint">' + found.length + ' apps. The ones marked ✓ match a service in your list.</div><div class="dates-list big">' +
          found.map(function (a) {
            return '<div class="date-row"><span class="date-name">' + (byId[a.id] ? '✓ ' : '') + TV.esc(a.name) + '</span><span class="date-when">' + TV.esc(a.id) + '</span></div>';
          }).join('') + '</div>'
          : '<div class="empty-note">' + TV.esc(lastError || 'Nothing found yet. Use Find Apps on This TV.') + '</div>') +
        '<div class="hint">To get a tile for one of these, use Edit on the Apps page (or Settings > Apps) and press Add next to it.</div>';
    }
  };

  TV.on('ready', function () {
    TV.apps.render();
    if (onTv()) TV.apps.discover();   // learn this TV's real app IDs
  });
})(window.TV);
