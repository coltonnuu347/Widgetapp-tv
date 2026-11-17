// Shared helpers. Written for older TV browsers (Chromium 63+): no optional chaining, no ?? operator.
window.TV = window.TV || {};

(function (TV) {
  TV.$ = function (sel, root) { return (root || document).querySelector(sel); };
  TV.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  TV.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  TV.pad = function (n) { return (n < 10 ? '0' : '') + n; };

  function hour12() { return !!(TV.settings && TV.settings.prefs && TV.settings.prefs.hour12); }
  // 24-hour "09:05", or "9:05 AM" when the 12-hour option is on
  TV.fmtTime = function (d) {
    if (!hour12()) return TV.pad(d.getHours()) + ':' + TV.pad(d.getMinutes());
    return (d.getHours() % 12 || 12) + ':' + TV.pad(d.getMinutes()) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
  };
  // Hour only: "09", or "9 AM"
  TV.fmtHour = function (d) {
    if (!hour12()) return TV.pad(d.getHours());
    return (d.getHours() % 12 || 12) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
  };

  TV.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  TV.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  TV.startOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  TV.addDays = function (d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds()); };
  // Whole calendar days from a to b (local time, DST-safe).
  TV.daysBetween = function (a, b) {
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  };

  // "Today", "Tomorrow", or "Thursday, Oct 29"
  TV.dayLabel = function (day, now) {
    var diff = TV.daysBetween(now, day);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return TV.DAYS[day.getDay()] + ', ' + TV.MONTHS[day.getMonth()].slice(0, 3) + ' ' + day.getDate();
  };

  TV.inDaysText = function (n) {
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    return 'In ' + n + ' days';
  };

  // fetch with a timeout. Rejects on HTTP errors.
  TV.fetchWithTimeout = function (url, opts, ms) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { done = true; reject(new Error('Timed out: ' + url)); }, ms || 15000);
      fetch(url, opts).then(function (res) {
        if (done) return;
        clearTimeout(timer);
        resolve(res);
      }, function (err) {
        if (done) return;
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  TV.fetchJSON = function (url, opts, ms) {
    return TV.fetchWithTimeout(url, opts, ms).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    });
  };

  // Run fn now and then every ms milliseconds.
  TV.every = function (ms, fn) {
    fn();
    return setInterval(fn, ms);
  };

  // localStorage that never throws.
  TV.storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };

  // Tiny event bus so modules can react to each other (e.g. weather -> sun/moon widget).
  var listeners = {};
  TV.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); };
  TV.emit = function (name, data) {
    (listeners[name] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { console.error(e); }
    });
  };

  // Play a one-shot animation on an element (restarting it if it is already playing).
  // Nothing is added when animations are Off, or Reduced for the movement-style ones, so no stale class is left behind.
  TV.play = function (el, cls) {
    var mode = (TV.settings && TV.settings.prefs && TV.settings.prefs.anim) || 'full';
    if (mode === 'off' || (mode === 'reduced' && cls === 'bump')) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  };

  // Full-screen views opened with OK on a card: id -> { render(el), action(name, value) }
  TV.details = {};

  TV.log = function () {
    if (window.console) console.log.apply(console, ['[TV]'].concat(Array.prototype.slice.call(arguments)));
  };
})(window.TV);
