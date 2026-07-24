import piecesData from './pezzi.json';
import type { Piece } from '../types';

export const pieces: Piece[] = piecesData as Piece[];

export const BUDGET = 156;
export const MAX_PIECES_TOTAL = 16;
export const MIN_PIECES_TOTAL = 10;
export const MAX_IDENTICAL = 5;
export const MAX_PAWNS = 8;
export const KING_SIGLA = 'RE';

export const PAWN_SIGLE = ['PG', 'FG', 'PE'];