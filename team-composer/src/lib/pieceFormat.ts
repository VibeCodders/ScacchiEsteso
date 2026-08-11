import { ACTION_LABELS } from '../data/actionLabels';
import { pieces } from '../data/pieces';
import type { Piece } from '../types';

/**
 * Shared formatting/derivation helpers for piece data — the cost tiers, movement quirks and
 * special-action labels used by every piece surface (roster, encyclopedia, deployment) live here
 * instead of being re-declared per screen.
 */

/** Tailwind badge classes for a piece's punti cost, mirroring the old cost-free/low/med/high tiers. */
export function costTierClass(cost: number): string {
  if (cost === 0) return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400';
  if (cost <= 10) return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  if (cost <= 25) return 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400';
  return 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400';
}

/** Movement/capture quirks and the Golem's armatura — special ACTIONS come from `alternativeActions` below. */
const FLAG_LABELS: Record<string, string> = {
  saltaInterposizioni: 'Salta interposizioni',
  catturaSoloInMischia: 'Solo mischia',
  catturaADistanza: 'A distanza',
  armatura: 'Armatura',
};

/** Human-readable labels for a piece's boolean quirk flags (e.g. "Salta interposizioni"). */
export function activeFlags(piece: Piece): string[] {
  const flags: string[] = [];
  for (const [key, label] of Object.entries(FLAG_LABELS)) {
    if (piece[key as keyof Piece]) flags.push(label);
  }
  return flags;
}

/** Special-action badges, one per `alternativeActions` entry, labeled like the encyclopedia's "Azioni speciali". */
export function actionBadges(piece: Piece): string[] {
  return piece.alternativeActions.map((action) => ACTION_LABELS[action.type] ?? action.type);
}

/** All badge labels shown on a piece card, in a stable order. */
export function pieceBadges(piece: Piece): string[] {
  return [...activeFlags(piece), ...actionBadges(piece)];
}

/** Human-readable description of a sigla, falling back to the sigla itself. */
export function pieceDescription(sigla: string): string {
  return pieces.find((p) => p.sigla === sigla)?.descrizione ?? sigla;
}
