// Claim: a Zod-validated schema for 20+ Canadian cards; unverified data stays null.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCard } from "@/engine";
import { DATA_DIR, loadCardFiles } from "../helpers/data-files";

describe("claim: 20+ validated Canadian cards", () => {
  it("has >= 20 card files, every one valid", () => {
    const files = loadCardFiles(join(DATA_DIR, "cards"));
    const invalid = files.filter((f) => !validateCard(f.json).ok).map((f) => f.label);
    console.log(`card files: ${files.length}, invalid: ${invalid.length}`);
    expect(invalid).toEqual([]);
    expect(files.length).toBeGreaterThanOrEqual(20);
  });
});
