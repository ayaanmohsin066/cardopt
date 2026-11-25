// npm run label-template -- "<description column>" <export.csv> [more.csv ...]
// Reads your own bank exports locally and writes tests/fixtures/labelled/to-label.csv
// (gitignored). Fill in every label yourself, delete rows that aren't purchases or
// that name a person, then save it as transactions.csv. See docs/claims.md, item 5.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { labelTemplate } from "./lib/label-template";

const [column, ...files] = process.argv.slice(2);
if (!column || files.length === 0) {
  console.error('usage: npm run label-template -- "<description column>" <export.csv> [more.csv ...]');
  process.exit(1);
}
const descriptions: string[] = [];
for (const f of files) {
  const rows = Papa.parse<Record<string, string>>(readFileSync(f, "utf8"), { header: true, skipEmptyLines: true }).data;
  if (rows.length && !(column in rows[0])) {
    console.error(`${f}: no column "${column}". Columns: ${Object.keys(rows[0]).join(", ")}`);
    process.exit(1);
  }
  descriptions.push(...rows.map((r) => r[column] ?? ""));
}
const dir = join("tests", "fixtures", "labelled");
const out = join(dir, "to-label.csv");
if (existsSync(out)) {
  console.error(`${out} already exists; not overwriting your labels`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const rows = labelTemplate(descriptions, "cardwise-labelled-v1");
writeFileSync(out, Papa.unparse(rows, { columns: ["description", "label", "split"] }) + "\n");
console.log(`Wrote ${rows.length} distinct merchants to ${out} (${rows.filter((r) => r.split === "test").length} test).
Next: fill "label" with one of the 12 categories in src/engine/categories.ts without running the categorizer,
delete payments, transfers and any row with a person's name, then rename the file to transactions.csv.`);
