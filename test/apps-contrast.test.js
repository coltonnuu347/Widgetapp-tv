// Readability of the text that sits directly on the background of the Apps page (title, weather, clock, footer).
// Run: node test/apps-contrast.test.js
// Worst case over every theme color and every app's wash color, with the soft shading behind that text (the same strength as
// behind the Home clock) and the wash at the strength it actually has where the text is (under 8%, see below).
const fs = require('fs');
const path = require('path');
global.window = { TV: { on() {}, $() {} } }; global.setInterval = () => 0;
eval(fs.readFileSync(path.join(__dirname, '../js/themes.js'), 'utf8'));
const { CATALOG, washColor } = require('../js/appmatch.js');
const G = window.TV.GRADIENTS;
const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const W = [255, 255, 255], K = [0, 0, 0];
let failed = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' - ' + detail)); if (!ok) failed++; }

// where is the wash, and how strong? CSS: radial-gradient(ellipse 80% 70% at 50% 40%, color 0%, transparent 72%) on 1920 x 1080, layer opacity .4
const washOpacity = +/#apps-wash i\.on \{ opacity: ([\d.]+); \}/.exec(css)[1];
const rx = 0.8 * 1920, ry = 0.7 * 1080, cx = 960, cy = 0.4 * 1080;
const washAt = (x, y) => Math.max(0, 1 - Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) / 0.72) * washOpacity;
const spots = { 'title': [140, 95], 'weather chip': [1560, 95], 'clock': [1800, 95], 'footer': [960, 1040], 'title (right end)': [330, 95] };
const strongest = Math.max(...Object.values(spots).map(([x, y]) => washAt(x, y)));
check('the wash is faint where the text is (under 8%)', strongest < 0.08, 'strongest ' + strongest.toFixed(3));

const vigDark = +/--clock-vignette: rgba\(0, 0, 0, ([\d.]+)\)/.exec(css)[1], vigLight = +/--clock-vignette: rgba\(255, 255, 255, ([\d.]+)\)/.exec(css)[1];
let dark = 99, light = 99;
for (const g of G) for (const c of [g.base, ...g.blobs].map(hex)) for (const app of CATALOG) {
  const brand = hex(washColor(app));
  const bgD = mix(K, vigDark, mix(brand, strongest, mix(K, 0.42, mix(W, 0.14, c))));
  dark = Math.min(dark, ratio(W, bgD));
  const litL = mix(hex('#20359a'), 0.16, mix(W, 0.14, c));
  const bgL = mix(W, vigLight, mix(brand, strongest, mix(W, 0.45, litL)));
  light = Math.min(light, ratio(K, bgL));
}
check('white text on the Apps page background stays at 4.5:1 or better in Dark mode (worst ' + dark.toFixed(2) + ')', dark >= 4.5, dark.toFixed(2));
check('black text stays at 4.5:1 or better in Light mode (worst ' + light.toFixed(2) + ')', light >= 4.5, light.toFixed(2));
// The Edit pill is glass (same material as the round buttons on Home): its text sits on the glass, not on the bare background
const glassD = +/body\.mode-dark \{[^}]*--glass: rgba\(28, 28, 30, ([\d.]+)\)/.exec(css)[1], glassL = +/body\.mode-light \{[^}]*--glass: rgba\(255, 255, 255, ([\d.]+)\)/.exec(css)[1];
let pillD = 99, pillL = 99;
for (const g of G) for (const c of [g.base, ...g.blobs].map(hex)) {
  pillD = Math.min(pillD, ratio(W, mix([28, 28, 30], glassD, mix(W, 0.14, c))));
  pillL = Math.min(pillL, ratio(K, mix([255, 255, 255], glassL, mix(hex('#20359a'), 0.16, mix(W, 0.14, c)))));
}
check('the Edit pill text is 4.5:1 or better on the glass in Dark mode (worst ' + pillD.toFixed(2) + ')', pillD >= 4.5, pillD.toFixed(2));
check('...and in Light mode (worst ' + pillL.toFixed(2) + ')', pillL >= 4.5, pillL.toFixed(2));
check('the shading behind the title and footer exists in the stylesheet', /#apps-head::before, #apps-foot::before/.test(css), 'missing');

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All Apps page readability checks passed');
