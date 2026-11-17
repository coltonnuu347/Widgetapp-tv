// Run with: node test/smart.test.js
const assert = require('assert');
const s = require('../js/smart.js');

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)));
  if (!ok) failed++;
};

const min = 60000, hour = 3600000;
const at = (h, m) => new Date(2026, 10, 17, h, m || 0, 0);
const fmt = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const dayLabel = (d, now) => d.getDate() === now.getDate() ? 'Today' : d.getDate() === now.getDate() + 1 ? 'Tomorrow' : 'Later';

// ---- countdown wording
check('under a minute', s.inText(20000), 'now');
check('25 minutes', s.inText(25 * min), 'in 25 min');
check('rounds to the nearest minute', s.inText(24.6 * min), 'in 25 min');
check('exactly an hour', s.inText(60 * min), 'in 1 h');
check('hour and minutes', s.inText(65 * min), 'in 1 h 5 min');
check('long waits drop the minutes', s.inText(7 * hour + 20 * min), 'in 7 h');
check('length wording', s.lengthText(80 * min), '1 h 20 min');

// ---- event progress
check('progress at the start', s.progress(at(10), at(12), at(10)), 0);
check('progress halfway', s.progress(at(10), at(12), at(11)), 0.5);
check('progress is capped', s.progress(at(10), at(12), at(13)), 1);
check('zero-length event', s.progress(at(10), at(10), at(10)), 0);

// ---- rain heads-up (hours are the start of each hour)
const hrs = (pops, codes, startHour) => pops.map((p, i) => ({ time: at((startHour == null ? 14 : startHour) + i), pop: p, code: codes ? codes[i] : 1 }));
check('dry forecast shows nothing', s.rainHint(hrs([0, 10, 20, 10]), at(14, 20), fmt), null);
check('49% is not rain', s.rainHint(hrs([10, 49, 49]), at(14, 20), fmt), null);
check('50% is rain', s.rainHint(hrs([10, 50, 10]), at(14, 20), fmt).text, 'Rain likely within the hour');
check('rain two hours out', s.rainHint(hrs([0, 0, 80, 10]), at(14, 20), fmt).text, 'Rain likely from 16:00');
check('rain far off shows nothing', s.rainHint(hrs([0, 0, 0, 0, 0, 0, 0, 0, 90]), at(14, 20), fmt), null);
check('raining now, stops later', s.rainHint(hrs([70, 60, 10, 0]), at(14, 20), fmt).text, 'Rain until about 16:00');
check('raining the whole forecast', s.rainHint(hrs([70, 60]), at(14, 20), fmt).text, 'Rain for the rest of the forecast');
check('wet weather code counts when there is no percentage', s.isWet({ pop: null, code: 63 }), true);
check('dry code without a percentage', s.isWet({ pop: null, code: 2 }), false);
check('empty forecast', s.rainHint([], at(14), fmt), null);

// ---- sun countdown
const today = { sunrise: at(7, 12), sunset: at(17, 40) }, tomorrow = { sunrise: new Date(2026, 10, 18, 7, 13), sunset: new Date(2026, 10, 18, 17, 39) };
check('sunset within 90 min', s.sunHint(today, tomorrow, at(16, 20)).text, 'Sunset in 1 h 20 min');
check('sunset more than 90 min away', s.sunHint(today, tomorrow, at(12)), null);
check('sunrise within 90 min', s.sunHint(today, tomorrow, at(6, 30)).text, 'Sunrise in 42 min');
check('sunrise tomorrow after sunset is far off', s.sunHint(today, tomorrow, at(20)), null);
check('late night before sunrise', s.sunHint(today, tomorrow, at(5, 50)).text, 'Sunrise in 1 h 22 min');

// ---- greeting
check('4:59 is still night', s.greeting(at(4, 59)), 'Good night');
check('morning', s.greeting(at(5)), 'Good morning');
check('afternoon', s.greeting(at(12)), 'Good afternoon');
check('evening', s.greeting(at(17)), 'Good evening');
check('late evening', s.greeting(at(21, 59)), 'Good evening');
check('night', s.greeting(at(22)), 'Good night');

// ---- the line under the clock: two items, most important first
const ev = (title, h, m, eh, em, allDay) => ({ title, start: at(h, m), end: at(eh, em), allDay: !!allDay });
const ctx = (now, events, extra) => Object.assign({ now, events, hours: hrs([0, 0, 0]), today, tomorrow, weatherText: '68° Partly Cloudy', fmt, dayLabel }, extra || {});
check('current event + next event', s.glanceItems(ctx(at(10, 30), [ev('Standup', 10, 0, 11, 0), ev('Lunch', 12, 0, 13, 0)])).map(i => i.text),
  ['Standup until 11:00', 'Lunch in 1 h 30 min']);
check('current event beats rain beats next event', s.glanceItems(ctx(at(10, 30), [ev('Standup', 10, 0, 11, 0), ev('Lunch', 12, 0, 13, 0)], { hours: hrs([0, 90, 0], null, 10) })).map(i => i.text),
  ['Standup until 11:00', 'Rain likely within the hour']);
check('quiet day falls back to the next event and weather', s.glanceItems(ctx(at(8), [ev('Dentist', 9, 30, 10, 0)])).map(i => i.text),
  ['Dentist in 1 h 30 min', '68° Partly Cloudy']);
check('all-day events never show here', s.glanceItems(ctx(at(8), [ev('Trash day', 0, 0, 23, 59, true)])).map(i => i.text),
  ['68° Partly Cloudy']);
check('event tomorrow shows the day', s.glanceItems(ctx(at(20), [{ title: 'Gym', start: new Date(2026, 10, 18, 7, 0), end: new Date(2026, 10, 18, 8, 0), allDay: false }])).map(i => i.text),
  ['Gym · Tomorrow 07:00', '68° Partly Cloudy']);
check('finished events are ignored', s.glanceItems(ctx(at(15), [ev('Old', 9, 0, 10, 0)])).map(i => i.text), ['68° Partly Cloudy']);
check('never more than two items', s.glanceItems(ctx(at(16, 30), [ev('A', 16, 0, 17, 0), ev('B', 18, 0, 19, 0)], { hours: hrs([0, 90, 0], null, 16) })).length, 2);

// ---- starting soon, tomorrow's weather, "left today", sun progress
const soonItems = s.glanceItems(ctx(at(10, 55), [ev('Standup', 11, 0, 11, 30)], { hours: hrs([0, 90, 0], null, 10) }));
check('event within 10 min is "Soon", urgent, and beats the rain line', soonItems.map(i => i.label + ':' + !!i.urgent), ['Soon:true', ':false']);
check('event 30 min away is a normal "Next"', s.glanceItems(ctx(at(10, 30), [ev('Standup', 11, 0, 11, 30)]))[0].label, 'Next');
check('tomorrow weather shows after 20:00', s.glanceItems(ctx(at(20, 30), [], { tomorrowText: 'Tomorrow 72° Sunny', weatherText: '60° Clear' })).map(i => i.text), ['Tomorrow 72° Sunny', '60° Clear']);
check('tomorrow weather hidden before 20:00', s.glanceItems(ctx(at(19, 59), [], { tomorrowText: 'Tomorrow 72° Sunny', weatherText: '60° Clear' })).map(i => i.text), ['60° Clear']);
check('left today counts timed events still to come', s.todayText([ev('A', 9, 0, 10, 0), ev('B', 15, 0, 16, 0), ev('C', 17, 0, 18, 0)], at(12)), '2 left today');
check('a running event still counts', s.todayText([ev('A', 11, 30, 12, 30)], at(12)), '1 left today');
check('done for today', s.todayText([ev('A', 9, 0, 10, 0)], at(12)), 'Done for today');
check('nothing today', s.todayText([], at(12)), 'Nothing today');
check('all-day only is not "left"', s.todayText([ev('Holiday', 0, 0, 23, 59, true)], at(12)), 'Done for today');
check('sun progress is 0 before sunrise', s.sunProgress(today, at(6)), 0);
check('sun progress is 1 after sunset', s.sunProgress(today, at(19)), 1);
check('sun progress halfway', Math.abs(s.sunProgress({ sunrise: at(6), sunset: at(18) }, at(12)) - 0.5) < 1e-9, true);
check('sun progress without data', s.sunProgress(null, at(12)), 0);

// ---- UV and air quality levels
check('UV 0 is Low', s.uvLevel(0).label, 'Low');
check('UV 2.4 rounds to 2: Low', s.uvLevel(2.4).label, 'Low');
check('UV 3 is Moderate', s.uvLevel(3).label, 'Moderate');
check('UV 5 is Moderate', s.uvLevel(5).label, 'Moderate');
check('UV 6 is High', s.uvLevel(6).label, 'High');
check('UV 7.4 is High', s.uvLevel(7.4).label, 'High');
check('UV 8 is Very High', s.uvLevel(8).label, 'Very High');
check('UV 10 is Very High', s.uvLevel(10).label, 'Very High');
check('UV 11 is Extreme', s.uvLevel(11).label, 'Extreme');
check('UV missing', s.uvLevel(null), null);
check('AQI 50 is Good', s.aqiLevel(50).label, 'Good');
check('AQI 51 is Moderate', s.aqiLevel(51).label, 'Moderate');
check('AQI 100 is Moderate', s.aqiLevel(100).label, 'Moderate');
check('AQI 101 is Unhealthy for Sensitive Groups', s.aqiLevel(101).label, 'Unhealthy for Sensitive Groups');
check('AQI 151 is Unhealthy', s.aqiLevel(151).label, 'Unhealthy');
check('AQI 201 is Very Unhealthy', s.aqiLevel(201).label, 'Very Unhealthy');
check('AQI 301 is Hazardous', s.aqiLevel(301).label, 'Hazardous');
check('AQI missing', s.aqiLevel(undefined), null);

// ---- Countdowns
check('title prefix "Countdown: "', s.countdownTitle('Countdown: Beach trip'), 'Beach trip');
check('title prefix "countdown - "', s.countdownTitle('countdown - Beach trip'), 'Beach trip');
check('hourglass prefix', s.countdownTitle('\u23F3 Concert'), 'Concert');
check('ordinary event is not a countdown', s.countdownTitle('Dentist'), null);
check('the word later in the title does not count', s.countdownTitle('Final countdown party'), null);
check('empty name is not a countdown', s.countdownTitle('Countdown:'), null);
check('the word without a separator is not a countdown', s.countdownTitle('Countdown to Christmas'), null);
const cnow = new Date(2026, 10, 17, 15, 0);
const items = s.countdownItems([{ name: 'Trip', date: '2026-12-20' }, { name: 'Birthday', date: '03-05' }, { name: 'Past', date: '2026-01-01' }, { name: 'Today thing', date: '2026-11-17' }, { name: 'Bad', date: 'soon' }],
  [{ title: 'Countdown: Concert', start: new Date(2026, 11, 1, 19, 0) }, { title: 'Dentist', start: new Date(2026, 10, 20, 9, 0) }], cnow);
check('countdowns sorted soonest first', items.map(i => i.name), ['Today thing', 'Concert', 'Trip', 'Birthday']);
check('days to a date', items.map(i => i.days), [0, 14, 33, 108]);
check('yearly MM-DD already passed rolls to next year', items[3].date.getFullYear(), 2027);
check('sources', items.map(i => i.source), ['config', 'calendar', 'config', 'config']);
check('more than 366 days away is ignored', s.countdownItems([{ name: 'Far', date: '2028-01-01' }], [], cnow), []);
check('the same event twice shows once', s.countdownItems([], [{ title: 'Countdown: X', start: new Date(2026, 11, 1, 9) }, { title: 'Countdown: X', start: new Date(2026, 11, 1, 18) }], cnow).length, 1);
check('countdown across the clock-change weekend counts whole days', s.countdownItems([{ name: 'D', date: '2026-11-02' }], [], new Date(2026, 9, 31, 23, 0)).map(i => i.days), [2]);

// ---- Day strip
const E = (h, m, eh, em, color, allDay) => ({ title: 'e', start: at(h, m), end: at(eh, em), color: color || '#f00', allDay: !!allDay });
check('no timed events: no strip', s.dayStrip([E(0, 0, 23, 59, '#0f0', true)], at(12)), null);
const ds = s.dayStrip([E(9, 0, 10, 0), E(13, 0, 14, 30), E(18, 0, 19, 0)], at(11, 30));
check('default window is 08:00 to 20:00', [ds.from, ds.to], [8, 20]);
check('block position and width', [Math.round(ds.blocks[0].left * 10) / 10, Math.round(ds.blocks[0].width * 10) / 10], [8.3, 8.3]);
check('past and future blocks', ds.blocks.map(b => b.past), [true, false, false]);
check('now marker position (11:30 of 08-20)', Math.round(ds.nowPct * 10) / 10, 29.2);
check('tick labels every 2 hours (12-hour window)', ds.ticks.map(t => t.hour), [8, 11, 14, 17, 20]);
const early = s.dayStrip([E(6, 30, 7, 15)], at(6, 45));
check('an early event widens the window', [early.from, early.to], [6, 20]);
const late = s.dayStrip([E(21, 0, 23, 30)], at(22));
check('a late event widens the window', [late.from, late.to], [8, 24]);
check('now marker is hidden when outside the window', s.dayStrip([E(9, 0, 10, 0)], at(23)).nowPct, -1);
check('very short events stay visible', s.dayStrip([E(9, 0, 9, 5)], at(8)).blocks[0].width >= 1.5, true);
check('an event across midnight is clipped', s.dayStrip([{ title: 'x', start: new Date(2026, 10, 16, 22, 0), end: at(1, 0), color: '#f00', allDay: false }], at(0, 30)).blocks.length, 1);

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All smart-logic checks passed');
