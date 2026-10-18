"use client";

import { AnimatedNumber } from "./motion";

interface Props {
  label: string;
  /** Shown as is when there's no number to animate (e.g. "Not yet verified"). */
  value: string;
  /** The number behind `value`. When given, the figure counts to it. */
  amount?: number | null;
  format?: (n: number) => string;
  sub?: string;
  /** Large headline figure (one per view). */
  hero?: boolean;
  /** Text colour class for the figure, e.g. "text-gain". */
  tone?: string;
}

export function StatTile({ label, value, amount, format, sub, hero = false, tone = "" }: Props) {
  const figure = amount !== undefined && amount !== null && format ? <AnimatedNumber value={amount} format={format} /> : value;
  return (
    <div className={`inset flex min-w-0 flex-col ${hero ? "gap-2.5 px-5 py-5 sm:px-6 sm:py-6" : "gap-1.5 px-4 py-3.5"}`}>
      <span className="eyebrow">{label}</span>
      <span className={`${hero ? "figure-hero" : "text-xl font-semibold tracking-tight tabular-nums"} ${tone}`}>{figure}</span>
      {sub && <span className="text-xs leading-relaxed text-muted">{sub}</span>}
    </div>
  );
}
