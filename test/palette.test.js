// Album-art palette checks. Run: node test/palette.test.js
const p = require('../js/palette.js');
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
  if (!ok) failed++;
}
function img(n, fn) { const d = new Uint8ClampedArray(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = fn(x, y), i = (y * n + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return d; }
const MAX = 0.86;

check('grey art keeps the theme', p.albumPalette(img(16, () => [128, 128, 128]), 16, MAX), null);
check('black art keeps the theme', p.albumPalette(img(16, () => [5, 5, 5]), 16, MAX), null);
check('white art keeps the theme', p.albumPalette(img(16, () => [250, 250, 250]), 16, MAX), null);
const red = p.albumPalette(img(16, () => [200, 30, 30]), 16, MAX);
check('red art gives red colors', red && red.colors.every(c => parseInt(c.slice(1, 3), 16) > parseInt(c.slice(3, 5), 16) * 2), true);
check('four colors and a base', red && red.colors.length === 4 && /^#[0-9a-f]{6}$/.test(red.base), true);
check('hue of red art', red && (red.hue < 10 || red.hue > 350), true);
// quadrants: top-left red, top-right blue, bottom-left green, bottom-right yellow
const quad = p.albumPalette(img(16, (x, y) => y < 8 ? (x < 8 ? [220, 30, 30] : [30, 30, 220]) : (x < 8 ? [30, 200, 40] : [230, 210, 30])), 16, MAX);
const ch = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
check('top-left is reddish', ch(quad.colors[0], 0) > ch(quad.colors[0], 2) + 30, true);
check('top-right is bluish', ch(quad.colors[1], 2) > ch(quad.colors[1], 0) + 30, true);
check('bottom-left is greenish', ch(quad.colors[2], 1) > ch(quad.colors[2], 0) + 30, true);
// every color stays within the brightness the themes use, whatever the art
let worst = 0;
for (let hue = 0; hue < 360; hue += 7) for (const light of [90, 160, 220, 255]) {
  const c = p.albumPalette(img(16, () => [light, Math.round(light * ((hue % 120) / 120)), Math.round(light * (1 - (hue % 120) / 120) * 0.5)]), 16, MAX);
  if (c) c.colors.forEach(x => { worst = Math.max(worst, p.lum(x)); });
}
check('no color is brighter than the cap', worst <= MAX + 1e-9, true);
check('capLum darkens a too-bright color', p.lum(p.capLum('#ffffff', 0.5)) <= 0.5, true);
check('capLum leaves a dark color alone', p.capLum('#102030', 0.5), '#102030');

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All palette checks passed');
