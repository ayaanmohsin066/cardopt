"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "../lib/motion-tokens";

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys move between tabs,
 * Home/End jump to the ends, only the selected tab is in the tab order.
 * The underline slides to the selected tab and the panel fades in
 * (transform and opacity only; skipped with reduced motion).
 */
export function Tabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
        : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
          : e.key === "Home" ? 0
            : e.key === "End" ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border" onKeyDown={onKey}>
        {tabs.map((t, i) => {
          const selected = i === index;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={`relative -mb-px rounded-t-control px-3 pt-2 pb-2.5 text-sm transition-colors duration-(--duration-fast) ${selected ? "font-medium text-foreground" : "text-muted hover:text-foreground"}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
              {selected && (
                <motion.span
                  aria-hidden
                  layoutId={`${base}-underline`}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent"
                  transition={{ duration: DURATION.base, ease: EASE.emphasized }}
                />
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={i !== index}
          tabIndex={0}
          className="focus:outline-none"
        >
          {i === index && (
            <motion.div
              key={t.id}
              className="flex flex-col gap-6"
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.standard }}
            >
              {t.content}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}
