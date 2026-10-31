# TEST RESULTS — concrete-calc-bd

Run date: 2026-10-31. All numbers below are real outputs of the test runs.

## Unit tests: 38/38 passed (`node tests/test.js`)

- Volumes: slab 10x12x0.5 ft = 1.699 m3; rect column 1x1x10 ft = 0.28317 m3;
  circular column D2 x H10 ft = 0.8896 m3; beam 5x0.3x0.5 m = 0.75 m3;
  footing 2x2x0.5 m = 2 m3. Zero/negative/wrong-count dims and bad elements rejected.
- Mixes: M10 1:3:6, M15 1:2:4, M25 1:1:2, custom kept; zero custom part and M30 rejected.
- Materials for 1 m3 M15, qty 1, wastage 0: dry 1.54 m3, cement 316.8 kg,
  bagsExact 6.34, bagsWhole 7, sand 0.44 m3 / 15.54 ft3, agg 0.88 m3 / 31.08 ft3,
  wet 35.31 ft3. M10 1 m3: bagsExact 4.44, whole 5. M15 + 10% wastage: bagsExact 6.97.
- Quantity rule (caught by a test, fixed in the test, not the app): 2 m3 M15 gives
  bagsWhole 13 = ceil(12.67), because rounding up applies to the element total,
  not per cubic metre. The original test expectation of 14 was wrong.
- Cost (integer paisa, whole bags + displayed ft3): 1 m3 M15 at 550/60/55 =
  649,180 paisa = ৳6,491.80. No prices -> null; bags-only partial cost exact;
  negative price rejected.
- Formatting: fmt(10538, 2) = "10,538.00"; toBnDigits("123") renders Bengali digits.
- Import: good file accepted; wrong app, bad element, qty 0 rejected.
- Totals: two identical slab items sum to bagsWhole 14, wetM3 2.

## Smoke tests: 20/20 passed (`node tests/smoke.js`, raw CDP, /opt/meta-chromium/chrome)

- Title, 5 element options, circular column hides the 3rd dimension, slab restores it.
- Slab case 10x12x0.5 ft, M15, wastage 0, prices 550/60/55: result shows 60.00 ft3,
  1.70 m3, 10.76 bags (buy 11), sand 26.40 ft3, agg 52.80 ft3, cost 10,538.00.
- Add-to-project creates 1 row; totals row shows 11 bags + 10,538.00; row survives reload.
- Empty dimension shows an inline validation error.
- BN toggle switches document language to bn with a Bengali title; project row
  renders Bengali digits.
- 390 px viewport: no horizontal overflow (scrollWidth <= 390).
- Zero console/page errors.

## Source hygiene

All pushed sources are pure ASCII (Bengali only as \uXXXX escapes in js/i18n.js
and numeric entities in index.html); verified with grep -P '[^\x00-\x7F]' = 0 matches.
Remote Bengali decoding verified in the unit run (BN title renders as Bengali text).
