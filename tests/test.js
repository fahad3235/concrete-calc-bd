// Concrete Calculator BD - node unit tests. Run: node tests/test.js
'use strict';
const C = require('../js/logic.js');
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('ok - ' + name); }
  else { failed++; console.log('FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function close(a, b, tol) { return Math.abs(a - b) <= (tol || 0.011); }
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }

// Volumes
check('slab 10x12x0.5 ft = 1.699 m3', close(C.volumeM3('slab', [10, 12, 0.5], 'ft'), 1.69901, 0.001));
check('rectCol 1x1x10 ft = 0.28317 m3', close(C.volumeM3('rectCol', [1, 1, 10], 'ft'), 0.28317, 0.001));
check('circCol D2 H10 ft = 0.8896 m3', close(C.volumeM3('circCol', [2, 10], 'ft'), 0.8896, 0.001));
check('beam 5x0.3x0.5 m = 0.75 m3', C.volumeM3('beam', [5, 0.3, 0.5], 'm') === 0.75);
check('footing 2x2x0.5 m = 2 m3', C.volumeM3('footing', [2, 2, 0.5], 'm') === 2);
check('volume rejects zero dim', throws(() => C.volumeM3('slab', [10, 0, 0.5], 'ft')));
check('volume rejects negative dim', throws(() => C.volumeM3('slab', [10, -1, 0.5], 'ft')));
check('volume rejects wrong dim count', throws(() => C.volumeM3('circCol', [2, 10, 5], 'ft')));
check('volume rejects bad element', throws(() => C.volumeM3('wall', [1, 1, 1], 'm')));

// Mixes
check('M15 parts 1:2:4', JSON.stringify(C.mixParts('M15')) === JSON.stringify({ c: 1, s: 2, a: 4 }));
check('M10 parts 1:3:6', C.mixParts('M10').a === 6);
check('M25 parts 1:1:2', C.mixParts('M25').s === 1);
check('custom parts kept', C.mixParts('custom', { c: 1, s: 1.5, a: 3 }).s === 1.5);
check('custom rejects zero part', throws(() => C.mixParts('custom', { c: 0, s: 2, a: 4 })));
check('bad mix rejected', throws(() => C.mixParts('M30')));

// Materials: 1 m3, M15, qty 1, wastage 0
const m15 = C.materials(1, { c: 1, s: 2, a: 4 }, 1, 0);
check('M15 1m3 dry = 1.54', m15.dryM3 === 1.54);
check('M15 1m3 cement = 316.8 kg', m15.cementKg === 316.8, 'got ' + m15.cementKg);
check('M15 1m3 bagsExact = 6.34', m15.bagsExact === 6.34, 'got ' + m15.bagsExact);
check('M15 1m3 bagsWhole = 7', m15.bagsWhole === 7);
check('M15 1m3 sand = 0.44 m3 / 15.54 ft3', m15.sandM3 === 0.44 && m15.sandFt3 === 15.54, 'got ' + m15.sandM3 + '/' + m15.sandFt3);
check('M15 1m3 agg = 0.88 m3 / 31.08 ft3', m15.aggM3 === 0.88 && m15.aggFt3 === 31.08, 'got ' + m15.aggM3 + '/' + m15.aggFt3);
check('M15 1m3 wetFt3 = 35.31', m15.wetFt3 === 35.31);
const m10 = C.materials(1, { c: 1, s: 3, a: 6 }, 1, 0);
check('M10 1m3 bagsExact = 4.44 / whole 5', m10.bagsExact === 4.44 && m10.bagsWhole === 5, 'got ' + m10.bagsExact);
const m15w = C.materials(1, { c: 1, s: 2, a: 4 }, 1, 10);
check('M15 1m3 +10% wastage bagsExact = 6.97', m15w.bagsExact === 6.97, 'got ' + m15w.bagsExact);
const m15q = C.materials(1, { c: 1, s: 2, a: 4 }, 2, 0);
check('qty 2 doubles volume, bagsWhole = ceil(12.67) = 13', m15q.bagsWhole === 13 && m15q.wetM3 === 2);
check('materials rejects qty 0', throws(() => C.materials(1, { c: 1, s: 2, a: 4 }, 0, 0)));
check('materials rejects wastage 51', throws(() => C.materials(1, { c: 1, s: 2, a: 4 }, 1, 51)));

// Cost (integer paisa, whole bags + displayed ft3)
const cost = C.costPaisa(m15, { bag: 550, sand: 60, agg: 55 });
check('cost total = 6491.80 BDT', cost && cost.totalPaisa === 649180 && cost.totalBDT === 6491.8, 'got ' + JSON.stringify(cost));
check('cost null with no prices', C.costPaisa(m15, { bag: '', sand: '', agg: '' }) === null);
check('cost partial (bags only)', C.costPaisa(m15, { bag: 550, sand: '', agg: '' }).totalPaisa === 7 * 55000);
check('cost rejects negative price', throws(() => C.costPaisa(m15, { bag: -5, sand: '', agg: '' })));

// Formatting + digits
check('fmt thousands', C.fmt(10538, 2) === '10,538.00', 'got ' + C.fmt(10538, 2));
check('toBnDigits 123', C.toBnDigits('123') === '\u09e7\u09e8\u09e9');

// Import validation
const good = { app: 'concrete-calc-bd', version: 1, items: [
  { element: 'slab', dims: [10, 12, 0.5], unit: 'ft', qty: 1, mix: 'M15', custom: null, wastage: 5, mat: m15, cost: null }
]};
check('validateImport accepts good file', C.validateImport(good) === true);
check('validateImport rejects wrong app', C.validateImport({ app: 'other', version: 1, items: [] }) === false);
check('validateImport rejects bad element', C.validateImport({ app: 'concrete-calc-bd', version: 1, items: [
  { element: 'wall', dims: [1, 1, 1], unit: 'm', qty: 1, mix: 'M15', custom: null, wastage: 0, mat: m15, cost: null }] }) === false);
check('validateImport rejects qty 0', C.validateImport({ app: 'concrete-calc-bd', version: 1, items: [
  { element: 'slab', dims: [10, 12, 0.5], unit: 'ft', qty: 0, mix: 'M15', custom: null, wastage: 0, mat: m15, cost: null }] }) === false);

// Totals
const tot = C.totals([good.items[0], good.items[0]]);
check('totals double bagsWhole', tot.bagsWhole === 14 && tot.wetM3 === 2);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
