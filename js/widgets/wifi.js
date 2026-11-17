// Guest Wi-Fi QR code. Made on the TV; your password is never sent anywhere.
(function (TV) {
  function escapeWifi(s) { return String(s).replace(/([\\;,:"])/g, '\\$1'); }

  TV.wifiString = function (w) {
    var sec = (w.security || 'WPA').toUpperCase();
    if (sec === 'NONE' || sec === 'OPEN' || sec === 'NOPASS') {
      return 'WIFI:T:nopass;S:' + escapeWifi(w.ssid) + ';' + (w.hidden ? 'H:true;' : '') + ';';
    }
    return 'WIFI:T:' + (sec === 'WEP' ? 'WEP' : 'WPA') + ';S:' + escapeWifi(w.ssid) + ';P:' + escapeWifi(w.password || '') + ';' + (w.hidden ? 'H:true;' : '') + ';';
  };

  var svgCache = null, cacheKey = '';

  function qrSvg(text) {
    if (cacheKey === text && svgCache) return svgCache;
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    var qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    var n = qr.getModuleCount(), q = 2, size = n + q * 2, path = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) path += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
      }
    }
    svgCache = '<svg viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
    cacheKey = text;
    return svgCache;
  }

  TV.widgets.register({
    id: 'wifi',
    name: 'Guest Wi-Fi',
    visible: function () { var w = TV_CONFIG.wifi; return !!(w && w.ssid); },
    render: function (el) {
      var w = TV_CONFIG.wifi;
      if (el.getAttribute('data-built') === w.ssid) return;
      el.setAttribute('data-built', w.ssid);
      el.innerHTML = TV.widgetHeader('wifi', 'Guest Wi-Fi') +
        '<div class="wifi-body"><div class="wifi-qr">' + qrSvg(TV.wifiString(w)) + '</div>' +
        '<div class="wifi-info"><div class="wifi-label">Network</div><div class="wifi-ssid">' + TV.esc(w.ssid) + '</div>' +
        '<div class="wifi-hint">Point your phone’s camera at the code to join.</div></div></div>';
    },
    detail: function (el) {
      var w = TV_CONFIG.wifi;
      var open = /^(none|open|nopass)$/i.test(w.security || '');
      el.innerHTML = '<div class="dwifi"><div class="dwifi-qr">' + qrSvg(TV.wifiString(w)) + '</div>' +
        '<div class="dwifi-info"><h2>Join Wi-Fi</h2>' +
        '<div class="dsm-label">Network</div><div class="dwifi-val">' + TV.esc(w.ssid) + '</div>' +
        (open ? '' : '<div class="dsm-label">Password</div><div class="dwifi-val">' + TV.esc(w.password) + '</div>') +
        '<div class="hint">Open your phone’s camera and point it at the code, then tap the notification to join.</div></div></div>';
    }
  });
})(window.TV);
