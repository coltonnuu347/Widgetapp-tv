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
  check('compact grid: page 1 has 5 tiles in 2 rows (the wide Spotify tile goes on page 2)',
    (await page.$$('#widget-slots .widget')).length === 5 && (await page.$$('#widget-slots .wrow')).length === 2);
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
    TV.settings.widgets.disabled = ['wifi', 'dates', 'nasa', 'commute'];   // sun & moon + Spotify: one row of three columns
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
