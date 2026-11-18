// Streaming-app matching checks. Run: node test/appmatch.test.js
const m = require('../js/appmatch.js');
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
  if (!ok) failed++;
}
const TV = [
  { id: 'a1', name: 'Netflix' }, { id: 'a2', name: 'YouTube' }, { id: 'a3', name: 'YouTube Kids' }, { id: 'a4', name: 'Disney+' },
  { id: 'a5', name: 'Prime Video' }, { id: 'a6', name: 'Apple TV' }, { id: 'a7', name: 'Settings' }, { id: 'a8', name: 'Spotify - Music and Podcasts' },
  { id: 'a9', name: 'Max' }, { id: 'b1', name: 'Plex' }, { id: 'b2', name: 'Samsung TV Plus' }
];
const f = m.matchInstalled(TV);
check('finds Netflix by name', f.netflix, { id: 'a1', name: 'Netflix' });
check('YouTube is not confused with YouTube Kids', f.youtube, { id: 'a2', name: 'YouTube' });
check('Disney+ (with the plus sign)', f.disney.id, 'a4');
check('Disney Plus (spelled out) also matches', m.matchInstalled([{ id: 'x', name: 'Disney Plus' }]).disney.id, 'x');
check('Prime Video', f.prime.id, 'a5');
check('a looser name still matches (Spotify - Music and Podcasts)', f.spotify.id, 'a8');
check('Max', f.max.id, 'a9');
check('Samsung TV Plus is not Plex or anything else', Object.keys(f).sort(), ['appletv', 'disney', 'max', 'netflix', 'plex', 'prime', 'spotify', 'youtube']);
check('apps that are not installed are not matched', f.hulu, undefined);
check('an exact name beats a looser one, whatever the order', m.matchInstalled([{ id: '1', name: 'Hulu Live' }, { id: '2', name: 'Hulu' }]).hulu.id, '2');
check('the first match wins when there are two equal ones', m.matchInstalled([{ id: '1', name: 'Netflix' }, { id: '2', name: 'Netflix' }]).netflix.id, '1');
check('entries without a name or id are ignored', m.matchInstalled([{ id: '1' }, { name: 'Netflix' }, null]), {});
check('nothing installed: nothing matched', m.matchInstalled([]), {});
check('matching is not case sensitive', m.matchInstalled([{ id: '1', name: 'NETFLIX' }]).netflix.id, '1');

// resolve(): what the Apps page shows
let r = m.resolve(TV, [], {});
check('with a TV list, apps found use the TV’s own IDs', r.filter(a => a.source === 'tv').length, 8);
check('apps the TV says are missing are marked not installed', r.find(a => a.key === 'hulu').installed, false);
check('apps found are marked installed', r.find(a => a.key === 'netflix').installed, true);
check('the page leaves out apps that are not installed', m.visible(r).map(a => a.key), ['netflix', 'youtube', 'disney', 'prime', 'appletv', 'max', 'spotify', 'plex']);
r = m.resolve([], [], {});
check('when the TV reports nothing, every app is shown', m.visible(r).length, 12);
check('...using the unverified built-in ID where there is one', r.find(a => a.key === 'netflix').appId + '|' + r.find(a => a.key === 'netflix').source, '3201907018807|known');
check('...and no ID where there is none', r.find(a => a.key === 'hulu').appId + '|' + r.find(a => a.key === 'hulu').source, 'null|none');
check('...installed is unknown, not false', r.find(a => a.key === 'netflix').installed, null);
r = m.resolve([], [{ name: 'Netflix', id: 'MY.ID' }], {});
check('config.local.js overrides a built-in app’s ID', r.find(a => a.key === 'netflix').appId + '|' + r.find(a => a.key === 'netflix').source, 'MY.ID|config');
check('...and keeps its brand color', r.find(a => a.key === 'netflix').color, ['#b20710', '#5a0308']);
r = m.resolve([], [{ name: 'Crunchyroll', id: 'CR.1', color: '#f47521' }], {});
check('config.local.js can add a new app', r[r.length - 1].name + '|' + r[r.length - 1].appId + '|' + r[r.length - 1].color[0], 'Crunchyroll|CR.1|#f47521');
check('a custom app with no id is ignored', m.resolve([], [{ name: 'Nope' }], {}).length, 12);
r = m.resolve(TV, [], { order: ['plex', 'netflix'], disabled: ['youtube'] });
check('your order comes first, the rest follow in the usual order', m.visible(r).map(a => a.key).slice(0, 4), ['plex', 'netflix', 'disney', 'prime']);
check('a turned-off app is left out', m.visible(r).some(a => a.key === 'youtube'), false);
check('at most 15 tiles', m.visible(m.resolve([], Array.from({ length: 10 }, (_, i) => ({ name: 'App ' + i, id: 'id' + i })), {})).length, 15);
// text on every tile is readable: white on the lighter end of each brand gradient
const lum = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].reduce((s, v, i) => { v /= 255; v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0); };
const worst = Math.min(...m.CATALOG.map(c => 1.05 / (lum(c.color[0]) + 0.05)));
check('white app names reach 4.5:1 on every tile', worst >= 4.5, true);
console.log('(lowest contrast ' + worst.toFixed(2) + ')');

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All app-matching checks passed');
