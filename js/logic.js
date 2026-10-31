// Concrete Calculator BD - pure logic (no DOM). Shared by the app and node tests.
'use strict';
(function (root) {
  var FT_TO_M = 0.3048;
  var M3_TO_FT3 = 35.3146667;
  var DRY_FACTOR = 1.54;
  var CEMENT_DENSITY = 1440; // kg per m3
  var BAG_KG = 50;

  var MIXES = {
    M10: { c: 1, s: 3, a: 6, label: 'M10 (1 : 3 : 6)' },
    M15: { c: 1, s: 2, a: 4, label: 'M15 (1 : 2 : 4)' },
    M20: { c: 1, s: 1.5, a: 3, label: 'M20 (1 : 1.5 : 3)' },
    M25: { c: 1, s: 1, a: 2, label: 'M25 (1 : 1 : 2)' }
  };

  // Dimension specs per element: [key, ...] in input order.
  var DIMS = {
    slab: ['length', 'width', 'thickness'],
    rectCol: ['length', 'width', 'height'],
    circCol: ['diameter', 'height'],
    beam: ['length', 'width', 'depth'],
    footing: ['length', 'width', 'thickness']
  };

  function round2(n) { return Math.round(n * 100) / 100; }

  function toM(value, unit) {
    if (unit === 'ft') return value * FT_TO_M;
    if (unit === 'm') return value;
    throw new Error('bad unit');
  }

  // dims: array of numbers in the element's input order, in the chosen unit.
  // Returns wet volume in m3. Throws on non-positive dims.
  function volumeM3(element, dims, unit) {
    var need = DIMS[element];
    if (!need) throw new Error('bad element');
    if (!dims || dims.length !== need.length) throw new Error('bad dims');
    var m = dims.map(function (d) {
      if (!(d > 0) || !isFinite(d)) throw new Error('dims must be positive numbers');
      return toM(d, unit);
    });
    var v;
    if (element === 'circCol') {
      var r = m[0] / 2;
      v = Math.PI * r * r * m[1];
    } else {
      v = m[0] * m[1] * m[2];
    }
    return v;
  }

  function mixParts(mixKey, custom) {
    if (mixKey === 'custom') {
      if (!custom) throw new Error('custom ratio required');
      var c = custom.c, s = custom.s, a = custom.a;
      if (!(c > 0) || !(s > 0) || !(a > 0) || !isFinite(c + s + a)) throw new Error('ratio parts must be positive');
      return { c: c, s: s, a: a };
    }
    var p = MIXES[mixKey];
    if (!p) throw new Error('bad mix');
    return { c: p.c, s: p.s, a: p.a };
  }

  // volM3: wet volume for ONE element. qty multiplies at the end.
  // Returns quantities for the full (qty x) amount.
  function materials(volM3, parts, qty, wastagePct) {
    if (!(volM3 > 0) || !isFinite(volM3)) throw new Error('volume must be positive');
    if (!(qty >= 1) || Math.floor(qty) !== qty) throw new Error('qty must be a positive integer');
    if (!(wastagePct >= 0) || wastagePct > 50) throw new Error('wastage must be 0-50');
    var sum = parts.c + parts.s + parts.a;
    var wet = volM3 * qty;
    var dry = wet * DRY_FACTOR * (1 + wastagePct / 100);
    var cementM3 = dry * parts.c / sum;
    var cementKg = cementM3 * CEMENT_DENSITY;
    var bagsExact = cementKg / BAG_KG;
    var sandM3 = dry * parts.s / sum;
    var aggM3 = dry * parts.a / sum;
    return {
      wetM3: round2(wet), wetFt3: round2(wet * M3_TO_FT3),
      dryM3: round2(dry),
      cementKg: round2(cementKg), bagsExact: round2(bagsExact),
      bagsWhole: Math.ceil(bagsExact - 1e-9),
      sandM3: round2(sandM3), sandFt3: round2(sandM3 * M3_TO_FT3),
      aggM3: round2(aggM3), aggFt3: round2(aggM3 * M3_TO_FT3)
    };
  }

  // Cost in integer paisa. Uses whole bags + displayed (2dp) ft3 quantities.
  // prices: { bag, sand, agg } in BDT, each optional (null/undefined/'' = skip).
  // Returns { totalPaisa, totalBDT, parts } or null when no price is given.
  function costPaisa(mat, prices) {
    function toPaisa(bdt) {
      if (bdt === null || bdt === undefined || bdt === '') return null;
      var n = Number(bdt);
      if (!(n >= 0) || !isFinite(n)) throw new Error('prices must be non-negative');
      return Math.round(n * 100);
    }
    var pb = toPaisa(prices.bag), ps = toPaisa(prices.sand), pa = toPaisa(prices.agg);
    if (pb === null && ps === null && pa === null) return null;
    var bagP = pb === null ? 0 : mat.bagsWhole * pb;
    var sandP = ps === null ? 0 : Math.round(mat.sandFt3 * ps);
    var aggP = pa === null ? 0 : Math.round(mat.aggFt3 * pa);
    var total = bagP + sandP + aggP;
    return { totalPaisa: total, totalBDT: round2(total / 100), bagPaisa: bagP, sandPaisa: sandP, aggPaisa: aggP };
  }

  function fmt(n, dp) {
    var s = Number(n).toFixed(dp === undefined ? 2 : dp);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function toBnDigits(str) {
    return String(str).replace(/[0-9]/g, function (d) { return BN_DIGITS[Number(d)]; });
  }

  function validateItem(it) {
    if (!it || typeof it !== 'object') return false;
    var els = Object.keys(DIMS);
    if (els.indexOf(it.element) === -1) return false;
    if (!it.dims || it.dims.length !== DIMS[it.element].length) return false;
    if (!it.dims.every(function (d) { return d > 0 && isFinite(d); })) return false;
    if (it.unit !== 'ft' && it.unit !== 'm') return false;
    if (!(it.qty >= 1) || Math.floor(it.qty) !== it.qty) return false;
    if (it.mix !== 'custom' && !MIXES[it.mix]) return false;
    if (it.mix === 'custom') {
      if (!it.custom || !(it.custom.c > 0) || !(it.custom.s > 0) || !(it.custom.a > 0)) return false;
    }
    if (!(it.wastage >= 0) || it.wastage > 50) return false;
    if (!it.mat || typeof it.mat !== 'object') return false;
    if (!(it.mat.wetM3 > 0) || !(it.mat.bagsWhole >= 0)) return false;
    return true;
  }

  function validateImport(data) {
    if (!data || data.app !== 'concrete-calc-bd' || data.version !== 1) return false;
    if (!Array.isArray(data.items)) return false;
    if (data.items.length > 200) return false;
    return data.items.every(validateItem);
  }

  function totals(items) {
    var t = { wetM3: 0, bagsWhole: 0, bagsExact: 0, sandFt3: 0, aggFt3: 0, costPaisa: 0, hasCost: false };
    items.forEach(function (it) {
      t.wetM3 += it.mat.wetM3;
      t.bagsWhole += it.mat.bagsWhole;
      t.bagsExact += it.mat.bagsExact;
      t.sandFt3 += it.mat.sandFt3;
      t.aggFt3 += it.mat.aggFt3;
      if (it.cost) { t.costPaisa += it.cost.totalPaisa; t.hasCost = true; }
    });
    t.wetM3 = round2(t.wetM3);
    t.bagsExact = round2(t.bagsExact);
    t.sandFt3 = round2(t.sandFt3);
    t.aggFt3 = round2(t.aggFt3);
    return t;
  }

  var api = {
    FT_TO_M: FT_TO_M, M3_TO_FT3: M3_TO_FT3, DRY_FACTOR: DRY_FACTOR,
    CEMENT_DENSITY: CEMENT_DENSITY, BAG_KG: BAG_KG, MIXES: MIXES, DIMS: DIMS,
    round2: round2, toM: toM, volumeM3: volumeM3, mixParts: mixParts,
    materials: materials, costPaisa: costPaisa, fmt: fmt,
    toBnDigits: toBnDigits, validateItem: validateItem,
    validateImport: validateImport, totals: totals
  };
  root.Concrete = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
