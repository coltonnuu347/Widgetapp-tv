// Severe weather alerts from the US National Weather Service (US locations only).
// Shown as a banner across the top of the screen, not as a grid card.
(function (TV) {
  var alerts = [];
  var rotateIndex = 0;
  var SEVERITY_ORDER = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };

  function fetchAlerts() {
    var loc = TV.location;
    if (!loc || (loc.country && loc.country !== 'US')) { alerts = []; render(); return; }
    var url = 'https://api.weather.gov/alerts/active?status=actual&point=' + loc.lat.toFixed(4) + ',' + loc.lon.toFixed(4);
    TV.fetchJSON(url, { headers: { Accept: 'application/geo+json' } }).then(function (j) {
      var now = new Date();
      alerts = (j.features || []).map(function (f) { return f.properties; }).filter(function (p) {
        var ends = p.ends || p.expires;
        return !ends || new Date(ends) > now;
      }).sort(function (a, b) {
        return (SEVERITY_ORDER[a.severity] || 4) - (SEVERITY_ORDER[b.severity] || 4);
      });
      render();
    }).catch(function (e) {
      TV.log('Alerts failed:', e.message); // keep showing the last alerts
    });
  }

  function untilText(d) {
    var label = TV.dayLabel(d, new Date());
    return TV.esc(label === 'Today' ? TV.fmtTime(d) : label + ' ' + TV.fmtTime(d));
  }

  function render() {
    var el = TV.$('#alert-banner');
    if (!TV.widgets.isEnabled({ id: 'alerts' }) || !alerts.length) {
      el.className = 'hidden';
      document.body.classList.remove('has-alert');
      return;
    }
    var a = alerts[rotateIndex % alerts.length];
    var ends = a.ends || a.expires;
    var sev = (a.severity || 'Unknown').toLowerCase();
    el.className = 'sev-' + sev;
    el.innerHTML = '<span class="icon">' + TV.icon('warning') + '</span>' +
      '<span class="alert-event">' + TV.esc(a.event) + '</span>' +
      (ends ? '<span class="alert-until">until ' + untilText(new Date(ends)) + '</span>' : '') +
      (alerts.length > 1 ? '<span class="alert-count">' + (rotateIndex % alerts.length + 1) + ' of ' + alerts.length + '</span>' : '');
    document.body.classList.add('has-alert');
  }

  TV.widgets.register({
    id: 'alerts',
    name: 'Severe Weather Alerts (banner)',
    visible: function () { return false; }, // never takes a grid slot
    init: function () {
      TV.on('location', function () { fetchAlerts(); });
      TV.on('prefs', render);
      setInterval(fetchAlerts, 5 * 60 * 1000);
      setInterval(function () { if (alerts.length > 1) { rotateIndex++; render(); } }, 10000);
    },
    render: function () {},
    refresh: render,
    detail: function (el) {
      if (!alerts.length) { el.innerHTML = '<h2>Weather Alerts</h2><div class="empty-note">No active alerts.</div>'; return; }
      el.innerHTML = '<h2>Weather Alerts</h2>' + alerts.map(function (a) {
        var ends = a.ends || a.expires;
        return '<div class="da-alert sev-' + TV.esc((a.severity || 'unknown').toLowerCase()) + '">' +
          '<div class="da-event">' + TV.esc(a.event) + (ends ? ' · until ' + untilText(new Date(ends)) : '') + '</div>' +
          (a.headline ? '<div class="da-headline">' + TV.esc(a.headline) + '</div>' : '') +
          (a.description ? '<div class="da-text">' + TV.esc(a.description) + '</div>' : '') +
          (a.instruction ? '<div class="da-text"><b>What to do:</b> ' + TV.esc(a.instruction) + '</div>' : '') +
          '<div class="dsm-label">From ' + TV.esc(a.senderName || 'National Weather Service') + '</div></div>';
      }).join('') + '<div class="hint">Use ▲ ▼ to scroll · Back to close</div>';
    }
  });
})(window.TV);
