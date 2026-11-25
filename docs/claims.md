# Project claims and the data they still need

`npm run test:claims` checks each public claim against the real data in the repo. A claim is true only when its test passes. Don't quote a number that this gate hasn't printed.

Run it with `npm run test:claims -- --silent=false` to see the measured numbers.

## Status on 2026-11-25

| Claim | Test | Status | Measured |
|---|---|---|---|
| 380+ Vitest tests | `npm test` | **Passes** | 415 passed |
| Mixed-integer linear program solved in-browser with HiGHS WASM | `tests/engine/catalogue.test.ts`, `tests/rules/solver-asset.test.ts` | **Passes** | MILP with fee (−fee·y), cap, eligibility and card-count rows |
| …with 80+ card-category variables on the real catalogue | `tests/claims/lp-size.test.ts` | Fails | 60 pairs (5 usable cards × 12 categories), 56 cap rows, 5 fee terms, 0 eligibility rows |
| No data leaves the browser | `tests/rules/` | **Passes** | Network rule, CSP `connect-src 'self'` |
| CSVs from 3+ Canadian institutions | `tests/claims/presets.test.ts` | Fails | 0 of 8 presets verified |
| 90%+ categorization accuracy on a hand-labelled set | `tests/claims/categorize-accuracy.test.ts` | Fails | No labelled set yet, so nothing can be measured |
| 20+ Zod-validated Canadian cards | `tests/claims/cards.test.ts` | Fails | 9 cards, all valid |

## What only a person can supply

The code is ready for each item below. None of these values may be invented, guessed or filled in from memory (CLAUDE.md hard rule 5).

### 1. Point values for 4 programs

Without these, 4 of the 9 cards can't be used: Amex Cobalt, NBC World Elite, RBC Avion and TD Aeroplan.

- **Programs:** `avion-rewards`, `aeroplan-rewards`, `amex-membership-rewards` and `a-la-carte-rewards` in `src/data/programs/`.
- **What to add:** one `redemptions` entry per method, with `cents_per_point`, `is_estimate` (and `notes` if it is an estimate), `source_url` and `last_verified`.
- **Source:** each program's official redemption page.
- **Also unverified:** Cobalt, Avion and Aeroplan have unverified caps or rates for some categories (run `npm run card-status`).

### 2. 11 or more additional cards

The target is 20. That also gives the 80+ card-category pairs, which needs at least 7 fully usable cards × 12 categories.

- **Where:** `src/data/issuers.json` already lists capital-one-canada, mbna, pc-financial, canadian-tire, rogers-bank, tangerine, simplii, walmart-rewards, neo-financial, brim-financial and others.
- **How:** run `npm run new-card -- <issuer> <card-id>`, then fill in only what the issuer page states. Set `last_verified` to the day you checked.
- **FX fee:** fill `fx_fee_pct` where it is published, so a card isn't dropped whenever there is foreign spend.

### 3. Income eligibility

- **Field:** `eligibility.min_personal_income` / `min_household_income` on each card.
- **Values:** a number, `"none"` (that path doesn't exist), or `null` (unverified).
- **Rule:** fill these only from the issuer page. The eligibility part of the LP claim needs at least one card with a verified minimum above the stated test applicant's income ($40,000 personal, $60,000 household).

### 4. Real export layouts from 3 banks

For each bank, provide one sample CSV export with the real header row and layout. The values may be redacted. This tells the preset:

- the delimiter;
- the date format;
- the decimal separator;
- the sign convention;
- whether there is a header row.

Then, for each bank:

1. Put a fixture at `tests/fixtures/statements/presets/<preset-id>.csv` that has the real header and at least 3 FAKE rows.
2. Fill `mapping` and `format` in `src/engine/presets/<bank>.ts` and set `verified: true`.
3. Change the "marks every current issuer stub unverified" test in `tests/engine/presets.test.ts` so it covers only the presets that are still unverified.

### 5. A hand-labelled transaction set

- **File:** `tests/fixtures/labelled/transactions.csv`, with columns `description,label,split`.
- **Size:** at least 300 rows, with at least 100 rows where `split=test`.
- **Labels:** one of the 12 categories in `src/engine/categories.ts`, assigned by a person without looking at the categorizer's output.
- **Privacy:** descriptions only. No amounts, dates, card numbers or names, because the file goes into a public repo.
- **Freezing the split:** choose the test rows before any rule tuning. Then set `FROZEN_TEST_HASH` in the accuracy test to the value it prints.
- **Tuning:** tune `src/data/merchant_rules.json` on dev misses only (the test prints them).
- **Precision:** with 100 test rows, a 90% result has roughly ±6 points of sampling error. Say so next to the number.

## Wording

The optimizer chooses which cards to hold with 0/1 variables, so call it a **mixed-integer linear program**. Plain "linear program" fits only the per-set routing LP (`solveRouting`), and that LP has no fee or eligibility constraints.
