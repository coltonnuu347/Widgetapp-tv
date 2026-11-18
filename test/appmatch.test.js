// Streaming-app matching and list checks. Run: node test/appmatch.test.js
const fs = require('fs');
const path = require('path');
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
check('Max is HBO Max', f.hbomax.id, 'a9');
check('HBO Max (full name) matches too', m.matchInstalled([{ id: 'x', name: 'HBO Max' }]).hbomax.id, 'x');
check('Samsung TV Plus and Settings match nothing', Object.keys(f).sort(), ['appletv', 'disney', 'hbomax', 'netflix', 'plex', 'prime', 'spotify', 'youtube']);
check('YouTube Music and YouTube TV are their own services', Object.keys(m.matchInstalled([{ id: '1', name: 'YouTube Music' }, { id: '2', name: 'YouTube TV' }])).sort(), ['youtubemusic', 'youtubetv']);
check('Apple Music is not Apple TV', Object.keys(m.matchInstalled([{ id: '1', name: 'Apple Music' }])), ['applemusic']);
check('apps that are not installed are not matched', f.hulu, undefined);
check('an exact name beats a looser one, whatever the order', m.matchInstalled([{ id: '1', name: 'Hulu Live' }, { id: '2', name: 'Hulu' }]).hulu.id, '2');
check('the first match wins when there are two equal ones', m.matchInstalled([{ id: '1', name: 'Netflix' }, { id: '2', name: 'Netflix' }]).netflix.id, '1');
check('entries without a name or id are ignored', m.matchInstalled([{ id: '1' }, { name: 'Netflix' }, null]), {});
check('nothing installed: nothing matched', m.matchInstalled([]), {});
check('matching is not case sensitive', m.matchInstalled([{ id: '1', name: 'NETFLIX' }]).netflix.id, '1');

// the catalog itself
const keys = m.CATALOG.map(c => c.key);
check('every service has a different key', new Set(keys).size, keys.length);
check('twelve services are on by default (three full rows of four)', m.CATALOG.filter(c => c.def).length, 12);
check('every service has a logo or a wordmark', m.CATALOG.filter(c => !c.logo && !c.word).map(c => c.key), []);
const logosSrc = fs.readFileSync(path.join(__dirname, '../js/logos.js'), 'utf8');
const logoKeys = [...logosSrc.matchAll(/^\s{4}(\w+): '/gm)].map(x => x[1]);
check('every logo a service names exists in js/logos.js', m.CATALOG.filter(c => c.logo && logoKeys.indexOf(c.logo) < 0).map(c => c.key), []);
check('every icon in js/logos.js is used by a service', logoKeys.filter(k => !m.CATALOG.some(c => c.logo === k)), []);
check('every icon is 24 x 24 path data (starts with a move command, no markup)', logoKeys.every(k => new RegExp("^\\s{4}" + k + ": '[Mm][^<>']+'", 'm').test(logosSrc)), true);
const hexOk = h => /^#[0-9a-fA-F]{6}$/.test(h);
check('every color is a 6-digit hex', m.CATALOG.filter(c => !(hexOk(c.fg) && c.bg.length === 2 && c.bg.every(hexOk))).map(c => c.key), []);

// resolve(): what the Apps page shows
let r = m.resolve(TV, [], {});
check('with a TV list, apps found use the TV’s own IDs', r.filter(a => a.source === 'tv').length, 8);
check('apps the TV says are missing are marked not installed', r.find(a => a.key === 'hulu').installed, false);
check('apps found are marked installed', r.find(a => a.key === 'netflix').installed, true);
check('the page leaves out apps that are not installed', m.visible(r).map(a => a.key), ['netflix', 'youtube', 'disney', 'prime', 'appletv', 'hbomax', 'spotify', 'plex']);
r = m.resolve([], [], {});
check('when the TV reports nothing, the twelve default apps are shown', m.visible(r).length, 12);
check('...using the unverified built-in ID where there is one', r.find(a => a.key === 'netflix').appId + '|' + r.find(a => a.key === 'netflix').source, '3201907018807|known');
check('...and no ID where there is none', r.find(a => a.key === 'hulu').appId + '|' + r.find(a => a.key === 'hulu').source, 'null|none');
check('...installed is unknown, not false', r.find(a => a.key === 'netflix').installed, null);
check('services that are off by default are listed but not shown', r.filter(a => !a.enabled).length > 0 && m.visible(r).every(a => a.def), true);
r = m.resolve([], [{ name: 'Netflix', id: 'MY.ID' }], {});
check('config.local.js overrides a built-in app’s ID', r.find(a => a.key === 'netflix').appId + '|' + r.find(a => a.key === 'netflix').source, 'MY.ID|config');
check('...and keeps its own look', r.find(a => a.key === 'netflix').bg + '|' + r.find(a => a.key === 'netflix').logo, '#1f1f1f,#050505|netflix');
r = m.resolve([], [{ name: 'Crunchyroll', id: 'CR.1', color: '#f47521' }], {});
check('config.local.js can set the ID and color of a service that was off', r.find(a => a.key === 'crunchyroll').appId + '|' + r.find(a => a.key === 'crunchyroll').bg[0], 'CR.1|#f47521');
check('...and listing it there turns it on', r.find(a => a.key === 'crunchyroll').enabled, true);
r = m.resolve([], [{ name: 'My Own App', id: 'X.1', color: '#336699' }], {});
check('config.local.js can add a new app', r[r.length - 1].name + '|' + r[r.length - 1].appId + '|' + r[r.length - 1].bg[0] + '|' + r[r.length - 1].mark, 'My Own App|X.1|#336699|M');
check('a custom app with no id is ignored', m.resolve([], [{ name: 'Nope' }], {}).length, m.CATALOG.length);
r = m.resolve(TV, [], { order: ['plex', 'netflix'], disabled: ['youtube'] });
check('your order comes first, the rest follow in the usual order', m.visible(r).map(a => a.key).slice(0, 4), ['plex', 'netflix', 'disney', 'prime']);
check('a turned-off app is left out', m.visible(r).some(a => a.key === 'youtube'), false);
r = m.resolve([], [], { enabled: ['twitch', 'kodi'], disabled: ['netflix'] });
check('a service you turn on is shown', m.visible(r).some(a => a.key === 'twitch') && m.visible(r).some(a => a.key === 'kodi'), true);
check('...and a default you turn off is not', m.visible(r).some(a => a.key === 'netflix'), false);
check('...the list is then 12 - 1 + 2', m.visible(r).length, 13);
check('an app can be on but not installed: then it is not shown', m.visible(m.resolve(TV, [], { enabled: ['twitch'] })).some(a => a.key === 'twitch'), false);
check('there is no cap on the number of tiles', m.visible(m.resolve([], Array.from({ length: 10 }, (_, i) => ({ name: 'App ' + i, id: 'id' + i })), {})).length, 22);
check('keys saved by the earlier version still work (max -> hbomax)', m.visible(m.resolve([], [], { disabled: ['max'] })).some(a => a.key === 'hbomax'), false);
// apps you add from the TV
r = m.resolve(TV, [], { custom: [{ name: 'Samsung TV Plus', id: 'b2' }, { name: 'Gallery', id: 'g1' }] });
check('an app added from the TV gets a tile of its own', r.filter(a => a.source === 'user').map(a => a.name + '|' + a.appId + '|' + a.removable + '|' + a.mark), ['Samsung TV Plus|b2|true|S', 'Gallery|g1|true|G']);
check('...it is on, and can be removed', m.visible(r).some(a => a.name === 'Gallery') && r.find(a => a.name === 'Gallery').key === 'u_gallery', true);
check('an app already listed under the same TV id is not added twice', m.resolve(TV, [], { custom: [{ name: 'Netflix again', id: 'a1' }] }).filter(a => a.appId === 'a1').length, 1);
check('built-in services cannot be removed, only turned off', m.resolve(TV, [], {}).some(a => a.removable), false);
// what the editor offers from the TV
check('apps on the TV that have no tile yet can be added', m.unmatched(TV, m.resolve(TV, [], {})).map(a => a.name), ['YouTube Kids', 'Settings', 'Samsung TV Plus']);
check('...an app that was added no longer shows there', m.unmatched(TV, m.resolve(TV, [], { custom: [{ name: 'Settings', id: 'a7' }] })).map(a => a.name), ['YouTube Kids', 'Samsung TV Plus']);
check('slug', m.slug('Samsung TV Plus!'), 'samsungtvplus');

// the color the page washes the background with
const byKey = k => m.CATALOG.find(c => c.key === k);
check('wash: a grey tile with a colored logo gives the logo color (Netflix)', m.washColor(byKey('netflix')), '#E50914');
check('wash: a colored tile with a white logo gives the tile color (Disney+)', m.washColor(byKey('disney')), '#1f4fe0');

// readability. The name under a logo is white text (large: 26 px bold), checked in the lightest place the tile has (the top, with
// its sheen) so it holds everywhere. The logo itself is a graphic: 3:1 against both ends of the tile's gradient.
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const lighten = (c, a) => c.map(v => v * (1 - a) + 255 * a);
const W = [255, 255, 255];
let wName = 99, nameKey = '', wLogo = 99, logoKey = '';
m.CATALOG.forEach(c => {
  const n = ratio(W, lighten(hex(c.bg[0]), 0.15)); if (n < wName) { wName = n; nameKey = c.key; }
  [hex(c.bg[0]), hex(c.bg[1])].forEach(bg => { const x = ratio(hex(c.fg), bg); if (x < wLogo) { wLogo = x; logoKey = c.key; } });
});
check('the white name is at least 3:1 on every tile (large text; worst ' + wName.toFixed(2) + ', ' + nameKey + ')', wName >= 3 ? true : wName.toFixed(2), true);
check('every logo is at least 3:1 against its tile (worst ' + wLogo.toFixed(2) + ', ' + logoKey + ')', wLogo >= 3 ? true : wLogo.toFixed(2), true);
const prime = byKey('prime');
check('the "prime" accent word is at least 3:1 on its tile (' + ratio(hex(prime.word.accent), lighten(hex(prime.bg[0]), 0.15)).toFixed(2) + ')', ratio(hex(prime.word.accent), lighten(hex(prime.bg[0]), 0.15)) >= 3, true);

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All app-matching checks passed');
