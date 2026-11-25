import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  genericPreset,
  ingestCsv,
  isUsablePreset,
  ISSUER_PRESETS,
  presetForIssuer,
  validateIssuers,
} from "@/engine";
import { DATA_DIR, FIXTURES_DIR, loadJson } from "../helpers/data-files";

const issuers = (() => {
  const r = validateIssuers(loadJson(join(DATA_DIR, "issuers.json")));
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.issuers;
})();

describe("presets", () => {
  it("has a preset for every Tier 1 issuer", () => {
    const tier1 = issuers.filter((i) => i.tier === 1).map((i) => i.id);
    expect(ISSUER_PRESETS.map((p) => p.issuer_id).sort()).toEqual([...tier1].sort());
  });

  it("only references known issuers and has unique ids", () => {
    const ids = new Set(issuers.map((i) => i.id));
    for (const p of ISSUER_PRESETS) expect(ids.has(p.issuer_id!)).toBe(true);
    const presetIds = ISSUER_PRESETS.map((p) => p.id);
    expect(new Set(presetIds).size).toBe(presetIds.length);
  });

  it("never guesses column names: a mapping needs a real export or a cited public source", () => {
    for (const p of [...ISSUER_PRESETS, genericPreset]) {
      for (const url of p.documented_by) expect(url, p.id).toMatch(/^https:\/\//);
      if (!p.verified && p.documented_by.length === 0) {
        expect(p.mapping, p.id).toBeNull();
        expect(p.format, p.id).toBeNull();
      }
    }
  });

  it("has no preset verified from a real export yet; only RBC is publicly documented", () => {
    expect(ISSUER_PRESETS.filter((p) => p.verified)).toEqual([]);
    expect(ISSUER_PRESETS.filter((p) => p.mapping !== null).map((p) => p.id)).toEqual(["rbc"]);
  });

  it("ingests the RBC fixture (documented header, FAKE rows) with purchases positive", () => {
    const p = presetForIssuer("rbc");
    const r = ingestCsv(readFileSync(join(FIXTURES_DIR, "statements", "presets", "rbc.csv"), "utf8"), p.mapping!, p.format!);
    expect(r.parse_errors).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.transactions.map((t) => [t.date, t.amount_cad])).toEqual([["2026-02-03", 45.2], ["2026-02-14", 4.75], ["2026-02-20", -200]]);
  });
});

describe("presetForIssuer", () => {
  it("returns the issuer's stub, or the generic preset", () => {
    expect(presetForIssuer("rbc").id).toBe("rbc");
    expect(presetForIssuer("tangerine")).toBe(genericPreset);
  });
});

describe("isUsablePreset", () => {
  it("is false for unverified presets and true only with mapping and format", () => {
    expect(isUsablePreset(genericPreset)).toBe(false);
    expect(isUsablePreset(presetForIssuer("td"))).toBe(false);
    const mapping = {
      date: "D", description: "X", amount: "A", debit: null, credit: null,
      currency: null, foreign_amount: null, exchange_rate: null,
    };
    const format = { has_header: true, date_format: "YYYY-MM-DD", decimal_separator: ".", purchase_sign: "positive" } as const;
    expect(isUsablePreset({ ...genericPreset, verified: true, mapping, format })).toBe(true);
    expect(isUsablePreset({ ...genericPreset, verified: true, mapping: null, format })).toBe(false);
    expect(isUsablePreset({ ...genericPreset, documented_by: ["https://example.com/layout"], mapping, format })).toBe(true);
    expect(isUsablePreset({ ...genericPreset, mapping, format })).toBe(false);
  });
});
