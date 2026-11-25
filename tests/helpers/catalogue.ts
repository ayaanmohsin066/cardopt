// The real card catalogue (src/data), as the app loads it, for the claims gate.
import { join } from "node:path";
import { validateCard, validateProgram, type CardSetEntry, type Program } from "@/engine";
import { DATA_DIR, loadCardFiles, loadProgramFiles } from "./data-files";

export function realPrograms(): Map<string, Program> {
  const out = new Map<string, Program>();
  for (const f of loadProgramFiles(join(DATA_DIR, "programs"))) {
    const r = validateProgram(f.json);
    if (r.ok) out.set(r.program.id, r.program);
  }
  return out;
}

/** Every valid card in src/data/cards with its program (invalid files are reported by tests/data). */
export function realCatalogue(): CardSetEntry[] {
  const programs = realPrograms();
  return loadCardFiles(join(DATA_DIR, "cards")).flatMap((f) => {
    const r = validateCard(f.json);
    if (!r.ok) return [];
    return [{ card: r.card, program: r.card.program_id ? programs.get(r.card.program_id) ?? null : null }];
  });
}
