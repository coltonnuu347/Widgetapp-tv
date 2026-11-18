// Two full-screen pages, one above the other: Home (the widgets) and Apps. Pressing Down past the last widget
// slides the screen up to the Apps page; Up (from the top row) or Back slides it back, like the Apple TV home screen.
(function (TV) {
  var page = 'home', homeFocus = null;

  function go(name) {
    if (name === page) return;
    var pager = TV.$('#pager');
    if (name === 'apps') {
      var a = document.activeElement;
      homeFocus = a && TV.$('#app').contains(a) ? a : homeFocus;   // so Up lands back where you were
      if (a && a.blur) a.blur();
    }
    page = name;
    pager.setAttribute('data-page', name);
    document.body.classList.toggle('on-apps', name === 'apps');
    var target = null;
    if (name === 'apps') target = TV.$('.app-tile', TV.$('#apps'));
    else if (homeFocus && document.body.contains(homeFocus)) target = homeFocus;
    else target = TV.$('#card-calendar');
    if (target && target.focus) target.focus();
  }

  TV.pager = {
    page: function () { return page; },
    go: go
  };
})(window.TV);
