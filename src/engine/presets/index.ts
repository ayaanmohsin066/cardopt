import { genericPreset } from "./generic";
import type { Preset } from "./types";
import { rbcPreset } from "./rbc";
import { tdPreset } from "./td";
import { scotiabankPreset } from "./scotiabank";
import { bmoPreset } from "./bmo";
import { cibcPreset } from "./cibc";
import { nationalBankPreset } from "./national-bank";
import { amexCanadaPreset } from "./amex-canada";
import { desjardinsPreset } from "./desjardins";

export * from "./types";
export { genericPreset } from "./generic";

/** Issuer-specific presets. Unverified ones fall back to manual mapping. */
export const ISSUER_PRESETS: readonly Preset[] = [rbcPreset, tdPreset, scotiabankPreset, bmoPreset, cibcPreset, nationalBankPreset, amexCanadaPreset, desjardinsPreset];

/** The preset for an issuer, or the generic preset if there isn't one. */
export function presetForIssuer(issuerId: string): Preset {
  return ISSUER_PRESETS.find((p) => p.issuer_id === issuerId) ?? genericPreset;
}

/**
 * True when the preset can prefill the columns: verified from a real export, or
 * cited to public documentation. Use `preset.verified` to tell the two apart.
 */
export function isUsablePreset(preset: Preset): boolean {
  return (preset.verified || preset.documented_by.length > 0) && preset.mapping !== null && preset.format !== null;
}
