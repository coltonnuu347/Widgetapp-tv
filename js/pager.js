// Two full-screen pages, one above the other: Home (the widgets) and Apps. Pressing Down past the last widget
// slides the screen up to the Apps page; Up (from the top row) or Back slides it back, like the Apple TV home screen.
(function (TV) {
  var page = 'home', homeFocus = null, pagingTimer = null;
  var SLIDE_MS = 850;   // a little longer than the slide itself (see the CSS)

  function go(name) {
    if (name === page) return;
    var pager = TV.$('#pager');
    if (name === 'apps') {
      var a = document.activeElement;
      homeFocus = a && TV.$('#app').contains(a) ? a : homeFocus;   // so Up lands back where you were
      if (a && a.blur) a.blur();
    }
    // While the screen slides, the blur, shadows and background motion are switched off (see body.paging in the CSS):
    // that is what makes the slide smooth on a TV. They come back the moment it lands.
    document.body.classList.add('paging');
    clearTimeout(pagingTimer);
    pagingTimer = setTimeout(function () { document.body.classList.remove('paging'); }, TV.settings.prefs.anim === 'full' ? SLIDE_MS : 50);
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
