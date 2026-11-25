import { describe, expect, it } from "vitest";
import {
  eligibilityStatus,
  solveCatalogue,
  solveRouting,
  type Applicant,
  type Card,
  type CardSetEntry,
  type Category,
  type LpProblem,
  type LpSolver,
  type SpendCell,
} from "@/engine";
import { fixtureCard, program } from "../helpers/cards";
import { getSolver } from "../helpers/solver";
import { rng, syntheticCatalogue } from "../helpers/synthetic";

const cash = program("cash-cad");
const entry = (id: string, over: Partial<Card> = {}): CardSetEntry => ({ card: { ...fixtureCard(id), ...over }, program: cash });
const A = (over: Partial<Card> = {}) => entry("fake-flat-cash", over); // 2% everything, no fee
const B = (over: Partial<Card> = {}) => entry("fake-grocery-cash", over); // 5% groceries+dining to $500/mo, $100 fee
const C = (over: Partial<Card> = {}) => entry("fake-shared-cap", over); // 4% groceries / 2% dining sharing $1000/mo, no fee

// Instance H: 12 months, domestic; each month groceries $500, dining $200, other $300.
const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const H: SpendCell[] = months.flatMap((month) =>
  ([["groceries", 500], ["dining", 200], ["other", 300]] as const).map(([category, net]) => ({ category, month, foreign: false, net })),
);

const applicant = (personal_income: number | null, household_income: number | null = null): Applicant => ({ personal_income, household_income });
const elig = (min_personal_income: number | "none" | null, min_household_income: number | "none" | null) => ({ eligibility: { min_personal_income, min_household_income } });

describe("eligibilityStatus", () => {
  const card = (e: Card["eligibility"]) => ({ ...fixtureCard("fake-flat-cash"), eligibility: e });

  it("is unknown when the card's eligibility or the applicant is missing", () => {
    expect(eligibilityStatus(card(null), applicant(80000))).toBe("unknown");
    expect(eligibilityStatus(card(elig(60000, 100000).eligibility), null)).toBe("unknown");
  });

  it("is eligible when either verified minimum is met (personal OR household)", () => {
    const c = card(elig(60000, 100000).eligibility);
    expect(eligibilityStatus(c, applicant(60000))).toBe("eligible");
    expect(eligibilityStatus(c, applicant(10000, 100000))).toBe("eligible");
    expect(eligibilityStatus(card(elig(0, "none").eligibility), applicant(0))).toBe("eligible");
  });

  it("is ineligible only when every path is verified and fails", () => {
    expect(eligibilityStatus(card(elig(60000, 100000).eligibility), applicant(59999, 99999))).toBe("ineligible");
    expect(eligibilityStatus(card(elig(60000, "none").eligibility), applicant(50000))).toBe("ineligible");
  });

  it("is unknown when a failing path leaves another path unverified or unanswered", () => {
    expect(eligibilityStatus(card(elig(60000, null).eligibility), applicant(50000))).toBe("unknown");
    expect(eligibilityStatus(card(elig(60000, 100000).eligibility), applicant(50000, null))).toBe("unknown");
    expect(eligibilityStatus(card(elig(60000, "none").eligibility), applicant(null))).toBe("unknown");
  });
});

describe("solveCatalogue on instance H (hand-computed)", () => {
  const solverP = getSolver();
  const run = async (cards: CardSetEntry[], opts: Parameters<typeof solveCatalogue>[2] = {}) => solveCatalogue(cards, H, opts, await solverP);

  it("K=3 holds all three: B takes dining + $300 groceries, C the other $200 groceries, A 'other' → 368", async () => {
    // Per month: B 500 × 5% = 25, C 200 × 4% = 8, A 300 × 2% = 6 → 39 × 12 = 468, − B's $100 fee = 368.
    const r = await run([A(), B(), C()]);
    expect(r.status).toBe("ok");
    expect(r.selected).toEqual(["fake-flat-cash", "fake-grocery-cash", "fake-shared-cap"]);
    expect(r.upper_bound).toBeCloseTo(368, 6);
    const spend = (card: string, category: Category) => r.allocation.find((a) => a.card_id === card && a.category === category)?.amount ?? 0;
    expect(spend("fake-grocery-cash", "dining")).toBeCloseTo(2400, 6);
    expect(spend("fake-grocery-cash", "groceries")).toBeCloseTo(3600, 6);
    expect(spend("fake-shared-cap", "groceries")).toBeCloseTo(2400, 6);
    expect(spend("fake-flat-cash", "other")).toBeCloseTo(3600, 6);
  });

  it("K=2 picks {A, C} → 360, K=1 picks {C} → 324", async () => {
    // {A,C}: groceries 500 × 4% + dining 200 × 2% + other 300 × 2% = 30/mo → 360. {B,C} 332 and {A,B} 320 are worse.
    const two = await run([A(), B(), C()], { maxCards: 2 });
    expect(two.selected).toEqual(["fake-flat-cash", "fake-shared-cap"]);
    expect(two.upper_bound).toBeCloseTo(360, 6);
    // {C}: 20 + 4 + 3 = 27/mo → 324 beats {A} 240 and {B} 260.
    const one = await run([A(), B(), C()], { maxCards: 1 });
    expect(one.selected).toEqual(["fake-shared-cap"]);
    expect(one.upper_bound).toBeCloseTo(324, 6);
  });

  it("the annual fee is a real decision: at $200, B is dropped → {A, C}, 360", async () => {
    const r = await run([A(), B({ annual_fee: 200 }), C()]);
    expect(r.selected).toEqual(["fake-flat-cash", "fake-shared-cap"]);
    expect(r.upper_bound).toBeCloseTo(360, 6);
    expect(r.model.fee_terms).toBe(1);
  });

  it("a verified-ineligible card is never held: C needs $60k personal, applicant has $50k → {A, B}, 320", async () => {
    const r = await run([A(), B(), C(elig(60000, "none"))], { applicant: applicant(50000) });
    expect(r.ineligible).toEqual(["fake-shared-cap"]);
    expect(r.model.rows.eligibility).toBe(1);
    expect(r.selected).toEqual(["fake-flat-cash", "fake-grocery-cash"]);
    expect(r.upper_bound).toBeCloseTo(320, 6);
  });

  it("an unverified requirement keeps the card allowed and flags it → 368", async () => {
    const r = await run([A(), B(), C(elig(null, "none"))], { applicant: applicant(50000) });
    expect(r.ineligible).toEqual([]);
    expect(r.eligibility_unverified).toContain("fake-shared-cap");
    expect(r.model.rows.eligibility).toBe(0);
    expect(r.upper_bound).toBeCloseTo(368, 6);
  });

  it("reports the model size: 36 cells, 156 x, 3 binaries, 9 pairs, 24 cap rows, 108 linking rows", async () => {
    const r = await run([A(), B(), C()]);
    // x per month: A 3 cells × 1 tier, B groceries/dining × 2 tiers + other × 1, C groceries/dining × 2 + other × 1 → 13 × 12.
    expect(r.model).toEqual({
      pairs: 9,
      x_vars: 156,
      binaries: 3,
      fee_terms: 1,
      rows: { demand: 36, cap: 24, linking: 108, eligibility: 0, cardinality: 1 },
    });
  });

  it("is infeasible (not a throw) when every usable card is ineligible, and reports no usable cards", async () => {
    const none = await run([A(elig(1e6, "none")), B(elig(1e6, "none"))], { applicant: applicant(1) });
    expect(none.status).toBe("infeasible");
    expect(none.message).toMatch(/ineligible for every usable card/);
    const empty = await run([]);
    expect(empty.status).toBe("no_usable_cards");
    const unverified = await run([A({ base_rate: null })]);
    expect(unverified).toMatchObject({ status: "no_usable_cards", excluded: [{ card_id: "fake-flat-cash" }] });
  });

  it("passes the selection binaries to the solver and rejects a bad maxCards", async () => {
    const seen: LpProblem[] = [];
    const solver = await solverP;
    const spy: LpSolver = (p) => { seen.push(p); return solver(p); };
    solveCatalogue([A(), C()], H, {}, spy);
    expect(seen[0].binaries).toEqual(["y|fake-flat-cash", "y|fake-shared-cap"]);
    expect(() => solveCatalogue([A()], H, { maxCards: 0 }, spy)).toThrow("maxCards");
    expect(() => solveCatalogue([A()], H, { maxCards: 1.5 }, spy)).toThrow("maxCards");
  });

  it("returns error on a solver failure", () => {
    const failing: LpSolver = () => ({ status: "error", message: "boom" });
    expect(solveCatalogue([A()], H, {}, failing)).toMatchObject({ status: "error", message: "boom", selected: [] });
  });
});

describe("solveCatalogue matches subset enumeration (property test)", () => {
  // For small catalogues, the MILP optimum must equal the best routing LP over
  // every allowed subset of at most K cards (fees included).
  const subsets = <T,>(xs: T[], k: number): T[][] => {
    const out: T[][] = [];
    const go = (i: number, acc: T[]) => {
      if (acc.length > 0) out.push(acc);
      if (acc.length === k) return;
      for (let j = i; j < xs.length; j++) go(j + 1, [...acc, xs[j]]);
    };
    go(0, []);
    return out;
  };
  const CATS: Category[] = ["groceries", "dining", "gas", "travel", "other"];

  it("20 seeds × 8 synthetic cards, K=3", async () => {
    const solver = await getSolver();
    for (let seed = 1; seed <= 20; seed++) {
      const r = rng(seed * 101);
      const cards = syntheticCatalogue(8, seed);
      const cells: SpendCell[] = ["2026-01", "2026-02", "2026-03"].flatMap((month) =>
        CATS.map((category) => ({ category, month, foreign: false, net: Math.round(r() * 800) + 20 })),
      );
      const milp = solveCatalogue(cards, cells, { maxCards: 3 }, solver);
      expect(milp.status).toBe("ok");
      const best = Math.max(
        ...subsets(cards, 3).map((s) => {
          const rr = solveRouting(s, cells, "ongoing", solver);
          return rr.status === "ok" ? rr.cases[0].upper_bound : -Infinity;
        }),
      );
      expect(milp.upper_bound, `seed ${seed}`).toBeCloseTo(best, 6);
      // The chosen set, routed on its own, reaches the same value.
      const chosen = cards.filter((c) => milp.selected.includes(c.card.id));
      expect(solveRouting(chosen, cells, "ongoing", solver).cases[0].upper_bound, `seed ${seed}`).toBeCloseTo(milp.upper_bound, 6);
    }
  }, 60_000);
});
