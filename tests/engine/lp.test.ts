import { describe, expect, it } from "vitest";
import { createHighsSolver, toLpText, type LpProblem } from "@/engine";
import { getSolver } from "../helpers/solver";

const toy: LpProblem = {
  objective: new Map([["chairs", 30], ["tables", 50]]),
  constraints: [
    { terms: new Map([["chairs", 1], ["tables", 2]]), upper: 40 },
    { terms: new Map([["chairs", 2], ["tables", 1]]), upper: 50 },
  ],
  variables: ["chairs", "tables"],
};

describe("toLpText", () => {
  it("writes CPLEX LP with safe variable names", () => {
    const { text, names } = toLpText({
      objective: new Map([["a|b", 1.5], ["c", -2]]),
      constraints: [
        { terms: new Map([["a|b", 1]]), lower: 1, upper: 1 },
        { terms: new Map([["c", 1]]), lower: 0.25 },
        { terms: new Map([["a|b", 1], ["c", 1]]), upper: 10 },
      ],
      variables: ["a|b", "c"],
    });
    expect(names).toEqual(new Map([["a|b", "x0"], ["c", "x1"]]));
    expect(text).toBe(
      "Maximize\n obj: 1.5 x0 - 2 x1\nSubject To\n c0: 1 x0 = 1\n c1: 1 x1 >= 0.25\n c2: 1 x0 + 1 x1 <= 10\nBounds\n x0 >= 0\n x1 >= 0\nEnd",
    );
  });

  it("rejects undeclared variables and non-finite coefficients", () => {
    expect(() => toLpText({ objective: new Map([["z", 1]]), constraints: [], variables: [] })).toThrow("not declared");
    expect(() => toLpText({ objective: new Map([["z", Infinity]]), constraints: [], variables: ["z"] })).toThrow("finite");
  });
});

describe("ranged and equality rows (HiGHS 1.15 misreads \"l <= expr <= u\")", () => {
  it("writes a two-sided row as two one-sided rows", () => {
    const { text } = toLpText({ objective: new Map([["x", -1]]), constraints: [{ terms: new Map([["x", 1]]), lower: 100, upper: 200 }], variables: ["x"] });
    expect(text).toContain(" c0: 1 x0 >= 100\n c0u: 1 x0 <= 200\n");
  });

  it("enforces the lower side of a range and of an equality (hand-solved)", async () => {
    const solve = await getSolver();
    // max −x s.t. 100 <= x <= 200 → x = 100, objective −100 (the ranged text form gave 0).
    const range = solve({ objective: new Map([["x", -1]]), constraints: [{ terms: new Map([["x", 1]]), lower: 100, upper: 200 }], variables: ["x"] });
    expect(range.status === "optimal" && range.objective).toBeCloseTo(-100, 9);
    // max −x s.t. x = 100 → −100: a negative-value option must still carry all its demand.
    const eq = solve({ objective: new Map([["x", -1]]), constraints: [{ terms: new Map([["x", 1]]), lower: 100, upper: 100 }], variables: ["x"] });
    expect(eq.status === "optimal" && eq.objective).toBeCloseTo(-100, 9);
    // x = 100 with x <= 0 elsewhere is infeasible.
    const inf = solve({ objective: new Map([["x", 1]]), constraints: [{ terms: new Map([["x", 1]]), lower: 100, upper: 100 }, { terms: new Map([["x", 1]]), upper: 0 }], variables: ["x"] });
    expect(inf.status).toBe("infeasible");
  });
});

describe("createHighsSolver", () => {
  it("solves the toy LP", async () => {
    const solve = await getSolver();
    const r = solve(toy);
    expect(r.status).toBe("optimal");
    if (r.status !== "optimal") return;
    expect(r.objective).toBeCloseTo(1100, 6);
    expect(r.values.get("chairs")).toBeCloseTo(20, 6);
    expect(r.values.get("tables")).toBeCloseTo(10, 6);
  });

  it("reports infeasible problems", async () => {
    const solve = await getSolver();
    const r = solve({ objective: new Map([["x", 1]]), constraints: [{ terms: new Map([["x", 1]]), upper: -1 }], variables: ["x"] });
    expect(r.status).toBe("infeasible");
  });

  it("handles an empty problem and solver errors", () => {
    const throwing = createHighsSolver({ solve: () => { throw new Error("boom"); } });
    expect(throwing({ objective: new Map(), constraints: [], variables: [] })).toEqual({ status: "optimal", objective: 0, values: new Map() });
    expect(throwing(toy)).toMatchObject({ status: "error" });
    const odd = createHighsSolver({ solve: () => ({ Status: "Time limit reached", ObjectiveValue: 0, Columns: {} }) });
    expect(odd(toy)).toEqual({ status: "error", message: "Solver status: Time limit reached" });
  });
});

describe("binary variables and upper bounds", () => {
  // Knapsack: max 5a + 4b s.t. 6a + 4b <= 9 (hand-solved).
  const knap = (over: Partial<LpProblem> = {}): LpProblem => ({
    objective: new Map([["a", 5], ["b", 4]]),
    constraints: [{ terms: new Map([["a", 6], ["b", 4]]), upper: 9 }],
    variables: ["a", "b"],
    ...over,
  });

  it("writes Binary and bounded variables in the LP text", () => {
    const { text } = toLpText(knap({ binaries: ["a"], upper_bounds: new Map([["b", 2.5]]) }));
    expect(text).toContain("Bounds\n 0 <= x1 <= 2.5\nBinary\n x0\nEnd");
    expect(text).not.toContain("x0 >= 0");
  });

  it("rejects bounds on undeclared variables and negative bounds", () => {
    expect(() => toLpText(knap({ upper_bounds: new Map([["z", 1]]) }))).toThrow("not declared");
    expect(() => toLpText(knap({ binaries: ["z"] }))).toThrow("not declared");
    expect(() => toLpText(knap({ upper_bounds: new Map([["a", -1]]) }))).toThrow(">= 0");
  });

  it("solves the knapsack to its integer optimum: a=1, b=0, objective 5", async () => {
    const r = (await getSolver())(knap({ binaries: ["a", "b"] }));
    expect(r).toMatchObject({ status: "optimal" });
    if (r.status !== "optimal") return;
    expect(r.objective).toBeCloseTo(5, 9);
    expect(r.values.get("a")).toBeCloseTo(1, 9);
    expect(r.values.get("b")).toBeCloseTo(0, 9);
  });

  it("relaxed to [0,1] bounds it gives 49/6 (a=5/6, b=1); with only x>=0 it gives 9 (b=9/4)", async () => {
    const solve = await getSolver();
    const unit = solve(knap({ upper_bounds: new Map([["a", 1], ["b", 1]]) }));
    const free = solve(knap());
    expect(unit.status === "optimal" && unit.objective).toBeCloseTo(49 / 6, 6);
    expect(free.status === "optimal" && free.objective).toBeCloseTo(9, 6);
  });

  it("passes mip_rel_gap 0 only for mixed-integer problems", () => {
    const seen: (Record<string, unknown> | undefined)[] = [];
    const spy = createHighsSolver({ solve: (_t, o) => { seen.push(o); return { Status: "Optimal", ObjectiveValue: 0, Columns: {} }; } });
    spy(knap());
    spy(knap({ binaries: ["a"] }));
    expect(seen).toEqual([{ output_flag: false }, { output_flag: false, mip_rel_gap: 0 }]);
  });
});
