// Ambient Mode: after a few minutes without a button press the panels fade out and a calm clock floats
// on the background (with your photos as a slideshow, if you added any). Any button brings everything
// back. The clock slowly changes position, so nothing is lit in the same spot for hours (good for OLED).
// Settings > Smart & Motion > Ambient Mode picks the delay or turns it off.
(function (TV) {
  var lastActive = Date.now(), on = false, driftTimer = null, lastText = '';

  function minutes() { return TV.settings.prefs.ambient || 0; }
  function overlayOpen() { return !TV.$('#overlay').classList.contains('hidden'); }
  function bump() { lastActive = Date.now(); }

  // What the small line under the clock says: the song that is playing, or what the clock would say.
  function lineText() {
    var parts = [], np = TV.nowPlaying && TV.nowPlaying();
    if (np) parts.push('<span class="amb-note">' + TV.icon('music') + '</span>' + TV.esc(np.title + (np.artist ? ' · ' + np.artist : '')));
    var g = (TV.glanceTexts && TV.glanceTexts()) || [];
    g.slice(0, np ? 1 : 2).forEach(function (t) { parts.push(TV.esc(t)); });
    return parts.join('<span class="glance-sep">·</span>');
  }

  function update(now) {
    now = now || new Date();
    var p = TV.settings.prefs;
    var h = p.hour12 ? String(now.getHours() % 12 || 12) : TV.pad(now.getHours());
    var clock = h + ':' + TV.pad(now.getMinutes()) + (p.hour12 ? '<small>' + (now.getHours() < 12 ? 'AM' : 'PM') + '</small>' : '');
    var text = clock + '|' + TV.DAYS[now.getDay()] + ', ' + TV.MONTHS[now.getMonth()] + ' ' + now.getDate() + '|' + lineText();
    if (text === lastText) return;
    lastText = text;
    TV.$('#amb-clock').innerHTML = clock;
    TV.$('#amb-date').textContent = TV.DAYS[now.getDay()] + ', ' + TV.MONTHS[now.getMonth()] + ' ' + now.getDate();
    TV.$('#amb-line').innerHTML = lineText();
  }

  function drift() {
    var b = TV.$('#amb-body');
    b.style.setProperty('--ax', Math.round(Math.random() * 640 - 320) + 'px');
    b.style.setProperty('--ay', Math.round(Math.random() * 300 - 150) + 'px');
  }

  function enter() {
    if (on) return;
    on = true;
    if (TV.pager) TV.pager.go('home');   // wake up on Home, not on the Apps page
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lastText = '';
    update();
    drift();
    clearInterval(driftTimer);
    driftTimer = setInterval(drift, 90 * 1000);
    document.body.classList.add('ambient');
    TV.$('#ambient').setAttribute('aria-hidden', 'false');
    TV.emit('ambient', true);
    if ((TV_CONFIG.wallpapers || []).length && TV.setAmbientSlides) TV.setAmbientSlides(true);
  }

  function exit() {
    if (!on) return;
    on = false;
    clearInterval(driftTimer);
    document.body.classList.remove('ambient');
    TV.$('#ambient').setAttribute('aria-hidden', 'true');
    TV.emit('ambient', false);
    bump();
    if (TV.setAmbientSlides) TV.setAmbientSlides(false);
  }

  // Called for every key press. While resting, the first press only wakes the screen (it does nothing else),
  // except the play/pause/skip keys, which control Spotify and leave the screen resting.
  function onKey(e, isMedia) {
    bump();
    if (!on) return false;
    if (isMedia) return false;
    exit();
    e.preventDefault();
    return true;
  }

  function check() {
    if (on) return;
    var m = minutes();
    if (!m) return;
    if (overlayOpen()) { bump(); return; }
    if (Date.now() - lastActive >= m * 60000) enter();
  }

  document.addEventListener('click', function () { if (on) exit(); else bump(); });
  setInterval(check, 10 * 1000);
  TV.on('prefs', function () { if (!minutes() && on) exit(); });

  TV.ambient = {
    enter: enter, exit: exit, check: check, update: update, onKey: onKey,
    active: function () { return on; },
    // for tests: pretend the last button press was `ms` milliseconds ago
    pretendIdle: function (ms) { lastActive = Date.now() - ms; }
  };
})(window.TV);
