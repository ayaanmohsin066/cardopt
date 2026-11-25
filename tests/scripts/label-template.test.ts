import { describe, expect, it } from "vitest";
import { labelTemplate } from "../../scripts/lib/label-template";

describe("labelTemplate", () => {
  const input = ["FAKE COFFEE #1234", "fake coffee #9999", "FAKE GROCER 001", "FAKE PHARMACY", "FAKE GAS STN", "FAKE BOOKS"];

  it("dedupes by merchant key, leaves labels empty and puts every third row in test", () => {
    const rows = labelTemplate(input, "s");
    expect(rows.map((r) => r.description).sort()).toEqual(["fake books", "fake coffee", "fake gas stn", "fake grocer", "fake pharmacy"]);
    expect(rows.every((r) => r.label === "")).toBe(true);
    expect(rows.map((r) => r.split)).toEqual(["dev", "dev", "test", "dev", "dev"]);
  });

  it("is deterministic for a seed and order-independent", () => {
    expect(labelTemplate([...input].reverse(), "s")).toEqual(labelTemplate(input, "s"));
  });
});
