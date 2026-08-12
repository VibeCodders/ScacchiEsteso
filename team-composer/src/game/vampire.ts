import type { Piece } from '../types';
import { DEFAULT_BOARD_DIMENSIONS, type BoardDimensions, type BoardState, type Coord } from './board';
import { emptyAdjacentCoords } from './directions';

/** The piece a captured enemy is transformed into by the Vampiro Lunare's Sete di Sangue. */
export const GHOUL_SIGLA = 'GH';

/** True only for the Vampiro Lunare (VL): its melee capture converts the enemy instead of
 *  eliminating it (README — Sete di Sangue). Drives the capture resolution in turnManager. */
export function canConvertOnCapture(pieceDef: Piece): boolean {
  return Boolean(pieceDef.vampirismo);
}

/**
 * Free squares where a converted enemy may materialize as an allied Ghoul: the 8 squares adjacent
 * to the captured piece's square that are on the board and empty. The board is expected to be the
 * state AFTER the capture (the capturer now occupies the captured square, so its own landing
 * square is naturally excluded, while the capturer's old square — if adjacent — is available).
 * An empty list means no Ghoul can be placed: the capture then resolves normally.
 */
export function getGhoulPlacementSquares(
  board: BoardState,
  capturedCoord: Coord,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Coord[] {
  return emptyAdjacentCoords(board, capturedCoord, dimensions);
}
