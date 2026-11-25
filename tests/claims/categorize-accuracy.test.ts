// Claim: transactions are classified by merchant category at >= 90% accuracy
// on a hand-labelled test set.
//
// The set lives in tests/fixtures/labelled/transactions.csv with columns
// description,label,split (split = dev | test). Descriptions and labels are
// written by a person; never generate or relabel them. Tune merchant_rules.json
// on dev misses only. Once the test split is frozen, put the SHA-256 of its
// rows (see testSplitHash) in FROZEN_TEST_HASH so it can't drift.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categorize, isCategory, parseCsv, type Transaction } from "@/engine";
import { FIXTURES_DIR } from "../helpers/data-files";
import { seededRules } from "../helpers/statements";

const FILE = join(FIXTURES_DIR, "labelled", "transactions.csv");
const FROZEN_TEST_HASH: string | null = null;
const MIN_ROWS = 300;
const MIN_TEST_ROWS = 100;

interface Row { description: string; label: string; split: string }

const load = (): Row[] => parseCsv(readFileSync(FILE, "utf8"), true).rows as unknown as Row[];
const testSplitHash = (rows: Row[]) =>
  createHash("sha256").update(rows.filter((r) => r.split === "test").map((r) => `${r.description}\t${r.label}`).join("\n")).digest("hex");

const tx = (description: string, i: number): Transaction => ({
  id: `l${i}`, statement_line: i, date: "2026-01-01", description, amount_cad: 10, kind: "purchase",
  is_foreign: false, is_foreign_confidence: "high", raw: {},
});

function accuracy(rows: Row[]) {
  const rules = seededRules();
  const misses = rows.filter((r, i) => categorize(tx(r.description, i), rules).category !== r.label);
  return { n: rows.length, correct: rows.length - misses.length, accuracy: rows.length ? (rows.length - misses.length) / rows.length : 0, misses };
}

describe("claim: >= 90% categorization accuracy on a hand-labelled test split", () => {
  it("has a hand-labelled set of the required size with valid labels", () => {
    expect(existsSync(FILE), `missing hand-labelled set ${FILE}`).toBe(true);
    const rows = load();
    expect(rows.length).toBeGreaterThanOrEqual(MIN_ROWS);
    expect(rows.filter((r) => r.split === "test").length).toBeGreaterThanOrEqual(MIN_TEST_ROWS);
    for (const r of rows) {
      expect(isCategory(r.label), `bad label "${r.label}" for "${r.description}"`).toBe(true);
      expect(["dev", "test"]).toContain(r.split);
    }
  });

  it("scores >= 0.90 on the frozen test split", () => {
    expect(existsSync(FILE), `missing hand-labelled set ${FILE}`).toBe(true);
    const rows = load();
    expect(FROZEN_TEST_HASH, "freeze the test split first: set FROZEN_TEST_HASH").not.toBeNull();
    expect(testSplitHash(rows)).toBe(FROZEN_TEST_HASH);
    const dev = accuracy(rows.filter((r) => r.split === "dev"));
    const test = accuracy(rows.filter((r) => r.split === "test"));
    // Misses are printed for dev only, so rules are never tuned on the test split.
    console.log(`dev: ${dev.correct}/${dev.n} = ${dev.accuracy.toFixed(3)}; test: ${test.correct}/${test.n} = ${test.accuracy.toFixed(3)}`);
    for (const m of dev.misses) console.log(`dev miss: "${m.description}" labelled ${m.label}`);
    expect(test.accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
