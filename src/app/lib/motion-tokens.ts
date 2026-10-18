/**
 * Motion tokens for Motion (JS animations). Mirrors the CSS tokens in
 * globals.css (--duration-*, --ease-*); keep the two in step.
 * Durations are in seconds, as Motion expects.
 */
export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  /** Number count-up in stat tiles. */
  counter: 0.7,
} as const;

/** cubic-bezier control points. */
export const EASE = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.16, 1, 0.3, 1],
} as const;

/** Distance (px) a section travels as it fades in. Transform only. */
export const REVEAL_OFFSET = 8;
