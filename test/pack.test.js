// Run with: node test/pack.test.js
const { pack } = require('../js/pack.js');

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)));
  if (!ok) failed++;
};
// Describe a result as text: pages separated by " | ", rows by " / ", tiles as id or id(span)
const items = (spec) => spec.split(' ').map(s => { const m = /^(\w+)(?:\((\d)\))?$/.exec(s); return { id: m[1], span: m[2] ? +m[2] : 1 }; });
const show = r => r.pages.map(p => p.map(row => row.map(c => c.item.id + (c.span > 1 ? '(' + c.span + ')' : '')).join(' ')).join(' / ')).join(' | ');
const COMPACT = [3, 2], LARGE = [3, 1], MEDIUM = [2, 2];
const run = (spec, g) => pack(items(spec), g[0], g[1]);

check('nothing to show', pack([], 3, 2), { dense: false, pages: [[[]]] });
check('one tile fills the row', show(run('a', COMPACT)), 'a');
check('three singles stay in one row', show(run('a b c', COMPACT)), 'a b c');
check('three singles are not dense', run('a b c', COMPACT).dense, false);
check('four singles split evenly, 2 + 2', show(run('a b c d', COMPACT)), 'a b / c d');
check('four singles are dense', run('a b c d', COMPACT).dense, true);
check('five singles: 3 + 2', show(run('a b c d e', COMPACT)), 'a b c / d e');
check('six singles: 3 + 3', show(run('a b c d e f', COMPACT)), 'a b c / d e f');
check('seven singles: two screens', show(run('a b c d e f g', COMPACT)), 'a b c / d e f | g');

check('wide tile + one single fit one row', show(run('a s(2)', COMPACT)), 'a s(2)');
check('wide tile + one single: not dense', run('a s(2)', COMPACT).dense, false);
check('wide first', show(run('s(2) a', COMPACT)), 's(2) a');
check('wide tile + two singles: wide gets its own row', show(run('a b s(2)', COMPACT)), 'a b / s(2)');
check('wide tile first + two singles', show(run('s(2) a b', COMPACT)), 's(2) / a b');
check('wide tile in the middle keeps the order: [a s] then [b]', show(run('a s(2) b', COMPACT)), 'a s(2) / b');
check('wide tile alone fills the row', show(run('s(2)', COMPACT)), 's(2)');
check('wide tile is capped at the number of columns', show(pack([{ id: 's', span: 2 }], 2, 2)), 's(2)');
check('wide tile in a 2-column grid takes a whole row (3 rows = 2 screens)', show(run('a s(2) b', MEDIUM)), 'a / s(2) | b');
check('medium grid: two singles share a row', show(run('a b', MEDIUM)), 'a b');
check('medium grid: three singles are dense, 2 + 1 -> 2 + 1', show(run('a b c', MEDIUM)), 'a b / c');

check('large grid: one row per screen, up to 3 tiles', show(run('a b c', LARGE)), 'a b c');
check('large grid: four tiles rotate in two screens', show(run('a b c d', LARGE)), 'a b | c d');
check('large grid is never dense', run('a b c d e f', LARGE).dense, false);
check('large grid: wide tile and one single', show(run('a s(2)', LARGE)), 'a s(2)');
check('large grid: wide + two singles rotate', show(run('a b s(2)', LARGE)), 'a b | s(2)');

// every tile appears exactly once, in order
const all = 'a b c d e f g h i';
const flat = r => [].concat(...[].concat(...r.pages)).map(c => c.item.id).join(' ');
for (const g of [COMPACT, LARGE, MEDIUM]) {
  check('keeps every tile, in order (' + g + ')', flat(run(all, g)), all);
  check('keeps every tile with a wide one (' + g + ')', flat(run('a b s(2) c d', g)), 'a b s c d');
}
// no row is ever wider than the grid
const wide = pack(items('a b s(2) c d s2(2) e'), 3, 2);
check('no row exceeds 3 columns', wide.pages.every(p => p.every(row => row.reduce((s, c) => s + c.span, 0) <= 3)), true);

if (failed) { console.log(failed + ' FAILED'); process.exit(1); }
console.log('All tile-packing checks passed');
