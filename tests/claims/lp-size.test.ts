// Claim: card selection + spend allocation is a mixed-integer linear program
// with 80+ card-category variables on a realistic input, with constraints for
// spending caps, applicant eligibility and annual fees, solved with HiGHS.
import { describe, expect, it } from "vitest";
import { CATEGORIES, solveCatalogue, type Category, type SpendCell } from "@/engine";
import { realCatalogue } from "../helpers/catalogue";
import { getSolver } from "../helpers/solver";

// FAKE spending profile (not anyone's real statements): 12 months, domestic, every category.
const MONTHLY: Record<Category, number> = {
  groceries: 600, dining: 250, gas: 180, transit: 100, travel: 150, streaming: 30, drugstore: 60,
  recurring_bills: 200, entertainment: 80, home_improvement: 70, online_shopping: 150, other: 200,
};
const cells: SpendCell[] = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`).flatMap((month) =>
  CATEGORIES.map((category) => ({ category, month, foreign: false, net: MONTHLY[category] })),
);
// The applicant the eligibility check is stated for.
const applicant = { personal_income: 40000, household_income: 60000 };

describe("claim: catalogue MILP size and constraints", () => {
  it("has >= 80 card-category variables, cap rows, eligibility rows and fee terms", async () => {
    const r = solveCatalogue(realCatalogue(), cells, { applicant }, await getSolver());
    console.log("catalogue MILP:", JSON.stringify({ status: r.status, model: r.model, excluded: r.excluded.map((x) => x.card_id) }));
    expect(r.status).toBe("ok");
    expect(r.model.pairs).toBeGreaterThanOrEqual(80);
    expect(r.model.rows.cap).toBeGreaterThanOrEqual(1);
    expect(r.model.rows.eligibility).toBeGreaterThanOrEqual(1);
    expect(r.model.fee_terms).toBeGreaterThanOrEqual(1);
  });
});
