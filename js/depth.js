// Depth: the background drifts a few pixels the opposite way to your selection, so the glass panels feel like they
// float in front of it (like visionOS). On the Apps page the selected tile also leans toward the way you just moved.
// Only transform changes. It follows the Animations setting (Full only) and Settings > Moving Background, and it
// stops in Ambient Mode. The background is scaled up a little (see the CSS) so its edges never show.
(function (TV) {
  var lastX = 0, lastY = 0, lastEl = null, lastFocus = null;

  function offsetIn(el, root) {
    var x = 0, y = 0, e = el;
    while (e && e !== root) {
      x += e.offsetLeft; y += e.offsetTop;
      if (e.getAttribute && e.getAttribute('data-sy')) y += parseFloat(e.getAttribute('data-sy'));   // a scrolled list of tiles
      e = e.offsetParent;
    }
    return e === root ? { x: x, y: y } : null;
  }

  function setDepth(dx, dy) {
    var st = document.body.style;
    st.setProperty('--dx', dx.toFixed(3));
    st.setProperty('--dy', dy.toFixed(3));
  }

  function clearTilt() {
    if (lastEl && lastEl.style) { lastEl.style.removeProperty('--tilt-x'); lastEl.style.removeProperty('--tilt-y'); }
    lastEl = null;
  }

  // Where the selected element is on its screen, from -1 (left/top) to 1 (right/bottom).
  function position(el) {
    var pager = TV.$('#pager');
    if (!pager || !el || !pager.contains(el)) return null;
    var p = offsetIn(el, pager);
    if (!p) return null;
    var onApps = TV.$('#apps').contains(el), y = p.y - (onApps ? 1080 : 0);
    return { x: (p.x + el.offsetWidth / 2) / 1920 * 2 - 1, y: (y + el.offsetHeight / 2) / 1080 * 2 - 1 };
  }

  function sync() {
    var a = document.activeElement, pos = (a && a.hasAttribute && a.hasAttribute('data-focus') && !document.body.classList.contains('ambient')) ? position(a) : null;
    var same = a === lastFocus && !!pos;     // the same element again (for example the delayed blur handler): keep its lean
    lastFocus = pos ? a : null;
    if (!same) clearTilt();
    if (!pos || !TV.motionOn()) { setDepth(0, 0); return; }
    setDepth(pos.x, pos.y);
    if (same) return;
    // lean the selected app tile toward the direction of travel
    if (a.classList.contains('app-tile')) {
      var mx = Math.max(-1, Math.min(1, (pos.x - lastX) * 2)), my = Math.max(-1, Math.min(1, (pos.y - lastY) * 2));
      a.style.setProperty('--tilt-x', mx.toFixed(2));
      a.style.setProperty('--tilt-y', my.toFixed(2));
      lastEl = a;
    }
    lastX = pos.x; lastY = pos.y;
  }

  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', function () { setTimeout(sync, 0); });
  TV.on('prefs', sync);
  TV.on('ambient', sync);
  TV.depth = { sync: sync };
})(window.TV);
