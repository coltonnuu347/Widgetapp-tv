// A soft glow that slides from one selected panel to the next, instead of each panel lighting up on its own.
// It sits behind the panels, so only its halo shows around the edges. It is a single element that moves
// (and resizes) with a transition; with Animations Off it simply jumps.
(function (TV) {
  function overlayOpen() { return !TV.$('#overlay').classList.contains('hidden'); }

  // Position of an element inside #app in layout pixels (ignores the focus "lift" scaling).
  function offsetIn(el, root) {
    var x = 0, y = 0, e = el;
    while (e && e !== root) {
      x += e.offsetLeft; y += e.offsetTop;
      if (e.getAttribute && e.getAttribute('data-sy')) y += parseFloat(e.getAttribute('data-sy'));   // a scrolled list of tiles
      e = e.offsetParent;
    }
    return e === root ? { x: x, y: y } : null;
  }

  function place(target) {
    var g = TV.$('#focus-glow'), app = TV.$('#pager');
    if (!g) return;
    if (!target || overlayOpen() || document.body.classList.contains('ambient') || !app.contains(target)) { g.style.opacity = '0'; return; }
    var pos = offsetIn(target, app);
    if (!pos) { g.style.opacity = '0'; return; }
    var first = g.style.opacity !== '1';
    if (first) g.classList.add('jump'); // appear in place instead of sliding in from the corner
    g.style.width = target.offsetWidth + 'px';
    g.style.height = target.offsetHeight + 'px';
    g.style.borderRadius = getComputedStyle(target).borderRadius;
    g.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
    g.style.opacity = '1';
    if (first) { void g.offsetWidth; g.classList.remove('jump'); }
  }

  function sync() {
    var a = document.activeElement;
    place(a && a.hasAttribute && a.hasAttribute('data-focus') ? a : null);
  }

  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', function () { setTimeout(sync, 0); });
  TV.focusGlow = { sync: sync };
})(window.TV);
