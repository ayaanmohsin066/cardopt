"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, MotionConfig, useInView, useReducedMotion } from "motion/react";
import { DURATION, EASE, REVEAL_OFFSET } from "../lib/motion-tokens";

/**
 * Wraps the app. With reduced motion requested, Motion skips transform and
 * layout animations everywhere; the components below also skip their fades.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE.standard }}>
      {children}
    </MotionConfig>
  );
}

/** Fades a section in (opacity + a short rise) the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: REVEAL_OFFSET }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: DURATION.slow, ease: EASE.emphasized, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A number that counts to its value: from 0 the first time it's seen, then
 * from the previous value when it changes. Text updates go straight to the
 * DOM (no re-renders). Screen readers get only the final value.
 * Adapted from the 21st.dev "Number Ticker" (danielpetho): same
 * animate()-a-number approach, plus reduced motion, in-view start,
 * formatted values and no flash of the wrong figure.
 */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const shown = useRef<number | null>(null);
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = formatRef.current;
    if (reduce) {
      el.textContent = fmt(value);
      shown.current = value;
      return;
    }
    if (!inView) return;
    const from = shown.current ?? 0;
    if (from === value) {
      el.textContent = fmt(value);
      return;
    }
    const controls = animate(from, value, {
      duration: DURATION.counter,
      ease: EASE.emphasized,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v);
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = fmt(value);
      },
    });
    return () => controls.stop();
  }, [value, reduce, inView]);

  // React renders the text once (0, or the final value with reduced motion); the effect drives it from then on.
  return (
    <>
      <span ref={ref} aria-hidden className="print:hidden">
        {format(reduce ? value : 0)}
      </span>
      {/* The final value for screen readers, and for print (a figure never scrolled into view hasn't counted yet). */}
      <span className="sr-only print:not-sr-only">{format(value)}</span>
    </>
  );
}

/**
 * The fill of a meter or progress bar, drawn with scaleX (transform only, no
 * layout). Grows from 0 when it mounts, then eases to each new value.
 */
export function Bar({ fraction, className }: { fraction: number; className: string }) {
  const f = Math.min(1, Math.max(0, fraction));
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`h-full w-full origin-left ${className}`}
      initial={reduce ? false : { scaleX: 0 }}
      animate={{ scaleX: f }}
      transition={{ duration: DURATION.slow, ease: EASE.emphasized }}
    />
  );
}
