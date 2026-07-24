import piecesData from './pezzi.json';
import type { Piece } from '../types';

const piecesRaw = piecesData as Piece[];
export const pieces = piecesRaw;
export { BUDGET, MAX_PIECES_TOTAL, MIN_PIECES_TOTAL, MAX_IDENTICAL, MAX_PAWNS, KING_SIGLA, PAWN_SIGLE } from './constants';