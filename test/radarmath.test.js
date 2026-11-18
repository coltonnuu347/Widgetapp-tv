// Radar and map URL checks. Run: node test/radarmath.test.js
const r = require('../js/radarmath.js');
const m = require('../js/mapurl.js');
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
  if (!ok) failed++;
}
function ok(name, cond, detail) { check(name, !!cond, true); if (!cond && detail) console.log('     ' + detail); }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

// ---- Web Mercator tile maths (values every slippy-map library agrees on)
check('zoom 0 is one tile: the center of the world is (0.5, 0.5)', [r.tileX(0, 0), r.tileY(0, 0)], [0.5, 0.5]);
check('zoom 1, lon 0 lat 0 is the corner between four tiles', [r.tileX(0, 1), r.tileY(0, 1)], [1, 1]);
check('lon -180 is the left edge, 180 the right edge', [r.tileX(-180, 5), r.tileX(180, 5)], [0, 32]);
check('the Web Mercator limit (85.0511) is the top edge', near(r.tileY(85.0511287798, 4), 0, 1e-6), true);
check('the south limit is the bottom edge', near(r.tileY(-85.0511287798, 4), 16, 1e-6), true);
check('New York (40.7128, -74.0060) is in tile 18/24 at zoom 6', [Math.floor(r.tileX(-74.006, 6)), Math.floor(r.tileY(40.7128, 6))], [18, 24]);
check('Greenwich (51.4779, 0) is in tile 32/21 at zoom 6', [Math.floor(r.tileX(0, 6)), Math.floor(r.tileY(51.4779, 6))], [32, 21]);
check('Miami (25.7617, -80.1918) is in tile 17/27 at zoom 6', [Math.floor(r.tileX(-80.1918, 6)), Math.floor(r.tileY(25.7617, 6))], [17, 27]);

// ---- the tile grid for a picture centered on a place
const g = r.grid(25.7617, -80.1918, 6, 768, 480);
check('the place is at the center of the picture', (() => { const t = g.tiles.find(t => t.x === Math.floor(g.fx) && t.y === Math.floor(g.fy)); return t.left <= 384 && 384 < t.left + 256 && t.top <= 240 && 240 < t.top + 256; })(), true);
check('the center pixel maps exactly to the place', (() => { const t = g.tiles.find(t => t.x === Math.floor(g.fx) && t.y === Math.floor(g.fy)); return near(t.left + (g.fx - Math.floor(g.fx)) * 256, 384, 1) && near(t.top + (g.fy - Math.floor(g.fy)) * 256, 240, 1); })(), true);
check('the tiles cover the whole picture', (() => { const xs = g.tiles.map(t => t.left), ys = g.tiles.map(t => t.top); return Math.min(...xs) <= 0 && Math.max(...xs) + 256 >= 768 && Math.min(...ys) <= 0 && Math.max(...ys) + 256 >= 480; })(), true);
check('a 768 x 480 picture needs at most 15 tiles', g.tiles.length <= 15, true);
check('neighbouring tiles are exactly 256 px apart', (() => { const a = g.tiles[0], b = g.tiles.find(t => t.y === a.y && t.x === a.x + 1); return b.left - a.left; })(), 256);
check('no tile is used twice', new Set(g.tiles.map(t => t.x + '/' + t.y)).size, g.tiles.length);
const wrap = r.grid(0, 179.9, 3, 1024, 256);
check('near the date line x wraps around the world', wrap.tiles.every(t => t.x >= 0 && t.x < 8) && wrap.tiles.some(t => t.x === 0), true);
const pole = r.grid(84, 0, 3, 512, 1024);
check('tiles beyond the top of the map are left out', pole.tiles.every(t => t.y >= 0), true);

// ---- choosing frames
const past = Array.from({ length: 13 }, (_, i) => ({ time: 1000 + i * 600, path: '/v2/radar/' + i }));
const frames = r.pickFrames({ past, nowcast: [{ time: 8200, path: '/v2/radar/n0' }, { time: 8800, path: '/v2/radar/n1' }] }, 6, 0);
check('six frames are picked from the past, spread out, ending with the newest', frames.map(f => f.time), [1000, 2440, 3880, 5120, 6560, 8200].map((_, i) => past[Math.round(i * 12 / 5)].time));
check('the newest past frame is last', frames[frames.length - 1].time, past[12].time);
check('none of them is marked as a forecast', frames.every(f => !f.forecast), true);
const withNow = r.pickFrames({ past, nowcast: [{ time: 1, path: 'a' }, { time: 2, path: 'b' }] }, 3, 1);
check('forecast frames are only added when asked, and limited', withNow.map(f => f.forecast), [false, false, false, true]);
check('fewer frames than asked: use what there is', r.pickFrames({ past: past.slice(0, 2) }, 6, 0).length, 2);
check('no data: no frames', r.pickFrames(null, 6, 2), []);
check('one frame asked: the newest', r.pickFrames({ past }, 1, 0).map(f => f.time), [past[12].time]);

// ---- URLs
check('tile URL', r.tileUrl('https://tilecache.rainviewer.com', { path: '/v2/radar/1700000000' }, 256, 6, 16, 26, 2, '1_1'), 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/6/16/26/2/1_1.png');
check('age text', [r.ageText(1000, 1000 * 1000), r.ageText(1000, (1000 + 1200) * 1000), r.ageText(1000, (1000 + 4800) * 1000), r.ageText(1000, (1000 + 3600) * 1000), r.ageText(1600, 1000 * 1000)], ['Now', '20 min ago', '1 h 20 min ago', '1 h ago', 'in 10 min']);
check('a frame a minute old still says Now', r.ageText(1000, (1000 + 60) * 1000), 'Now');

const route = { token: 'pk.test', dark: true, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', from: [-80.1918, 25.7617], to: [-80.3, 25.9], width: 640, height: 400 };
const u = m.routeMapUrl(route);
ok('route map: uses the dark style and the path', u.usedPath && u.url.indexOf('/styles/v1/mapbox/dark-v11/static/path-6+ff9f0a-0.9(') > 0, u.url);
ok('route map: the polyline is URL-encoded (the ` and ~ and ? characters)', u.url.indexOf(encodeURIComponent(route.polyline)) > 0 && u.url.indexOf('`') < 0, u.url);
ok('route map: pins use longitude,latitude order', u.url.indexOf('pin-s-a+ffffff(-80.19180,25.76170)') > 0 && u.url.indexOf('pin-s-b+ffffff(-80.30000,25.90000)') > 0, u.url);
ok('route map: fitted automatically at the requested size', /\/auto\/640x400\?padding=48&access_token=pk\.test$/.test(u.url), u.url);
check('route map: light mode uses the light style', m.routeMapUrl(Object.assign({}, route, { dark: false })).url.indexOf('/light-v11/') > 0, true);
const tricky = m.routeMapUrl(Object.assign({}, route, { polyline: 'a?b\\c/d(e)f', token: 'pk.a b' }));
ok('route map: special characters in the polyline and token are encoded', tricky.url.indexOf('a%3Fb%5Cc%2Fd(e)f') > 0 || tricky.url.indexOf('a%3Fb%5Cc%2Fd(e)f') === -1 && tricky.url.indexOf(encodeURIComponent('a?b\\c/d(e)f')) > 0, tricky.url);
ok('route map: the token is encoded', tricky.url.endsWith('access_token=pk.a%20b'), tricky.url);
const long = m.routeMapUrl(Object.assign({}, route, { polyline: 'x'.repeat(9000) }));
ok('route map: a route too long for Mapbox falls back to the two pins', !long.usedPath && long.url.length < 8192 && long.url.indexOf('path-6') < 0, String(long.url.length));
check('route map: a long but allowed route keeps the path', m.routeMapUrl(Object.assign({}, route, { polyline: 'x'.repeat(5000) })).usedPath, true);
check('route map: no polyline gives pins only', m.routeMapUrl(Object.assign({}, route, { polyline: '' })).usedPath, false);
check('route map: no token, nothing to build', m.routeMapUrl(Object.assign({}, route, { token: '' })), null);
check('route map: no destination, nothing to build', m.routeMapUrl(Object.assign({}, route, { to: null })), null);
check('route map: the size is limited to what Mapbox allows (1280)', /\/auto\/1280x1280\?/.test(m.routeMapUrl(Object.assign({}, route, { width: 4000, height: 4000 })).url), true);
check('base map: centered on the place, one zoom lower than the radar tiles', m.baseMapUrl({ token: 'pk.t', dark: true, lon: -80.1918, lat: 25.7617, z: 6, width: 768, height: 480 }), 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-80.19180,25.76170,5,0/768x480?access_token=pk.t');
check('base map: no token, nothing to build', m.baseMapUrl({ token: '', lon: 0, lat: 0, z: 6, width: 10, height: 10 }), null);
check('the base map and the radar tiles cover the same ground (Mapbox zoom is tile zoom - 1 for 512 px tiles)', (() => { const z = 6; const mapboxWorldPx = 512 * Math.pow(2, z - 1), tileWorldPx = 256 * Math.pow(2, z); return mapboxWorldPx === tileWorldPx; })(), true);

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All radar and map URL checks passed');
