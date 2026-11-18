// Streaming apps: the list the Apps page knows about, and the logic that finds each one on YOUR TV.
// Pure functions (no screen needed), so they are easy to test.
//
// Why "find it on the TV": Samsung does not publish the IDs of the built-in apps, the sources that list
// them disagree, and they can differ between TV models and software versions. So the app asks the TV what
// is installed, matches by name, and only falls back to the IDs below when the TV will not say.
// The `known` IDs come from one unofficial guide and are UNVERIFIED: check them with Settings > Apps >
// Find Apps on This TV.
(function (root) {
  var CATALOG = [
    { key: 'netflix', mark: 'N',   name: 'Netflix',     color: ['#b20710', '#5a0308'], match: /netflix/i, known: ['3201907018807'] },
    { key: 'youtube', mark: 'YT',   name: 'YouTube',     color: ['#c4001d', '#68000e'], match: /^youtube$/i, known: ['9Ur5IzDKqV.TizenYouTube'] },
    { key: 'disney', mark: 'D+',    name: 'Disney+',     color: ['#1342c9', '#0a1f6e'], match: /disney\s*(\+|plus)/i, known: ['3201901017640'] },
    { key: 'prime', mark: 'P',     name: 'Prime Video', color: ['#0a6ea8', '#053a63'], match: /prime\s*video|amazon\s*prime/i, known: ['3201910019365'] },
    { key: 'appletv', mark: 'tv',   name: 'Apple TV',    color: ['#3a3a3f', '#0a0a0b'], match: /^apple\s*tv(\s*\+)?$/i, known: [] },
    { key: 'max', mark: 'M',       name: 'Max',         color: ['#5a2fd6', '#26106e'], match: /^(hbo\s*)?max$/i, known: [] },
    { key: 'hulu', mark: 'H',      name: 'Hulu',        color: ['#0f7a43', '#073f24'], match: /hulu/i, known: [] },
    { key: 'peacock', mark: 'Pc',   name: 'Peacock',     color: ['#35353b', '#0f0f12'], match: /peacock/i, known: [] },
    { key: 'paramount', mark: 'P+', name: 'Paramount+',  color: ['#0050c8', '#002873'], match: /paramount/i, known: [] },
    { key: 'spotify', mark: 'S',   name: 'Spotify',     color: ['#17803b', '#094a21'], match: /spotify/i, known: [] },
    { key: 'plex', mark: 'Px',      name: 'Plex',        color: ['#8a5200', '#452a00'], match: /^plex/i, known: [] },
    { key: 'tubi', mark: 'T',      name: 'Tubi',        color: ['#7a3cff', '#3a14a3'], match: /tubi/i, known: [] }
  ];

  // installed: [{ id, name }] as reported by the TV. Returns { key: { id, name } } for the catalogue apps found.
  // An exact name match wins over a looser one, and the first match wins when there are several.
  function matchInstalled(installed, catalog) {
    var found = {};
    (catalog || CATALOG).forEach(function (c) {
      var exact = null, loose = null;
      (installed || []).forEach(function (a) {
        if (!a || !a.id || !a.name) return;
        if (!c.match.test(a.name)) return;
        if (a.name.trim().toLowerCase() === c.name.toLowerCase()) { if (!exact) exact = a; }
        else if (!loose) loose = a;
      });
      var hit = exact || loose;
      if (hit) found[c.key] = { id: hit.id, name: hit.name };
    });
    return found;
  }

  // Builds what the Apps page shows.
  //   installed: what the TV reported ([] when it reported nothing or could not be asked)
  //   custom:    c.apps from config.local.js: [{ name, id, color }]
  //   prefs:     { order: [keys], disabled: [keys] }
  // Returns [{ key, name, color, appId, source, installed, enabled }] in the user's order.
  //   source: 'tv' (found on this TV), 'config' (from config.local.js), 'known' (unverified built-in ID), 'none'
  //   installed: true / false when the TV was asked, null when it could not say
  function resolve(installed, custom, prefs) {
    prefs = prefs || {};
    var asked = !!(installed && installed.length), found = matchInstalled(installed || []);
    var list = CATALOG.map(function (c) {
      var hit = found[c.key], appId = null, source = 'none';
      if (hit) { appId = hit.id; source = 'tv'; }
      else if (!asked && c.known.length) { appId = c.known[0]; source = 'known'; }
      return { key: c.key, name: c.name, mark: c.mark, color: c.color, appId: appId, source: source, installed: asked ? !!hit : null };
    });
    (custom || []).forEach(function (u) {
      if (!u || !u.name || !u.id) return;
      var key = String(u.name).toLowerCase().replace(/[^a-z0-9+]+/g, '');
      var color = u.color ? [u.color, u.color] : ['#3a3a3f', '#0a0a0b'];
      var entry = { key: key, name: u.name, mark: String(u.name).charAt(0).toUpperCase(), color: color, appId: u.id, source: 'config', installed: null };
      var i = -1;
      list.forEach(function (x, n) { if (x.name.toLowerCase() === String(u.name).toLowerCase() || x.key === key) i = n; });
      if (i >= 0) { if (!u.color) entry.color = list[i].color; entry.mark = list[i].mark; list[i] = entry; } else list.push(entry);
    });
    var order = prefs.order || [], disabled = prefs.disabled || [];
    list.forEach(function (a) { a.enabled = disabled.indexOf(a.key) < 0; });
    list.sort(function (a, b) {
      var ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      if (ia < 0) ia = 1000 + list.indexOf(a);
      if (ib < 0) ib = 1000 + list.indexOf(b);
      return ia - ib;
    });
    return list;
  }

  // What is shown on the Apps page: enabled apps, leaving out apps the TV said are not installed. At most 15.
  function visible(list) {
    return list.filter(function (a) { return a.enabled && a.installed !== false; }).slice(0, 15);
  }

  var api = { CATALOG: CATALOG, matchInstalled: matchInstalled, resolve: resolve, visible: visible };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.appmatch = api; }
})(typeof window !== 'undefined' ? window : this);
