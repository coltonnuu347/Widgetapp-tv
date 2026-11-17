// Run with: TZ=America/Denver node test/ics.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ics = require('../js/ics.js');

const cal = ics.parse(fs.readFileSync(path.join(__dirname, 'sample.ics'), 'utf8'));
const occ = ics.expand(cal, new Date(2026, 9, 26), new Date(2026, 10, 4));
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const rows = occ.map(o => `${fmt(o.start)} -> ${fmt(o.end)} ${o.allDay ? '[all-day] ' : ''}${o.title}`);
rows.forEach(r => console.log(r));

const has = s => rows.some(r => r === s);
let failed = 0;
function check(name, cond) { if (cond) console.log('PASS', name); else { console.log('FAIL', name); failed++; } }

check('calendar name', cal.name === 'Home');
check('calendar color', cal.color === '#FF2968');
check('TZ conversion NY 09:00 -> Denver 07:00', has('2026-10-28 07:00 -> 2026-10-28 08:00 Call with NY office'));
check('all-day single', has('2026-10-29 00:00 -> 2026-10-30 00:00 [all-day] Trash day'));
check('multi-day all-day + escaped comma', has('2026-10-30 00:00 -> 2026-11-02 00:00 [all-day] Weekend trip, Aspen'));
check('weekly Mon', has('2026-10-26 10:00 -> 2026-10-26 11:00 Gym'));
check('weekly EXDATE removed', !has('2026-10-28 10:00 -> 2026-10-28 11:00 Gym'));
check('weekly Fri', has('2026-10-30 10:00 -> 2026-10-30 11:00 Gym'));
check('weekly next Mon', has('2026-11-02 10:00 -> 2026-11-02 11:00 Gym'));
check('COUNT first', has('2026-10-26 09:00 -> 2026-10-26 09:15 Standup'));
check('override replaced original', !has('2026-10-27 09:00 -> 2026-10-27 09:15 Standup'));
check('override shown', has('2026-10-27 11:00 -> 2026-10-27 11:30 Standup (moved)'));
check('COUNT third', has('2026-10-28 09:00 -> 2026-10-28 09:15 Standup'));
check('COUNT stops', rows.filter(r => r.endsWith(' Standup')).length === 2);
check('monthly -1FR', has('2026-10-30 17:00 -> 2026-10-30 18:00 Last Friday drinks'));
check('BYSETPOS last weekday', has('2026-10-30 08:00 -> 2026-10-30 08:30 Pay rent (last weekday)'));
check('yearly birthday', has('2026-11-01 00:00 -> 2026-11-02 00:00 [all-day] Mom\'s Birthday'));
// DST: 09:00 New York = 07:00 Denver both before and after Nov 1 (both zones shift the same day)
check('DST weekly before', has('2026-10-27 07:00 -> 2026-10-27 07:30 DST weekly'));
check('DST weekly after', has('2026-11-03 07:00 -> 2026-11-03 07:30 DST weekly'));
check('cancelled hidden', !rows.some(r => r.includes('Cancelled')));
check('folded line', rows.some(r => r.endsWith('A very long title that is folded across two lines')));
check('VALARM summary ignored', !rows.some(r => r.includes('alarm')));
check('old event excluded', !rows.some(r => r.includes('Old event')));

// UNTIL: DST weekly must stop after Nov 10
const later = ics.expand(cal, new Date(2026, 10, 1), new Date(2026, 11, 1)).filter(o => o.title === 'DST weekly').map(o => fmt(o.start));
console.log('DST weekly in Nov:', later.join(', '));
check('UNTIL respected', later.join(',') === '2026-11-03 07:00,2026-11-10 07:00');

// Real UTC instant for the DST check (independent of the TV's zone)
const dstOcc = occ.filter(o => o.title === 'DST weekly').map(o => o.start.toISOString());
check('UTC instants across DST', dstOcc.join(',') === '2026-10-27T13:00:00.000Z,2026-11-03T14:00:00.000Z');

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All ICS checks passed');
