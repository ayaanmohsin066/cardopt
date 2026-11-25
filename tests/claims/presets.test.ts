// Claim: bank-statement CSVs from 3+ Canadian institutions parse through
// verified presets (manual column mapping doesn't count).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestCsv, isUsablePreset, ISSUER_PRESETS } from "@/engine";
import { FIXTURES_DIR } from "../helpers/data-files";

describe("claim: 3+ institutions with verified presets", () => {
  // Publicly documented presets are usable in the app but don't count as verified.
  const usable = ISSUER_PRESETS.filter((p) => isUsablePreset(p) && p.verified);

  it("has >= 3 usable issuer presets", () => {
    console.log(`publicly documented: ${ISSUER_PRESETS.filter((p) => !p.verified && isUsablePreset(p)).map((p) => p.id).join(", ") || "none"}`);
    console.log(`verified presets: ${usable.length} (${usable.map((p) => p.id).join(", ") || "none"})`);
    expect(usable.length).toBeGreaterThanOrEqual(3);
  });

  it("each usable preset ingests its fixture (real header layout, FAKE rows) without errors", () => {
    for (const p of usable) {
      const file = join(FIXTURES_DIR, "statements", "presets", `${p.id}.csv`);
      expect(existsSync(file), `missing fixture ${file}`).toBe(true);
      const r = ingestCsv(readFileSync(file, "utf8"), p.mapping!, p.format!);
      expect(r.parse_errors, p.id).toEqual([]);
      expect(r.errors, p.id).toEqual([]);
      expect(r.transactions.length, p.id).toBeGreaterThanOrEqual(3);
    }
  });
});
