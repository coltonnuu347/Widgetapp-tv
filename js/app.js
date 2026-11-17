// Starts everything.
(function (TV) {
  var DESIGN_W = 1920, DESIGN_H = 1080;

  // The layout is designed at 1920x1080 and scaled to whatever the TV reports.
  function fitStage() {
    var s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    var stage = TV.$('#stage');
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = Math.round((window.innerWidth - DESIGN_W * s) / 2) + 'px';
    stage.style.top = Math.round((window.innerHeight - DESIGN_H * s) / 2) + 'px';
  }

  // Show a number as one <i> per digit, so only the digit that changed animates.
  function setDigits(el, text) {
    if (el.getAttribute('data-v') === text) return;
    if (el.children.length !== text.length) {
      el.innerHTML = text.split('').map(function (c) { return '<i>' + c + '</i>'; }).join('');
    } else {
      text.split('').forEach(function (c, i) {
        var d = el.children[i];
        if (d.textContent !== c) {
          d.textContent = c;
          TV.play(d, 'tick');
        }
      });
    }
    el.setAttribute('data-v', text);
  }

  var lastSec = -1;
  function tickClock() {
    var now = new Date(), p = TV.settings.prefs;
    setDigits(TV.$('#clock-h'), p.hour12 ? String(now.getHours() % 12 || 12) : TV.pad(now.getHours()));
    setDigits(TV.$('#clock-m'), TV.pad(now.getMinutes()));
    TV.$('#clock-s').textContent = p.seconds ? ':' + TV.pad(now.getSeconds()) : '';
    TV.$('#clock-ampm').textContent = p.hour12 ? (now.getHours() < 12 ? 'AM' : 'PM') : '';
    TV.$('#date-text').textContent = TV.DAYS[now.getDay()] + ', ' + TV.MONTHS[now.getMonth()] + ' ' + now.getDate();
    // The bright segment on the line under the clock travels once a minute
    var sec = now.getSeconds(), wrap = TV.$('#clock-wrap');
    if (sec < lastSec) { wrap.classList.add('sec-jump'); setTimeout(function () { wrap.classList.remove('sec-jump'); }, 60); }
    wrap.style.setProperty('--sec', (sec / 59).toFixed(3));
    lastSec = sec;
    if (TV.ambient && TV.ambient.active()) TV.ambient.update(now);
  }

  TV.tickClock = tickClock;

  // Move everything a few pixels every 10 minutes so nothing sits still on an OLED screen.
  function pixelShift() {
    var x = Math.round(Math.random() * 12 - 6), y = Math.round(Math.random() * 12 - 6);
    TV.$('#app').style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  // One-shot animations (a changed number, a new line of text) end by removing their class,
  // so the same animation can play again next time.
  document.addEventListener('animationend', function (e) {
    var t = e.target;
    if (t.classList) { t.classList.remove('bump'); t.classList.remove('tick'); t.classList.remove('swap'); }
  });

  function start() {
    TV.fillIcons(document);
    fitStage();
    window.addEventListener('resize', fitStage);
    TV.applyPrefs();
    TV.applyTheme();
    TV.applyNight();
    TV.nav.init();

    TV.$('#btn-theme').addEventListener('click', function () { TV.openSheet('theme'); });
    TV.$('#btn-settings').addEventListener('click', function () { TV.openSheet('settings'); });

    TV.every(1000, tickClock);
    TV.widgets.start();
    TV.emit('ready');

    if (TV.demo) { TV.demo.start(); return; }

    TV.every(15 * 60 * 1000, TV.refreshWeather);
    TV.every(15 * 60 * 1000, TV.refreshCalendar);
    setInterval(TV.renderCalendar, 60 * 1000);   // update "Now" and hide finished events
    setInterval(TV.applyTheme, 60 * 1000);       // Auto light/dark at sunrise/sunset
    setInterval(pixelShift, 10 * 60 * 1000);

    // Refresh right away when the TV wakes up / the app comes back to the front.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { TV.refreshWeather(); TV.refreshCalendar(); }
    });
  }

  function boot() {
    if (/[?&]demo=1/.test(location.search)) {
      var s = document.createElement('script');
      s.src = 'js/demo.js';
      s.onload = start;
      s.onerror = start;
      document.body.appendChild(s);
    } else start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TV);
