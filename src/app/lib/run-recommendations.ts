import {
  bestUseOfCards,
  bestWallet,
  type Applicant,
  type BestWalletResult,
  changeACard,
  sensitivity,
  type CardSetEntry,
  type CategorizedTransaction,
  type ChangeResult,
  type LpSolver,
  type SensitivityResult,
  type UseBetterResult,
} from "@/engine";

/*
 * The "Earn more" computation, independent of where it runs. The Web Worker
 * (src/app/workers/recommend.worker.ts) calls it with the browser solver; tests
 * call it with the Node solver. Pure: no I/O.
 */

export interface RecommendRequest {
  /** Increments per request; replies carry it so stale replies are ignored. */
  id: number;
  owned: CardSetEntry[];
  /** [card id, categorized statement lines] */
  items: [string, CategorizedTransaction[]][];
  catalogue: CardSetEntry[];
  /** Optional income for eligibility checks. In memory only: never persisted or logged. */
  applicant?: Applicant | null;
}

export interface RecommendResults {
  better: UseBetterResult;
  change: ChangeResult;
  sens: SensitivityResult | null;
  wallet: BestWalletResult;
}

export type Stage = "loading" | "your_cards" | "comparing" | "sensitivity" | "wallet";

export type WorkerMessage =
  | { id: number; type: "progress"; stage: Stage; done: number; total: number }
  | { id: number; type: "result"; results: RecommendResults }
  | { id: number; type: "error"; message: string };

export function runRecommendations(
  req: Omit<RecommendRequest, "id">,
  solver: LpSolver,
  progress: (stage: Stage, done: number, total: number) => void = () => {},
): RecommendResults {
  const itemsByCard = new Map(req.items);
  progress("your_cards", 0, 1);
  const better = bestUseOfCards(req.owned, itemsByCard, solver);
  progress("your_cards", 1, 1);
  const change = changeACard(req.owned, itemsByCard, req.catalogue, solver, {
    onProgress: (d, t) => progress("comparing", d, t),
  });
  const top = change.changes.slice(0, 3);
  const sens = top.length > 1
    ? sensitivity(top, req.owned, itemsByCard, req.catalogue, solver, (d, t) => progress("sensitivity", d, t))
    : null;
  progress("wallet", 0, 1);
  const wallet = bestWallet(req.owned, itemsByCard, req.catalogue, solver, { applicant: req.applicant ?? null });
  progress("wallet", 1, 1);
  return { better, change, sens, wallet };
}
