// Saved settings (on the TV, in localStorage). Your config files supply the starting values.
(function (TV) {
  var KEY = 'tvdash.settings.v1';

  // Starting values for everything under Settings > Clock, Layout, Glass & Outlines, Panels.
  TV.VERSION = '2026-11-19 c (radar forecast beside the weather, no-cache server)';   // shown at the bottom of Settings, so you can tell which copy is running
  TV.PREF_DEFAULTS = {
    clockStyle: 'thin', clockSize: 'm', hour12: false, seconds: false,
    density: 'compact', calSide: 'left',
    outline: 'theme', outlineWidth: 'medium', glass: 'frosted', corners: 'round', glow: true, motion: true,
    calDays: Math.max(1, TV_CONFIG.calendarDays || 7), hours: 12, unit: 'F',
    statHilo: true, statFeels: true, statHumidity: true, statWind: true,
    anim: 'full', greeting: true, nightDim: true,
    spotifyWide: true, commuteAlways: false,
    albumBg: true, wxfx: true, ambient: 10
  };

  var DEFAULTS = {
    theme: { style: 'gradient', gradient: 'purple', photo: '', art: '', mode: 'auto' },
    // Calendars added on the TV (on top of the ones in config.local.js), and config ones you hid.
    extraCalendars: [],
    hiddenCalendars: [],
    // Location you typed in Settings. null = use config.local.js or detect automatically.
    manualLocation: null,
    // Starts with the widgets config.local.js turns off; changes made on the TV are saved over this.
    widgets: { order: [], disabled: (TV_CONFIG.widgetsOff || []).slice() },
    // Streaming apps on the Apps page: your order, the ones you turned off or on, and apps you added from the TV
    apps: { order: [], disabled: [], enabled: [], custom: [] },
    prefs: JSON.parse(JSON.stringify(TV.PREF_DEFAULTS))
  };

  function merge(base, saved) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      var b = base[k], s = saved ? saved[k] : undefined;
      if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = merge(b, s || {});
      else out[k] = s === undefined ? b : s;
    });
    return out;
  }

  TV.settings = merge(DEFAULTS, TV.storage.get(KEY, {}));

  TV.saveSettings = function () {
    TV.storage.set(KEY, TV.settings);
  };

  // All calendars to show: config ones (unless hidden) + ones added on the TV.
  TV.getCalendars = function () {
    var cfg = (TV_CONFIG.calendars || []).filter(function (c) {
      return c && c.url && TV.settings.hiddenCalendars.indexOf(c.url) === -1;
    }).map(function (c) { return { url: c.url, name: c.name || '', color: c.color || '', fromConfig: true }; });
    var extra = TV.settings.extraCalendars.map(function (c) { return { url: c.url, name: c.name || '', color: c.color || '', fromConfig: false }; });
    return cfg.concat(extra);
  };
})(window.TV);
