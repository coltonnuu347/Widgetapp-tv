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
    (await page.$$('#widget-dots .dot')).length >= 3, largeTiles + ' tiles');
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
  const prog = await page.evaluate(() => parseFloat(document.querySelector('.ev-ring').getAttribute('data-p')));
  check('progress ring on the current event (halfway)', prog > 49 && prog < 51, String(prog));
  const ring = await page.evaluate(() => { const f = document.querySelector('.ev-ring-fill'), d = f.getAttribute('stroke-dasharray').split(' ').map(parseFloat); return { arc: d[0] / d[1], text: document.querySelector('.ev-ring-t').textContent, card: document.querySelectorAll('.event .ev-bar').length === document.querySelectorAll('#calendar-list .event').length }; });
  check('the ring is drawn halfway and says how long is left', Math.abs(ring.arc - 0.5) < 0.01 && /^\d+m$/.test(ring.text) && ring.card, JSON.stringify(ring));
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
    TV.settings.widgets.disabled = ['wifi', 'dates', 'nasa', 'commute', 'air', 'countdown', 'radar'];   // sun & moon + Spotify: one row of three columns
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

  // Ambient Mode (the photo frame uses your own photos: give the test two, which point at built-in artwork)
  await page.evaluate(() => { TV_CONFIG.wallpapers = ['u1.svg', 'u2.svg']; TV.wallData = { 'u1.svg': TV.artUrl(TV.ART[3]), 'u2.svg': TV.artUrl(TV.ART[4]) }; });
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
  check('slideshow shows a picture with a slow pan', /images\/art\/|data:image/.test(s1.url) && s1.kb && s1.grad === '0', JSON.stringify(s1));
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

  // 3c. Pictures win over album colors, built-in artwork, the Apps page.
  await page.evaluate(() => {
    TV.settings.widgets.disabled = []; TV.settings.theme.style = 'gradient'; TV.settings.theme.mode = 'dark';
    TV.setPref('anim', 'full'); TV.setPref('albumBg', true); TV.applyTheme(); TV.widgets.layout(true);
  });
  await page.evaluate(() => { if (!TV.nowPlaying()) TV.spotifyControl('toggle'); });
  await page.waitForFunction(() => !!TV.nowPlaying() && document.body.classList.contains('album-on'), null, { timeout: 5000 });

  // The reported bug: with music playing, a picture you pick must actually show (album colors used to cover it)
  const picks = [['art', 'aurora'], ['slideshow', 'slideshow'], ['nasa', 'nasa'], ['photo', 'u1.svg']];
  await page.evaluate(() => { TV_CONFIG.wallpapers = ['u1.svg', 'u2.svg']; TV.wallData = { 'u1.svg': TV.artUrl(TV.ART[3]), 'u2.svg': TV.artUrl(TV.ART[4]) }; });
  for (const [a, v] of picks) {
    await page.evaluate(([a, v]) => TV.handleThemeAction(a, v), [a, v]);
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => { const A = document.getElementById('bg-photo'), B = document.getElementById('bg-photo2'); return { album: document.body.classList.contains('album-on'), shown: A.style.opacity === '1' || B.style.opacity === '1', chosen: TV.photoThemeActive(), playing: !!TV.nowPlaying() }; });
    check('music playing + ' + a + ' background: the picture shows, album colors stay off', st.playing && !st.album && st.shown && st.chosen, JSON.stringify(st));
  }
  await page.evaluate(() => { TV.closeSheet(); TV.handleThemeAction('art', 'aurora'); TV.closeSheet(); });
  await page.waitForTimeout(3500);   // the album layer (if it were on) takes 2.6 s to fade
  const bare = async () => { const buf = await page.screenshot({ clip: { x: 700, y: 120, width: 400, height: 150 } }); const png = PNG.sync.read(buf); let r = 0, g = 0, b = 0, n = png.width * png.height; for (let i = 0; i < png.data.length; i += 4) { r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; } return [r / n, g / n, b / n]; };
  const withMusic = await bare();
  await page.evaluate(() => TV.setPref('albumBg', false));
  await page.waitForTimeout(3500);
  const noAlbum = await bare();
  const diff = Math.max(...withMusic.map((v, i) => Math.abs(v - noAlbum[i])));
  check('what you see is the artwork, the same with or without the album setting (pixels)', diff < 8, 'difference ' + diff.toFixed(1));
  await page.evaluate(() => { TV.setPref('albumBg', true); TV.handleThemeAction('gradient', 'purple'); });
  await page.waitForTimeout(500);
  check('back to a color theme: album colors return', await page.evaluate(() => document.body.classList.contains('album-on')));

  // Built-in artwork on the Theme screen
  await page.evaluate(() => TV.openSheet('theme'));
  const art = await page.evaluate(() => ({ tiles: document.querySelectorAll('#sheet-theme [data-action="art"]').length, slideshow: !!document.querySelector('#sheet-theme [data-action="slideshow"]'), label: /Artwork/.test(document.getElementById('sheet-theme').textContent) }));
  check('the theme screen lists 8 built-in artworks and a Slideshow', art.tiles === 8 && art.slideshow && art.label, JSON.stringify(art));
  await page.evaluate(() => TV.closeSheet());
  await page.evaluate(() => { TV.settings.theme.style = 'slideshow'; TV.applyTheme(); });
  check('the Slideshow cycles the artwork and your photos (8 + 2)', await page.evaluate(() => TV.slideCount() === 10));
  await page.evaluate(() => { TV.settings.theme.style = 'gradient'; TV.applyTheme(); });
  check('Ambient Mode’s photo frame uses only your photos (2)', await page.evaluate(() => { TV.setAmbientSlides(true); const n = TV.slideCount(); TV.setAmbientSlides(false); return n === 2; }));
  // NASA picked before its photo has loaded: say so and try again (it used to do nothing)
  const nasa = await page.evaluate(() => {
    const keep = TV.nasaPhoto, keepRetry = TV.nasaRetry; let retried = 0;
    TV.nasaPhoto = null; TV.nasaRetry = () => { retried++; };
    TV.openSheet('theme'); TV.handleThemeAction('nasa', 'nasa');
    const out = { style: TV.settings.theme.style, note: /has not loaded yet/.test(document.getElementById('sheet-theme').textContent), retried, tile: /not loaded/.test(document.getElementById('sheet-theme').textContent) };
    TV.nasaPhoto = keep; TV.nasaRetry = keepRetry; TV.closeSheet();
    return out;
  });
  check('picking NASA before it loads explains why and retries', nasa.style === 'gradient' && nasa.note && nasa.retried === 1 && nasa.tile, JSON.stringify(nasa));

  // Apps page: slide down from Home, like Apple TV
  await page.evaluate(() => { TV.settings.theme.style = 'gradient'; TV.settings.widgets.disabled = []; TV.widgets.layout(true); document.querySelector('#widget-slots .wrow:last-child [data-focus]').focus(); });
  check('Home shows the "Apps" hint', await page.evaluate(() => /Apps/.test(document.getElementById('home-hint').textContent)));
  await page.keyboard.press('ArrowDown');
  check('while the screen slides, the blur, shadows and background motion are paused', await page.evaluate(() => document.body.classList.contains('paging') && getComputedStyle(document.querySelector('.orn-button')).backdropFilter === 'none'));
  await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.getElementById('pager')).transform).m42 === -1080 && getComputedStyle(document.getElementById('app')).visibility === 'hidden', null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(300);
  check('...and they come back when it has landed', await page.evaluate(() => !document.body.classList.contains('paging') && getComputedStyle(document.querySelector('.orn-button')).backdropFilter !== 'none'));
  const ap = await page.evaluate(() => ({ page: TV.pager.page(), tiles: document.querySelectorAll('.app-tile').length, onTile: !!(document.activeElement && document.activeElement.classList.contains('app-tile')), shift: new DOMMatrix(getComputedStyle(document.getElementById('pager')).transform).m42, homeHidden: getComputedStyle(document.getElementById('app')).visibility }));
  check('Down from the last row slides to the Apps page', ap.page === 'apps' && ap.shift === -1080 && ap.onTile && ap.homeHidden === 'hidden', JSON.stringify(ap));
  check('Apps page shows a tile for every app (12)', ap.tiles === 12, String(ap.tiles));
  check('Apps page shows the time', await page.evaluate(() => /^\d{2}:\d{2}$/.test(document.getElementById('apps-clock').textContent)));
  const names = await page.evaluate(() => [].map.call(document.querySelectorAll('.app-name'), n => ({ t: n.textContent, over: n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1 })));
  check('every app name fits its tile', names.every(n => !n.over) && names.some(n => n.t === 'Paramount+') && names.some(n => n.t === 'Prime Video'), JSON.stringify(names.filter(n => n.over)));
  const apps0 = await page.evaluate(() => document.activeElement.dataset.app);
  await page.keyboard.press('ArrowRight');
  const apps1 = await page.evaluate(() => document.activeElement.dataset.app);
  await page.keyboard.press('ArrowDown');
  const apps2 = await page.evaluate(() => document.activeElement.dataset.app);
  check('arrows move across and down the tiles (Netflix, YouTube, then HBO Max below it: four tiles per row)', apps0 === 'netflix' && apps1 === 'youtube' && apps2 === 'hbomax', [apps0, apps1, apps2].join(','));
  const grid = await page.evaluate(() => { const r = [].map.call(document.querySelectorAll('.app-tile'), t => t.getBoundingClientRect()); const g = document.getElementById('apps-grid').getBoundingClientRect(); const t0 = document.querySelector('.app-tile'); return { perRow: [].filter.call(document.querySelectorAll('.app-tile'), x => x.offsetTop === t0.offsetTop).length, width: t0.offsetWidth, height: t0.offsetHeight, inside: r.slice(0, 12).every(x => x.top >= g.top - 1 && x.bottom <= g.bottom + 1 && x.left >= g.left - 1 && x.right <= g.right + 1) }; });
  check('four tiles per row, 429 x 230, and all twelve are inside the grid box (three full rows)', grid.perRow === 4 && grid.width === 429 && grid.height === 230 && grid.inside, JSON.stringify(grid));
  const arts = await page.evaluate(() => [].map.call(document.querySelectorAll('.app-tile'), t => t.querySelector('svg.app-logo') ? 'logo' : t.querySelector('.app-word') ? 'word' : t.querySelector('.app-mark') ? 'mark' : 'none'));
  check('eight services show their icon and four a text wordmark (Disney+, Prime Video, Hulu, Peacock)', arts.filter(a => a === 'logo').length === 8 && arts.filter(a => a === 'word').length === 4 && arts.indexOf('none') < 0 && arts.indexOf('mark') < 0, arts.join(','));
  check('every logo draws something (a real path, a size, brand color)', await page.evaluate(() => [].every.call(document.querySelectorAll('svg.app-logo'), s => { const b = s.getBoundingClientRect(), p = s.querySelector('path'); return b.width > 60 && b.height > 60 && p.getAttribute('d').length > 100; })));
  const wide = await page.evaluate(() => [].filter.call(document.querySelectorAll('.app-word'), w => w.scrollWidth > w.closest('.app-tile').clientWidth - 40).map(w => w.textContent));
  check('every text wordmark fits inside its tile', wide.length === 0, wide.join(','));
  check('the logo has the service’s color (Netflix red, Spotify green)', await page.evaluate(() => getComputedStyle(document.querySelector('[data-app="netflix"] svg.app-logo')).color === 'rgb(229, 9, 20)' && getComputedStyle(document.querySelector('[data-app="spotify"] svg.app-logo')).color === 'rgb(30, 215, 96)'));
  await page.waitForTimeout(900);
  const gl = await page.evaluate(() => { const g = document.getElementById('focus-glow').getBoundingClientRect(), a = document.activeElement.getBoundingClientRect(); return { dx: Math.abs((g.left + g.width / 2) - (a.left + a.width / 2)), dy: Math.abs((g.top + g.height / 2) - (a.top + a.height / 2)), op: document.getElementById('focus-glow').style.opacity }; });
  check('the selection glow follows the focus onto the Apps page', gl.op === '1' && gl.dx < 24 && gl.dy < 24, JSON.stringify(gl));
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  check('Up from the top row of tiles reaches the Edit button', await page.evaluate(() => document.activeElement.id === 'apps-edit'));
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('Edit opens the app editor', await page.evaluate(() => !document.getElementById('overlay').classList.contains('hidden') && /On the Apps page/.test(document.getElementById('sheet-detail').textContent) && /More services/.test(document.getElementById('sheet-detail').textContent)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Back closes the editor and returns to the Edit button', await page.evaluate(() => document.getElementById('overlay').classList.contains('hidden') && document.activeElement.id === 'apps-edit' && TV.pager.page() === 'apps'));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1300);
  check('Up from the Edit button slides back to Home, onto the widget you left', await page.evaluate(() => TV.pager.page() === 'home' && !!document.activeElement.closest('#widget-slots') && new DOMMatrix(getComputedStyle(document.getElementById('pager')).transform).m42 === 0));
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(700);
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  check('Back on the Apps page returns Home', await page.evaluate(() => TV.pager.page() === 'home'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Back on Home does not open the Apps page', await page.evaluate(() => TV.pager.page() === 'home'));
  // Right at the end of the widgets still pages the widgets (it does not open Apps)
  const paged = await page.evaluate(() => { const before = document.querySelectorAll('#widget-dots .dot.active').length ? [].indexOf.call(document.querySelectorAll('#widget-dots .dot'), document.querySelector('#widget-dots .dot.active')) : -1; const row = document.querySelectorAll('#widget-slots .wrow'); const last = row[row.length - 1].querySelectorAll('[data-focus]'); last[last.length - 1].focus(); return before; });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
  check('Right past the last widget shows the next page of widgets, not Apps', await page.evaluate((b) => TV.pager.page() === 'home' && [].indexOf.call(document.querySelectorAll('#widget-dots .dot'), document.querySelector('#widget-dots .dot.active')) !== b, paged));
  await page.evaluate(() => { TV.widgets.layout(true); });

  // Opening apps (the TV's own API is faked here)
  await page.evaluate(() => {
    window.__launched = null; window.__fail = null;
    window.tizen = { application: {
      getAppsInfo: (ok) => ok([{ id: 'N.1', name: 'Netflix' }, { id: 'Y.1', name: 'YouTube' }, { id: 'S.1', name: 'Settings' }, { id: 'X.1', name: 'Crunchyroll' }]),
      launch: (id, ok, err) => { window.__launched = id; if (window.__fail) err({ message: window.__fail }); else ok(); }
    } };
    TV.pager.go('apps'); TV.apps.discover();
  });
  await page.waitForTimeout(300);
  check('on the TV, only the apps it has are shown (Netflix and YouTube)', await page.evaluate(() => [].map.call(document.querySelectorAll('.app-tile'), t => t.dataset.app).join(',') === 'netflix,youtube'));
  await page.click('.app-tile[data-app="netflix"]');
  check('a tile opens its app with the ID the TV gave', await page.evaluate(() => window.__launched === 'N.1'), String(await page.evaluate(() => window.__launched)));
  await page.evaluate(() => { window.__fail = 'denied by the TV'; });
  await page.click('.app-tile[data-app="youtube"]');
  check('a refused launch says which app and why', await page.evaluate(() => /Couldn’t open YouTube/.test(document.getElementById('apps-toast').textContent) && /denied by the TV/.test(document.getElementById('apps-toast').textContent) && /Find Apps/.test(document.getElementById('apps-toast').textContent)), await page.evaluate(() => document.getElementById('apps-toast').textContent));
  await page.evaluate(() => { window.tizen.application.getAppsInfo = (ok) => ok([]); window.__fail = null; TV.apps.discover(); });
  await page.waitForTimeout(300);
  check('if the TV lists nothing, all apps are shown with the built-in IDs', await page.evaluate(() => document.querySelectorAll('.app-tile').length === 12));
  await page.click('.app-tile[data-app="hulu"]');
  check('an app with no known ID says so (instead of failing silently)', await page.evaluate(() => /not known yet/.test(document.getElementById('apps-toast').textContent)), await page.evaluate(() => document.getElementById('apps-toast').textContent));
  await page.click('.app-tile[data-app="netflix"]');
  check('...and a known built-in ID is tried', await page.evaluate(() => window.__launched === '3201907018807'), String(await page.evaluate(() => window.__launched)));
  await page.evaluate(() => { delete window.tizen; TV.pager.go('home'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { TV.pager.go('apps'); });
  await page.click('.app-tile[data-app="netflix"]');
  check('in a browser a tile just explains that apps open on the TV', await page.evaluate(() => /open when this runs on your TV/.test(document.getElementById('apps-toast').textContent)));
  await page.evaluate(() => TV.pager.go('home'));
  await page.waitForTimeout(400);

  // Add or remove apps: the editor (from Settings, and from the Edit button)
  await page.evaluate(() => TV.openSheet('settings'));
  check('Settings has an Apps section with Add or Remove Apps and Find Apps', await page.evaluate(() => /Add or Remove Apps/.test(document.getElementById('sheet-settings').textContent) && /Find Apps on This TV/.test(document.getElementById('sheet-settings').textContent) && document.querySelectorAll('#sheet-settings [data-action="app-toggle"]').length === 0));
  await page.click('#sheet-settings [data-action="apps-edit"]');
  const ed = await page.evaluate(() => ({ rows: document.querySelectorAll('#sheet-detail .row-logo').length, all: TV.apps.all().length, on: document.querySelectorAll('#sheet-detail .btn.toggle.on').length, svgs: document.querySelectorAll('#sheet-detail .row-logo svg').length }));
  check('the editor lists every service with its logo (28), twelve of them on', ed.rows === ed.all && ed.all === 28 && ed.on === 12 && ed.svgs >= 20, JSON.stringify(ed));
  await page.click('#sheet-detail [data-action="ae-toggle"][data-value="netflix"]');
  check('a service can be turned off (its tile goes, the choice is saved)', await page.evaluate(() => !TV.apps.visible().some(a => a.key === 'netflix') && TV.settings.apps.disabled.indexOf('netflix') >= 0 && document.querySelectorAll('.app-tile[data-app="netflix"]').length === 0));
  check('...and the editor keeps the focus on that service’s switch', await page.evaluate(() => document.activeElement.getAttribute('data-value') === 'netflix'));
  await page.click('#sheet-detail [data-action="ae-toggle"][data-value="netflix"]');
  await page.click('#sheet-detail [data-action="ae-toggle"][data-value="twitch"]');
  check('a service that was off can be added (Twitch gets a tile with its logo)', await page.evaluate(() => TV.apps.visible().some(a => a.key === 'twitch') && !!document.querySelector('.app-tile[data-app="twitch"] svg.app-logo') && TV.settings.apps.enabled.indexOf('twitch') >= 0));
  await page.click('#sheet-detail [data-action="ae-toggle"][data-value="twitch"]');
  check('...and taken away again', await page.evaluate(() => !TV.apps.visible().some(a => a.key === 'twitch') && TV.settings.apps.enabled.indexOf('twitch') < 0));
  await page.click('#sheet-detail [data-action="ae-down"][data-value="netflix"]');
  check('services can be reordered (Netflix moves below YouTube)', await page.evaluate(() => TV.apps.visible().map(a => a.key).slice(0, 2).join(',') === 'youtube,netflix'));
  await page.click('#sheet-detail [data-action="ae-up"][data-value="netflix"]');
  check('...and back', await page.evaluate(() => TV.apps.visible().map(a => a.key).slice(0, 2).join(',') === 'netflix,youtube'));
  await page.click('#sheet-detail [data-action="ae-find"]');
  check('Find Apps inside the editor says it only works on the TV', await page.evaluate(() => /only works on the TV/.test(document.getElementById('sheet-detail').textContent)));
  await page.evaluate(() => {
    window.tizen = { application: { getAppsInfo: (ok) => ok([{ id: 'N.1', name: 'Netflix' }, { id: 'Z.9', name: 'Some Other App' }, { id: 'Y.1', name: 'YouTube' }]), launch: () => {} } };
  });
  await page.click('#sheet-detail [data-action="ae-find"]');
  check('on the TV the editor offers the apps that have no tile yet (with an Add button)', await page.evaluate(() => /3 apps found on this TV/.test(document.getElementById('sheet-detail').textContent) && !!document.querySelector('#sheet-detail [data-action="ae-add"][data-value="Z.9"]') && !document.querySelector('#sheet-detail [data-action="ae-add"][data-value="N.1"]')));
  await page.click('#sheet-detail [data-action="ae-add"][data-value="Z.9"]');
  const added = await page.evaluate(() => ({ custom: TV.settings.apps.custom, tile: !!document.querySelector('.app-tile[data-app="u_someotherapp"]') || TV.apps.visible().some(a => a.key === 'u_someotherapp'), mark: (document.querySelector('.app-tile[data-app="u_someotherapp"] .app-mark') || {}).textContent, addAgain: !!document.querySelector('#sheet-detail [data-action="ae-add"][data-value="Z.9"]'), rm: !!document.querySelector('#sheet-detail [data-action="ae-remove"][data-value="u_someotherapp"]') }));
  check('Add gives the app a tile of its own (letter tile), and it can be removed again', added.custom.length === 1 && added.tile && added.mark === 'S' && !added.addAgain && added.rm, JSON.stringify(added));
  await page.click('#sheet-detail [data-action="ae-remove"][data-value="u_someotherapp"]');
  check('Remove deletes it (the tile goes, and it is offered again)', await page.evaluate(() => TV.settings.apps.custom.length === 0 && !TV.apps.visible().some(a => a.key === 'u_someotherapp') && !!document.querySelector('#sheet-detail [data-action="ae-add"][data-value="Z.9"]')));
  await page.evaluate(() => { TV.closeSheet(); delete window.tizen; TV.openSheet('settings'); });
  await page.click('#sheet-settings [data-action="apps-find"]');
  check('Find Apps in a browser says it only works on the TV', await page.evaluate(() => /only works on the TV/.test(document.getElementById('sheet-settings').textContent)));
  await page.evaluate(() => {
    window.tizen = { application: { getAppsInfo: (ok) => ok([{ id: 'N.1', name: 'Netflix' }, { id: 'Z.9', name: 'Some Other App' }, { id: 'Y.1', name: 'YouTube' }]), launch: () => {} } };
  });
  await page.click('#sheet-settings [data-action="apps-find"]');
  check('Find Apps on the TV reports what it found', await page.evaluate(() => /Found 3 apps on this TV\. 2 of them are in your list\./.test(document.getElementById('sheet-settings').textContent)), await page.evaluate(() => document.getElementById('sheet-settings').textContent.slice(0, 200)));
  await page.click('#sheet-settings [data-action="apps-list"]');
  check('Show List lists the TV’s apps with their IDs (✓ = on your Apps page)', await page.evaluate(() => { const t = document.getElementById('sheet-detail').textContent; return /Apps on This TV/.test(t) && /✓ Netflix/.test(t) && /Some Other App/.test(t) && /Z\.9/.test(t) && !/✓ Some Other App/.test(t); }));
  await page.evaluate(() => { TV.closeSheet(); delete window.tizen; TV.apps.discover(); });
  // Ambient Mode and Animations Off
  await page.evaluate(() => { TV.settings.apps.disabled = []; TV.apps.render(); TV.pager.go('apps'); TV.ambient.enter(); });
  check('Ambient Mode starts from Home even if you were on Apps', await page.evaluate(() => TV.pager.page() === 'home' && TV.ambient.active()));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pager')).visibility === 'hidden', null, { timeout: 5000 });
  await page.evaluate(() => TV.ambient.exit());
  await page.waitForFunction(() => getComputedStyle(document.getElementById('pager')).visibility === 'visible', null, { timeout: 5000 });
  await page.evaluate(() => TV.setPref('anim', 'off'));
  check('Animations Off: the pages jump instead of sliding', await page.evaluate(() => /^0s(, 0s)*$/.test(getComputedStyle(document.getElementById('pager')).transitionDuration)));
  await page.evaluate(() => TV.setPref('anim', 'full'));
  check('no script errors from pictures and the Apps page', errors.length === 0, errors.join(' | '));


  // 3d. Illustrated weather icons, event cards, commute map, rain radar, depth, richer Apps page.
  await page.evaluate(() => {
    TV.resetPrefs(); TV.settings.widgets.disabled = []; TV.settings.theme.style = 'gradient'; TV.settings.theme.mode = 'dark';
    TV.settings.theme.gradient = 'purple'; delete window.tizen; TV.applyTheme(); TV.widgets.layout(true); TV.pager.go('home');
  });
  await page.waitForTimeout(500);

  // Weather icons: every weather code has an illustration, and the shared gradients they use exist on the page
  const icons = await page.evaluate(() => {
    const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99], missing = [], ids = {};
    codes.forEach(c => [true, false].forEach(day => { const i = TV.weatherInfo(c, day).icon, svg = TV.ICONS[i]; if (!svg || svg.length < 80) missing.push(c + (day ? 'd' : 'n') + ':' + i); (svg || '').replace(/url\(#(\w+)\)/g, (m, id) => { ids[id] = 1; }); }));
    return { missing, undefinedGradients: Object.keys(ids).filter(id => !document.getElementById(id)), gradients: Object.keys(ids).length, names: TV.WX_ICON_NAMES.length };
  });
  check('every weather code (day and night) has an illustration', icons.missing.length === 0 && icons.names === 11, JSON.stringify(icons.missing));
  check('every gradient the icons use is defined once on the page', icons.undefinedGradients.length === 0 && icons.gradients >= 7, JSON.stringify(icons));
  check('the big weather icon moves gently (animations Full)', await page.evaluate(() => document.querySelectorAll('.wx-icon-big svg animateTransform').length > 0));
  check('the small hourly icons stay still', await page.evaluate(() => document.querySelectorAll('#weather-hourly svg animateTransform').length === 0));
  await page.evaluate(() => TV.setPref('anim', 'reduced'));
  check('Animations Reduced: the big icon stays still too', await page.evaluate(() => document.querySelectorAll('.wx-icon-big svg animateTransform').length === 0));
  await page.evaluate(() => TV.setPref('anim', 'full'));
  check('...and moves again on Full', await page.evaluate(() => document.querySelectorAll('.wx-icon-big svg animateTransform').length > 0));

  // Event cards
  await page.evaluate(() => {
    const n = new Date(), day = TV.startOfDay(n), tm = TV.addDays(day, 1);
    const mk = (title, s, e, color, extra) => Object.assign({ title, start: s, end: e, color, allDay: false, location: '' }, extra || {});
    TV.calendarEvents = [
      mk('Company holiday party planning', day, TV.addDays(day, 1), '#FF9500', { allDay: true }),
      mk('Standup', new Date(n.getTime() - 20 * 60000), new Date(n.getTime() + 25 * 60000), '#007AFF', { location: 'Zoom' }),
      mk('Dentist appointment with a very long title that keeps going and going', new Date(n.getTime() + 45 * 60000), new Date(n.getTime() + 105 * 60000), '#34C759', { location: 'Bright Smiles Dental, 22 Palm Avenue, Suite 300' }),
      mk('Pick up the kids', new Date(n.getTime() + 190 * 60000), new Date(n.getTime() + 220 * 60000), '#AF52DE'),
      mk('Gym', new Date(tm.getTime() + 7 * 3600000), new Date(tm.getTime() + 8 * 3600000), '#FF3B30')
    ];
    TV.renderCalendar();
  });
  const ev = await page.evaluate(() => {
    const evs = [...document.querySelectorAll('#calendar-list .event')], barColor = e => getComputedStyle(e.querySelector('.ev-bar')).backgroundColor;
    const rgb = hex => { const n = parseInt(hex.slice(1), 16); return 'rgb(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ')'; };
    const byTitle = t => evs.filter(e => e.querySelector('.event-title').textContent.indexOf(t) === 0)[0];
    return {
      count: evs.length, bars: evs.every(e => !!e.querySelector('.ev-bar')),
      allday: !!byTitle('Company') && byTitle('Company').classList.contains('allday') && byTitle('Company').offsetHeight < 64,
      colors: [barColor(byTitle('Standup')) === rgb('#007AFF'), barColor(byTitle('Dentist')) === rgb('#34C759'), barColor(byTitle('Gym')) === rgb('#FF3B30')],
      dur: [(byTitle('Dentist').querySelector('.ev-dur') || {}).textContent, (byTitle('Pick up') || byTitle('Gym')).querySelector('.ev-dur').textContent],
      nowRing: !!byTitle('Standup').querySelector('.ev-ring') && !byTitle('Standup').querySelector('.ev-dur'),
      onlyOneRing: document.querySelectorAll('#calendar-list .ev-ring').length === 1,
      overflow: ['calendar-list', 'card-calendar'].map(id => { const e = document.getElementById(id); return e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1; }),
      titleCut: byTitle('Dentist').querySelector('.event-title').scrollWidth > byTitle('Dentist').querySelector('.event-title').clientWidth
    };
  });
  check('every event is a card with a colored side bar, and the all-day one is a slim banner', ev.count >= 4 && ev.bars && ev.allday, JSON.stringify(ev));
  check('the side bar takes the calendar’s color', ev.colors.every(Boolean), JSON.stringify(ev.colors));
  check('timed events show how long they last (1 h, 30 min)', ev.dur[0] === '1 h' && ev.dur[1] === '30 min', JSON.stringify(ev.dur));
  check('the event happening now has the progress ring (and no duration chip)', ev.nowRing && ev.onlyOneRing, JSON.stringify(ev));
  check('long titles and places are cut with an ellipsis and nothing overflows the card', ev.titleCut && !ev.overflow[0] && !ev.overflow[1], JSON.stringify(ev.overflow));
  await page.evaluate(() => { TV.setPref('hour12', true); TV.renderCalendar(); });
  check('12-hour times still fit on the cards', await page.evaluate(() => [...document.querySelectorAll('#calendar-list .event')].every(e => { const t = e.querySelector('.tl-start'); return t.scrollWidth <= t.clientWidth + 1; }) && document.getElementById('calendar-list').scrollHeight <= document.getElementById('calendar-list').clientHeight + 1));
  await page.evaluate(() => { TV.setPref('hour12', false); TV.refreshCalendar(); });

  // Commute map (the preview draws a stand-in picture). A layout where the commute tile is on screen, in the compact grid:
  await page.evaluate(() => { TV.settings.widgets.disabled = ['wifi', 'dates', 'nasa', 'countdown', 'radar']; TV.widgets.layout(true); });
  await page.waitForTimeout(700);
  const cm = await page.evaluate(() => { const c = document.querySelector('[data-widget="commute"]'); return c ? { hasMap: c.classList.contains('has-map'), bg: (c.querySelector('.cm-map') || { style: {} }).style.backgroundImage || '', over: c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1, time: !!c.querySelector('.commute-time') } : null; });
  check('the commute tile shows a map of the route next to the drive time', !!cm && cm.hasMap && /data:image\/svg/.test(cm.bg) && cm.time && !cm.over, JSON.stringify(cm));
  const urls = [];
  page.on('request', r => { if (/api\.mapbox\.com\/styles/.test(r.url())) urls.push(r.url()); });
  await page.evaluate(() => {
    TV_CONFIG.commute.mapboxToken = 'pk.test-token';
    TV.widgets.update('commute'); TV.widgets.layout(true);
  });
  await page.waitForTimeout(1200);
  check('with a real token the app asks Mapbox for a dark-style static map with both pins', urls.some(u => /\/styles\/v1\/mapbox\/dark-v11\/static\/.*pin-s-a\+ffffff\(.*\),pin-s-b\+ffffff\(.*\)\/auto\/\d+x\d+\?padding=\d+&access_token=pk\.test-token/.test(u)), urls.join(' | ').slice(0, 300));
  check('if the map picture cannot be loaded the tile quietly goes back to text only', await page.evaluate(() => { const c = document.querySelector('[data-widget="commute"]'); return !!c && !c.classList.contains('has-map') && !c.querySelector('.cm-map') && !!c.querySelector('.commute-time'); }));
  await page.evaluate(() => { TV_CONFIG.commute.mapboxToken = 'demo'; TV.widgets.update('commute'); });
  await page.evaluate(() => { document.querySelector('[data-widget="commute"]').click(); });
  await page.waitForTimeout(300);
  check('the full-screen commute view has a larger map', await page.evaluate(() => { const m = document.querySelector('#sheet-detail .dc-map'); return !m || m.offsetWidth > 800; }));
  await page.evaluate(() => TV.closeSheet());

  // Rain radar (sample frames and drawn tiles in the preview)
  await page.evaluate(() => { TV.settings.widgets.disabled = ['sunmoon', 'wifi', 'dates', 'nasa', 'air', 'countdown', 'spotify', 'commute']; TV.widgets.layout(true); });
  await page.waitForTimeout(800);
  const rd = await page.evaluate(() => { const r = document.querySelector('[data-widget="radar"]'); if (!r) return null; const m = r.querySelector('.rd-map').getBoundingClientRect(), c = r.querySelector('.rd-credit').getBoundingClientRect(); return { frames: r.querySelectorAll('.rd-frame').length, imgsPerFrame: r.querySelectorAll('.rd-frame')[0].querySelectorAll('img').length, credit: r.querySelector('.rd-credit').textContent, creditInside: c.left >= m.left && c.right <= m.right && c.top >= m.top && c.bottom <= m.bottom, dots: r.querySelectorAll('.rd-dots i').length, pin: !!r.querySelector('.rd-pin'), wide: r.classList.contains('w-wide'), over: r.scrollHeight > r.clientHeight + 1 || r.scrollWidth > r.clientWidth + 1, state: TV.radar.state() }; });
  check('the radar widget appears with a frame for each picture (6 past + 2 forecast)', !!rd && rd.frames === 8 && rd.dots === 8 && rd.state.frames === 8, JSON.stringify(rd));
  check('each frame uses at most 15 tiles', !!rd && rd.imgsPerFrame >= 4 && rd.imgsPerFrame <= 15, JSON.stringify(rd));
  check('RainViewer is credited on the map, inside it', !!rd && /Weather data by RainViewer/.test(rd.credit) && rd.creditInside, JSON.stringify(rd));
  check('the radar has a pin for your place, is a wide tile and fits', !!rd && rd.pin && rd.wide && !rd.over, JSON.stringify(rd));
  const t0 = await page.evaluate(() => TV.radar.state().idx);
  await page.waitForFunction((i) => TV.radar.state().idx !== i, t0, { timeout: 6000 }).catch(() => {});
  const t1 = await page.evaluate(() => TV.radar.state().idx);
  check('the radar loops through its frames', t1 !== t0, t0 + ' -> ' + t1);
  check('only the current frame is visible, and the label says when it is from', await page.evaluate(() => { const r = document.querySelector('[data-widget="radar"]'); return r.querySelectorAll('.rd-frame.on').length === 1 && /ago|Now|in \d+ min/.test(r.querySelector('.rd-time').textContent); }));
  check('forecast frames are labeled as forecasts', await page.evaluate(() => { TV.radar.show(7); return /forecast/.test(document.querySelector('[data-widget="radar"] .rd-time').textContent); }));
  await page.evaluate(() => TV.setPref('anim', 'off'));
  const still0 = await page.evaluate(() => TV.radar.state().idx);
  await page.waitForTimeout(1600);
  check('Animations Off: the radar stops looping and shows the newest picture', await page.evaluate((i) => TV.radar.state().idx === i && !/forecast/.test(document.querySelector('[data-widget="radar"] .rd-time').textContent), still0));
  await page.evaluate(() => TV.setPref('anim', 'full'));
  await page.evaluate(() => { TV.settings.widgets.disabled.push('radar'); TV.widgets.layout(true); });
  const hid0 = await page.evaluate(() => TV.radar.state().idx);
  await page.waitForTimeout(1800);
  check('the loop pauses while the radar is not on screen', await page.evaluate((i) => TV.radar.state().idx === i, hid0));
  await page.evaluate(() => { TV.settings.widgets.disabled = ['sunmoon', 'wifi', 'dates', 'nasa', 'air', 'countdown', 'spotify', 'commute']; TV.widgets.layout(true); document.querySelector('[data-widget="radar"]').click(); });
  await page.waitForTimeout(500);
  check('the full-screen radar has a bigger map with play/pause and step buttons', await page.evaluate(() => { const m = document.querySelector('#sheet-detail .rd-map.big'); return !!m && m.offsetWidth > 1000 && !!document.querySelector('#sheet-detail [data-action="rd-toggle"]') && !!document.querySelector('#sheet-detail [data-action="rd-prev"]') && /RainViewer/.test(m.textContent); }));
  await page.evaluate(() => { TV.radar.show(3); });
  await page.click('#sheet-detail [data-action="rd-next"]');
  check('stepping forward pauses and shows the next frame', await page.evaluate(() => TV.radar.state().idx === 4 && !TV.radar.state().playing));
  await page.click('#sheet-detail [data-action="rd-prev"]'); await page.click('#sheet-detail [data-action="rd-prev"]');
  check('stepping back goes to earlier frames', await page.evaluate(() => TV.radar.state().idx === 2));
  await page.click('#sheet-detail [data-action="rd-toggle"]');
  check('play starts the loop again', await page.evaluate(() => TV.radar.state().playing));
  await page.evaluate(() => TV.closeSheet());
  const noTok = await page.evaluate(() => { const keep = [TV_CONFIG.mapboxToken, TV_CONFIG.commute.mapboxToken]; TV_CONFIG.mapboxToken = ''; TV_CONFIG.commute.mapboxToken = ''; TV.widgets.layout(true); const r = document.querySelector('[data-widget="radar"]'); const out = { plain: !!r.querySelector('.rd-plain'), note: /Mapbox token/.test(r.textContent), frames: r.querySelectorAll('.rd-frame').length }; TV_CONFIG.mapboxToken = keep[0]; TV_CONFIG.commute.mapboxToken = keep[1]; return out; });
  check('with no Mapbox token the radar still draws, on a plain backdrop with a note', noTok.plain && noTok.note && noTok.frames === 8, JSON.stringify(noTok));
  await page.evaluate(() => { TV.settings.widgets.disabled = []; TV.widgets.layout(true); });

  // Depth and parallax
  const depth = async (sel) => { await page.evaluate((s) => document.querySelector(s).focus(), sel); await page.waitForTimeout(250); return page.evaluate(() => ({ dx: +document.body.style.getPropertyValue('--dx'), dy: +document.body.style.getPropertyValue('--dy') })); };
  const dl = await depth('#card-calendar'), dr = await depth('#btn-settings');
  check('selecting something on the left or right shifts the depth the other way', dl.dx < -0.4 && dr.dx > 0.8 && dr.dy < -0.5 && dl.dy > 0, JSON.stringify([dl, dr]));
  await page.waitForTimeout(1800);
  const bgRight = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('background')).transform));
  check('the background drifts opposite to the selection (selected on the right, background moves left)', bgRight.m41 < -8 && bgRight.a > 1.04, bgRight.m41.toFixed(1));
  const cover = async () => page.evaluate(() => { const r = document.getElementById('background').getBoundingClientRect(); return r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight; });
  check('the drifting background always covers the whole screen (no edge shows), selected top right', await cover());
  await depth('#widget-slots .wrow:last-child [data-focus]');
  await page.waitForTimeout(1800);
  check('...and selected at the bottom', await cover());
  await page.evaluate(() => TV.setPref('anim', 'reduced'));
  check('Animations Reduced: no depth movement', await page.evaluate(() => +document.body.style.getPropertyValue('--dx') === 0 && getComputedStyle(document.getElementById('background')).transform === 'none'));
  await page.evaluate(() => TV.setPref('anim', 'full'));
  await page.evaluate(() => TV.setPref('motion', false));
  check('Moving Background off: no depth movement', await page.evaluate(() => getComputedStyle(document.getElementById('background')).transform === 'none'));
  await page.evaluate(() => TV.setPref('motion', true));
  await page.evaluate(() => { document.getElementById('btn-settings').focus(); TV.ambient.enter(); });
  check('Ambient Mode: the depth returns to center', await page.evaluate(() => +document.body.style.getPropertyValue('--dx') === 0 && +document.body.style.getPropertyValue('--dy') === 0));
  await page.evaluate(() => TV.ambient.exit());

  // Apps page: emblems, backdrop wash, weather chip, tilt (first forget what earlier checks pretended the TV reported)
  await page.evaluate(() => { window.tizen = { application: { getAppsInfo: (ok) => ok([]), launch: () => {} } }; TV.apps.discover(); delete window.tizen; TV.settings.apps.disabled = []; TV.apps.render(); });
  await page.evaluate(() => { TV.pager.go('apps'); });
  await page.waitForTimeout(900);
  const ap2 = await page.evaluate(() => ({ chip: document.getElementById('apps-wx').textContent, chipIcon: !!document.querySelector('#apps-wx svg'), wash: [].map.call(document.querySelectorAll('#apps-wash i'), i => i.className) }));
  check('the Apps page shows the weather next to the clock', /\d+°\s*\S/.test(ap2.chip) && ap2.chipIcon, ap2.chip);
  check('the first app tile’s color washes the background', ap2.wash.filter(c => c === 'on').length === 1, JSON.stringify(ap2.wash));
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
  const w2 = await page.evaluate(() => { const on = document.querySelector('#apps-wash i.on'); return { n: document.querySelectorAll('#apps-wash i.on').length, color: on ? on.style.getPropertyValue('--wc') : '', tilt: parseFloat(document.activeElement.style.getPropertyValue('--tilt-x')) }; });
  check('moving to another app changes the wash to that app’s color (YouTube red)', w2.n === 1 && w2.color === '#FF0000', JSON.stringify(w2));
  check('the selected tile leans the way you moved', w2.tilt > 0, JSON.stringify(w2));
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
  check('...and the other way when you move back', await page.evaluate(() => parseFloat(document.activeElement.style.getPropertyValue('--tilt-x')) < 0));
  // more than twelve services: the rows slide and the selected tile stays in view
  await page.evaluate(() => { TV.settings.apps.enabled = ['twitch', 'kodi', 'dazn', 'deezer', 'tidal']; TV.apps.render(); document.querySelector('.app-tile').focus(); });
  await page.waitForTimeout(400);
  const lastKey = await page.evaluate(() => { const ts = document.querySelectorAll('.app-tile'); ts[ts.length - 1].focus(); return ts[ts.length - 1].dataset.app; });
  await page.waitForTimeout(900);
  const sl = await page.evaluate(() => { const tr = document.querySelector('.apps-track'), t = document.activeElement.getBoundingClientRect(), g = document.getElementById('apps-grid').getBoundingClientRect(), gl = document.getElementById('focus-glow').getBoundingClientRect(); return { n: document.querySelectorAll('.app-tile').length, sy: tr.getAttribute('data-sy'), y: new DOMMatrix(getComputedStyle(tr).transform).m42, inside: t.top >= g.top - 1 && t.bottom <= g.bottom + 1, glow: Math.abs((gl.top + gl.height / 2) - (t.top + t.height / 2)) }; });
  check('with 17 services the fifth row slides into view (' + lastKey + ')', sl.n === 17 && sl.sy === '-532' && sl.y === -532 && sl.inside && sl.glow < 24, JSON.stringify(sl));
  await page.evaluate(() => { TV.settings.apps.enabled = []; TV.apps.render(); });
  await page.evaluate(() => TV.pager.go('home'));
  await page.waitForTimeout(600);
  check('leaving the Apps page clears the wash', await page.evaluate(() => document.querySelectorAll('#apps-wash i.on').length === 0));
  check('no script errors from the visual pass', errors.length === 0, errors.join(' | '));


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
  await p2.click('[data-action="apps-edit"]');
  await p2.click('[data-action="ae-toggle"][data-value="hulu"]');
  await p2.click('[data-action="ae-toggle"][data-value="kodi"]');
  await p2.click('[data-action="ae-down"][data-value="netflix"]');
  await p2.evaluate(() => TV.closeSheet()); await p2.evaluate(() => TV.openSheet('settings'));
  await p2.evaluate(() => TV.handleThemeAction('gradient', 'dusk'));
  await p2.evaluate(() => TV.handleThemeAction('mode', 'dark'));
  await p2.click(`[data-action="pref"][data-value='clockSize="l"']`);
  await p2.reload();
  await p2.waitForTimeout(1500);
  const saved = await p2.evaluate(() => ({ s: TV.settings, appTiles: [].map.call(document.querySelectorAll('.app-tile'), t => t.dataset.app), order: TV.widgets.all().map(w => w.id), dark: document.body.classList.contains('mode-dark') }));
  check('widget off is remembered', saved.s.widgets.disabled.includes('wifi'));
  check('widget order is remembered', saved.order.indexOf('sunmoon') === 1, saved.order.join(','));
  check('streaming apps: off, on and order are remembered', saved.s.apps.disabled.includes('hulu') && saved.s.apps.enabled.includes('kodi') && saved.s.apps.order.indexOf('netflix') === 1 && saved.appTiles.indexOf('hulu') < 0 && saved.appTiles.indexOf('kodi') > 0 && saved.appTiles.slice(0, 2).join(',') === 'youtube,netflix', JSON.stringify([saved.s.apps, saved.appTiles]));
  check('theme is remembered', saved.s.theme.gradient === 'dusk' && saved.dark);
  check('look options are remembered', saved.s.prefs.clockSize === 'l' && await p2.evaluate(() => document.body.getAttribute('data-clock-size') === 'l'));
  check('no script errors (normal mode, offline)', errors2.length === 0, errors2.join(' | '));
  const calText = await p2.textContent('#calendar-list');
  check('calendar card explains itself (no calendar, or why it could not load)', /No calendars yet|Couldn’t load/.test(calText) && !/Nothing scheduled/.test(calText), calText.trim().slice(0, 80));

  await browser.close();
  if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
  console.log('All UI checks passed');
})();
