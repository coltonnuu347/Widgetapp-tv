// Widget tiles under the weather panel.
// "Widgets on Screen" in Settings picks the grid: 3 Large (one row), 4 Medium (2 x 2) or 6 Compact (3 x 2).
// Tiles stay large while everything fits in one row, and switch to the compact two-row grid only when
// more widgets are showing than that. A widget can span more than one column (the Spotify player is two
// tiles wide). Anything beyond one screen is split into pages that rotate every 20 seconds (paused while
// you are using a widget with the remote). The packing itself lives in js/pack.js.
(function (TV) {
  var GRIDS = { large: { cols: 3, rows: 1 }, medium: { cols: 2, rows: 2 }, compact: { cols: 3, rows: 2 } };

  function safeVisible(w) { try { return w.visible(); } catch (e) { return false; } }
  function spanOf(w) { return typeof w.span === 'function' ? w.span() : (w.span || 1); }

  // What goes where: { dense, pages: [ [row, row], ... ] } where each row is a list of { w, span }.
  function plan() {
    var g = GRIDS[TV.settings.prefs.density] || GRIDS.compact;
    var res = TV.pack.pack(TV.widgets.visible().filter(function (w) { return !w.slot; }).map(function (w) { return { w: w, span: spanOf(w), solo: !!w.solo }; }), g.cols, g.rows);
    return {
      dense: res.dense,
      pages: res.pages.map(function (rows) {
        return rows.map(function (row) { return row.map(function (c) { return { w: c.item.w, span: c.span }; }); });
      })
    };
  }

  var ROTATE_MS = 20000;
  var page = 0;
  var lastSig = '';
  var list = [];
  var current = []; // widgets on screen now
  var tops = [];    // widgets with slot: 'top' (the rain radar) that are showing beside the weather: they are not in the grid

  TV.widgets = {
    register: function (w) {
      list.push(w);
      if (w.detail) TV.details[w.id] = { render: w.detail, action: w.detailAction };
    },

    all: function () {
      var order = TV.settings.widgets.order;
      var sorted = list.slice().sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia < 0) ia = 1000 + list.indexOf(a);
        if (ib < 0) ib = 1000 + list.indexOf(b);
        return ia - ib;
      });
      return sorted;
    },

    isEnabled: function (w) { return TV.settings.widgets.disabled.indexOf(w.id) < 0; },

    setEnabled: function (id, on) {
      var d = TV.settings.widgets.disabled.filter(function (x) { return x !== id; });
      if (!on) d.push(id);
      TV.settings.widgets.disabled = d;
      TV.saveSettings();
      list.forEach(function (w) { if (w.id === id && w.refresh) w.refresh(); });
      TV.widgets.layout();
    },

    move: function (id, delta) {
      var ids = TV.widgets.all().map(function (w) { return w.id; });
      var i = ids.indexOf(id), j = i + delta;
      if (i < 0 || j < 0 || j >= ids.length) return;
      ids.splice(i, 1);
      ids.splice(j, 0, id);
      TV.settings.widgets.order = ids;
      TV.saveSettings();
      TV.widgets.layout();
    },

    visible: function () {
      return TV.widgets.all().filter(function (w) {
        if (!TV.widgets.isEnabled(w)) return false;
        try { return w.visible(); } catch (e) { return false; }
      });
    },

    isDense: function () { return document.body.classList.contains('dense'); },

    // Rebuild the grid (call when a widget appears/disappears or settings change).
    // force = true redraws every tile even if the same widgets are showing.
    layout: function (force) {
      var pl = plan(), pages = pl.pages.length;
      if (page >= pages) page = 0;
      var rows = pl.pages[page];
      // A page with only one row (the last page of a long list) uses the large tile layout, so tiles never look empty
      var denseHere = pl.dense && rows.length > 1;
      var onPage = [].concat.apply([], rows).map(function (c) { return c.w; });
      var sig = (denseHere ? 'd|' : 'l|') + (pl.dense ? 'D|' : 'S|') + rows.map(function (r) { return r.map(function (c) { return c.w.id + (c.span > 1 ? ':' + c.span : ''); }).join(','); }).join('/');

      // Page dots first: they take up room, and the tiles are sized to what is left.
      var dots = TV.$('#widget-dots');
      if (pages > 1) {
        var h = '';
        for (var i = 0; i < pages; i++) h += '<span class="dot' + (i === page ? ' active' : '') + '"></span>';
        dots.innerHTML = h;
      } else dots.innerHTML = '';

      // Widgets with a slot of their own (the radar, beside the weather) are drawn there, whatever the grid does
      var topWanted = list.filter(function (w) { return w.slot === 'top' && TV.widgets.isEnabled(w) && safeVisible(w); });
      var topChanged = topWanted.length !== tops.length || topWanted.some(function (w, i) { return tops[i] !== w; });
      tops = topWanted;
      var topEl = TV.$('#card-radar');
      if (topEl) {
        topEl.classList.toggle('hidden', !tops.length);
        var row = TV.$('#top-row'), had = row.classList.contains('has-radar');
        row.classList.toggle('has-radar', !!tops.length);
        if (had !== !!tops.length && TV.rerenderWeather) {
          try { TV.rerenderWeather(); } catch (e) { console.error('Weather redraw failed', e); }   // the weather card is narrower beside the radar
        }
      }
      var slots = TV.$('#widget-slots');
      if (force || sig !== lastSig || topChanged) {
        if (topEl) tops.forEach(function (w) { TV.widgets.renderOne(w, topEl); });
        var focused = slots.contains(document.activeElement) ? document.activeElement.getAttribute('data-widget') : null;
        document.body.classList.toggle('dense', pl.dense);
        slots.innerHTML = '';
        slots.className = denseHere ? 'rows-2' : 'rows-1';
        rows.forEach(function (row) {
          var rowEl = document.createElement('div');
          rowEl.className = 'wrow';
          var total = row.reduce(function (sum, c) { return sum + c.span; }, 0);
          row.forEach(function (c) {
            var w = c.w, share = c.span / total;
            var el = document.createElement('section');
            // w-wide / w-narrow (large tiles) and d-wide (compact grid) let a tile change its layout with its width
            el.className = 'card widget widget-' + w.id + (denseHere ? (c.span > 1 ? ' d-wide' : '') : (share >= 0.5 ? ' w-wide' : ' w-narrow'));
            el.setAttribute('data-widget', w.id);
            // Each tile takes its share of the row (a 2-column tile is exactly two tiles plus the gap between them)
            el.style.flex = '0 0 calc(' + (share * 100).toFixed(3) + '% - var(--gap))';
            // Every card can be reached with the remote; OK opens its full-screen view.
            el.setAttribute('data-focus', '');
            el.setAttribute('data-detail', w.id);
            el.tabIndex = 0;
            rowEl.appendChild(el);
          });
          slots.appendChild(rowEl);
        });
        // Fill the tiles only after all of them are in place, so each one knows its final size
        // (some tiles size their text to fit).
        onPage.forEach(function (w) {
          TV.widgets.renderOne(w, TV.$('[data-widget="' + w.id + '"]', slots));
        });
        current = onPage.concat(tops);
        lastSig = sig;
        if (focused) {
          var again = TV.$('[data-widget="' + focused + '"]', slots);
          if (again) again.focus(); else if (TV.nav) TV.nav.focusFirst();
        }
      } else {
        TV.widgets.refreshAll();
      }
      if (TV.focusGlow) TV.focusGlow.sync();
    },

    // Show the next/previous page of widgets. Returns false when there is only one page.
    changePage: function (delta) {
      var pages = plan().pages.length;
      if (pages <= 1) return false;
      page = (page + delta + pages) % pages;
      TV.widgets.layout();
      return true;
    },

    renderOne: function (w, el) {
      try { w.render(el); } catch (e) {
        console.error('Widget ' + w.id + ' failed', e);
        // say so on the tile, instead of leaving it blank
        if (el && !el.firstChild) el.innerHTML = '<div class="empty-note">' + TV.esc(w.name || w.id) + ' could not be drawn: ' + TV.esc(e && e.message ? e.message : 'unknown error') + '</div>';
      }
    },

    refreshAll: function () {
      current.forEach(function (w) {
        var el = TV.$('[data-widget="' + w.id + '"]');
        if (el) TV.widgets.renderOne(w, el);
      });
    },

    // A widget's data changed: redraw it, or rebuild the grid if it appeared/disappeared.
    update: function (id) {
      var w = list.filter(function (x) { return x.id === id; })[0];
      if (!w) return;
      var shown = current.indexOf(w) >= 0;
      var shouldShow = TV.widgets.isEnabled(w) && w.visible();
      if (shown && shouldShow) {
        var el = TV.$('[data-widget="' + id + '"]');
        if (el) TV.widgets.renderOne(w, el);
      } else if (shown !== shouldShow) {
        TV.widgets.layout();
      }
      if (TV.currentDetail === id) TV.renderDetail();
    },

    start: function () {
      list.forEach(function (w) {
        if (w.init) {
          try { w.init(); } catch (e) { console.error('Widget ' + w.id + ' init failed', e); }
        }
      });
      TV.widgets.layout();
      setInterval(function () {
        if (TV.$('#widget-slots').contains(document.activeElement)) return; // user is using a widget
        if (!TV.$('#overlay').classList.contains('hidden')) return;
        var pages = plan().pages.length;
        if (pages > 1) { page = (page + 1) % pages; TV.widgets.layout(); }
      }, ROTATE_MS);
    }
  };

  // Shared card header markup.
  TV.widgetHeader = function (iconName, title) {
    return '<div class="card-title"><span class="badge"><span class="icon">' + TV.icon(iconName) + '</span></span>' +
      '<span class="ct-text">' + TV.esc(title) + '</span></div>';
  };
})(window.TV);
