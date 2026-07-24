import piecesRaw from './pieces.json';
import type { Piece } from '../types';

export const pieces: Piece[] = piecesRaw;

export const BUDGET = 154;
export const MAX_PIECES_TOTAL = 16;
export const MIN_PIECES_TOTAL = 4;
export const MAX_IDENTICAL = 5;
export const MAX_PAWNS = 8;
export const KING_SIGLA = 'RE';
export const PAWN_SIGLE = ['PG', 'FG', 'PE'] as const;