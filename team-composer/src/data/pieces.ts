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

/** Sorts a copy of `items` by point cost, ascending — used everywhere a piece list is shown to the user. */
export function sortByPunti<T extends { punti: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.punti - b.punti);
}

const PUNTI_BY_SIGLA = new Map(pieces.map((p) => [p.sigla, p.punti]));

/** Same ordering as sortByPunti, for lists that only carry a sigla (e.g. promotion/revival choices). */
export function sortSiglasByPunti(siglas: string[]): string[] {
  return [...siglas].sort((a, b) => (PUNTI_BY_SIGLA.get(a) ?? 0) - (PUNTI_BY_SIGLA.get(b) ?? 0));
}
