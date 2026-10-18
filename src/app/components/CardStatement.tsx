"use client";

import { useMemo, useState } from "react";
import {
  isUsablePreset,
  normalizeRows,
  parseCsv,
  presetForIssuer,
  removeOverride,
  setOverride,
  suggestMapping,
  summarizeStatement,
  type CategorizedTransaction,
  type Category,
  type CsvFormat,
  type Overrides,
  type RowError,
  type Transaction,
} from "@/engine";
import type { CardOption } from "../lib/catalog";
import { draftToMapping, emptyDraft, MappingForm, type MappingDraft } from "./MappingForm";
import { ReviewTable } from "./ReviewTable";
import { StatementSummary } from "./StatementSummary";

const DEFAULT_FORMAT: CsvFormat = {
  has_header: true,
  date_format: "YYYY-MM-DD",
  decimal_separator: ".",
  purchase_sign: "positive",
};

function draftFor(columns: string[]): MappingDraft {
  const s = suggestMapping(columns);
  return emptyDraft({ date: s.date ?? "", description: s.description ?? "", amount: s.amount ?? "" });
}

interface Props {
  card: CardOption;
  issuerName: string;
  hasTransactions: boolean;
  onTransactions: (t: Transaction[] | null) => void;
  /** Categorized transactions for this card (computed by the parent). */
  categorized: CategorizedTransaction[];
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
  saveFailed: boolean;
  refundMatches?: ReadonlyMap<string, number | null>;
  /** The card's chart colour, so its statement and charts read as one. */
  color?: string;
}

export function CardStatement({
  card, issuerName, hasTransactions, onTransactions, categorized, overrides, onOverrides, saveFailed, refundMatches, color,
}: Props) {
  const preset = presetForIssuer(card.issuer);
  const usable = isUsablePreset(preset);

  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const [format, setFormat] = useState<CsvFormat>(usable && preset.format ? preset.format : DEFAULT_FORMAT);
  const [draft, setDraft] = useState<MappingDraft>(emptyDraft());
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [dragging, setDragging] = useState(false);

  const parsed = useMemo(() => parseCsv(text, format.has_header), [text, format.has_header]);
  const mapping = draftToMapping(draft);
  const summary = useMemo(() => summarizeStatement(categorized), [categorized]);

  async function onFile(file: File | undefined) {
    onTransactions(null);
    setRowErrors([]);
    setReadError(null);
    if (!file) return;
    try {
      // Read locally. The file never leaves the browser.
      const content = await file.text();
      setFileName(file.name);
      setText(content);
      setDraft(draftFor(parseCsv(content, format.has_header).columns));
    } catch {
      setReadError("Couldn't read that file.");
    }
  }

  function onFormat(next: CsvFormat) {
    if (next.has_header !== format.has_header) {
      setDraft(draftFor(parseCsv(text, next.has_header).columns));
      onTransactions(null);
    }
    setFormat(next);
  }

  function runImport() {
    if (!mapping) return;
    const result = normalizeRows(parsed.rows, mapping, format);
    onTransactions(result.transactions);
    setRowErrors(result.errors);
  }

  const updateOverrides = onOverrides;

  const onCategory = (description: string, category: Category) =>
    updateOverrides(setOverride(overrides, description, category));
  const onResetCategory = (description: string) => updateOverrides(removeOverride(overrides, description));
  const overrideCount = Object.keys(overrides).length;

  return (
    <section className="panel" aria-label={`Statement for ${card.name}`}>
      <header className="panel-header items-center">
        <div className="flex min-w-0 items-center gap-3">
          {color && <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="eyebrow">Statement</p>
            <h2 className="panel-title truncate">{card.name}</h2>
            <p className="text-sm text-muted">
              {issuerName}
              {card.is_fixture && " · FAKE test fixture"}
            </p>
          </div>
        </div>
        {overrideCount > 0 && (
          <button type="button" className="link-action hover:text-danger" onClick={() => updateOverrides({})}>
            Clear {overrideCount} saved correction{overrideCount === 1 ? "" : "s"}
          </button>
        )}
      </header>

      <div className="panel-body">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id={`file-label-${card.id}`}>
            Statement CSV
          </span>
          <label
            htmlFor={`file-${card.id}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer items-center gap-3 rounded-inset border border-dashed px-3 py-3 transition-colors duration-(--duration-fast) focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring sm:px-4 sm:py-4 ${dragging ? "border-ring bg-surface-2" : "border-border-strong bg-background hover:bg-surface-2"}`}
          >
            <span aria-hidden className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-inset bg-surface text-muted ring-1 ring-border min-[400px]:flex">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.75H5.75a1.5 1.5 0 0 0-1.5 1.5v11.5a1.5 1.5 0 0 0 1.5 1.5h8.5a1.5 1.5 0 0 0 1.5-1.5V7l-4.25-4.25Z" strokeLinejoin="round" />
                <path d="M11.5 2.75V7h4.25M7.25 11h5.5M7.25 13.75h3.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{fileName ?? "Choose a CSV file, or drop it here"}</span>
              <span className="text-xs text-muted">
                {fileName ? "Choose another file to replace it." : "Read in this browser only. Nothing is uploaded."}
              </span>
            </span>
            <span className="btn btn-sm pointer-events-none">{fileName ? "Replace" : "Browse"}</span>
            <input
              id={`file-${card.id}`}
              type="file"
              accept=".csv,text/csv"
              aria-labelledby={`file-label-${card.id}`}
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {readError && <p className="text-sm text-danger">{readError}</p>}
          <p className="text-xs text-muted">
            {usable
              ? `Using the verified ${preset.label} format.`
              : preset.issuer_id
                ? `We don't have a verified ${preset.label} export format yet, so choose the columns below.`
                : "Choose which column is which below."}
          </p>
        </div>

        {fileName && parsed.columns.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-border pt-5">
            <h3 className="section-title">
              Columns in {fileName} <span className="font-normal text-muted">({parsed.rows.length} rows)</span>
            </h3>
            <MappingForm columns={parsed.columns} draft={draft} format={format} onDraft={setDraft} onFormat={onFormat} />
            {parsed.errors.length > 0 && (
              <p className="text-sm text-danger">Some lines couldn&apos;t be read: {parsed.errors.slice(0, 3).join("; ")}</p>
            )}
            <div>
              <button type="button" className="btn btn-primary" disabled={!mapping} onClick={runImport}>
                {hasTransactions ? "Re-import with these columns" : "Import transactions"}
              </button>
            </div>
          </div>
        )}
        {fileName && parsed.columns.length === 0 && <p className="text-sm text-danger">That file has no rows.</p>}

        {hasTransactions && (
          <div className="flex flex-col gap-6 border-t border-border pt-5">
            {rowErrors.length > 0 && (
              <div className="rounded-inset border border-danger/60 px-4 py-3 text-sm" role="status">
                <p className="font-medium">
                  {rowErrors.length} line{rowErrors.length === 1 ? " was" : "s were"} skipped
                </p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {rowErrors.slice(0, 5).map((e) => (
                    <li key={e.statement_line}>
                      Line {e.statement_line}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {saveFailed && (
              <p className="text-sm text-danger">
                This browser blocked saving, so your corrections will be lost when you close the tab.
              </p>
            )}
            <StatementSummary summary={summary} />
            <ReviewTable items={categorized} onCategory={onCategory} onReset={onResetCategory} refundMatches={refundMatches} />
          </div>
        )}
      </div>
    </section>
  );
}
