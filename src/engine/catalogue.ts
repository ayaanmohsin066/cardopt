/**
 * "Best wallet": choose which cards to hold, and route spend across them, as
 * one mixed-integer linear program over the whole usable catalogue
 * (docs/decisions.md, "Catalogue MILP").
 *
 * Variables: x[card, cell, tier] >= 0 (spend routed, as in solveRouting) and a
 * binary y[card] (hold the card or not). Constraints: every cell's spend is
 * routed (demand), bonus tiers respect each cap per period, spend can only go
 * to a held card (x <= spend × y), cards the applicant is verified ineligible
 * for are fixed to y = 0, and at most `maxCards` cards are held. Objective:
 * $ earned − prorated annual fee × y. Like solveRouting's, the objective is an
 * upper bound and is never displayed; shown values come from replay.
 */
import type { Card } from "./card-schema";
import type { Category } from "./categories";
import type { LpConstraint, LpSolver } from "./lp";
import { monthsSpanned, resolveCard, routingModel, type CardSetEntry, type ResolvedCard, type SpendCell } from "./optimize";

/** What the applicant told us. Kept in memory only; never persisted. */
export interface Applicant {
  personal_income: number | null;
  household_income: number | null;
}

export type EligibilityStatus = "eligible" | "ineligible" | "unknown";

/**
 * Whether an applicant meets a card's income requirement. Issuers accept a
 * personal OR a household minimum:
 * - eligible: some verified numeric minimum is met by the matching income;
 * - ineligible: every path is verified ("none", or a number the known income is below);
 * - unknown: anything else (unverified terms, or income not given).
 */
export function eligibilityStatus(card: Card, applicant: Applicant | null | undefined): EligibilityStatus {
  const e = card.eligibility;
  if (e === null || !applicant) return "unknown";
  const paths = [
    [e.min_personal_income, applicant.personal_income],
    [e.min_household_income, applicant.household_income],
  ] as const;
  if (paths.some(([min, income]) => typeof min === "number" && income !== null && income >= min)) return "eligible";
  const fails = paths.every(([min, income]) => min === "none" || (typeof min === "number" && income !== null && income < min));
  return fails ? "ineligible" : "unknown";
}

export interface CatalogueModelSize {
  /** Distinct (card, category) pairs with at least one x variable: the "card-category variables". */
  pairs: number;
  /** All x[card, cell, tier] variables. */
  x_vars: number;
  /** y[card] selection binaries. */
  binaries: number;
  /** Cards whose y carries a −fee term in the objective (fee > 0). */
  fee_terms: number;
  rows: { demand: number; cap: number; linking: number; eligibility: number; cardinality: number };
}

export interface CatalogueResult {
  status: "ok" | "infeasible" | "no_usable_cards" | "error";
  message?: string;
  months: string[];
  /** Cards to hold (y = 1), in catalogue order. */
  selected: string[];
  /** MILP objective for the data period: an upper bound, never display it. */
  upper_bound: number;
  allocation: { card_id: string; category: Category; foreign: boolean; amount: number }[];
  /** Cards left out because a term needed for this spend is unverified. */
  excluded: { card_id: string; name: string; reasons: string[] }[];
  /** Usable cards the applicant is verified ineligible for (fixed to y = 0). */
  ineligible: string[];
  /** Usable cards whose eligibility couldn't be checked: allowed, and flagged. */
  eligibility_unverified: string[];
  model: CatalogueModelSize;
}

const EPS = 1e-7;
const yName = (cardId: string) => `y|${cardId}`;

export function solveCatalogue(
  catalogue: readonly CardSetEntry[],
  cells: readonly SpendCell[],
  opts: { maxCards?: number; applicant?: Applicant | null },
  solver: LpSolver,
): CatalogueResult {
  const maxCards = opts.maxCards ?? 3;
  if (!Number.isInteger(maxCards) || maxCards < 1) throw new Error(`maxCards must be a positive integer, got ${maxCards}`);
  const months = monthsSpanned(cells);
  const resolved = catalogue.map((e) => resolveCard(e, cells, "ongoing"));
  const usable = resolved.filter((r): r is Extract<ResolvedCard, { ok: true }> => r.ok);
  const excluded = resolved.filter((r): r is Extract<ResolvedCard, { ok: false }> => !r.ok)
    .map(({ card_id, name, reasons }) => ({ card_id, name, reasons }));
  const status = new Map(usable.map((r) => [r.entry.card.id, eligibilityStatus(r.entry.card, opts.applicant)]));
  const ineligible = usable.filter((r) => status.get(r.entry.card.id) === "ineligible").map((r) => r.entry.card.id);
  const eligibility_unverified = usable.filter((r) => status.get(r.entry.card.id) === "unknown").map((r) => r.entry.card.id);

  const { demand, vars, objective, demand_rows, cap_rows } = routingModel(usable, cells);
  const ys = usable.map((r) => yName(r.entry.card.id));
  for (const r of usable) {
    if (r.fee > 0) objective.set(yName(r.entry.card.id), -(r.fee * months.length) / 12);
  }

  // Linking: one row per (card, cell): Σ_tier x − net × y ≤ 0.
  const linking: LpConstraint[] = [];
  demand.forEach((cell) => {
    for (const r of usable) {
      const id = r.entry.card.id;
      const xs = vars.filter((v) => v.cell === cell && v.option.card_id === id);
      if (xs.length === 0) continue;
      linking.push({ terms: new Map([...xs.map((v) => [v.name, 1] as const), [yName(id), -cell.net]]), upper: 0 });
    }
  });
  const eligibility: LpConstraint[] = ineligible.map((id) => ({ terms: new Map([[yName(id), 1]]), upper: 0 }));
  const cardinality: LpConstraint[] = ys.length ? [{ terms: new Map(ys.map((y) => [y, 1])), upper: maxCards }] : [];

  const fee_terms = usable.filter((r) => r.fee > 0).length;
  const model: CatalogueModelSize = {
    pairs: new Set(vars.map((v) => `${v.option.card_id}|${v.cell.category}`)).size,
    x_vars: vars.length,
    binaries: ys.length,
    fee_terms,
    rows: {
      demand: demand_rows.length,
      cap: cap_rows.length,
      linking: linking.length,
      eligibility: eligibility.length,
      cardinality: cardinality.length,
    },
  };
  const base = { months, excluded, ineligible, eligibility_unverified, model, selected: [], upper_bound: 0, allocation: [] };
  if (usable.length === 0) return { ...base, status: "no_usable_cards", message: "No card in the catalogue has verified terms for this spending." };

  const sol = solver({
    objective,
    constraints: [...demand_rows, ...cap_rows, ...linking, ...eligibility, ...cardinality],
    variables: [...vars.map((v) => v.name), ...ys],
    binaries: ys,
  });
  if (sol.status === "infeasible") {
    return {
      ...base,
      status: "infeasible",
      message: ineligible.length === usable.length
        ? "The applicant is verified ineligible for every usable card."
        : "No allowed set of cards can carry this spending.",
    };
  }
  if (sol.status !== "optimal") return { ...base, status: "error", message: sol.message };

  const selected = usable.filter((r) => (sol.values.get(yName(r.entry.card.id)) ?? 0) > 0.5).map((r) => r.entry.card.id);
  const alloc = new Map<string, CatalogueResult["allocation"][number]>();
  for (const v of vars) {
    const x = sol.values.get(v.name) ?? 0;
    if (x <= EPS) continue;
    const k = `${v.option.card_id}|${v.cell.category}|${v.cell.foreign}`;
    const a = alloc.get(k) ?? { card_id: v.option.card_id, category: v.cell.category, foreign: v.cell.foreign, amount: 0 };
    a.amount += x;
    alloc.set(k, a);
  }
  return { ...base, status: "ok", selected, upper_bound: sol.objective, allocation: [...alloc.values()] };
}
