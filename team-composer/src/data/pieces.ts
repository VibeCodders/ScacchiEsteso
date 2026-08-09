import piecesRaw from './pieces.json';
import rulesRaw from './rules.json';
import type { Piece, Rules } from '../types';

export const pieces: Piece[] = piecesRaw as Piece[];
export const rules: Rules = rulesRaw as Rules;

/** Pieces selectable during team-building — excludes pieces only obtainable via in-game promotion (e.g. Damone). */
export const pickablePieces: Piece[] = pieces.filter((p) => !p.obtainableOnlyViaPromotion);

export const BUDGET = rules.budget;
export const MAX_PIECES_TOTAL = rules.maxPiecesTotal;
export const KING_SIGLA = rules.kingSigla;

/**
 * Sorts a copy of `items` by point cost, ascending, then by sigla — used everywhere a piece list
 * is shown to the user. The sigla is the tie-breaker (never used as the primary key) precisely
 * because it's always unique, so it makes the order fully deterministic instead of depending on
 * each piece's incidental position in pieces.json.
 */
export function sortByPunti<T extends { punti: number; sigla: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.punti - b.punti || a.sigla.localeCompare(b.sigla));
}

const PIECE_BY_SIGLA = new Map(pieces.map((p) => [p.sigla, p]));

/** Same ordering as sortByPunti, for lists that only carry a sigla (e.g. promotion/revival choices). */
export function sortSiglasByPunti(siglas: string[]): string[] {
  return [...siglas].sort((a, b) => {
    const puntiA = PIECE_BY_SIGLA.get(a)?.punti ?? 0;
    const puntiB = PIECE_BY_SIGLA.get(b)?.punti ?? 0;
    return puntiA - puntiB || a.localeCompare(b);
  });
}
