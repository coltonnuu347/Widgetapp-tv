// Remote-control navigation: arrow keys move focus to the nearest item in that direction,
// Enter (OK) activates it, Back closes a panel or exits the app.
(function (TV) {
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 10009, ESC: 27, BACKSPACE: 8,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
    PLAY_PAUSE: 10252, PLAY: 415, PAUSE: 19, NEXT: 10233, PREV: 10232,
    IME_DONE: 65376, IME_CANCEL: 65385
  };
  var idleTimer = null;

  function registerTizenKeys() {
    try {
      if (window.tizen && tizen.tvinputdevice) {
        ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
          'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaTrackNext', 'MediaTrackPrevious'].forEach(function (k) {
          try {
            tizen.tvinputdevice.registerKey(k);
            var code = tizen.tvinputdevice.getKey(k).code;
            if (k === 'ColorF0Red') KEY.RED = code;
            if (k === 'ColorF1Green') KEY.GREEN = code;
            if (k === 'ColorF2Yellow') KEY.YELLOW = code;
            if (k === 'ColorF3Blue') KEY.BLUE = code;
            if (k === 'MediaPlayPause') KEY.PLAY_PAUSE = code;
            if (k === 'MediaPlay') KEY.PLAY = code;
            if (k === 'MediaPause') KEY.PAUSE = code;
            if (k === 'MediaTrackNext') KEY.NEXT = code;
            if (k === 'MediaTrackPrevious') KEY.PREV = code;
          } catch (e) { /* key not on this remote */ }
        });
      }
    } catch (e) { /* not running on a Samsung TV */ }
  }

  function root() {
    var ov = TV.$('#overlay');
    if (!ov.classList.contains('hidden')) {
      var sheet = TV.$$('.sheet', ov).filter(function (s) { return !s.hidden; })[0];
      if (sheet) return sheet;
    }
    return TV.$('#app');
  }

  function focusables(r) {
    return TV.$$('[data-focus]', r).filter(function (el) {
      if (el.disabled) return false;
      var rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function center(rect) { return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }

  function move(dir) {
    var r = root(), items = focusables(r);
    if (!items.length) {
      if (r.classList.contains('sheet') && (dir === 'up' || dir === 'down')) r.scrollTop += dir === 'down' ? 260 : -260;
      return;
    }
    var cur = document.activeElement;
    if (!cur || items.indexOf(cur) < 0) { items[0].focus(); return; }
    var a = cur.getBoundingClientRect(), ca = center(a), best = null, bestScore = Infinity;
    items.forEach(function (el) {
      if (el === cur) return;
      var b = el.getBoundingClientRect(), cb = center(b);
      var along, across;
      // Only items fully past the current item's edge count (TOL covers the focus "lift" scaling).
      // "across" is the gap between the two items sideways (0 when they line up), plus a small center tie-breaker.
      var TOL = 24;
      function gap(a1, a2, b1, b2) { return Math.max(0, b1 - a2, a1 - b2); }
      if (dir === 'left') { along = a.left - b.right; if (along < -TOL) return; across = gap(a.top, a.bottom, b.top, b.bottom) + Math.abs(cb.y - ca.y) * 0.1; }
      if (dir === 'right') { along = b.left - a.right; if (along < -TOL) return; across = gap(a.top, a.bottom, b.top, b.bottom) + Math.abs(cb.y - ca.y) * 0.1; }
      if (dir === 'up') { along = a.top - b.bottom; if (along < -TOL) return; across = gap(a.left, a.right, b.left, b.right) + Math.abs(cb.x - ca.x) * 0.1; }
      if (dir === 'down') { along = b.top - a.bottom; if (along < -TOL) return; across = gap(a.left, a.right, b.left, b.right) + Math.abs(cb.x - ca.x) * 0.1; }
      var score = Math.max(0, along) + across * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus();
      if (best.scrollIntoView && r.classList.contains('sheet')) best.scrollIntoView({ block: 'nearest' });
      return;
    }
    // Nothing further that way:
    // - past the last widget -> show the next page of widgets
    var slots = TV.$('#widget-slots');
    if (slots.contains(cur) && (dir === 'right' || dir === 'down')) {
      if (TV.widgets.changePage(1)) {
        var first = TV.$('[data-focus]', slots);
        if (first) first.focus();
      }
      return;
    }
    // - in a long panel -> scroll it
    if (r.classList.contains('sheet') && (dir === 'up' || dir === 'down')) {
      r.scrollTop += dir === 'down' ? 260 : -260;
    }
  }

  // Hide the focus ring after a while so the screen stays clean.
  function bumpIdle() {
    document.body.classList.add('using-remote');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (TV.$('#overlay').classList.contains('hidden') && document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      document.body.classList.remove('using-remote');
    }, 15000);
  }

  function back() {
    if (!TV.$('#overlay').classList.contains('hidden')) { TV.closeSheet(); return; }
    if (document.activeElement && document.activeElement !== document.body) { document.activeElement.blur(); return; }
    try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* browser preview */ }
  }

  function onKey(e) {
    var k = e.keyCode, active = document.activeElement;
    // While Ambient Mode is resting, the first press only wakes the screen (play/pause/skip still control Spotify)
    var isMedia = k === KEY.PLAY_PAUSE || k === KEY.PLAY || k === KEY.PAUSE || k === KEY.NEXT || k === KEY.PREV;
    if (TV.ambient && TV.ambient.onKey(e, isMedia)) return;
    bumpIdle();
    var typing = active && active.tagName === 'INPUT';

    if (typing) {
      if (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.BACKSPACE) return; // let the text box handle it
      if (k === KEY.ENTER || k === KEY.IME_DONE) {
        e.preventDefault();
        var target = active.getAttribute('data-submit');
        var btn = target && TV.$('#' + target);
        active.blur();
        if (btn) { btn.focus(); btn.click(); }
        return;
      }
      if (k === KEY.IME_CANCEL || k === KEY.ESC) { e.preventDefault(); active.blur(); return; }
    }

    switch (k) {
      case KEY.LEFT: e.preventDefault(); move('left'); break;
      case KEY.RIGHT: e.preventDefault(); move('right'); break;
      case KEY.UP: e.preventDefault(); move('up'); break;
      case KEY.DOWN: e.preventDefault(); move('down'); break;
      case KEY.ENTER:
        if (active && active.hasAttribute && active.hasAttribute('data-focus')) {
          e.preventDefault();
          if (active.tagName === 'INPUT') active.focus(); else active.click();
        } else { e.preventDefault(); move('down'); }
        break;
      case KEY.BACK: case KEY.ESC: e.preventDefault(); back(); break;
      case KEY.BACKSPACE: if (!typing) { e.preventDefault(); back(); } break;
      case KEY.YELLOW: e.preventDefault(); TV.openSheet('theme'); break;
      case KEY.BLUE: e.preventDefault(); TV.openSheet('settings'); break;
      case KEY.PLAY_PAUSE: case KEY.PLAY: case KEY.PAUSE: if (TV.spotifyControl) TV.spotifyControl('toggle'); break;
      case KEY.NEXT: if (TV.spotifyControl) TV.spotifyControl('next'); break;
      case KEY.PREV: if (TV.spotifyControl) TV.spotifyControl('prev'); break;
    }
  }

  TV.nav = {
    init: function () {
      registerTizenKeys();
      document.addEventListener('keydown', onKey);
    },
    focusFirst: function () {
      var r = root(), preferred = TV.$('[data-autofocus]', r);
      if (preferred) { preferred.focus(); return; }
      var items = focusables(r);
      if (items.length) items[0].focus();
      else if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // nothing to press in this view
    }
  };
})(window.TV);
