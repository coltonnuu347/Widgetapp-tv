// Streaming apps: the services the Apps page knows about, how each tile looks, and the logic that finds each one on YOUR TV.
// Pure functions (no screen needed), so they are easy to test.
//
// Why "find it on the TV": Samsung does not publish the IDs of the built-in apps, the sources that list
// them disagree, and they can differ between TV models and software versions. So the app asks the TV what
// is installed, matches by name, and only falls back to the IDs below when the TV will not say.
// The `known` IDs come from one unofficial guide and are UNVERIFIED: check them with the app editor's
// "Find Apps on This TV".
//
// Tile look: `bg` is the tile gradient, `fg` the logo color. `logo` names an icon in js/logos.js; `word` draws a text
// wordmark for brands that are not in that icon set. `def: true` means the tile is on until you turn it off; the rest
// can be added in the app editor.
(function (root) {
  var CATALOG = [
    // ---- on by default
    { key: 'netflix',   name: 'Netflix',     logo: 'netflix',       mark: 'N',  bg: ['#1f1f1f', '#050505'], fg: '#E50914', match: /netflix/i, known: ['3201907018807'], def: true },
    { key: 'youtube',   name: 'YouTube',     logo: 'youtube',       mark: 'YT', bg: ['#2b2b2b', '#0f0f0f'], fg: '#FF0000', match: /^youtube$/i, known: ['9Ur5IzDKqV.TizenYouTube'], def: true },
    { key: 'disney',    name: 'Disney+',     word: { text: 'Disney+', style: 'disney' }, mark: 'D+', bg: ['#1f4fe0', '#0a1a66'], fg: '#FFFFFF', match: /disney\s*(\+|plus)/i, known: ['3201901017640'], def: true },
    { key: 'prime',     name: 'Prime Video', word: { text: 'prime video', style: 'prime', accent: '#4DB8FF' }, mark: 'P', bg: ['#1d2a38', '#0b1118'], fg: '#FFFFFF', match: /prime\s*video|amazon\s*prime/i, known: ['3201910019365'], def: true },
    { key: 'appletv',   name: 'Apple TV',    logo: 'appletv',       mark: 'tv', bg: ['#3d3d42', '#0c0c0e'], fg: '#FFFFFF', match: /^apple\s*tv(\s*\+)?$/i, known: [], def: true },
    { key: 'hbomax',    name: 'HBO Max',     logo: 'hbomax',        mark: 'M',  bg: ['#7132ea', '#2a0c78'], fg: '#FFFFFF', match: /^(hbo\s*)?max$/i, known: [], def: true },
    { key: 'hulu',      name: 'Hulu',        word: { text: 'hulu', style: 'hulu' }, mark: 'H', bg: ['#20262c', '#07090b'], fg: '#1CE783', match: /hulu/i, known: [], def: true },
    { key: 'peacock',   name: 'Peacock',     word: { text: 'peacock', style: 'peacock' }, mark: 'Pc', bg: ['#33333a', '#0a0a0d'], fg: '#FFFFFF', match: /peacock/i, known: [], def: true },
    { key: 'paramount', name: 'Paramount+',  logo: 'paramountplus', mark: 'P+', bg: ['#1f78ff', '#0540b8'], fg: '#FFFFFF', match: /paramount/i, known: [], def: true },
    { key: 'spotify',   name: 'Spotify',     logo: 'spotify',       mark: 'S',  bg: ['#222222', '#080808'], fg: '#1ED760', match: /spotify/i, known: [], def: true },
    { key: 'plex',      name: 'Plex',        logo: 'plex',          mark: 'Px', bg: ['#34363a', '#121315'], fg: '#EBAF00', match: /^plex/i, known: [], def: true },
    { key: 'tubi',      name: 'Tubi',        logo: 'tubi',          mark: 'T',  bg: ['#8d2eff', '#4208b0'], fg: '#FFFFFF', match: /tubi/i, known: [], def: true },
    // ---- more services you can add
    { key: 'crunchyroll', name: 'Crunchyroll', logo: 'crunchyroll', mark: 'C',  bg: ['#33302e', '#121110'], fg: '#FF7A1A', match: /crunchyroll/i, known: [] },
    { key: 'twitch',    name: 'Twitch',      logo: 'twitch',        mark: 'T',  bg: ['#33205f', '#120a2b'], fg: '#B58CFF', match: /^twitch/i, known: [] },
    { key: 'applemusic', name: 'Apple Music', logo: 'applemusic',   mark: 'A',  bg: ['#d81d38', '#7a0b1b'], fg: '#FFFFFF', match: /apple\s*music/i, known: [] },
    { key: 'youtubemusic', name: 'YouTube Music', logo: 'youtubemusic', mark: 'YM', bg: ['#2b2b2b', '#0f0f0f'], fg: '#FF0000', match: /youtube\s*music/i, known: [] },
    { key: 'youtubetv', name: 'YouTube TV',  logo: 'youtubetv',     mark: 'YT', bg: ['#2b2b2b', '#0f0f0f'], fg: '#FF0000', match: /youtube\s*tv/i, known: [] },
    { key: 'vimeo',     name: 'Vimeo',       logo: 'vimeo',         mark: 'V',  bg: ['#17445a', '#071e29'], fg: '#1AB7EA', match: /vimeo/i, known: [] },
    { key: 'tidal',     name: 'TIDAL',       logo: 'tidal',         mark: 'T',  bg: ['#303030', '#0a0a0a'], fg: '#FFFFFF', match: /tidal/i, known: [] },
    { key: 'fubo',      name: 'Fubo',        logo: 'fubo',          mark: 'F',  bg: ['#33211c', '#0d0605'], fg: '#FF6A3D', match: /fubo/i, known: [] },
    { key: 'pandora',   name: 'Pandora',     logo: 'pandora',       mark: 'P',  bg: ['#2f58cc', '#142a73'], fg: '#FFFFFF', match: /pandora/i, known: [] },
    { key: 'soundcloud', name: 'SoundCloud', logo: 'soundcloud',    mark: 'S',  bg: ['#d44b00', '#7a2a00'], fg: '#FFFFFF', match: /soundcloud/i, known: [] },
    { key: 'deezer',    name: 'Deezer',      logo: 'deezer',        mark: 'D',  bg: ['#2b1f45', '#0d0818'], fg: '#B866FF', match: /deezer/i, known: [] },
    { key: 'kick',      name: 'Kick',        logo: 'kick',          mark: 'K',  bg: ['#1b201d', '#050606'], fg: '#53FC19', match: /^kick$/i, known: [] },
    { key: 'dazn',      name: 'DAZN',        logo: 'dazn',          mark: 'D',  bg: ['#2b2b2b', '#0a0a0a'], fg: '#F8F8F5', match: /dazn/i, known: [] },
    { key: 'kodi',      name: 'Kodi',        logo: 'kodi',          mark: 'K',  bg: ['#17394a', '#08141c'], fg: '#17B2E7', match: /^kodi$/i, known: [] },
    { key: 'plutotv',   name: 'Pluto TV',    word: { text: 'PLUTO TV', style: 'pluto' }, mark: 'P', bg: ['#2d2d33', '#0a0a0d'], fg: '#FFE600', match: /pluto/i, known: [] },
    { key: 'espn',      name: 'ESPN',        word: { text: 'ESPN', style: 'espn' }, mark: 'E', bg: ['#262626', '#080808'], fg: '#FF4040', match: /^espn/i, known: [] }
  ];

  var LEGACY = { max: 'hbomax' };

  function slug(name) { return String(name).toLowerCase().replace(/[^a-z0-9+]+/g, ''); }

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

  var PLAIN = { bg: ['#45454b', '#141416'], fg: '#FFFFFF' };

  // Builds the list the Apps page and the app editor work from.
  //   installed: what the TV reported ([] when it reported nothing or could not be asked)
  //   custom:    c.apps from config.local.js: [{ name, id, color }]
  //   prefs:     { order: [keys], disabled: [keys], enabled: [keys], custom: [{ name, id }] }   (custom = apps you added on the TV)
  // Returns every service, in your order, each: { key, name, logo, word, mark, bg, fg, appId, source, installed, enabled, def, removable }
  //   source: 'tv' (found on this TV), 'config' (config.local.js), 'user' (added on the TV), 'known' (unverified built-in ID), 'none'
  //   installed: true / false when the TV was asked, null when it could not say
  function resolve(installed, custom, prefs) {
    prefs = prefs || {};
    var asked = !!(installed && installed.length), found = matchInstalled(installed || []);
    var list = CATALOG.map(function (c) {
      var hit = found[c.key], appId = null, source = 'none';
      if (hit) { appId = hit.id; source = 'tv'; }
      else if (!asked && c.known.length) { appId = c.known[0]; source = 'known'; }
      return { key: c.key, name: c.name, logo: c.logo || '', word: c.word || null, mark: c.mark, bg: c.bg, fg: c.fg, appId: appId, source: source, installed: asked ? !!hit : null, def: !!c.def, removable: false };
    });
    function add(u, source) {
      if (!u || !u.name || !u.id) return;
      var key = (source === 'user' ? 'u_' : '') + slug(u.name), i = -1;
      var entry = { key: key, name: u.name, logo: '', word: null, mark: String(u.name).charAt(0).toUpperCase(), bg: u.color ? [u.color, u.color] : PLAIN.bg, fg: PLAIN.fg, appId: u.id, source: source, installed: null, def: true, removable: source === 'user' };
      list.forEach(function (x, n) { if (x.name.toLowerCase() === String(u.name).toLowerCase() || x.key === key) i = n; });
      if (i >= 0) {
        // fixes a built-in service: it keeps its own look
        ['logo', 'word', 'mark', 'fg'].forEach(function (k) { entry[k] = list[i][k]; });
        if (!u.color) entry.bg = list[i].bg;
        entry.key = list[i].key; entry.def = true; entry.removable = false;   // you listed it yourself, so it is on
        list[i] = entry;
      } else {
        // an app that is already listed under the same TV id is not added twice
        if (list.some(function (x) { return x.appId === u.id; })) return;
        list.push(entry);
      }
    }
    (custom || []).forEach(function (u) { add(u, 'config'); });
    (prefs.custom || []).forEach(function (u) { add(u, 'user'); });
    // keys saved by the earlier version of the page
    function fix(keys) { return (keys || []).map(function (k) { return LEGACY[k] || k; }); }
    var order = fix(prefs.order), disabled = fix(prefs.disabled), enabled = fix(prefs.enabled);
    list.forEach(function (a) { a.enabled = disabled.indexOf(a.key) < 0 && (a.def || enabled.indexOf(a.key) >= 0); });
    list.sort(function (a, b) {
      var ia = order.indexOf(a.key), ib = order.indexOf(b.key);
      if (ia < 0) ia = 1000 + list.indexOf(a);
      if (ib < 0) ib = 1000 + list.indexOf(b);
      return ia - ib;
    });
    return list;
  }

  // What is shown on the Apps page: enabled apps, leaving out apps the TV said are not installed.
  function visible(list) {
    return list.filter(function (a) { return a.enabled && a.installed !== false; });
  }

  // Apps the TV reported that are not in the list yet (so they can be added): not matched to a service, not already added.
  function unmatched(found, list) {
    var used = {};
    list.forEach(function (a) { if (a.appId) used[a.appId] = 1; });
    return (found || []).filter(function (a) { return a && a.id && a.name && !used[a.id]; });
  }

  // The color the Apps page tints its background with while a tile is selected: whichever of the tile color and the
  // logo color is more colorful (a grey tile with a red logo gives red).
  function chroma(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return Math.max(r, g, b) - Math.min(r, g, b); }
  function washColor(a) { return chroma(a.fg) > chroma(a.bg[0]) ? a.fg : a.bg[0]; }

  var api = { washColor: washColor, CATALOG: CATALOG, matchInstalled: matchInstalled, resolve: resolve, visible: visible, unmatched: unmatched, slug: slug };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.appmatch = api; }
})(typeof window !== 'undefined' ? window : this);
