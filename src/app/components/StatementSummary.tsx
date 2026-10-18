import { CATEGORIES, type StatementSummary as Summary } from "@/engine";
import { CATEGORY_LABELS, formatCad } from "../lib/format";

export function StatementSummary({ summary }: { summary: Summary }) {
  const spent = CATEGORIES.filter((c) => summary.spend_by_category[c] > 0);
  const other = [
    ["Refunds", summary.refunds],
    ["Foreign-currency spending", summary.foreign_spend],
    ["Card fees", summary.fees],
    ["Interest", summary.interest],
    ["Statement credits", summary.statement_credits],
    ["Payments and reward redemptions", summary.payments],
  ] as const;

  const row = "flex items-baseline justify-between gap-4 border-t border-border py-2 first:border-t-0";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="inset flex flex-col px-4 py-3.5">
        <h3 className="section-title mb-1">Spending by category <span className="font-normal text-muted">(after refunds)</span></h3>
        {spent.length === 0 ? (
          <p className="py-2 text-sm text-muted">No spending found.</p>
        ) : (
          <dl className="text-sm">
            {spent.map((c) => (
              <div key={c} className={row}>
                <dt>{CATEGORY_LABELS[c]}</dt>
                <dd className="tabular-nums font-medium">{formatCad(summary.spend_by_category[c])}</dd>
              </div>
            ))}
          </dl>
        )}
        {summary.over_refunded.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Refunds were larger than purchases in{" "}
            {summary.over_refunded.map((c) => CATEGORY_LABELS[c]).join(", ")}, probably for purchases on an
            earlier statement. Shown as $0.
          </p>
        )}
      </div>
      <div className="inset flex flex-col px-4 py-3.5">
        <h3 className="section-title mb-1">Other totals</h3>
        <dl className="text-sm">
          {other.map(([label, value]) => (
            <div key={label} className={row}>
              <dt>{label}</dt>
              <dd className="tabular-nums font-medium">{formatCad(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Fees, interest and payments aren&apos;t category spending. Foreign-currency spending is already
          included on the left; it&apos;s shown here because it matters for foreign transaction fees.
        </p>
      </div>
    </div>
  );
}
