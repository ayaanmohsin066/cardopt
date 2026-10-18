"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CASH_PROGRAM_ID, combineCardSummaries } from "@/engine";
import { CATEGORY_LABELS, formatCad, formatPoints, seriesColor } from "../lib/format";
import { useNarrow } from "../lib/use-narrow";
import type { CardReport } from "./Importer";
import { StatTile } from "./StatTile";

/**
 * Totals across the selected cards. Dollars add up across cards; points from
 * different programs don't, so points are listed per card, never summed.
 */
export function CombinedSummary({ reports }: { reports: CardReport[] }) {
  const summary = combineCardSummaries(reports.map((r) => r.report));
  const narrow = useNarrow();
  const valued = reports.filter((r) => summary.valued_card_ids.includes(r.option.id));
  const notValued = summary.unvalued_card_ids;
  const { net_value: net, rewards_value: rewards, credits_total: credits, fees_total: fees } = summary;
  const { unverified_count: unverified, any_excluded: anyExcluded } = summary;

  // Chart rows: one key per card id (report.card_id is the card's id), plus the label and total.
  const rows = summary.categories.map(
    (c): Record<string, number | string> => ({ ...c.by_card, name: CATEGORY_LABELS[c.category], total: c.total }),
  );
  const height = Math.max(120, rows.length * 36 + 40);
  // Green and red are used only for money gained or lost.
  const netTone = net > 0 ? "text-gain" : net < 0 ? "text-loss" : "";

  return (
    <section className="panel" aria-label="All selected cards">
      <header className="panel-header">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Combined</p>
          <h2 className="panel-title">All selected cards</h2>
          <p className="text-sm text-muted">Combined for the periods each card&apos;s statements cover.</p>
        </div>
      </header>

      <div className="panel-body">
      <div className="flex flex-col gap-3">
      <StatTile
        hero
        label="Combined net value"
        value={formatCad(net)}
        amount={net}
        format={formatCad}
        tone={netTone}
        sub={anyExcluded ? "Leaves out unverified parts; see each card" : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Rewards value" value={formatCad(rewards)} amount={rewards} format={formatCad} sub={notValued.length ? `${notValued.length} card${notValued.length === 1 ? "" : "s"} not valued (unverified)` : undefined} />
        <StatTile label="Credits used" value={formatCad(credits)} amount={credits} format={formatCad} />
        <StatTile label="Annual fee share + FX fees" value={formatCad(fees)} amount={fees} format={formatCad} />
      </div>
      </div>
      {unverified > 0 && (
        <div className="callout text-sm" role="status">
          <p className="eyebrow text-foreground">Not yet verified</p>
          <p className="font-semibold">
            {unverified} item{unverified === 1 ? " is" : "s are"} not yet verified across these cards and left out of the totals.
          </p>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border inset text-sm">
        {reports.map((r) => (
          <li key={r.option.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span aria-hidden className="inline-block h-3 w-1 rounded-full" style={{ background: seriesColor(r.slot) }} />
            <span className="font-medium">{r.option.name}</span>
            <span className="ml-auto tabular-nums text-muted">
              {r.option.card.program_id === CASH_PROGRAM_ID ? "" : `${formatPoints(r.report.points_total)} ${r.program?.name ?? "points"} · `}
              {r.report.rewards_value === null ? "value not yet verified" : formatCad(r.report.rewards_value)}
            </span>
          </li>
        ))}
      </ul>

      {valued.length > 0 && rows.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <h4 className="section-title">Rewards value by category and card</h4>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: narrow ? 12 : 24, bottom: 4, left: 0 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeWidth={1} />
                <XAxis
                  type="number"
                  tickCount={narrow ? 3 : 5}
                  tickFormatter={(v: number) => formatCad(v)}
                  stroke="var(--chart-axis)"
                  tick={{ fill: "var(--chart-ink-muted)", fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis type="category" dataKey="name" width={narrow ? 92 : 120} stroke="var(--chart-axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-control border border-border bg-surface px-3 py-2 text-xs shadow-raised">
                        <div className="mb-1 text-muted">{String(label)}</div>
                        {valued.map((r) => {
                          const v = payload[0].payload[r.option.id] as number;
                          return (
                            <div key={r.option.id} className="flex items-center gap-2">
                              <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: seriesColor(r.slot) }} />
                              <span className="font-semibold">{formatCad(v)}</span>
                              <span className="text-muted">{r.option.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {valued.map((r, i) => (
                  <Bar
                    key={r.option.id}
                    dataKey={r.option.id}
                    name={r.option.name}
                    stackId="cards"
                    fill={seriesColor(r.slot)}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    maxBarSize={24}
                    radius={i === valued.length - 1 ? [0, 4, 4, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="text-sm">
            <summary className="disclosure">Show as table</summary>
            <div className="mt-3 table-wrap">
            <table className="data-table min-w-[480px]">
              <thead>
                <tr>
                  <th>Category</th>
                  {valued.map((r) => (
                    <th key={r.option.id} className="px-3 py-2 text-right font-semibold">{r.option.name}</th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.name)}>
                    <td>{String(row.name)}</td>
                    {valued.map((r) => (
                      <td key={r.option.id} className="px-3 py-2 text-right">{formatCad(row[r.option.id] as number)}</td>
                    ))}
                    <td className="num font-semibold">{formatCad(row.total as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </details>
        </div>
      )}
      </div>
    </section>
  );
}
