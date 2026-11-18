// Settings panel (look and layout options, widgets, calendars, location) and the shared open/close logic for panels.
(function (TV) {
  var placeResults = [];
  var message = '';

  function input(id, placeholder, submitId) {
    // Text boxes are not reachable with the arrows directly (on Samsung TVs that would pop up the
    // keyboard while you are just moving past). Press the "Type" button to start typing.
    return '<div class="field">' +
      '<input id="' + id + '" type="text" placeholder="' + TV.esc(placeholder) + '" data-submit="' + submitId + '" autocomplete="off" spellcheck="false">' +
      '<button class="btn" data-focus data-action="type" data-value="' + id + '">Type</button>' +
      '</div>';
  }

  function calendarsSection() {
    var cals = TV.getCalendars();
    var html = '<div class="section-label">Calendars</div><div class="list">';
    if (!cals.length) html += '<div class="hint">No calendars yet.</div>';
    cals.forEach(function (c) {
      html += '<div class="row"><span class="row-text">' + TV.esc(c.name || c.url.replace(/^\w+:\/\//, '').slice(0, 48) + '…') + '</span>' +
        '<button class="btn" data-focus data-action="cal-remove" data-value="' + TV.esc(c.url) + '">' + (c.fromConfig ? 'Hide' : 'Remove') + '</button></div>';
    });
    if (TV.settings.hiddenCalendars.length) {
      html += '<div class="row"><span class="row-text">' + TV.settings.hiddenCalendars.length + ' hidden calendar(s)</span>' +
        '<button class="btn" data-focus data-action="cal-unhide">Show Again</button></div>';
    }
    html += '</div>' + input('cal-url', 'Paste an iCloud public calendar link (webcal://…)', 'cal-add') +
      '<button class="btn primary" id="cal-add" data-focus data-action="cal-add">Add Calendar</button>' +
      '<div class="hint">Tip: it is much easier to put calendar links in config.local.js before installing.</div>';
    return html;
  }

  function locationSection() {
    var loc = TV.location;
    var manual = TV.settings.manualLocation;
    var html = '<div class="section-label">Location</div>' +
      '<div class="row"><span class="row-text">' + (loc ? TV.esc(TV.placeLabel(loc)) : 'Finding…') +
      (manual ? ' (set by you)' : ' (automatic)') + '</span>' +
      (manual ? '<button class="btn" data-focus data-action="loc-auto">Use Automatic</button>' : '') + '</div>' +
      input('loc-query', 'City or ZIP code', 'loc-search') +
      '<button class="btn primary" id="loc-search" data-focus data-action="loc-search">Search</button>';
    if (placeResults.length) {
      html += '<div class="list">' + placeResults.map(function (p, i) {
        return '<button class="btn wide" data-focus data-action="loc-pick" data-value="' + i + '">' +
          TV.esc(TV.placeLabel(p) + (p.country ? ' · ' + p.country : '')) + '</button>';
      }).join('') + '</div>';
    }
    return html;
  }

  // Clock, Layout, Glass & Outlines, Panels (the list of options lives in js/prefs.js).
  function prefsSections() {
    var p = TV.settings.prefs, html = '';
    TV.PREF_SECTIONS.forEach(function (sec) {
      html += '<div class="section-label">' + TV.esc(sec.title) + '</div><div class="list">';
      sec.rows.forEach(function (r) {
        html += '<div class="row"><span class="row-text">' + TV.esc(r.label) + '</span>';
        if (r.toggle) {
          html += '<button class="btn toggle' + (p[r.key] ? ' on' : '') + '" data-focus data-action="pref-toggle" data-value="' + r.key + '">' + (p[r.key] ? 'On' : 'Off') + '</button>';
        } else {
          html += '<div class="segmented">' + r.options.map(function (o) {
            return '<button class="seg' + (p[r.key] === o[0] ? ' selected' : '') + '" data-focus data-action="pref" data-value="' + r.key + '=' + TV.esc(JSON.stringify(o[0])) + '">' + TV.esc(o[1]) + '</button>';
          }).join('') + '</div>';
        }
        html += '</div>';
      });
      html += '</div>' + (sec.hint ? '<div class="hint">' + TV.esc(sec.hint) + '</div>' : '');
    });
    html += '<button class="btn primary" data-focus data-action="pref-reset">Reset Look to Defaults</button>';
    return html;
  }

  function widgetsSection() {
    var html = '<div class="section-label">Widgets</div><div class="list">';
    TV.widgets.all().forEach(function (w, i, arr) {
      var on = TV.widgets.isEnabled(w);
      html += '<div class="row"><span class="row-text">' + TV.esc(w.name) + '</span>' +
        '<button class="btn toggle' + (on ? ' on' : '') + '" data-focus data-action="w-toggle" data-value="' + w.id + '">' + (on ? 'On' : 'Off') + '</button>' +
        '<button class="btn icon-btn" data-focus data-action="w-up" data-value="' + w.id + '"' + (i === 0 ? ' disabled' : '') + '>' + TV.icon('up') + '</button>' +
        '<button class="btn icon-btn" data-focus data-action="w-down" data-value="' + w.id + '"' + (i === arr.length - 1 ? ' disabled' : '') + '>' + TV.icon('down') + '</button>' +
        '</div>';
    });
    html += '</div><div class="hint">Widgets without setup (Wi-Fi, Commute, Spotify) stay hidden until you add their info to config.local.js. Commute only shows during your commute hours.</div>';
    return html;
  }

  // Streaming apps on the Apps page: turn each on or off, put them in your order, and find out what the TV has.
  function appsSection() {
    var list = TV.apps.all();
    var html = '<div class="section-label">Apps</div><div class="list">';
    list.forEach(function (a, i) {
      html += '<div class="row"><span class="row-text">' + TV.esc(a.name) + (a.installed === false ? ' (not on this TV)' : '') + '</span>' +
        '<button class="btn toggle' + (a.enabled ? ' on' : '') + '" data-focus data-action="app-toggle" data-value="' + TV.esc(a.key) + '">' + (a.enabled ? 'On' : 'Off') + '</button>' +
        '<button class="btn icon-btn" data-focus data-action="app-up" data-value="' + TV.esc(a.key) + '"' + (i === 0 ? ' disabled' : '') + '>' + TV.icon('up') + '</button>' +
        '<button class="btn icon-btn" data-focus data-action="app-down" data-value="' + TV.esc(a.key) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>' + TV.icon('down') + '</button></div>';
    });
    html += '</div><div class="row"><span class="row-text">' + (TV.apps.found().length ? TV.apps.found().length + ' apps found on this TV' : 'Not checked yet') + '</span>' +
      '<button class="btn" data-focus data-action="apps-find">Find Apps on This TV</button>' +
      (TV.apps.found().length ? '<button class="btn" data-focus data-action="apps-list">Show List</button>' : '') + '</div>' +
      '<div class="hint">Press Down past the widgets on the home screen to open the Apps page. The TV tells the app which apps are installed and what their IDs are. If a tile will not open its app, use Find Apps, then Show List, and add the app’s ID in config.local.js (c.apps).</div>';
    return html;
  }

  TV.renderSettingsSheet = function () {
    var focusedAction = document.activeElement && document.activeElement.getAttribute
      ? [document.activeElement.getAttribute('data-action'), document.activeElement.getAttribute('data-value')] : null;
    TV.$('#sheet-settings').innerHTML = '<h2>Settings</h2>' +
      (message ? '<div class="message">' + TV.esc(message) + '</div>' : '') +
      prefsSections() + widgetsSection() + appsSection() + calendarsSection() + locationSection() +
      '<div class="hint footer-hint">Remote: arrows to move · OK to select · Back to close · Yellow = Theme · Blue = Settings</div>';
    // Keep focus on the same control after redrawing.
    if (focusedAction && focusedAction[0]) {
      var sel = '[data-action="' + focusedAction[0] + '"]' + (focusedAction[1] ? '[data-value="' + focusedAction[1].replace(/"/g, '\\"') + '"]' : '');
      var el = TV.$(sel, TV.$('#sheet-settings'));
      if (el && !el.disabled) el.focus();
      else TV.nav.focusFirst();
    }
  };

  function say(msg) { message = msg; TV.renderSettingsSheet(); }

  TV.handleSettingsAction = function (action, value) {
    var s = TV.settings;
    switch (action) {
      case 'pref':
        var eq = value.indexOf('=');
        TV.setPref(value.slice(0, eq), JSON.parse(value.slice(eq + 1)));
        TV.renderSettingsSheet();
        return true;
      case 'pref-toggle':
        TV.setPref(value, !s.prefs[value]);
        TV.renderSettingsSheet();
        return true;
      case 'pref-reset':
        TV.resetPrefs();
        say('The look is back to its defaults.');
        return true;
      case 'type':
        var box = TV.$('#' + value);
        if (box) box.focus();
        return true;
      case 'cal-add':
        var url = TV.$('#cal-url').value.trim();
        if (!/^(webcals?|https?):\/\/.+/i.test(url)) { say('That doesn’t look like a calendar link. It should start with webcal:// or https://'); return true; }
        if (TV.getCalendars().some(function (c) { return c.url === url; })) { say('That calendar is already added.'); return true; }
        s.extraCalendars.push({ url: url });
        TV.saveSettings();
        say('Calendar added. Loading…');
        TV.refreshCalendar().then(function () { say('Calendar added.'); });
        return true;
      case 'cal-remove':
        if ((TV_CONFIG.calendars || []).some(function (c) { return c.url === value; })) s.hiddenCalendars.push(value);
        s.extraCalendars = s.extraCalendars.filter(function (c) { return c.url !== value; });
        TV.saveSettings();
        TV.refreshCalendar();
        say('Calendar removed.');
        return true;
      case 'cal-unhide':
        s.hiddenCalendars = [];
        TV.saveSettings();
        TV.refreshCalendar();
        say('Hidden calendars are back.');
        return true;
      case 'loc-search':
        var q = TV.$('#loc-query').value;
        say('Searching…');
        TV.searchPlace(q).then(function (list) {
          placeResults = list;
          say(list.length ? 'Pick your location:' : 'No places found for “' + q + '”.');
        }).catch(function () { say('Search failed. Check the internet connection.'); });
        return true;
      case 'loc-pick':
        var p = placeResults[+value];
        if (!p) return true;
        s.manualLocation = p;
        placeResults = [];
        TV.saveSettings();
        say('Location set to ' + TV.placeLabel(p) + '.');
        TV.refreshWeather();
        return true;
      case 'loc-auto':
        s.manualLocation = null;
        TV.saveSettings();
        say('Using automatic location.');
        TV.refreshWeather();
        return true;
      case 'w-toggle':
        var w = TV.widgets.all().filter(function (x) { return x.id === value; })[0];
        TV.widgets.setEnabled(value, !TV.widgets.isEnabled(w));
        TV.renderSettingsSheet();
        return true;
      case 'app-toggle':
        var off = s.apps.disabled.indexOf(value) >= 0;
        s.apps.disabled = s.apps.disabled.filter(function (k) { return k !== value; });
        if (!off) s.apps.disabled.push(value);
        TV.saveSettings(); TV.apps.render(); TV.renderSettingsSheet();
        return true;
      case 'app-up': case 'app-down':
        var keys = TV.apps.all().map(function (a) { return a.key; }), at = keys.indexOf(value), to = at + (action === 'app-up' ? -1 : 1);
        if (at >= 0 && to >= 0 && to < keys.length) { keys.splice(at, 1); keys.splice(to, 0, value); s.apps.order = keys; }
        TV.saveSettings(); TV.apps.render(); TV.renderSettingsSheet();
        return true;
      case 'apps-find':
        say('Asking the TV what is installed…');
        TV.apps.discover(function (n, err) {
          if (!n) { say(err || 'The TV did not list any apps.'); return; }
          var matched = Object.keys(TV.appmatch.matchInstalled(TV.apps.found())).length;
          say('Found ' + n + ' apps on this TV. ' + matched + ' of them are in your list.');
        });
        return true;
      case 'apps-list':
        TV.openDetail('appsfound');
        return true;
      case 'w-up': TV.widgets.move(value, -1); TV.renderSettingsSheet(); return true;
      case 'w-down': TV.widgets.move(value, 1); TV.renderSettingsSheet(); return true;
    }
    return false;
  };

  // ---------- Opening and closing panels ----------
  var lastFocus = null;
  TV.currentDetail = null;

  TV.renderDetail = function () {
    var d = TV.details[TV.currentDetail], el = TV.$('#sheet-detail');
    if (!d) return;
    var active = document.activeElement;
    var keep = active && el.contains(active) ? active.getAttribute('data-action') : null;
    d.render(el);
    if (keep) {
      var again = TV.$('[data-action="' + keep + '"]', el);
      if (again && again !== document.activeElement) again.focus();
    }
  };

  // name: 'theme', 'settings' or 'detail' (with detailId, e.g. 'spotify')
  TV.openSheet = function (name, detailId) {
    var ov = TV.$('#overlay');
    if (!ov.classList.contains('hidden')) TV.closeSheet(true);
    else lastFocus = document.activeElement;
    message = '';
    placeResults = [];
    TV.currentDetail = name === 'detail' ? detailId : null;
    TV.$('#sheet-detail').removeAttribute('data-built');
    if (name === 'theme') TV.renderThemeSheet();
    else if (name === 'settings') TV.renderSettingsSheet();
    else TV.renderDetail();
    ['theme', 'settings', 'detail'].forEach(function (n) { TV.$('#sheet-' + n).hidden = n !== name; });
    TV.$('#sheet-detail').className = 'sheet' + (name === 'detail' ? ' detail-' + detailId : '');
    ov.classList.remove('hidden');
    TV.$$('.sheet').forEach(function (s) { s.scrollTop = 0; });
    TV.nav.focusFirst();
  };

  TV.openDetail = function (id) {
    if (TV.details[id]) TV.openSheet('detail', id);
  };

  TV.closeSheet = function (silent) {
    TV.$('#overlay').classList.add('hidden');
    TV.$$('.sheet').forEach(function (s) { s.hidden = true; });
    TV.currentDetail = null;
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
  };

  // One click handler for cards and everything inside the panels.
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document && !(el.getAttribute && (el.getAttribute('data-action') || el.getAttribute('data-detail')))) el = el.parentNode;
    if (!el || el === document) return;
    if (!TV.$('#overlay').contains(el)) {
      if (el.getAttribute('data-detail')) TV.openDetail(el.getAttribute('data-detail'));
      return;
    }
    var action = el.getAttribute('data-action'), value = el.getAttribute('data-value');
    if (TV.currentDetail) {
      var d = TV.details[TV.currentDetail];
      if (d && d.action) d.action(action, value);
      return;
    }
    if (!TV.handleThemeAction(action, value)) TV.handleSettingsAction(action, value);
  });
})(window.TV);
