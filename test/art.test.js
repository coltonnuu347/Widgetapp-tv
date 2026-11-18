// Readability check for the built-in artwork in Dark mode.
// Run (with the app served, see README): node test/art.test.js
// For every artwork it takes the real colors of the picture (48 px cells, about the size the glass blurs over),
// applies that artwork's own Dark-mode scrim from js/art.js, and runs the same worst-case model as the theme check
// (all 23 themes' tints, the ambient lights, the glass highlight): card text must stay at 4.5:1 or better, and the
// clock, date and the line under it at 3:1 (they sit on the bare background, top left).
// Light mode always uses the normal white layer, whose worst case is the darkest theme color; these pictures are no darker.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';

const P = { td: 0.14, t3d: 0.80, t2d: 0.86, orb: 0.14, sheen: 0.09, cd: 0.84, vig: 0.30, clockGlow: 0.45 };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const W = [255, 255, 255], K = [0, 0, 0];
const COLS = 40, CELL = 48;
const inHero = n => (n % COLS) * CELL < 760 && Math.floor(n / COLS) * CELL < 300;   // clock, date, the line under it

let failed = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' - ' + detail)); if (!ok) failed++; }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(BASE + '?demo=1');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ themes: TV.GRADIENTS.map(g => ({ tint: g.tint, glow: g.glow, tintDark: g.tintDark || null })), art: TV.ART.map(a => ({ id: a.id, scrim: a.scrim })) }));
  const tintFor = g => g.tintDark || P.td;
  for (const a of info.art) {
    await page.evaluate(id => { document.body.innerHTML = '<div style="position:fixed;left:0;top:0;width:1920px;height:1080px;background:url(' + TV.artUrl(TV.artById(id)) + ') center/cover"></div>'; }, a.id);
    await page.waitForTimeout(250);
    const png = PNG.sync.read(await page.screenshot());
    const cells = [];
    for (let cy = 0; cy < 1080 / CELL; cy++) for (let cx = 0; cx < COLS; cx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = cy * CELL; y < Math.min(1080, (cy + 1) * CELL); y++) for (let x = cx * CELL; x < (cx + 1) * CELL; x++) { const i = (y * 1920 + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++; }
      cells.push([r / n, g / n, b / n]);
    }
    let t1 = 99, t2 = 99, t3 = 99, clock = 99;
    cells.forEach((c, n) => {
      const bg = mix(K, a.scrim, mix(W, P.orb, c));
      for (const g of info.themes) {
        if (inHero(n)) { clock = Math.min(clock, ratio(mix(hex(g.glow), P.clockGlow, W), mix(K, P.vig, bg))); continue; }
        let card = mix([28, 28, 30], P.cd, bg); card = mix(hex(g.tint), tintFor(g), card); card = mix(W, P.sheen, card);
        t1 = Math.min(t1, ratio(W, card));
        t2 = Math.min(t2, ratio(mix([235, 235, 245], P.t2d, card), card));
        t3 = Math.min(t3, ratio(mix([235, 235, 245], P.t3d, card), card));
      }
    });
    const detail = 'scrim ' + a.scrim + ': text ' + t1.toFixed(2) + ', secondary ' + t2.toFixed(2) + ', faintest ' + t3.toFixed(2) + ', clock ' + clock.toFixed(2);
    check(a.id + ' is readable in Dark mode (' + detail + ')', t1 >= 4.5 && t2 >= 4.5 && t3 >= 4.5 && clock >= 3, detail);
  }
  await browser.close();
  if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
  console.log('All artwork readability checks passed');
})();
