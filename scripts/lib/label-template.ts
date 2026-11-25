// Builds the to-label sheet for tests/fixtures/labelled/transactions.csv from a
// person's own exports. It never fills in a label: a person writes every one.
import { createHash } from "node:crypto";
import { overrideKey } from "@/engine";

export interface TemplateRow { description: string; label: ""; split: "dev" | "test" }

/**
 * One row per distinct merchant (by overrideKey, which drops tokens with digits
 * such as card or reference numbers), in a seeded shuffle. The split is fixed
 * here, before any rule tuning: every third row is "test".
 */
export function labelTemplate(descriptions: string[], seed: string): TemplateRow[] {
  const seen = new Map<string, string>();
  for (const d of descriptions) {
    const key = overrideKey(d.trim());
    if (key && !seen.has(key)) seen.set(key, key);
  }
  const rank = (k: string) => createHash("sha256").update(`${seed}\t${k}`).digest("hex");
  return [...seen.keys()]
    .sort((a, b) => (rank(a) < rank(b) ? -1 : 1))
    .map((description, i) => ({ description, label: "", split: i % 3 === 2 ? "test" : "dev" }));
}
