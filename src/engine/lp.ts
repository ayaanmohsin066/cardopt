/**
 * A minimal linear-program interface so the engine never loads or imports a
 * solver itself. The app (browser) and the tests (Node) create a solver from
 * HiGHS and pass it in; see src/app/lib/solver.ts and tests/helpers/solver.ts.
 *
 * Variables are >= 0, continuous unless listed in `binaries` (then 0 or 1,
 * which makes it a mixed-integer program), with an optional upper bound.
 */

export interface LpConstraint {
  terms: ReadonlyMap<string, number>;
  /** Inclusive bounds; omit a side for "unbounded". */
  lower?: number;
  upper?: number;
}

export interface LpProblem {
  /** Always maximized. */
  objective: ReadonlyMap<string, number>;
  constraints: readonly LpConstraint[];
  /** Every variable used anywhere. Each is >= 0. */
  variables: readonly string[];
  /** Variables restricted to {0, 1}. Each must be in `variables`. */
  binaries?: readonly string[];
  /** Optional finite upper bounds on variables (lower bound stays 0). */
  upper_bounds?: ReadonlyMap<string, number>;
}

export type LpSolution =
  | { status: "optimal"; objective: number; values: ReadonlyMap<string, number> }
  | { status: "infeasible" | "error"; message: string };

export type LpSolver = (problem: LpProblem) => LpSolution;

const num = (x: number) => {
  if (!Number.isFinite(x)) throw new Error(`LP coefficient must be finite, got ${x}`);
  // Plain decimal notation, enough precision for money.
  return Number(x.toPrecision(15)).toString();
};

function expr(terms: ReadonlyMap<string, number>, name: (v: string) => string): string {
  const parts: string[] = [];
  for (const [v, c] of terms) {
    if (c === 0) continue;
    const sign = c < 0 ? "-" : "+";
    parts.push(`${sign} ${num(Math.abs(c))} ${name(v)}`);
  }
  if (parts.length === 0) return "0";
  const s = parts.join(" ");
  return s.startsWith("+ ") ? s.slice(2) : s;
}

/**
 * CPLEX LP text for HiGHS. Variable names are replaced with x0, x1, … so any
 * engine-side name is safe. Returns the text and the name map.
 */
export function toLpText(problem: LpProblem): { text: string; names: Map<string, string> } {
  const names = new Map<string, string>();
  problem.variables.forEach((v, i) => names.set(v, `x${i}`));
  const name = (v: string) => {
    const n = names.get(v);
    if (!n) throw new Error(`Variable ${v} is not declared`);
    return n;
  };
  const lines = ["Maximize", ` obj: ${expr(problem.objective, name)}`, "Subject To"];
  problem.constraints.forEach((c, i) => {
    const e = expr(c.terms, name);
    // HiGHS 1.15's LP reader misreads the ranged form "l <= expr <= u" (it keeps
    // only the upper side), so write an equality, or two one-sided rows.
    if (c.lower !== undefined && c.upper !== undefined) {
      if (c.lower === c.upper) lines.push(` c${i}: ${e} = ${num(c.lower)}`);
      else lines.push(` c${i}: ${e} >= ${num(c.lower)}`, ` c${i}u: ${e} <= ${num(c.upper)}`);
    } else if (c.lower !== undefined) {
      lines.push(` c${i}: ${e} >= ${num(c.lower)}`);
    } else if (c.upper !== undefined) {
      lines.push(` c${i}: ${e} <= ${num(c.upper)}`);
    }
  });
  const binaries = new Set(problem.binaries ?? []);
  for (const [v, u] of problem.upper_bounds ?? []) {
    name(v);
    if (u < 0) throw new Error(`Upper bound of ${v} must be >= 0, got ${u}`);
  }
  lines.push("Bounds");
  for (const v of problem.variables) {
    if (binaries.has(v)) continue;
    const u = problem.upper_bounds?.get(v);
    lines.push(u === undefined ? ` ${name(v)} >= 0` : ` 0 <= ${name(v)} <= ${num(u)}`);
  }
  if (binaries.size > 0) {
    lines.push("Binary");
    for (const v of binaries) lines.push(` ${name(v)}`);
  }
  lines.push("End");
  return { text: lines.join("\n"), names };
}

/** The part of the HiGHS JS API the engine relies on (structural, no import). */
export interface HighsLike {
  solve(
    problem: string,
    options?: Record<string, unknown>,
  ): { Status: string; ObjectiveValue: number; Columns: Record<string, unknown> };
}

/** Wrap a loaded HiGHS instance as an LpSolver. */
export function createHighsSolver(highs: HighsLike): LpSolver {
  return (problem) => {
    if (problem.variables.length === 0) {
      return { status: "optimal", objective: 0, values: new Map() };
    }
    const { text, names } = toLpText(problem);
    let r: ReturnType<HighsLike["solve"]>;
    try {
      // mip_rel_gap 0: a mixed-integer solve must prove optimality, not stop at the default 0.01% gap.
      r = highs.solve(text, problem.binaries?.length ? { output_flag: false, mip_rel_gap: 0 } : { output_flag: false });
    } catch (e) {
      return { status: "error", message: String(e) };
    }
    if (r.Status === "Infeasible") return { status: "infeasible", message: "Infeasible" };
    if (r.Status !== "Optimal") return { status: "error", message: `Solver status: ${r.Status}` };
    const values = new Map<string, number>();
    for (const [v, n] of names) {
      const col = r.Columns[n] as { Primal?: number } | undefined;
      values.set(v, col?.Primal ?? 0);
    }
    return { status: "optimal", objective: r.ObjectiveValue, values };
  };
}
