import piecesRaw from './pieces.json';
import rulesRaw from './rules.json';
import type { Piece, Rules } from '../types';

export const pieces: Piece[] = piecesRaw as Piece[];
export const rules: Rules = rulesRaw as Rules;

export const BUDGET = rules.budget;
export const MAX_PIECES_TOTAL = rules.maxPiecesTotal;
export const MIN_PIECES_TOTAL = rules.minPiecesTotal;
export const KING_SIGLA = rules.kingSigla;
