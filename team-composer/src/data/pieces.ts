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
