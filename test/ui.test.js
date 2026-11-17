// Browser checks with Playwright. Serve the folder first, e.g.:
//   python3 -m http.server 8765   (from the tv-dashboard folder)
// then:  NODE_PATH=<folder with playwright, jsqr, pngjs> node test/ui.test.js
const { chromium } = require('playwright');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
let failed = 0;
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!cond) failed++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // 1. Preview mode loads with no script errors and fills every area.
  await page.goto(BASE + '?demo=1');
  await page.waitForTimeout(2500);
  check('no script errors (preview)', errors.length === 0, errors.join(' | '));
  check('clock shows 24-hour time', /^\d{2}:\d{2}$/.test(await page.textContent('#clock')));
  check('calendar has events', (await page.$$('.event')).length >= 3);
  check('weather shows °F temp', /°$/.test((await page.textContent('.wx-temp')).trim()));
  check('12 hourly entries', (await page.$$('.hr')).length === 12);
  check('alert banner visible', await page.isVisible('#alert-banner'));
  check('compact grid: page 1 has 6 tiles in 2 rows (the wide Spotify tile goes on page 2)',
    (await page.$$('#widget-slots .widget')).length === 6 && (await page.$$('#widget-slots .wrow')).length === 2);
  const tooTall = await page.evaluate(() => [...document.querySelectorAll('#app .card')]
    .filter(c => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1).map(c => c.id || c.dataset.widget));
  check('nothing overflows its panel', tooTall.length === 0, tooTall.join(', '));

  // 2. QR code decodes to the right Wi-Fi string.
  const qr = await page.$('.wifi-qr');
  if (qr) {
    const png = PNG.sync.read(await qr.screenshot());
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    const expected = await page.evaluate(() => TV.wifiString(TV_CONFIG.wifi));
    check('Wi-Fi QR decodes correctly', code && code.data === expected, code ? code.data : 'not decoded');
  } else check('Wi-Fi QR present', false);
  const esc = await page.evaluate(() => TV.wifiString({ ssid: 'My;Net,"x"', password: 'p:a\\ss', security: 'WPA' }));
  check('Wi-Fi special characters escaped', esc === 'WIFI:T:WPA;S:My\\;Net\\,\\"x\\";P:p\\:a\\\\ss;;', esc);

  // 3. Remote navigation.
  await page.keyboard.press('ArrowRight');
  check('arrow focuses a control', await page.evaluate(() => document.activeElement.hasAttribute('data-focus')));
  await page.evaluate(() => document.getElementById('btn-theme').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('OK opens Theme panel', await page.isVisible('#sheet-theme'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('picking the Red theme with the remote', await page.evaluate(() => TV.settings.theme.gradient === 'red'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Back closes panel', !(await page.isVisible('#overlay')));

  // 3b. Cards open full-screen views; single-color themes.
  await page.evaluate(() => document.querySelector('[data-detail="wifi"]').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('OK on a card opens its full-screen view', await page.isVisible('#sheet-detail .dwifi-qr'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Back returns to the same card', await page.evaluate(() => document.activeElement.getAttribute('data-detail') === 'wifi'));
  await page.evaluate(() => TV.openDetail('spotify'));
  await page.waitForTimeout(300);
  check('player opens with Play/Pause focused', await page.evaluate(() => document.activeElement.getAttribute('data-action') === 'toggle'));
  const before = await page.evaluate(() => !!document.querySelector('#sheet-detail .player-btn.main svg rect'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => !!document.querySelector('#sheet-detail .player-btn.main svg rect'));
  check('OK on Play/Pause toggles playback', before !== after);
  await page.keyboard.press('Escape');
  await page.evaluate(() => TV.handleThemeAction('gradient', 'purple'));
  check('single-color theme sets matching accent', await page.evaluate(() => document.body.style.getPropertyValue('--accent') === '#7B2CBF'));
  await page.evaluate(() => document.querySelector('#widget-slots .widget:last-child').focus());
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  check('moving past the last widget shows the next page', await page.evaluate(() => document.querySelector('.dot.active') === document.querySelectorAll('.dot')[1] && document.activeElement.hasAttribute('data-detail')));
  check('no script errors after navigation', errors.length === 0, errors.join(' | '));

  // 3c. Customization options, changed with the controls in Settings.
  const pref = v => `[data-action="pref"][data-value='${v}']`;
  await page.evaluate(() => TV.openSheet('settings'));
  await page.click(pref('clockStyle="outline"'));
  check('clock style option applies', await page.evaluate(() => document.body.getAttribute('data-clock') === 'outline'));
  await page.click(pref('hour12=true'));
  await page.click('[data-action="pref-toggle"][data-value="seconds"]');
  await page.waitForTimeout(200);
  check('12-hour time with seconds', /^\d{1,2}:\d{2}:\d{2}(AM|PM)$/.test(await page.textContent('#clock')), await page.textContent('#clock'));
  check('12-hour time is used in the calendar too', /(AM|PM)/.test(await page.textContent('#calendar-list')));
  await page.click(pref('unit="C"'));
  await page.waitForTimeout(400);
  check('°C option converts the temperature', (await page.textContent('.wx-temp')).trim() === '20°', await page.textContent('.wx-temp'));
  await page.click(pref('hours=6'));
  check('forecast length option', (await page.$$('#weather-hourly .hr')).length === 6);
  await page.click('[data-action="pref-toggle"][data-value="statWind"]');
  check('weather stats can be turned off', (await page.$$('#weather-now .wx-stat')).length === 3);
  await page.click(pref('density="large"'));
  const largeTiles = (await page.$$('#widget-slots .widget')).length;
  check('large tiles option: a single row of up to 3', largeTiles >= 2 && largeTiles <= 3 && (await page.$$('#widget-slots .wrow')).length === 1 &&
    (await page.$$('#widget-dots .dot')).length === 3, largeTiles + ' tiles');
  await page.click(pref('calSide="right"'));
  check('calendar side option', await page.evaluate(() => document.getElementById('card-calendar').getBoundingClientRect().left > document.getElementById('card-weather').getBoundingClientRect().left));
  await page.click(pref('outline="crisp"'));
  await page.click(pref('corners="square"'));
  check('outline and corner options apply', await page.evaluate(() => document.body.getAttribute('data-outline') === 'crisp' && getComputedStyle(document.getElementById('card-weather')).borderTopLeftRadius === '12px'));
  // Smart features, with controlled times so the result does not depend on when the test runs.
  await page.evaluate(() => {
    const n = Date.now(), m = 60000;
    TV.calendarEvents = [
      { title: 'Standup', location: '', allDay: false, start: new Date(n - 30 * m), end: new Date(n + 30 * m), calendar: 'x', color: '#ff9500' },
      { title: 'Dentist', location: '', allDay: false, start: new Date(n + 25 * m), end: new Date(n + 85 * m), calendar: 'x', color: '#ff9500' }
    ];
    TV.weather.hours = TV.weather.hours.map(h => Object.assign({}, h, { pop: 0, code: 1 })); // a dry forecast, so no rain line
    TV.renderCalendar(); TV.renderGlance();
  });
  check('countdown on the next event', /in 2[45] min/.test(await page.textContent('#calendar-list .countdown')), await page.textContent('#calendar-list .countdown'));
  const prog = await page.evaluate(() => parseFloat(document.querySelector('.ev-progress span').style.width));
  check('progress line on the current event (halfway)', prog > 49 && prog < 51, String(prog));
  check('glance line: current event first, then the next one', /Now\s*Standup until/.test(await page.textContent('#glance')) && /Dentist in 2[45] min/.test(await page.textContent('#glance')), await page.textContent('#glance'));
  check('greeting shows before the date', /^Good (morning|afternoon|evening|night)$/.test(await page.textContent('#greeting')) && await page.isVisible('#greeting'));
  await page.click('[data-action="pref-toggle"][data-value="greeting"]');
  check('greeting can be turned off', !(await page.isVisible('#greeting')));
  await page.evaluate(() => {
    const m = document.getElementById('clock-m');
    m.querySelector('i:last-child').textContent = 'x'; m.setAttribute('data-v', 'zz'); // pretend the last digit just changed
    TV.tickClock();
  });
  check('only the changed clock digit animates', await page.evaluate(() => { const t = document.querySelectorAll('#clock i.tick'); return t.length === 1 && getComputedStyle(t[0]).animationName === 'tick'; }));
  await page.click(pref('anim="off"'));
  check('Animations Off stops every animation', await page.evaluate(() => getComputedStyle(document.getElementById('clock-colon')).animationName === 'none' && getComputedStyle(document.querySelector('.blob')).animationName === 'none'));
  await page.click(pref('anim="reduced"'));
  check('Animations Reduced keeps fades only', await page.evaluate(() => getComputedStyle(document.getElementById('clock-colon')).animationName === 'none' && getComputedStyle(document.getElementById('card-weather')).animationName === 'fadein'));
  const night = await page.evaluate((nightDim) => {
    const n = Date.now();
    TV.weather = { today: { sunrise: new Date(n + 5 * 3600000), sunset: new Date(n - 45 * 60000) }, tomorrow: { sunrise: new Date(n + 5 * 3600000), sunset: new Date(n + 20 * 3600000) }, hours: [], current: { temp: 20, code: 1, isDay: false } };
    TV.settings.prefs.nightDim = nightDim; TV.applyNight();
    return parseFloat(document.body.style.getPropertyValue('--night-dim'));
  }, true);
  check('screen dims after sunset', night > 0.1, String(night));
  check('Dim After Sunset can be turned off', (await page.evaluate(() => { TV.settings.prefs.nightDim = false; TV.applyNight(); return parseFloat(document.body.style.getPropertyValue('--night-dim')); })) === 0);
  // The Spotify player is two tiles wide (and the Settings switch turns that off).
  const tileWidths = () => page.evaluate(() => {
    const r = id => document.querySelector('[data-widget="' + id + '"]').getBoundingClientRect();
    return { sm: r('sunmoon').width, sp: r('spotify').width };
  });
  await page.evaluate(() => {
    TV.settings.widgets.disabled = ['wifi', 'dates', 'nasa', 'commute', 'air', 'countdown'];   // sun & moon + Spotify: one row of three columns
    TV.settings.prefs.density = 'compact'; TV.widgets.layout(true);
  });
  let wd = await tileWidths();
  check('Spotify is two tiles wide (two tile widths plus the gap between)', Math.abs(wd.sp - (2 * wd.sm + 24)) < 2.5, JSON.stringify(wd));
  await page.evaluate(() => TV.openSheet('settings'));
  await page.click('[data-action="pref-toggle"][data-value="spotifyWide"]');
  await page.evaluate(() => TV.closeSheet());
  wd = await tileWidths();
  check('Wide Spotify Tile can be turned off', Math.abs(wd.sp - wd.sm) < 2.5, JSON.stringify(wd));
  await page.evaluate(() => TV.openSheet('settings'));
  await page.click('[data-action="pref-reset"]');
  await page.waitForTimeout(400);
  check('Reset Look to Defaults', await page.evaluate(() => JSON.stringify(TV.settings.prefs) === JSON.stringify(TV.PREF_DEFAULTS)) && /^\d{2}:\d{2}$/.test(await page.textContent('#clock')));
  await page.evaluate(() => TV.closeSheet());
  check('no script errors after changing options', errors.length === 0, errors.join(' | '));

  // 3b. Album background, weather effects, Ambient Mode, slideshow, day strip, Air & UV, Countdown, focus glow.
  await page.evaluate(() => {
    TV.resetPrefs(); TV.settings.widgets.disabled = []; TV.settings.theme.style = 'gradient'; TV.settings.theme.mode = 'dark';
    TV.applyTheme(); TV.widgets.layout(true);
  });
  // earlier checks replaced the calendar with test events and may have paused the sample player: start clean
  await page.evaluate(() => TV.refreshCalendar());
  await page.evaluate(() => { if (!TV.nowPlaying()) TV.spotifyControl('toggle'); });
  await page.waitForFunction(() => !!TV.nowPlaying(), null, { timeout: 5000 });
  await page.waitForTimeout(600);

  // Album background: the screen takes the colors of the cover art while a song plays
  check('album art colors fill the background while music plays', await page.evaluate(() => document.body.classList.contains('album-on') && document.getElementById('bg-album').classList.contains('on')));
  await page.evaluate(() => TV.setPref('albumBg', false));
  check('Album Art Background can be turned off', await page.evaluate(() => !document.body.classList.contains('album-on')));
  await page.evaluate(() => TV.setPref('albumBg', true));
  check('...and back on', await page.evaluate(() => document.body.classList.contains('album-on')));

  // Weather effects
  const fx = (code, isDay, extra) => page.evaluate(([c, d, e]) => {
    TV.weather.current.code = c; TV.weather.current.isDay = d; Object.assign(TV.settings.prefs, e || {}); TV.applyPrefs(); TV.applyWeatherFx();
    const q = s => document.querySelectorAll('#bg-wx ' + s).length;
    return { type: document.getElementById('bg-wx').getAttribute('data-fx'), rain: q('.fx-rain i'), snow: q('.fx-snow i'), stars: q('.fx-stars i'), clouds: q('.fx-clouds b'), fog: q('.fx-fog b'), sun: q('.fx-sun b') };
  }, [code, isDay, extra]);
  let f = await fx(63, true);        check('rain: streaks fall', f.type === 'rain' && f.rain >= 20, JSON.stringify(f));
  f = await fx(95, true);            check('thunderstorm: heavy rain', f.type === 'rain-heavy' && f.rain >= 30, JSON.stringify(f));
  f = await fx(53, true);            check('drizzle: a few light streaks', f.type === 'drizzle' && f.rain >= 10 && f.rain < 30, JSON.stringify(f));
  f = await fx(73, true);            check('snow: flakes fall', f.type === 'snow' && f.snow >= 20, JSON.stringify(f));
  f = await fx(45, true);            check('fog: soft drifting bands', f.type === 'fog' && f.fog >= 3, JSON.stringify(f));
  f = await fx(3, true);             check('cloudy: drifting clouds', f.type === 'clouds' && f.clouds >= 3, JSON.stringify(f));
  f = await fx(0, false);            check('clear night (dark mode): stars', f.type === 'stars' && f.stars >= 20, JSON.stringify(f));
  f = await fx(0, true);             check('clear day: warm glow', f.type === 'sun' && f.sun === 1, JSON.stringify(f));
  f = await fx(63, true, { wxfx: false }); check('Weather Effects can be turned off', f.type === '' && f.rain === 0, JSON.stringify(f));
  f = await fx(63, true, { wxfx: true, anim: 'off' }); check('Animations Off shows no weather effects', f.type === '' && f.rain === 0, JSON.stringify(f));
  f = await fx(63, true, { anim: 'reduced' });
  check('Animations Reduced hides falling rain', await page.evaluate(() => getComputedStyle(document.querySelector('#bg-wx .fx-rain')).display === 'none'));
  f = await fx(3, true, { anim: 'reduced' });
  check('Animations Reduced keeps clouds still', await page.evaluate(() => getComputedStyle(document.querySelector('#bg-wx .fx-clouds b')).animationName === 'none'));
  await fx(2, true, { anim: 'full', wxfx: true });

  // Ambient Mode
  await page.evaluate(() => { TV.ambient.pretendIdle(9 * 60000); TV.ambient.check(); });
  check('Ambient Mode waits for the full delay (9 of 10 minutes: not yet)', await page.evaluate(() => !TV.ambient.active()));
  await page.evaluate(() => { TV.ambient.pretendIdle(10 * 60000 + 500); TV.ambient.check(); });
  check('Ambient Mode starts after 10 idle minutes', await page.evaluate(() => TV.ambient.active() && document.body.classList.contains('ambient')));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).visibility === 'hidden', null, { timeout: 5000 });
  check('the panels fade out and the ambient clock shows', await page.evaluate(() => /^\d{2}:\d{2}$/.test(document.getElementById('amb-clock').textContent) && /,/.test(document.getElementById('amb-date').textContent)));
  check('the song that is playing is shown', await page.evaluate(() => /Sample Song Title/.test(document.getElementById('amb-line').textContent)));
  check('your photos become a slideshow while resting', await page.evaluate(() => { const a = document.getElementById('bg-photo'), b = document.getElementById('bg-photo2'); return (a.style.opacity === '1' || b.style.opacity === '1') && (a.classList.contains('kb') || b.classList.contains('kb')); }));
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 10252, bubbles: true })));
  check('the play/pause key does not wake the screen', await page.evaluate(() => TV.ambient.active()));
  await page.keyboard.press('ArrowDown');
  check('the first button press only wakes the screen', await page.evaluate(() => !TV.ambient.active() && !document.body.classList.contains('ambient') && !(document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-focus'))));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).visibility === 'visible', null, { timeout: 5000 });
  check('the panels come back', await page.evaluate(() => getComputedStyle(document.getElementById('app')).visibility === 'visible'));
  check('the normal background comes back', await page.evaluate(() => document.getElementById('bg-photo').style.opacity !== '1' && document.getElementById('bg-photo2').style.opacity !== '1'));
  await page.evaluate(() => { TV.openSheet('settings'); TV.ambient.pretendIdle(60 * 60000); TV.ambient.check(); });
  check('Ambient Mode never starts while Settings is open', await page.evaluate(() => !TV.ambient.active()));
  await page.evaluate(() => TV.closeSheet());
  await page.evaluate(() => { TV.setPref('ambient', 0); TV.ambient.pretendIdle(5 * 3600000); TV.ambient.check(); });
  check('Ambient Mode can be turned off', await page.evaluate(() => !TV.ambient.active()));
  await page.evaluate(() => { TV.setPref('ambient', 5); TV.ambient.pretendIdle(5 * 60000 + 500); TV.ambient.check(); });
  check('...or set to 5 minutes', await page.evaluate(() => TV.ambient.active()));
  await page.evaluate(() => { TV.ambient.exit(); TV.setPref('ambient', 10); });

  // Slideshow
  const slide = () => page.evaluate(() => { const a = document.getElementById('bg-photo'), b = document.getElementById('bg-photo2'); const front = a.style.opacity === '1' ? a : b; return { front: front.id, url: front.style.backgroundImage, other: (front === a ? b : a).style.opacity, kb: front.classList.contains('kb'), grad: document.getElementById('bg-gradient').style.opacity }; });
  await page.evaluate(() => { TV.openSheet('theme'); });
  check('the theme screen offers a Slideshow when you have photos', await page.evaluate(() => !!document.querySelector('#sheet-theme [data-action="slideshow"]')));
  await page.evaluate(() => { TV.closeSheet(); TV.handleThemeAction('slideshow', 'slideshow'); TV.closeSheet(); });
  const s1 = await slide();
  check('slideshow shows a photo with a slow pan', /wallpapers/.test(s1.url) && s1.kb && s1.grad === '0', JSON.stringify(s1));
  await page.evaluate(() => TV.nextSlide());
  const s2 = await slide();
  check('the next photo fades in on the other layer', s2.front !== s1.front && s2.url !== s1.url && s2.other === '0', JSON.stringify([s1.front, s2.front]));
  await page.evaluate(() => { TV.settings.theme.style = 'gradient'; TV.applyTheme(); });
  check('back to a color theme: photos are gone', await page.evaluate(() => document.getElementById('bg-photo').style.opacity === '0' && document.getElementById('bg-photo2').style.opacity === '0' && document.getElementById('bg-gradient').style.opacity === '1'));

  // Day strip under Up Next
  const strip = await page.evaluate(() => {
    const s = TV.smart.dayStrip(TV.calendarEvents, new Date());
    return { want: s ? s.blocks.length : 0, has: !!s, nowWanted: s ? s.nowPct >= 0 : false, blocks: document.querySelectorAll('#day-strip .ds-ev').length, now: document.querySelectorAll('#day-strip .ds-now').length, ticks: document.querySelectorAll('#day-strip .ds-ticks span').length, on: document.getElementById('day-strip').classList.contains('on') };
  });
  check('day strip: one block per timed event today', strip.on === strip.has && strip.blocks === strip.want && strip.want >= 1, JSON.stringify(strip));
  check('day strip: "now" marker when now is inside the window', strip.now === (strip.nowWanted ? 1 : 0), JSON.stringify(strip));
  check('day strip: hour labels', strip.ticks >= 3, JSON.stringify(strip));

  // Air & UV
  await page.evaluate(() => TV.emit('location', TV.location));
  await page.waitForFunction(() => document.querySelector('[data-widget="air"]') || document.querySelector('#widget-slots'), null, { timeout: 3000 });
  await page.evaluate(() => { TV.settings.widgets.disabled = ['sunmoon', 'wifi', 'dates', 'nasa', 'commute', 'countdown', 'spotify']; TV.widgets.layout(true); });
  await page.waitForTimeout(500);
  const air = await page.evaluate(() => { const el = document.querySelector('[data-widget="air"]'); return el ? { text: el.textContent, left: [].map.call(el.querySelectorAll('.gauge i'), i => parseFloat(i.style.left)) } : null; });
  check('Air & UV shows UV 6 High and air quality 42 Good', !!air && /UV Index/.test(air.text) && /6/.test(air.text) && /High/.test(air.text) && /Air Quality/.test(air.text) && /42/.test(air.text) && /Good/.test(air.text), JSON.stringify(air));
  check('gauge markers sit where the numbers say (UV 6.4 of 12, AQI 42 of 300)', !!air && Math.abs(air.left[0] - 53.3) < 0.3 && Math.abs(air.left[1] - 14) < 0.3, JSON.stringify(air && air.left));
  await page.evaluate(() => { document.querySelector('[data-widget="air"]').click(); });
  await page.waitForTimeout(300);
  const labels = await page.evaluate(() => [].map.call(document.querySelectorAll('#sheet-detail .gauge-scale')[0].querySelectorAll('span'), s => [s.textContent, parseFloat(s.style.left)]));
  check('UV scale numbers sit where each level starts (0, 3, 6, 8, 11 of 12)', JSON.stringify(labels.map(l => [l[0], Math.round(l[1] * 10) / 10])) === JSON.stringify([['0', 0], ['3', 25], ['6', 50], ['8', 66.7], ['11+', 91.7]]), JSON.stringify(labels));
  await page.evaluate(() => TV.closeSheet());
  // If the service refuses the UV value, air quality still shows
  await page.evaluate(() => {
    window.__fetch = window.fetch;
    window.fetch = function (u, o) {
      if (!/air-quality-api/.test(String(u))) return window.__fetch(u, o);
      // the service refuses a request that asks for UV, and answers one that does not (with air quality only)
      return /uv_index/.test(String(u)) ? Promise.resolve(new Response('{}', { status: 400 })) : Promise.resolve(new Response(JSON.stringify({ current: { us_aqi: 42, pm2_5: 9.6 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    TV.emit('location', TV.location);
  });
  await page.waitForTimeout(600);
  check('without UV data the widget still shows air quality', await page.evaluate(() => { const el = document.querySelector('[data-widget="air"]'); return !!el && el.querySelectorAll('.air-row').length === 1 && /Air Quality/.test(el.textContent) && !/UV Index/.test(el.textContent); }));
  await page.evaluate(() => { window.fetch = window.__fetch; TV.emit('location', TV.location); });
  await page.waitForTimeout(600);
  check('...and UV returns when the service answers again', await page.evaluate(() => document.querySelectorAll('[data-widget="air"] .air-row').length === 2));

  // Countdown
  await page.evaluate(() => { TV.settings.widgets.disabled = ['sunmoon', 'wifi', 'dates', 'nasa', 'commute', 'air', 'spotify']; TV.widgets.layout(true); });
  await page.waitForTimeout(400);
  const cd = await page.evaluate(() => { const el = document.querySelector('[data-widget="countdown"]'); return el ? { num: el.querySelector('.cd-num').textContent, name: el.querySelector('.cd-name').textContent, others: [].map.call(el.querySelectorAll('.cd-other-name'), n => n.textContent) } : null; });
  check('Countdown shows the soonest one (from config)', !!cd && cd.num === '23' && cd.name === 'Beach trip', JSON.stringify(cd));
  check('...and the next ones (a "Countdown: ..." calendar event)', !!cd && cd.others.indexOf('Concert night') >= 0, JSON.stringify(cd));
  await page.evaluate(() => { TV.farEvents = [{ title: 'Countdown: Far trip', start: TV.addDays(new Date(), 200), end: TV.addDays(new Date(), 201), allDay: true }]; TV.widgets.update('countdown'); document.querySelector('[data-widget="countdown"]').click(); });
  await page.waitForTimeout(300);
  check('a calendar countdown more than 60 days away is listed too', await page.evaluate(() => /Far trip/.test(document.getElementById('sheet-detail').textContent) && /In 200 days/.test(document.getElementById('sheet-detail').textContent)));
  await page.evaluate(() => { TV.closeSheet(); TV.farEvents = []; TV.settings.widgets.disabled = []; TV.widgets.layout(true); });

  // Sliding focus glow
  const glow = () => page.evaluate(() => { const g = document.getElementById('focus-glow'), r = g.getBoundingClientRect(); const a = document.activeElement, ar = a && a.getBoundingClientRect ? a.getBoundingClientRect() : null; return { op: g.style.opacity, cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width), acx: ar ? Math.round(ar.left + ar.width / 2) : null, acy: ar ? Math.round(ar.top + ar.height / 2) : null, dur: getComputedStyle(g).transitionDuration }; });
  await page.evaluate(() => document.getElementById('card-weather').focus());
  await page.waitForTimeout(900);
  let g1 = await glow();
  check('the glow sits behind the selected panel', g1.op === '1' && Math.abs(g1.cx - g1.acx) < 16 && Math.abs(g1.cy - g1.acy) < 16, JSON.stringify(g1));
  await page.evaluate(() => document.getElementById('card-calendar').focus());
  await page.waitForFunction(() => { const g = document.getElementById('focus-glow').getBoundingClientRect(), a = document.getElementById('card-calendar').getBoundingClientRect(); return Math.abs((g.left + g.width / 2) - (a.left + a.width / 2)) < 16; }, null, { timeout: 5000 }).catch(() => {});
  let g2 = await glow();
  check('the glow slides to the next panel', Math.abs(g2.cx - g2.acx) < 16 && g2.cx < g1.cx - 200, JSON.stringify([g1, g2]));
  await page.evaluate(() => TV.openSheet('settings'));
  await page.waitForTimeout(500);
  check('the glow is hidden while a sheet is open', (await glow()).op === '0');
  await page.evaluate(() => TV.closeSheet());
  await page.evaluate(() => { document.activeElement.blur(); });
  await page.waitForTimeout(200);
  check('the glow hides when nothing is selected', (await glow()).op === '0');
  await page.evaluate(() => { TV.setPref('anim', 'off'); document.getElementById('card-weather').focus(); });
  await page.waitForTimeout(200);
  check('Animations Off: the glow jumps instead of sliding', /^0s(, 0s)*$/.test((await glow()).dur));
  await page.evaluate(() => { TV.setPref('anim', 'full'); document.activeElement.blur(); });

  // The new options are in Settings
  await page.evaluate(() => TV.openSheet('settings'));
  const sheetText = await page.evaluate(() => document.getElementById('sheet-settings').textContent);
  check('Settings lists Album Art Background, Weather Effects and Ambient Mode', /Album Art Background/.test(sheetText) && /Weather Effects/.test(sheetText) && /Ambient Mode/.test(sheetText));
  await page.evaluate(() => TV.closeSheet());
  check('no script errors from the new features', errors.length === 0, errors.join(' | '));

  // 4. Settings are saved on the TV (normal mode; network calls just fail here).
  const p2 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors2 = [];
  p2.on('pageerror', e => errors2.push(e.message));
  await p2.goto(BASE);
  await p2.evaluate(() => localStorage.clear());
  await p2.reload();
  await p2.waitForTimeout(1500);
  await p2.evaluate(() => TV.openSheet('settings'));
  await p2.click('[data-action="w-toggle"][data-value="wifi"]');
  await p2.click('[data-action="w-down"][data-value="sunmoon"]');
  await p2.evaluate(() => TV.handleThemeAction('gradient', 'dusk'));
  await p2.evaluate(() => TV.handleThemeAction('mode', 'dark'));
  await p2.click(`[data-action="pref"][data-value='clockSize="l"']`);
  await p2.reload();
  await p2.waitForTimeout(1500);
  const saved = await p2.evaluate(() => ({ s: TV.settings, order: TV.widgets.all().map(w => w.id), dark: document.body.classList.contains('mode-dark') }));
  check('widget off is remembered', saved.s.widgets.disabled.includes('wifi'));
  check('widget order is remembered', saved.order.indexOf('sunmoon') === 1, saved.order.join(','));
  check('theme is remembered', saved.s.theme.gradient === 'dusk' && saved.dark);
  check('look options are remembered', saved.s.prefs.clockSize === 'l' && await p2.evaluate(() => document.body.getAttribute('data-clock-size') === 'l'));
  check('no script errors (normal mode, offline)', errors2.length === 0, errors2.join(' | '));
  const calText = await p2.textContent('#calendar-list');
  check('calendar card explains itself (no calendar, or why it could not load)', /No calendars yet|Couldn’t load/.test(calText) && !/Nothing scheduled/.test(calText), calText.trim().slice(0, 80));

  await browser.close();
  if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
  console.log('All UI checks passed');
})();
