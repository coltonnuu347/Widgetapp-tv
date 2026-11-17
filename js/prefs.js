// Customization: the options shown in Settings, and how each one is applied to the screen.
(function (TV) {
  // Each row is either a set of choices (options: [value, label]) or an On/Off switch (toggle).
  TV.PREF_SECTIONS = [
    { title: 'Clock', rows: [
      { key: 'clockStyle', label: 'Style', options: [['thin', 'Thin'], ['bold', 'Bold'], ['outline', 'Outline']] },
      { key: 'clockSize', label: 'Size', options: [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']] },
      { key: 'hour12', label: 'Time Format', options: [[false, '24-Hour'], [true, '12-Hour']] },
      { key: 'seconds', label: 'Show Seconds', toggle: true }
    ] },
    { title: 'Layout', rows: [
      { key: 'density', label: 'Widgets on Screen', options: [['large', '3 Large'], ['medium', '4 Medium'], ['compact', '6 Compact']] },
      { key: 'calSide', label: 'Calendar Side', options: [['left', 'Left'], ['right', 'Right']] },
      { key: 'spotifyWide', label: 'Wide Spotify Tile', toggle: true }
    ], hint: 'Tiles only get smaller when more widgets are showing than fit in one row.' },
    { title: 'Glass & Outlines', rows: [
      { key: 'outline', label: 'Outline', options: [['theme', 'Theme Glow'], ['crisp', 'Crisp'], ['subtle', 'Subtle']] },
      { key: 'outlineWidth', label: 'Outline Thickness', options: [['thin', 'Thin'], ['medium', 'Medium'], ['thick', 'Thick']] },
      { key: 'glass', label: 'Glass', options: [['frosted', 'Frosted'], ['solid', 'Solid']] },
      { key: 'corners', label: 'Corners', options: [['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']] },
      { key: 'glow', label: 'Glow Around Panels', toggle: true },
      { key: 'motion', label: 'Moving Background', toggle: true }
    ], hint: 'Frosted is as see-through as the glass can be while small text stays easy to read.' },
    { title: 'Panels', rows: [
      { key: 'calDays', label: 'Up Next Shows', options: [[3, '3 Days'], [7, '7 Days'], [14, '14 Days']] },
      { key: 'hours', label: 'Forecast Length', options: [[6, '6 Hours'], [8, '8 Hours'], [12, '12 Hours']] },
      { key: 'unit', label: 'Temperature', options: [['F', '°F'], ['C', '°C']] },
      { key: 'statHilo', label: 'Weather: High · Low', toggle: true },
      { key: 'statFeels', label: 'Weather: Feels Like', toggle: true },
      { key: 'statHumidity', label: 'Weather: Humidity', toggle: true },
      { key: 'statWind', label: 'Weather: Wind', toggle: true }
    ] },
    { title: 'Smart & Motion', rows: [
      { key: 'anim', label: 'Animations', options: [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']] },
      { key: 'greeting', label: 'Greeting', toggle: true },
      { key: 'nightDim', label: 'Dim After Sunset', toggle: true }
    ], hint: 'Reduced keeps simple fades only. If anything looks choppy on your TV, set Animations to Reduced or Off.' }
  ];

  // Puts the saved choices onto <body>, where the stylesheet picks them up.
  TV.applyPrefs = function () {
    var p = TV.settings.prefs, b = document.body;
    b.setAttribute('data-clock', p.clockStyle);
    b.setAttribute('data-clock-size', p.clockSize);
    b.setAttribute('data-outline', p.outline);
    b.setAttribute('data-ol-width', p.outlineWidth);
    b.setAttribute('data-glass', p.glass);
    b.setAttribute('data-corners', p.corners);
    b.classList.toggle('h12', !!p.hour12);
    b.classList.toggle('cal-right', p.calSide === 'right');
    b.classList.toggle('no-glow', !p.glow);
    b.classList.toggle('no-motion', !p.motion);
    b.setAttribute('data-anim', p.anim);
    b.classList.toggle('no-greeting', !p.greeting);
    if (TV.applyNight) TV.applyNight();
  };

  // Change one option, save it, and redraw whatever it affects.
  TV.setPref = function (key, value) {
    var p = TV.settings.prefs;
    if (!(key in p)) return;
    p[key] = value;
    TV.saveSettings();
    TV.refreshLook();
    if (key === 'unit') TV.refreshWeather(); // temperatures have to be fetched again in the new unit
  };

  TV.refreshLook = function () {
    TV.applyPrefs();
    if (TV.tickClock) TV.tickClock();
    if (TV.rerenderWeather) TV.rerenderWeather();
    if (TV.renderCalendar) TV.renderCalendar();
    if (TV.widgets) TV.widgets.layout(true);
    TV.emit('prefs');
  };

  TV.resetPrefs = function () {
    var d = TV.PREF_DEFAULTS, p = TV.settings.prefs, unitChanged = p.unit !== d.unit;
    Object.keys(d).forEach(function (k) { p[k] = d[k]; });
    TV.saveSettings();
    TV.refreshLook();
    if (unitChanged) TV.refreshWeather();
  };
})(window.TV);
