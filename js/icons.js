// Simple line icons (24x24) drawn for this app, in the spirit of SF Symbols.
// UI icons use currentColor; weather icons use fixed colors like Apple Weather.
(function (TV) {
  function line(body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  function color(body) {
    return '<svg viewBox="0 0 24 24">' + body + '</svg>';
  }

  var SUN_C = '#FFD60A', CLOUD_C = 'var(--wx-cloud)', CLOUD_DARK = 'var(--wx-cloud-dark)', RAIN_C = 'var(--wx-rain)', BOLT_C = '#FFD60A', MOON_C = 'var(--wx-moon)', SNOW_C = 'var(--wx-snow)';

  var sunRays = '';
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    sunRays += '<line x1="' + (12 + Math.cos(a) * 7.2).toFixed(2) + '" y1="' + (12 + Math.sin(a) * 7.2).toFixed(2) +
      '" x2="' + (12 + Math.cos(a) * 9.6).toFixed(2) + '" y2="' + (12 + Math.sin(a) * 9.6).toFixed(2) + '"/>';
  }

  var cloudPath = 'M7 19h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.6 10.1 4.5 4.5 0 0 0 7 19z';
  var smallSun = '<g transform="translate(-3.5 -4) scale(0.62)"><circle cx="12" cy="12" r="4.6" fill="' + SUN_C + '"/><g stroke="' + SUN_C + '" stroke-width="2.2" stroke-linecap="round">' + sunRays + '</g></g>';
  var smallMoon = '<g transform="translate(-2.5 -3.5) scale(0.6)"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" style="fill:' + MOON_C + '"/></g>';
  var cloudUp = '<g transform="translate(0 -2.5)"><path d="' + cloudPath + '" style="fill:' + CLOUD_C + '"/></g>';
  var cloudUpDark = '<g transform="translate(0 -2.5)"><path d="' + cloudPath + '" style="fill:' + CLOUD_DARK + '"/></g>';

  TV.ICONS = {
    // ---- UI ----
    paintpalette: line('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="14.5" cy="7" r="1.2" fill="currentColor"/>'),
    gear: line('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    calendar: line('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    location: line('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    sunrise: line('<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 4l2.5 2.5M4.9 11.6l1.4 1.1M19.1 11.6l-1.4 1.1"/>'),
    sunset: line('<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 9l2.5-2.5M4.9 11.6l1.4 1.1M19.1 11.6l-1.4 1.1"/>'),
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M3.5 7v10a.8.8 0 0 0 1.2.7l7.3-5a.8.8 0 0 0 0-1.4l-7.3-5A.8.8 0 0 0 3.5 7zM12 7v10a.8.8 0 0 0 1.2.7l7.3-5a.8.8 0 0 0 0-1.4l-7.3-5A.8.8 0 0 0 12 7z" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M20.5 7v10a.8.8 0 0 1-1.2.7l-7.3-5a.8.8 0 0 1 0-1.4l7.3-5a.8.8 0 0 1 1.2.7zM12 7v10a.8.8 0 0 1-1.2.7l-7.3-5a.8.8 0 0 1 0-1.4l7.3-5A.8.8 0 0 1 12 7z" fill="currentColor"/></svg>',
    car: line('<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><rect x="3.5" y="12" width="17" height="5" rx="1.5"/><path d="M6 17v2M18 17v2"/><circle cx="7.5" cy="14.5" r=".9" fill="currentColor"/><circle cx="16.5" cy="14.5" r=".9" fill="currentColor"/>'),
    gift: line('<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-4.5-5.5-2S10 9 12 9zM12 9c1.5-3.5 5.5-4.5 5.5-2S14 9 12 9z"/>'),
    wifi: line('<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.5a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>'),
    sparkles: line('<path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM5.5 15.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/>'),
    music: line('<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    warning: line('<path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.5" r=".9" fill="currentColor"/>'),
    check: line('<path d="M5 12.5 10 17.5 19 7"/>'),
    plus: line('<path d="M12 5v14M5 12h14"/>'),
    trash: line('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
    up: line('<path d="M6 14l6-6 6 6"/>'),
    down: line('<path d="M6 10l6 6 6-6"/>'),
    drop: line('<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>'),

    // ---- Weather (colored) ----
    'wx-sun': color('<circle cx="12" cy="12" r="4.6" fill="' + SUN_C + '"/><g stroke="' + SUN_C + '" stroke-width="2" stroke-linecap="round">' + sunRays + '</g>'),
    'wx-moon': color('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" style="fill:' + MOON_C + '"/>'),
    'wx-partly-day': color(smallSun + '<path d="' + cloudPath + '" style="fill:' + CLOUD_C + '"/>'),
    'wx-partly-night': color(smallMoon + '<path d="' + cloudPath + '" style="fill:' + CLOUD_C + '"/>'),
    'wx-cloud': color('<path d="' + cloudPath + '" transform="translate(0 -1)" style="fill:' + CLOUD_C + '"/>'),
    'wx-fog': color(cloudUp + '<g style="stroke:' + CLOUD_DARK + '" stroke-width="1.8" stroke-linecap="round"><line x1="5" y1="19.5" x2="19" y2="19.5"/><line x1="7" y1="22" x2="17" y2="22"/></g>'),
    'wx-drizzle': color(cloudUp + '<g style="stroke:' + RAIN_C + '" stroke-width="1.8" stroke-linecap="round"><line x1="9" y1="19" x2="8.5" y2="20.5"/><line x1="13" y1="19" x2="12.5" y2="20.5"/><line x1="17" y1="19" x2="16.5" y2="20.5"/></g>'),
    'wx-rain': color(cloudUp + '<g style="stroke:' + RAIN_C + '" stroke-width="2" stroke-linecap="round"><line x1="8.5" y1="18.5" x2="7.3" y2="22"/><line x1="12.5" y1="18.5" x2="11.3" y2="22"/><line x1="16.5" y1="18.5" x2="15.3" y2="22"/></g>'),
    'wx-snow': color(cloudUp + '<g style="fill:' + SNOW_C + '"><circle cx="8" cy="20" r="1.3"/><circle cx="12" cy="21.5" r="1.3"/><circle cx="16" cy="20" r="1.3"/></g>'),
    'wx-sleet': color(cloudUp + '<g style="stroke:' + RAIN_C + '" stroke-width="2" stroke-linecap="round"><line x1="8.5" y1="18.5" x2="7.5" y2="21.5"/><line x1="15.5" y1="18.5" x2="14.5" y2="21.5"/></g><circle cx="12" cy="21" r="1.3" style="fill:' + SNOW_C + '"/>'),
    'wx-thunder': color(cloudUpDark + '<path d="M12.8 15.5 9.5 20.2h2.6l-1 3.3 3.6-4.9h-2.6l1.2-3.1z" fill="' + BOLT_C + '"/>')
  };

  TV.icon = function (name) { return TV.ICONS[name] || ''; };

  // Fill every <span data-icon="..."> in the page.
  TV.fillIcons = function (root) {
    TV.$$('[data-icon]', root).forEach(function (el) {
      if (!el.firstChild) el.innerHTML = TV.icon(el.getAttribute('data-icon'));
    });
  };
})(window.TV);
