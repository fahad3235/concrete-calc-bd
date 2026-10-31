# Concrete Calculator BD

Offline, bilingual (English / বাংলা) concrete estimator for Bangladeshi construction work.
Enter an element's dimensions, pick a mix ratio, and get the cement bags, sand, and
aggregate you need — plus an optional cost estimate from your own unit prices.
Add several elements to a project to see combined totals.

Live site: https://fahad3235.github.io/concrete-calc-bd/

## Features

1. **Five element types** — Slab, Rectangular Column, Circular Column, Beam, Footing —
   with dimensions in feet or metres.
2. **Mix designs** — Nominal mixes M10 (1:3:6), M15 (1:2:4), M20 (1:1.5:3), M25 (1:1:2),
   plus a custom ratio. Wet-to-dry conversion uses the standard factor 1.54.
3. **Material quantities** — Cement in kg, exact bags and whole bags to buy (50 kg bags,
   density 1,440 kg/m³); sand and aggregate in m³ and ft³; wastage 0–50%.
4. **Cost estimator** — Optional per-bag / per-cft prices in BDT, computed in integer
   paisa from whole bags and displayed (2-decimal) ft³ quantities.
5. **Project totals** — Add elements to a project, see summed volume, bags, sand,
   aggregate and cost; per-element delete, typed-DELETE erase-all.
6. **Data portability** — JSON export and strict import (wrong app, version, or any
   invalid row rejects the whole file; existing data stays intact).
7. **Bilingual + mobile** — EN/বাংলা toggle persisted, Bengali digits in বাংলা mode,
   localStorage persistence, 390 px mobile layout, zero network requests.

## Stack

Vanilla HTML/CSS/JS, no build step, no dependencies. Tests run in Node and in a
headless Chromium via raw CDP.

## Run locally

Open `index.html` in any browser, or serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Testing

```sh
node tests/test.js    # unit tests (38 checks)
node tests/smoke.js   # headless-Chrome smoke tests (20 checks)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the verified numbers.

## Worked example (hand-verified)

Slab 10 ft × 12 ft × 0.5 ft, M15, no wastage:

- Wet volume: 60.00 ft³ = 1.70 m³
- Dry volume: 1.70 × 1.54 = 2.62 m³
- Cement: 2.62 / 7 × 1,440 = 538.25 kg = 10.76 bags → buy **11 bags**
- Sand: 26.40 ft³ · Aggregate: 52.80 ft³
- At ৳550/bag, ৳60/cft sand, ৳55/cft aggregate: 11×550 + 26.40×60 + 52.80×55 = **৳10,538.00**

## Limitations

- Quantities are estimates from nominal mixes, not a structural design. Confirm the
  mix, reinforcement, and member sizes with a structural engineer.
- Prices are your own inputs, not market rates — no price data is shipped.
- Circular columns use π·(D/2)²·H; no deduction is made for reinforcement volume.
- This is a personal estimation tool, not affiliated with any authority.

## Status

Factory run #193 (17:00 slot, 2026-10-31). Complete and tested; see TEST_RESULTS.md.
