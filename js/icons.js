// Simple line icons (24x24) drawn for this app, in the spirit of SF Symbols.
// UI icons use currentColor; weather icons use fixed colors like Apple Weather.
(function (TV) {
  function line(body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  function color(body) {
    return '<svg viewBox="0 0 24 24">' + body + '</svg>';
  }

  // ---- Weather illustrations ----
  // Soft shaded drawings (like Apple Weather). They share gradients defined once in index.html (#wx-defs) and take
  // their light/dark colors from the --wx-* variables, so they work in both modes. `animated` adds slow SVG motion
  // (rays turning, clouds bobbing) for the big icon only; the small ones stay still.
  function grad(n) { return 'url(#' + n + ')'; }
  function spin(on, dur) { return on ? '<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="' + dur + 's" repeatCount="indefinite"/>' : ''; }
  function bob(on, dy, dur) { return on ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 ' + dy + ';0 0" dur="' + dur + 's" repeatCount="indefinite" additive="sum"/>' : ''; }

  var sunRays = '';
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    sunRays += '<line x1="' + (12 + Math.cos(a) * 7.5).toFixed(2) + '" y1="' + (12 + Math.sin(a) * 7.5).toFixed(2) +
      '" x2="' + (12 + Math.cos(a) * 10).toFixed(2) + '" y2="' + (12 + Math.sin(a) * 10).toFixed(2) + '"/>';
  }
  var cloudPath = 'M7 19h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.6 10.1 4.5 4.5 0 0 0 7 19z';

  function sunArt(animated) {
    return '<circle cx="12" cy="12" r="11.5" fill="' + grad('wxSunGlow') + '"/>' +
      '<g stroke="#FFC21A" stroke-width="1.9" stroke-linecap="round">' + sunRays + spin(animated, 48) + '</g>' +
      '<circle cx="12" cy="12" r="5.2" fill="' + grad('wxSun') + '"/>' +
      '<circle cx="12" cy="12" r="5.2" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.6"/>';
  }
  function moonArt() {
    return '<circle cx="12" cy="12" r="11" fill="' + grad('wxMoonGlow') + '"/>' +
      '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="' + grad('wxMoon') + '"/>' +
      '<circle cx="14.6" cy="15.2" r="1.15" fill="rgba(0,0,0,0.13)"/><circle cx="11.2" cy="17.4" r="0.8" fill="rgba(0,0,0,0.13)"/><circle cx="8.6" cy="12.6" r="0.7" fill="rgba(0,0,0,0.13)"/>';
  }
  // A puffy cloud with a highlight on top and a soft shadow underneath. dark = storm / overcast.
  function cloud(dx, dy, scale, dark, animated) {
    var tf = 'translate(' + dx + ' ' + dy + ')' + (scale && scale !== 1 ? ' scale(' + scale + ')' : '');
    return '<g transform="' + tf + '">' + bob(animated, -0.7, 7) +
      '<path d="' + cloudPath + '" fill="' + grad(dark ? 'wxCloudDark' : 'wxCloud') + '"/>' +
      '<path d="M8.4 10.7A4.2 4.2 0 0 1 12.7 7.7" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M7.3 18.4h10.2a3.6 3.6 0 0 0 2.8-1.3" fill="none" stroke="rgba(0,0,0,0.16)" stroke-width="1.2" stroke-linecap="round"/></g>';
  }
  function drop(cx, cy, h, w) {
    return '<rect x="' + (cx - w / 2) + '" y="' + cy + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '" fill="' + grad('wxDrop') + '" transform="rotate(14 ' + cx + ' ' + (cy + h / 2) + ')"/>';
  }
  function flake(cx, cy, r) {
    var o = '';
    for (var k = 0; k < 3; k++) {
      var ang = k * Math.PI / 3;
      o += '<line x1="' + (cx - Math.cos(ang) * r).toFixed(2) + '" y1="' + (cy - Math.sin(ang) * r).toFixed(2) + '" x2="' + (cx + Math.cos(ang) * r).toFixed(2) + '" y2="' + (cy + Math.sin(ang) * r).toFixed(2) + '"/>';
    }
    return o;
  }
  function wxIcon(name, animated) {
    var body = '';
    switch (name) {
      case 'wx-sun': body = sunArt(animated); break;
      case 'wx-moon': body = moonArt(); break;
      case 'wx-partly-day': body = '<g transform="translate(0 0) scale(0.66)">' + sunArt(animated) + '</g>' + cloud(1.6, 1.4, 1, false, animated); break;
      case 'wx-partly-night': body = '<g transform="translate(0.2 0.2) scale(0.62)">' + moonArt() + '</g>' + cloud(1.6, 1.4, 1, false, animated); break;
      case 'wx-cloud': body = cloud(0, -0.8, 1, false, animated); break;
      case 'wx-fog': body = cloud(0, -2.8, 1, false, animated) + '<g fill="' + grad('wxFog') + '"><rect x="4.5" y="18.4" width="15" height="1.8" rx="0.9"/><rect x="6.5" y="21" width="11" height="1.8" rx="0.9"/></g>'; break;
      case 'wx-drizzle': body = cloud(0, -2.8, 1, false, animated) + drop(8.5, 18.2, 2.4, 1.5) + drop(12.5, 19.2, 2.4, 1.5) + drop(16.5, 18.2, 2.4, 1.5); break;
      case 'wx-rain': body = cloud(0, -2.8, 1, false, animated) + drop(8.6, 17.6, 4.2, 1.9) + drop(12.6, 18.4, 4.2, 1.9) + drop(16.6, 17.6, 4.2, 1.9); break;
      case 'wx-snow': body = cloud(0, -2.8, 1, false, animated) + '<g stroke="' + 'var(--wx-snow-ink)' + '" stroke-width="1" stroke-linecap="round">' + flake(8, 19.6, 1.5) + flake(12.3, 21.4, 1.5) + flake(16.6, 19.6, 1.5) + '</g>'; break;
      case 'wx-sleet': body = cloud(0, -2.8, 1, false, animated) + drop(8.8, 17.8, 3.6, 1.8) + drop(15.8, 17.8, 3.6, 1.8) + '<g stroke="var(--wx-snow-ink)" stroke-width="1" stroke-linecap="round">' + flake(12.3, 20.8, 1.4) + '</g>'; break;
      case 'wx-thunder': body = cloud(0, -3, 1, true, animated) + '<path d="M13.2 14.6 9.4 20.4h2.8l-1.1 3.3 4.3-5.9h-2.9l1.1-3.2z" fill="' + grad('wxBolt') + '" stroke="rgba(255,255,255,0.45)" stroke-width="0.4" stroke-linejoin="round"/>'; break;
      default: return '';
    }
    return '<svg viewBox="0 0 24 24">' + body + '</svg>';
  }
  var WX_NAMES = ['wx-sun', 'wx-moon', 'wx-partly-day', 'wx-partly-night', 'wx-cloud', 'wx-fog', 'wx-drizzle', 'wx-rain', 'wx-snow', 'wx-sleet', 'wx-thunder'];

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
    air: line('<path d="M3 9h10a2.5 2.5 0 1 0-2.5-2.5M3 13h14a2.5 2.5 0 1 1-2.5 2.5M3 17h6"/>'),
    radar: line('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.4-4.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
    hourglass: line('<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 3.2 5.2 4 8.5-.8 3.3-4 4-4 8.5M16 3.5c0 4.5-3.2 5.2-4 8.5.8 3.3 4 4 4 8.5"/>'),
    plus: line('<path d="M12 5v14M5 12h14"/>'),
    trash: line('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
    up: line('<path d="M6 14l6-6 6 6"/>'),
    down: line('<path d="M6 10l6 6 6-6"/>'),
    drop: line('<path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/>')
  };
  WX_NAMES.forEach(function (n) { TV.ICONS[n] = wxIcon(n, false); });

  // animated = true gives the weather illustrations their slow motion (used for the big icon only)
  TV.icon = function (name, animated) { return animated && name.indexOf('wx-') === 0 ? wxIcon(name, true) : (TV.ICONS[name] || ''); };
  TV.WX_ICON_NAMES = WX_NAMES;

  // Fill every <span data-icon="..."> in the page.
  TV.fillIcons = function (root) {
    TV.$$('[data-icon]', root).forEach(function (el) {
      if (!el.firstChild) el.innerHTML = TV.icon(el.getAttribute('data-icon'));
    });
  };
})(window.TV);
