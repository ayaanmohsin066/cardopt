import type { Preset } from "./types";

/**
 * From public third-party documentation, not a real sample export, so
 * `verified` stays false. Columns, month-first dates and one signed CAD$ column
 * with money out negative: invoicedataextraction.com (updated 2026-11-18).
 * Card charges negative: sproute.pages.dev (verified March 2026).
 * shortcut: "Description 2" is ignored and USD$ isn't read as foreign; revisit with a real export.
 */
export const rbcPreset: Preset = {
  id: "rbc",
  issuer_id: "rbc",
  label: "RBC",
  verified: false,
  documented_by: [
    "https://invoicedataextraction.com/blog/rbc-bank-statement-to-excel",
    "https://sproute.pages.dev/guides/rbc",
  ],
  mapping: {
    date: "Transaction Date",
    description: "Description 1",
    amount: "CAD$",
    debit: null,
    credit: null,
    currency: null,
    foreign_amount: null,
    exchange_rate: null,
  },
  format: { has_header: true, date_format: "MM/DD/YYYY", decimal_separator: ".", purchase_sign: "negative" },
  notes: "RBC layout from public documentation, not yet checked against a real export. Check the columns below before importing.",
};
