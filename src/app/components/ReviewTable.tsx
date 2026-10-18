"use client";

import { useState } from "react";
import { CATEGORIES, type CategorizedTransaction, type Category } from "@/engine";
import { CATEGORY_LABELS, formatCad, KIND_LABELS } from "../lib/format";

interface Props {
  items: CategorizedTransaction[];
  onCategory: (description: string, category: Category) => void;
  onReset: (description: string) => void;
  /** Refund id -> statement line of the purchase it matched, or null if unmatched. */
  refundMatches?: ReadonlyMap<string, number | null>;
}

const SOURCE_LABELS = {
  override: "Your correction",
  rule: "Merchant rule",
  unmatched: "No match",
  excluded: "Not spending",
} as const;

export function ReviewTable({ items, onCategory, onReset, refundMatches }: Props) {
  const refundNote = (t: CategorizedTransaction["transaction"]) =>
    t.kind === "refund" && refundMatches?.has(t.id) ? (
      <div className="text-xs text-muted">
        {refundMatches.get(t.id) === null ? "Not matched to a purchase (points estimated)" : `Matches line ${refundMatches.get(t.id)}`}
      </div>
    ) : null;

  const categoryControl = (item: CategorizedTransaction, review: boolean, wide = false) => {
    const t = item.transaction;
    return item.category === null ? (
      <span className="text-sm text-muted">Not spending</span>
    ) : (
      <div className="flex flex-col gap-1">
        <select
          className={`field field-sm ${wide ? "" : "max-w-48"} ${review ? "border-review-border" : ""}`}
          value={item.category}
          aria-label={`Category for ${t.description}`}
          onChange={(e) => onCategory(t.description, e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          {review && <span className="font-medium text-foreground">Unsure · </span>}
          {SOURCE_LABELS[item.source]}
          {item.source === "override" && (
            <>
              {" · "}
              <button type="button" className="link-action text-xs" onClick={() => onReset(t.description)}>
                undo
              </button>
            </>
          )}
        </span>
      </div>
    );
  };

  const [onlyReview, setOnlyReview] = useState(false);
  const toReview = items.filter((i) => i.confidence === "low").length;
  const shown = onlyReview ? items.filter((i) => i.confidence === "low") : items;

  const filters = [
    { id: false, label: "All", count: items.length },
    { id: true, label: "To review", count: toReview },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="section-title">Transactions</h3>
          <p className="max-w-2xl text-xs leading-relaxed text-muted">
            Rows marked <span className="font-medium text-foreground">Unsure</span> are guesses. Changing a category saves a
            correction for that merchant on this card, and it&apos;s applied to every matching line.
          </p>
        </div>
        <div role="radiogroup" aria-label="Show transactions" className="segmented">
          {filters.map((f) => (
            <button
              key={f.label}
              type="button"
              role="radio"
              aria-checked={onlyReview === f.id}
              className={`flex items-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-3 py-1 transition-colors duration-(--duration-fast) ${onlyReview === f.id ? "bg-surface text-foreground shadow-panel ring-1 ring-border" : "text-muted hover:text-foreground"}`}
              onClick={() => setOnlyReview(f.id)}
            >
              {f.label}
              <span className="tabular-nums text-muted">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>{onlyReview ? "Nothing to review. Every line was matched by a merchant rule or your corrections." : "No transactions in this statement."}</p>
        </div>
      ) : (
        <>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-inset border border-border sm:hidden">
          {shown.map((item) => {
            const t = item.transaction;
            const review = item.confidence === "low";
            return (
              <li
                key={t.id}
                className={`flex flex-col gap-2.5 px-3.5 py-3 ${review ? "bg-review/60 shadow-[inset_3px_0_0_var(--review-border)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium break-words">{t.description}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {t.date} · Line {t.statement_line} · {KIND_LABELS[t.kind]}
                      {t.is_foreign && ` · Foreign${t.is_foreign_confidence === "low" ? " (unsure)" : ""}`}
                    </span>
                    {refundNote(t)}
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{formatCad(t.amount_cad)}</span>
                </div>
                {categoryControl(item, review, true)}
              </li>
            );
          })}
        </ul>
        <div className="table-wrap hidden max-h-[30rem] overflow-y-auto sm:block">
          <table className="data-table min-w-[720px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14">Line</th>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th>Type</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const t = item.transaction;
                const review = item.confidence === "low";
                return (
                  <tr key={t.id} className={review ? "bg-review/60 hover:bg-review/80!" : ""}>
                    <td
                      className={`tabular-nums text-muted ${review ? "shadow-[inset_3px_0_0_var(--review-border)]" : ""}`}
                    >
                      {t.statement_line}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{t.date}</td>
                    <td>
                      <div className="font-medium">{t.description}</div>
                      {t.is_foreign && (
                        <div className="text-xs text-muted">
                          Foreign currency{t.is_foreign_confidence === "low" ? " (unsure)" : ""}
                        </div>
                      )}
                    </td>
                    <td className="num">{formatCad(t.amount_cad)}</td>
                    <td>
                      <div>{KIND_LABELS[t.kind]}</div>
                      {refundNote(t)}
                    </td>
                    <td>{categoryControl(item, review)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
